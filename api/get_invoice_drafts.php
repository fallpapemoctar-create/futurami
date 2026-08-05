<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';
require_once __DIR__ . '/invoice_line_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------------------------------------------------------------
// Paramètres optionnels de filtre
// ---------------------------------------------------------------
$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $decoded = json_decode(file_get_contents('php://input'), true);
    if (is_array($decoded)) {
        $input = $decoded;
    }
} else {
    $input = $_GET;
}

$clientId   = isset($input['client_id']) && $input['client_id'] !== '' ? (int) $input['client_id'] : null;
$clientName = isset($input['client_name']) ? trim((string) $input['client_name']) : null;
$monthRaw   = isset($input['month']) ? trim((string) $input['month']) : null;
$statusFilter = isset($input['status']) ? trim((string) $input['status']) : 'draft';

$monthKey = null;
if ($monthRaw !== null && $monthRaw !== '') {
    $periodMonth = invoiceParsePeriodMonth($monthRaw);
    $monthKey = $periodMonth ? $periodMonth->format('Y-m') : null;
}

try {
    ensureInvoiceDraftTable($pdo);

    $where = ['d.entity = :entity'];
    $params = [':entity' => $currentEntity];

    if ($statusFilter !== '' && $statusFilter !== 'all') {
        $where[] = 'd.status = :status';
        $params[':status'] = $statusFilter;
    }
    if ($clientId !== null) {
        $where[] = 'd.client_id = :client_id';
        $params[':client_id'] = $clientId;
    } elseif ($clientName !== null && $clientName !== '') {
        $where[] = 'd.client_name = :client_name';
        $params[':client_name'] = $clientName;
    }
    if ($monthKey !== null) {
        $where[] = 'd.month = :month';
        $params[':month'] = $monthKey;
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $stmt = $pdo->prepare("SELECT
        d.id          AS draft_id,
        d.client_id,
        d.client_name,
        d.month,
        d.payment_condition_id,
        d.bank_account_id,
        d.total_ht,
        d.created_by,
        d.status,
        d.created_at,
        d.updated_at
    FROM invoice_draft d
    $whereSql
    ORDER BY d.updated_at DESC
    LIMIT 200");

    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normaliser les types
    $drafts = array_map(function (array $row): array {
        return [
            'draft_id'             => (int) $row['draft_id'],
            'client_id'            => $row['client_id'] !== null ? (int) $row['client_id'] : null,
            'client_name'          => $row['client_name'],
            'month'                => $row['month'],
            'payment_condition_id' => $row['payment_condition_id'] !== null ? (int) $row['payment_condition_id'] : null,
            'bank_account_id'      => $row['bank_account_id'] !== null ? (int) $row['bank_account_id'] : null,
            'total_ht'             => (float) $row['total_ht'],
            'created_by'           => $row['created_by'] !== null ? (int) $row['created_by'] : null,
            'status'               => $row['status'],
            'created_at'           => $row['created_at'],
            'updated_at'           => $row['updated_at'],
        ];
    }, $rows);

    respond(200, ['success' => true, 'drafts' => $drafts]);

} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
