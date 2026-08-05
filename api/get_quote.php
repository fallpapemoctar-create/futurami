<?php
/**
 * get_quote.php
 * AMI v1.4 — Module Devis
 *
 * Retourne les informations complètes d'un devis (header + lignes).
 * Utilisé par Flutter pour afficher / générer le PDF du devis.
 *
 * GET ?quote_id=88
 * → 200 { quote: {...}, lines: [...] }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['success' => false, 'error' => 'Méthode non autorisée']);
}

$quoteId = isset($_GET['quote_id']) ? (int) $_GET['quote_id'] : 0;
if ($quoteId <= 0) {
    respond(400, ['success' => false, 'error' => 'quote_id requis']);
}

try {
    ensureInvoiceDraftTable($pdo);

    // Header du devis
    $stmt = $pdo->prepare("
        SELECT
            d.id,
            d.client_id,
            d.client_name,
            d.mission_id,
            d.month,
            d.total_ht,
            d.status,
            d.date_valid_until,
            d.notes,
            d.sent_at,
            d.converted_invoice_number,
            d.created_by,
            d.created_at,
            d.updated_at,
            -- Infos mission
            m.ref            AS mission_ref,
            m.datemission    AS mission_date,
            m.dureemission   AS mission_duree,
            -- Infos client
            s.address        AS client_address,
            s.zip            AS client_zip,
            s.town           AS client_town
        FROM invoice_draft d
        LEFT JOIN llx_missionsplanet_mission m ON m.rowid = d.mission_id
        LEFT JOIN llx_societe s ON s.rowid = d.client_id
        WHERE d.id = :id AND d.entity = :entity
        LIMIT 1
    ");
    $stmt->execute([':id' => $quoteId, ':entity' => $currentEntity]);
    $quote = $stmt->fetch();

    if (!$quote) {
        respond(404, ['success' => false, 'error' => 'Devis introuvable']);
    }

    // Lignes du devis
    $stmtLines = $pdo->prepare("
        SELECT
            id,
            draft_id,
            mission_id,
            description,
            quantity,
            unit_price,
            tva_rate,
            discount,
            total,
            sort_order,
            updated_at
        FROM invoice_draft_lines
        WHERE draft_id = :did
        ORDER BY sort_order ASC, id ASC
    ");
    $stmtLines->execute([':did' => $quoteId]);
    $lines = $stmtLines->fetchAll();

    // Typage numérique
    foreach ($lines as &$line) {
        $line['id']         = (int)   $line['id'];
        $line['draft_id']   = (int)   $line['draft_id'];
        $line['mission_id'] = $line['mission_id'] ? (int) $line['mission_id'] : null;
        $line['quantity']   = (float) $line['quantity'];
        $line['unit_price'] = (float) $line['unit_price'];
        $line['tva_rate']   = (float) $line['tva_rate'];
        $line['discount']   = (float) $line['discount'];
        $line['total']      = (float) $line['total'];
        $line['sort_order'] = (int)   $line['sort_order'];
    }
    unset($line);

    $quote['id']         = (int)   $quote['id'];
    $quote['client_id']  = $quote['client_id']  ? (int)   $quote['client_id']  : null;
    $quote['mission_id'] = $quote['mission_id'] ? (int)   $quote['mission_id'] : null;
    $quote['total_ht']   = (float) $quote['total_ht'];

    respond(200, ['success' => true, 'quote' => $quote, 'lines' => $lines]);

} catch (Exception $e) {
    error_log('get_quote error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur']);
}
