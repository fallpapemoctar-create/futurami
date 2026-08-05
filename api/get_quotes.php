<?php
/**
 * get_quotes.php
 * AMI v1.4 — Module Devis
 *
 * Liste les devis avec filtres optionnels.
 *
 * GET ?status=draft&client_id=12&page=1&pageSize=25
 * → 200 { quotes: [...], total: int }
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

$status   = isset($_GET['status'])    ? trim($_GET['status'])    : null;
$clientId = isset($_GET['client_id']) ? (int) $_GET['client_id'] : null;
$page     = max(1, (int)($_GET['page']     ?? 1));
$pageSize = min(100, max(1, (int)($_GET['pageSize'] ?? 25)));
$offset   = ($page - 1) * $pageSize;

$where  = ['d.entity = :entity'];
$params = [':entity' => $currentEntity];

$allowedStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'finalized', 'accepted_converted'];
if ($status && in_array($status, $allowedStatuses, true)) {
    $where[]          = 'd.status = :status';
    $params[':status'] = $status;
}
if ($clientId) {
    $where[]            = 'd.client_id = :client_id';
    $params[':client_id'] = $clientId;
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

try {
    ensureInvoiceDraftTable($pdo);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM invoice_draft d $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $dataStmt = $pdo->prepare("
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
            m.ref AS mission_ref
        FROM invoice_draft d
        LEFT JOIN llx_missionsplanet_mission m ON m.rowid = d.mission_id
        $whereSql
        ORDER BY d.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    foreach ($params as $k => $v) {
        $dataStmt->bindValue($k, $v);
    }
    $dataStmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
    $dataStmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
    $dataStmt->execute();
    $quotes = $dataStmt->fetchAll();

    foreach ($quotes as &$q) {
        $q['id']         = (int)   $q['id'];
        $q['client_id']  = $q['client_id']  ? (int)   $q['client_id']  : null;
        $q['mission_id'] = $q['mission_id'] ? (int)   $q['mission_id'] : null;
        $q['total_ht']   = (float) $q['total_ht'];
    }
    unset($q);

    respond(200, ['success' => true, 'quotes' => $quotes, 'total' => $total]);

} catch (Exception $e) {
    error_log('get_quotes error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur']);
}
