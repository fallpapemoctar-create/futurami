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

function buildDateTimeFromParts(?string $date, ?string $time): ?DateTime {
    if ($date === null || $date === '') {
        return null;
    }
    $timePart = ($time !== null && $time !== '') ? $time : '00:00';
    $candidates = [
        trim($date . ' ' . $timePart),
        trim($date . 'T' . $timePart),
    ];
    foreach ($candidates as $candidate) {
        if ($candidate === '') {
            continue;
        }
        try {
            $dt = new DateTime($candidate);
            return $dt;
        } catch (Exception $e) {
            continue;
        }
    }
    return null;
}

function resolveDefaultUserId(PDO $pdo): ?int {
    static $cachedUserId = null;
    if ($cachedUserId !== null) {
        return $cachedUserId;
    }
    try {
        $stmt = $pdo->query("SELECT rowid FROM llx_user ORDER BY rowid ASC LIMIT 1");
        $val = $stmt->fetchColumn();
        if ($val !== false && $val !== null) {
            $cachedUserId = (int)$val;
            return $cachedUserId;
        }
    } catch (Exception $e) {
        // ignore, fallback below
    }
    return null;
}

function generateMissionReference(PDO $pdo, string $prefix = 'PROV', int $padLength = 5): string {
    $prefix = preg_replace('/[^A-Z0-9]/i', '', $prefix);
    if ($prefix === '') {
        $prefix = 'PROV';
    }
    $padLength = max(3, min(12, $padLength));
    $startPos = strlen($prefix) + 1; // SUBSTRING is 1-indexed
    $pattern = $prefix . '%';
    $regex = '^' . preg_quote($prefix, '/') . '[0-9]+$';
    $nextNumeric = 1;

    try {
        $sql = "SELECT MAX(CAST(SUBSTRING(ref, $startPos) AS UNSIGNED)) AS max_num\n                FROM llx_missionsplanet_mission\n                WHERE ref LIKE :pattern AND ref REGEXP :regex";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':pattern' => $pattern, ':regex' => $regex]);
        $maxNum = $stmt->fetchColumn();
        if ($maxNum !== false && $maxNum !== null) {
            $nextNumeric = (int)$maxNum + 1;
        }
    } catch (Exception $e) {
        $nextNumeric = 1;
    }

    $attempts = 0;
    do {
        $candidate = $prefix . str_pad((string)$nextNumeric, $padLength, '0', STR_PAD_LEFT);
        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM llx_missionsplanet_mission WHERE ref = :ref");
        $stmtCheck->execute([':ref' => $candidate]);
        if ((int)$stmtCheck->fetchColumn() === 0) {
            return $candidate;
        }
        $nextNumeric++;
        $attempts++;
    } while ($attempts < 50);

    // Fallback: include timestamp chunk to avoid collisions if something unexpected happens
    $fallbackNumber = substr((string)time(), -$padLength);
    return $prefix . str_pad($fallbackNumber, $padLength, '0', STR_PAD_LEFT);
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

    $interpreterId = isset($data['interpreter_id']) ? (int)$data['interpreter_id'] : 0;
    $clientId = isset($data['client_id']) ? (int)$data['client_id'] : null;
    $contactId = isset($data['contact_id']) ? (int)$data['contact_id'] : null;
    $commentaires = array_key_exists('commentaires', $data)
        ? trim((string)$data['commentaires'])
        : null;
    $ref = isset($data['reference_devis']) ? trim($data['reference_devis']) : '';
    if ($ref === '') {
        $ref = generateMissionReference($pdo);
    }
    $produitRef = isset($data['id_produit_service']) ? (int)$data['id_produit_service'] : null;
    if (!$produitRef && isset($data['produit_ref'])) {
        $rawProduit = trim($data['produit_ref']);
        if ($rawProduit !== '') {
            // Try matching by ref first
            $stmtProd = $pdo->prepare("SELECT rowid FROM llx_product WHERE ref = :ref LIMIT 1");
            $stmtProd->execute([':ref' => $rawProduit]);
            $row = $stmtProd->fetch();
            if ($row && isset($row['rowid'])) {
                $produitRef = (int)$row['rowid'];
            } else {
                // Fallback: attempt resolving by label when ref is empty
                $stmtProd = $pdo->prepare("SELECT rowid FROM llx_product WHERE label = :label LIMIT 1");
                $stmtProd->execute([':label' => $rawProduit]);
                $row = $stmtProd->fetch();
                if ($row && isset($row['rowid'])) {
                    $produitRef = (int)$row['rowid'];
                }
            }
        }
    }

    $debut = isset($data['debutmission']) ? trim($data['debutmission']) : null; // yyyy-mm-dd
    $fin = isset($data['finmission']) ? trim($data['finmission']) : null;       // yyyy-mm-dd
    $tarifHoraire = isset($data['tarif_horaire']) ? (float)$data['tarif_horaire'] : 0.0;
    $paid = isset($data['status_payment']) ? (int)$data['status_payment'] : 0;
    $label = isset($data['label']) ? trim($data['label']) : null;
    $datemission = isset($data['datemission']) ? trim($data['datemission']) : null;
    $heureDebutMission = isset($data['heuredebutmission']) ? trim($data['heuredebutmission']) : null;
    $dureeMission = (isset($data['dureemission']) && $data['dureemission'] !== '') ? (int)$data['dureemission'] : null;
    $missionStatus = isset($data['mission_status']) ? (int)$data['mission_status'] : 1;
    $missionTypes = sanitizeMissionTypes($data['mission_types'] ?? []);
    $missionTypesJson = json_encode($missionTypes, JSON_UNESCAPED_UNICODE);
    if ($missionTypesJson === false) {
        $missionTypesJson = json_encode([]);
    }
    $creatorId = isset($data['creator_id']) ? (int)$data['creator_id'] : null;

    $hasLabelColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'label');
    $hasMissionTypesColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'mission_types');
    $hasDateCreationColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'date_creation');
    $hasDateMissionColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'datemission');
    $hasHeureMissionColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'heuredebutmission');
    $hasDureeMissionColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'dureemission');
    $hasClientColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'fk_soc');
    $hasContactColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'contactdemandeur');
    $hasDescriptionColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'description');
    $hasMontantColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'montant_mission');
    $hasStatusPaymentColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'status_payment');
    $creatorColumn = null;
    foreach (['fk_user_creat', 'fk_user_creator', 'fk_user_create'] as $candidate) {
        if (columnExists($pdo, 'llx_missionsplanet_mission', $candidate)) {
            $creatorColumn = $candidate;
            break;
        }
    }

    if ($interpreterId <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "interpreter_id requis"]);
        exit;
    }

    // S'assure que llx_missionsplanet_mission a bien sa colonne entity propre
    // (auto-réparateur : backfill DEFAULT 1 sur les lignes existantes si besoin).
    ensureMissionEntityColumn($pdo);

    // Cloisonnement multi-entités : l'interprète assigné doit appartenir à l'entité courante.
    $chkInterp = $pdo->prepare("SELECT 1 FROM llx_user WHERE rowid = :id AND entity = :entity LIMIT 1");
    $chkInterp->execute([':id' => $interpreterId, ':entity' => $currentEntity]);
    if (!$chkInterp->fetchColumn()) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Interprète hors entité"]);
        exit;
    }

    // Derive planning fields when only date/heure/durée provided
    if (!$debut && $datemission) {
        $startDt = buildDateTimeFromParts($datemission, $heureDebutMission);
        if ($startDt) {
            $debut = $startDt->format('Y-m-d H:i:s');
            if (!$fin && $dureeMission !== null) {
                $endDt = clone $startDt;
                $endDt->modify('+' . $dureeMission . ' minutes');
                $fin = $endDt->format('Y-m-d H:i:s');
            }
        }
    }
    if (!$fin && $debut && $dureeMission !== null) {
        try {
            $startDt = new DateTime($debut);
            $startDt->modify('+' . $dureeMission . ' minutes');
            $fin = $startDt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            // ignore
        }
    }
    if (!$fin && $debut) {
        $fin = $debut;
    }

    // Compute montant if possible (only when column exists)
    $montant = null;
    if ($hasMontantColumn && $debut && $fin && $tarifHoraire > 0) {
        $debutTs = strtotime($debut);
        $finTs = strtotime($fin);
        if ($debutTs && $finTs && $finTs > $debutTs) {
            $hours = ($finTs - $debutTs) / 3600.0;
            $montant = $tarifHoraire * $hours;
        } else {
            $montant = 0.0;
        }
    }

    $columns = [
        'entity'          => ':entity',
        'nominterprete'   => ':nominterprete',
        'ref'             => ':ref',
        'debutmission'    => ':debutmission',
        'finmission'      => ':finmission',
        'langue'          => ':langue',
        'status'          => ':status',
    ];
    $params = [
        ':entity'          => $currentEntity,
        ':nominterprete'   => $interpreterId,
        ':ref'             => $ref,
        ':debutmission'    => $debut,
        ':finmission'      => $fin,
        ':langue'          => $produitRef,
        ':status'          => $missionStatus,
    ];

    if ($hasMontantColumn) {
        $columns['montant_mission'] = ':montant_mission';
        $params[':montant_mission'] = $montant ?? 0.0;
    }
    if ($hasStatusPaymentColumn) {
        $columns['status_payment'] = ':status_payment';
        $params[':status_payment'] = $paid;
    }

    if ($hasClientColumn) {
        $columns['fk_soc'] = ':fk_soc';
        $params[':fk_soc'] = $clientId && $clientId > 0 ? $clientId : null;
    }
    if ($hasContactColumn) {
        $columns['contactdemandeur'] = ':contactdemandeur';
        $params[':contactdemandeur'] = $contactId && $contactId > 0 ? $contactId : 0;
    }

    if ($hasLabelColumn) {
        $columns['label'] = ':label';
        $params[':label'] = $label;
    }
    if ($hasDateCreationColumn) {
        $columns['date_creation'] = ':date_creation';
        $params[':date_creation'] = date('Y-m-d H:i:s');
    }
    if ($hasDateMissionColumn) {
        $columns['datemission'] = ':datemission';
        $params[':datemission'] = $datemission;
    }
    if ($hasHeureMissionColumn) {
        $columns['heuredebutmission'] = ':heuredebutmission';
        $params[':heuredebutmission'] = $heureDebutMission;
    }
    if ($hasDureeMissionColumn) {
        $columns['dureemission'] = ':dureemission';
        $params[':dureemission'] = $dureeMission;
    }
    if ($hasMissionTypesColumn) {
        $columns['mission_types'] = ':mission_types';
        $params[':mission_types'] = $missionTypesJson;
    }
    if ($hasDescriptionColumn) {
        $columns['description'] = ':description';
        $params[':description'] = ($commentaires !== null && $commentaires !== '') ? $commentaires : null;
    }
    if ($creatorColumn !== null) {
        $assignedCreatorId = $creatorId;
        if ($assignedCreatorId === null || $assignedCreatorId <= 0) {
            $assignedCreatorId = resolveDefaultUserId($pdo);
        }
        if ($assignedCreatorId !== null && $assignedCreatorId > 0) {
            $columns[$creatorColumn] = ':creator_id';
            $params[':creator_id'] = $assignedCreatorId;
        }
    }

    $sql = "INSERT INTO llx_missionsplanet_mission (" . implode(', ', array_keys($columns)) . ") VALUES (" . implode(', ', array_values($columns)) . ")";
    $stmt = $pdo->prepare($sql);
    $ok = $stmt->execute($params);
    $insertedId = $ok ? (int)$pdo->lastInsertId() : 0;

    echo json_encode([
        "success" => $ok,
        "id" => $insertedId > 0 ? $insertedId : null,
        "ref" => $ref,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
