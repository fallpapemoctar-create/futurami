<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$page = isset($input['page']) ? max(1, (int) $input['page']) : 1;
$pageSize = isset($input['pageSize']) ? (int) $input['pageSize'] : 50;
// Plafond relevé à 2000 : l'écran Facturation côté Flutter charge l'intégralité
// des factures clients pour appliquer ses filtres (mois, statut, type, recherche)
// localement. Avec un cap trop bas, les factures anciennes étaient ignorées.
$pageSize = max(1, min(2000, $pageSize));
$offset = ($page - 1) * $pageSize;

$client = trim((string) ($input['client'] ?? $input['client_name'] ?? ''));
$status = trim((string) ($input['status'] ?? $input['status_code'] ?? ''));
$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
$missionRef = trim((string) ($input['mission_ref'] ?? ''));
$search = trim((string) ($input['search'] ?? $input['q'] ?? ''));
// AMI v2 — filtre par type de document : 'invoice', 'credit_note' ou '' (tous)
$typeFilter = strtolower(trim((string) ($input['type'] ?? $input['invoice_type'] ?? '')));

try {
    ensureClientBillingTable($pdo);

    $where = ["COALESCE(cb.category, '') IN ('', 'client')", 'cb.entity = :entity'];
    $params = [':entity' => $currentEntity];

    if ($client !== '') {
        $where[] = 'cb.client_name LIKE :client';
        $params[':client'] = "%$client%";
    }
    if ($status !== '') {
        $where[] = '(cb.status_code = :status_code OR cb.status_label LIKE :status_label)';
        $params[':status_code'] = $status;
        $params[':status_label'] = "%$status%";
    }
    if ($invoiceNumber !== '') {
        $where[] = 'cb.invoice_number LIKE :invoice';
        $params[':invoice'] = "%$invoiceNumber%";
    }
    if ($missionRef !== '') {
        $where[] = 'cb.mission_ref LIKE :mission_ref';
        $params[':mission_ref'] = "%$missionRef%";
    }
    if ($search !== '') {
        $where[] = "(cb.invoice_number LIKE :search OR cb.client_name LIKE :search OR cb.mission_ref LIKE :search OR COALESCE(m.label, '') LIKE :search)";
        $params[':search'] = "%$search%";
    }

    if (in_array($typeFilter, ['credit_note', 'avoir', 'cn', '2'], true)) {
        $where[] = 'COALESCE(cb.invoice_type, 0) = 2';
    } elseif (in_array($typeFilter, ['invoice', 'facture', '0'], true)) {
        $where[] = 'COALESCE(cb.invoice_type, 0) = 0';
    }

    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(DISTINCT cb.invoice_number) FROM tble_client_billed cb LEFT JOIN llx_missionsplanet_mission m ON m.ref = cb.mission_ref WHERE $whereSql");
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();

    $dataSql = "
        SELECT
            cb.invoice_number,
            MAX(cb.id) AS id,
            MAX(cb.category) AS category,
            COALESCE(MAX(NULLIF(cb.invoice_total_ht, 0)), SUM(COALESCE(cb.amount_ht, 0))) AS invoice_total_ht,
            (
                SELECT SUM(cil2.total_ht * (1 + COALESCE(cil2.tva_rate, 0)/100))
                FROM tble_client_invoice_lines cil2
                WHERE cil2.invoice_number = cb.invoice_number
            ) AS invoice_total_ttc,
            SUM(COALESCE(cb.amount_ht, 0)) AS amount_ht,
            MAX(cb.client_name) AS client_name,
            CASE
                WHEN COUNT(DISTINCT COALESCE(cb.mission_ref, '')) = 1 THEN MAX(cb.mission_ref)
                ELSE NULL
            END AS mission_ref,
            MAX(cb.status_code) AS status_code,
            MAX(cb.status_label) AS status_label,
            MAX(cb.billed_at) AS billed_at,
            MAX(cb.pdf_size) AS pdf_size,
            MAX(cb.created_by) AS created_by,
            MAX(cb.created_by_name) AS created_by_name,
            MAX(cb.notes) AS notes,
            MAX(cb.created_at) AS created_at,
            MAX(cb.updated_at) AS updated_at,
            MAX(cb.pdf_filename) AS pdf_filename,
            MAX(cb.pdf_path) AS pdf_path,
            COALESCE(MAX(cb.invoice_type), 0) AS invoice_type,
            MAX(cb.source_invoice_number) AS source_invoice_number,
            MAX(cb.credit_note_reason) AS credit_note_reason,
            -- `applied_amount` est stocké répété sur chaque ligne d'une facture
            -- (UPDATE ... WHERE invoice_number = :inv). Il faut donc MAX(NULLIF)
            -- pour récupérer la valeur unique et NON SUM, sinon on multiplie
            -- par le nombre de lignes de la facture.
            COALESCE(MAX(NULLIF(cb.applied_amount, 0)), 0) AS applied_amount,
            COALESCE(MAX(cb.credit_consumed), 0) AS credit_consumed,
            (
                SELECT MAX(cil.period_month)
                FROM tble_client_invoice_lines cil
                WHERE cil.invoice_number = cb.invoice_number
            ) AS period_month,
            CASE
                WHEN COUNT(DISTINCT COALESCE(cb.mission_ref, '')) = 1 THEN MAX(m.label)
                ELSE NULL
            END AS mission_label
        FROM tble_client_billed cb
        LEFT JOIN llx_missionsplanet_mission m ON m.ref = cb.mission_ref
        WHERE $whereSql
        GROUP BY cb.invoice_number
        ORDER BY MAX(cb.billed_at) DESC, MAX(cb.id) DESC
        LIMIT :offset, :limit";

    $dataStmt = $pdo->prepare($dataSql);
    foreach ($params as $key => $value) {
        $dataStmt->bindValue($key, $value);
    }
    $dataStmt->bindValue(':offset', (int) $offset, PDO::PARAM_INT);
    $dataStmt->bindValue(':limit', (int) $pageSize, PDO::PARAM_INT);
    $dataStmt->execute();
    $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    respond(200, [
        'success' => true,
        'page' => $page,
        'pageSize' => $pageSize,
        'total' => $total,
        'invoices' => $rows,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
