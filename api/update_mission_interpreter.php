<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
require_once "config.php";
require_once __DIR__ . "/billing_helpers.php";

function columnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $table = str_replace('`', '', $table);
        $column = str_replace('`', '', $column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
        return $stmt && $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

function sanitizeMissionTypes($value): array {
    $source = [];
    if (is_array($value)) {
        $source = $value;
    } elseif (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $source = $decoded;
        } else {
            $source = explode(',', $value);
        }
    } elseif ($value === null || $value === '') {
        return [];
    } else {
        $source = [$value];
    }

    $result = [];
    foreach ($source as $item) {
        if (is_array($item)) {
            $item = implode(' ', $item);
        }
        $str = trim((string)$item);
        if ($str === '') {
            continue;
        }
        if (!isset($result[$str])) {
            $result[$str] = true;
        }
    }

    return array_keys($result);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
        exit;
    }

    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "id requis"]);
        exit;
    }

    // S'assure que llx_missionsplanet_mission a bien sa colonne entity propre
    // (auto-réparateur : backfill DEFAULT 1 sur les lignes existantes si besoin).
    ensureMissionEntityColumn($pdo);

    // Cloisonnement multi-entités : filtre direct sur m.entity, quelle que soit
    // l'entité courante (générique, pas seulement entity=2).
    $chkMission = $pdo->prepare(
        "SELECT 1 FROM llx_missionsplanet_mission m
         WHERE m.rowid = :id AND m.entity = :entity LIMIT 1"
    );
    $chkMission->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$chkMission->fetchColumn()) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Mission introuvable"]);
        exit;
    }

    // Si un nouvel interprète est fourni, il doit lui aussi appartenir à l'entité courante.
    if (isset($data['interpreter_id'])) {
        $newInterpreterId = (int)$data['interpreter_id'];
        $chkInterp = $pdo->prepare("SELECT 1 FROM llx_user WHERE rowid = :id AND entity = :entity LIMIT 1");
        $chkInterp->execute([':id' => $newInterpreterId, ':entity' => $currentEntity]);
        if (!$chkInterp->fetchColumn()) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Interprète hors entité"]);
            exit;
        }
    }

    $fields = [];
    $params = [':id' => $id];
    $hasLabelColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'label');
    $hasMissionTypesColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'mission_types');
    $hasClientColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'fk_soc');
    $hasContactColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'contactdemandeur');
    $hasDescriptionColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'description');
    $hasMontantColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'montant_mission');
    $hasStatusPaymentColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'status_payment');
    $modifierColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'fk_user_modif') ? 'fk_user_modif' : null;

    if (isset($data['interpreter_id'])) { $fields[] = 'nominterprete = :nominterprete'; $params[':nominterprete'] = (int)$data['interpreter_id']; }
    if (isset($data['reference_devis'])) { $fields[] = 'ref = :ref'; $params[':ref'] = trim($data['reference_devis']); }
    if (isset($data['debutmission'])) { $fields[] = 'debutmission = :debutmission'; $params[':debutmission'] = trim($data['debutmission']); }
    if (isset($data['finmission'])) { $fields[] = 'finmission = :finmission'; $params[':finmission'] = trim($data['finmission']); }
    if ($hasStatusPaymentColumn && isset($data['status_payment'])) { $fields[] = 'status_payment = :status_payment'; $params[':status_payment'] = (int)$data['status_payment']; }
    if ($hasLabelColumn && array_key_exists('label', $data)) { $fields[] = 'label = :label'; $params[':label'] = trim((string)$data['label']); }

    // Raw mission fields
    if (isset($data['datemission'])) { $fields[] = 'datemission = :datemission'; $params[':datemission'] = trim($data['datemission']); }
    if (isset($data['heuredebutmission'])) { $fields[] = 'heuredebutmission = :heuredebutmission'; $params[':heuredebutmission'] = trim($data['heuredebutmission']); }
    if (isset($data['dureemission'])) { $fields[] = 'dureemission = :dureemission'; $params[':dureemission'] = (int)$data['dureemission']; }
    if (isset($data['mission_status'])) { $fields[] = 'status = :status'; $params[':status'] = (int)$data['mission_status']; }

    // langue/product
    if (isset($data['id_produit_service'])) { $fields[] = 'langue = :langue'; $params[':langue'] = (int)$data['id_produit_service']; }
    else if (isset($data['produit_ref'])) {
        $rawProduit = trim((string)$data['produit_ref']);
        $stmtProd = $pdo->prepare("SELECT rowid FROM llx_product WHERE ref = :ref LIMIT 1");
        $stmtProd->execute([':ref' => $rawProduit]);
        $row = $stmtProd->fetch();
        if (!$row || !isset($row['rowid'])) {
            $stmtProd = $pdo->prepare("SELECT rowid FROM llx_product WHERE label = :label LIMIT 1");
            $stmtProd->execute([':label' => $rawProduit]);
            $row = $stmtProd->fetch();
        }
        if ($row && isset($row['rowid'])) { $fields[] = 'langue = :langue'; $params[':langue'] = (int)$row['rowid']; }
    }

    if ($hasMissionTypesColumn && array_key_exists('mission_types', $data)) {
        $missionTypes = sanitizeMissionTypes($data['mission_types']);
        $missionTypesJson = json_encode($missionTypes, JSON_UNESCAPED_UNICODE);
        if ($missionTypesJson === false) {
            $missionTypesJson = json_encode([]);
        }
        $fields[] = 'mission_types = :mission_types';
        $params[':mission_types'] = $missionTypesJson;
    }

    if ($hasClientColumn && array_key_exists('client_id', $data)) {
        $fields[] = 'fk_soc = :fk_soc';
        $params[':fk_soc'] = (int)$data['client_id'] > 0 ? (int)$data['client_id'] : null;
    }

    if ($hasContactColumn && array_key_exists('contact_id', $data)) {
        $fields[] = 'contactdemandeur = :contactdemandeur';
        $params[':contactdemandeur'] = (int)$data['contact_id'] > 0 ? (int)$data['contact_id'] : 0;
    }

    if ($hasDescriptionColumn && array_key_exists('commentaires', $data)) {
        $fields[] = 'description = :description';
        $comment = trim((string)$data['commentaires']);
        $params[':description'] = $comment !== '' ? $comment : null;
    }
    if ($modifierColumn !== null && isset($data['modifier_id'])) {
        $fields[] = "$modifierColumn = :modifier_id";
        $params[':modifier_id'] = (int)$data['modifier_id'];
    }

    // montant_mission recompute if tarif provided and dates available
    $tarifHoraire = isset($data['tarif_horaire']) ? (float)$data['tarif_horaire'] : null;
    if ($hasMontantColumn && $tarifHoraire !== null) {
        // We need debut and fin; if not provided in payload, fetch current values
        $stmtCurrent = $pdo->prepare("SELECT debutmission, finmission FROM llx_missionsplanet_mission WHERE rowid = :id");
        $stmtCurrent->execute([':id' => $id]);
        $cur = $stmtCurrent->fetch();
        $debut = isset($params[':debutmission']) ? $params[':debutmission'] : ($cur['debutmission'] ?? null);
        $fin = isset($params[':finmission']) ? $params[':finmission'] : ($cur['finmission'] ?? null);
        $montant = 0.0;
        if ($debut && $fin) {
            $dt1 = strtotime($debut); $dt2 = strtotime($fin);
            if ($dt1 && $dt2 && $dt2 > $dt1) {
                $hours = ($dt2 - $dt1) / 3600.0;
                $montant = $tarifHoraire * $hours;
            }
        }
        $fields[] = 'montant_mission = :montant_mission';
        $params[':montant_mission'] = $montant;
    }

    if (empty($fields)) {
        echo json_encode(["success" => false, "message" => "Aucun champ à mettre à jour"]);
        exit;
    }

    // Garde-fou final : la clause entity dans le WHERE empêche de modifier une
    // ligne d'une autre entité même si un id valide d'une autre entité fuitait
    // jusqu'ici (défense en profondeur, générique quelle que soit l'entité).
    $params[':entity'] = $currentEntity;
    $sql = "UPDATE llx_missionsplanet_mission SET " . implode(', ', $fields) . " WHERE rowid = :id AND entity = :entity";
    $stmt = $pdo->prepare($sql);
    $ok = $stmt->execute($params);

    echo json_encode(["success" => $ok]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
