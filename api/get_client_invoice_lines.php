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

$invoiceNumber = trim((string) ($input['invoice_number'] ?? $input['invoice'] ?? ''));
$missionRef = trim((string) ($input['mission_ref'] ?? ''));
if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Le numero de facture est obligatoire.']);
}

try {
    ensureClientInvoiceLinesTable($pdo);

    $sql = "SELECT
        id,
        invoice_number,
        mission_ref,
        designation,
        tva_rate,
        unit_price_ht,
        quantity,
        total_ht,
        discount,
        notes,
        sort_order,
        client_name,
        period_month
    FROM tble_client_invoice_lines
    WHERE invoice_number = :invoice AND entity = :entity";

    if ($missionRef !== '') {
        $sql .= " AND mission_ref = :mission_ref";
    }

    $sql .= " ORDER BY sort_order ASC, id ASC";

    $stmt = $pdo->prepare($sql);

    $params = [':invoice' => $invoiceNumber, ':entity' => $currentEntity];
    if ($missionRef !== '') {
        $params[':mission_ref'] = $missionRef;
    }
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalHt = 0;
    foreach ($rows as $row) {
        $totalHt += (float) ($row['total_ht'] ?? 0);
    }

    respond(200, [
        'success' => true,
        'invoice_number' => $invoiceNumber,
        'mission_ref' => $missionRef !== '' ? $missionRef : null,
        'total_ht' => round($totalHt, 2),
        'lines' => $rows,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
