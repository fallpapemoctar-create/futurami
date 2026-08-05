<?php
/**
 * create_quote_from_mission.php
 * AMI v1.4 — Module Devis
 *
 * Crée un devis pré-rempli depuis une mission existante (RM-01).
 * Vérifie qu'aucun devis actif (draft/sent) n'existe déjà pour cette mission (RM-02).
 *
 * POST { mission_id: int, user_id: int }
 * → 201 { quote_id: int, status: "draft_created" }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Méthode non autorisée']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide']);
}

$missionId = isset($input['mission_id']) ? (int) $input['mission_id'] : 0;
$userId    = isset($input['user_id'])    ? (int) $input['user_id']    : null;

if ($missionId <= 0) {
    respond(400, ['success' => false, 'error' => 'mission_id requis']);
}

try {
    ensureInvoiceDraftTable($pdo);

    // ---------------------------------------------------------------
    // 1. Charger la mission
    // ---------------------------------------------------------------
    $stmtM = $pdo->prepare("
        SELECT
            m.rowid         AS mission_id,
            m.ref               AS mission_ref,
            m.fk_soc            AS client_id,
            s.nom               AS client_name,
            m.datemission,
            m.dureemission,
            m.heuredebutmission,
            m.description       AS commentaires,
            socp.lastname       AS nom_demandeur,
            socp.firstname      AS prenom_demandeur,
            p.label             AS produit_label,
            p.ref               AS produit_ref,
            p.price             AS produit_price,
            p.tva_tx            AS produit_tva_tx
        FROM llx_missionsplanet_mission m
        LEFT JOIN llx_societe   s    ON s.rowid    = m.fk_soc
        LEFT JOIN llx_product   p    ON p.rowid    = m.langue
        LEFT JOIN llx_socpeople socp ON socp.rowid = m.contactdemandeur
        LEFT JOIN llx_user      iu   ON iu.rowid   = m.nominterprete
        WHERE m.rowid = :id
          AND (s.entity = :entity OR iu.entity = :entity)
        LIMIT 1
    ");
    $stmtM->execute([':id' => $missionId, ':entity' => $currentEntity]);
    $mission = $stmtM->fetch();

    if (!$mission) {
        respond(404, ['success' => false, 'error' => 'Mission introuvable']);
    }

    // ---------------------------------------------------------------
    // 2. CT-09 — Vérifier que la mission n'est pas déjà facturée
    // ---------------------------------------------------------------
    $stmtBilled = $pdo->prepare("
        SELECT invoice_number FROM tble_client_billed
        WHERE mission_ref = :ref AND entity = :entity
        LIMIT 1
    ");
    $stmtBilled->execute([':ref' => $mission['mission_ref'], ':entity' => $currentEntity]);
    if ($stmtBilled->fetchColumn()) {
        respond(409, [
            'success' => false,
            'error'   => 'Cette mission est déjà facturée. Impossible de créer un devis.',
            'code'    => 'MISSION_ALREADY_BILLED',
        ]);
    }

    // ---------------------------------------------------------------
    // 3. RM-02 — Vérifier l'absence de devis actif pour cette mission
    // ---------------------------------------------------------------
    $stmtCheck = $pdo->prepare("
        SELECT id FROM invoice_draft
        WHERE mission_id = :mid
          AND entity = :entity
          AND status IN ('draft', 'sent')
        LIMIT 1
    ");
    $stmtCheck->execute([':mid' => $missionId, ':entity' => $currentEntity]);
    $existing = $stmtCheck->fetchColumn();
    if ($existing) {
        respond(409, [
            'success'  => false,
            'error'    => 'Un devis actif existe déjà pour cette mission',
            'quote_id' => (int) $existing,
            'code'     => 'QUOTE_ALREADY_EXISTS',
        ]);
    }

    // ---------------------------------------------------------------
    // 3. Calculer quantité et prix unitaire (même règle que billing_page)
    // ---------------------------------------------------------------
    $dureeMins = 0;
    if (!empty($mission['dureemission'])) {
        $raw = trim($mission['dureemission']);
        if (preg_match('/^(\d+):(\d+)/', $raw, $m2)) {
            $dureeMins = (int)$m2[1] * 60 + (int)$m2[2];
        } elseif (is_numeric($raw)) {
            $dureeMins = (int)$raw;
        }
    }

    // Quantize minutes → heures (paliers 15/30/60/ceil-15)
    function quantizeMinutes(int $mins): float {
        if ($mins <= 0)  return 0;
        if ($mins <= 15) return 15;
        if ($mins <= 30) return 30;
        if ($mins <= 60) return 60;
        return 15 * ceil($mins / 15);
    }
    $quantity  = $dureeMins > 0 ? round(quantizeMinutes($dureeMins) / 60, 4) : 1.0;
    $unitPrice = $mission['produit_price'] !== null ? (float)$mission['produit_price'] : 0.0;
    $tvaRate   = $mission['produit_tva_tx'] !== null ? (float)$mission['produit_tva_tx'] : 0.0;
    $total     = round($unitPrice * $quantity, 2);

    $description = $mission['produit_label'] ?? $mission['produit_ref'] ?? '';
    if (!$description && !empty($mission['commentaires'])) {
        $description = mb_substr($mission['commentaires'], 0, 255);
    }
    if (!$description) {
        $description = 'Mission';
    }

    // Construire la désignation complète (même logique que billing_page _designationFor)
    $parts = [$description];

    // Date
    $dateMission = $mission['datemission'] ?? null;
    if ($dateMission) {
        $d = DateTime::createFromFormat('Y-m-d H:i:s', $dateMission)
          ?: DateTime::createFromFormat('Y-m-d', substr($dateMission, 0, 10));
        $parts[] = 'Date : ' . ($d ? $d->format('d/m/Y') : '-');
    } else {
        $parts[] = 'Date : -';
    }

    // Heure début – fin (calculée depuis heuredebutmission + dureemission)
    $hDebut = $mission['heuredebutmission'] ?? null;
    $hLabel = '-';
    if ($hDebut) {
        $tDebut = strtotime($hDebut);
        $hDebutStr = $tDebut !== false ? date('H:i', $tDebut) : substr($hDebut, 0, 5);
        if ($dureeMins > 0 && $tDebut !== false) {
            $tFin = $tDebut + ($dureeMins * 60);
            $hLabel = $hDebutStr . ' - ' . date('H:i', $tFin);
        } else {
            $hLabel = $hDebutStr;
        }
    }
    $parts[] = 'Heure : ' . $hLabel;

    // Durée
    $durLabel = '';
    if ($dureeMins > 0) {
        $durLabel = ($dureeMins % 60 === 0)
            ? (($dureeMins / 60) . 'h')
            : ($dureeMins . ' min');
    }
    $parts[] = 'Durée : ' . $durLabel;

    // Demandeur
    $prenom = trim((string)($mission['prenom_demandeur'] ?? ''));
    $nom    = trim((string)($mission['nom_demandeur']    ?? ''));
    $demandeur = trim("$prenom $nom");
    $parts[] = 'Demandeur : ' . ($demandeur ?: '-');

    $description = implode("\n", $parts);

    // Date de validité : 30 jours à partir d'aujourd'hui
    $dateValidUntil = date('Y-m-d', strtotime('+30 days'));

    // ---------------------------------------------------------------
    // 4. Insérer le devis en transaction
    // ---------------------------------------------------------------
    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO invoice_draft
            (entity, client_id, client_name, mission_id, month, total_ht,
             status, date_valid_until, created_by, created_at, updated_at)
        VALUES
            (:entity, :client_id, :client_name, :mission_id, :month, :total_ht,
             'draft', :date_valid_until, :created_by, NOW(), NOW())
    ");
    $month = $mission['datemission']
        ? substr($mission['datemission'], 0, 7)
        : date('Y-m');

    $stmtInsert->execute([
        ':entity'          => $currentEntity,
        ':client_id'       => $mission['client_id'] ?: null,
        ':client_name'     => $mission['client_name'] ?? null,
        ':mission_id'      => $missionId,
        ':month'           => $month,
        ':total_ht'        => $total,
        ':date_valid_until'=> $dateValidUntil,
        ':created_by'      => $userId,
    ]);
    $quoteId = (int) $pdo->lastInsertId();

    // Insérer la ligne de devis
    ensureInvoiceDraftLinesEntityColumn($pdo);
    $stmtLine = $pdo->prepare("
        INSERT INTO invoice_draft_lines
            (entity, draft_id, mission_id, description, quantity, unit_price,
             tva_rate, discount, total, sort_order, updated_at)
        VALUES
            (:entity, :draft_id, :mission_id, :description, :quantity, :unit_price,
             :tva_rate, 0.00, :total, 0, NOW())
    ");
    $stmtLine->execute([
        ':entity'      => $currentEntity,
        ':draft_id'    => $quoteId,
        ':mission_id'  => $missionId,
        ':description' => $description,
        ':quantity'    => $quantity,
        ':unit_price'  => $unitPrice,
        ':tva_rate'    => $tvaRate,
        ':total'       => $total,
    ]);

    $pdo->commit();

    respond(201, [
        'success'  => true,
        'quote_id' => $quoteId,
        'status'   => 'draft_created',
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('create_quote_from_mission error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur']);
}
