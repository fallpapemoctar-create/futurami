<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';

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
    respond(400, ['success' => false, 'error' => 'Invalid JSON input']);
}

$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
$newDate       = trim((string) ($input['new_date'] ?? ''));

if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'invoice_number is required']);
}
if ($newDate === '') {
    respond(400, ['success' => false, 'error' => 'new_date is required']);
}

// Validate date format: accept YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
if (!preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/', $newDate)) {
    respond(400, ['success' => false, 'error' => 'new_date must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS']);
}

// Normalize to YYYY-MM-DD HH:MM:SS
if (strlen($newDate) === 10) {
    $newDate .= ' 00:00:00';
} elseif (strlen($newDate) === 16) {
    $newDate .= ':00';
}

try {
    // Verify invoice exists
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM tble_client_billed WHERE invoice_number = :inv AND entity = :entity LIMIT 1"
    );
    $stmt->execute([':inv' => $invoiceNumber, ':entity' => $currentEntity]);
    if ((int) $stmt->fetchColumn() === 0) {
        respond(404, ['success' => false, 'error' => 'Invoice not found']);
    }

    // Update created_at and billed_at for all rows of this invoice
    $update = $pdo->prepare(
        "UPDATE tble_client_billed
         SET created_at = :new_date, billed_at = :new_date, updated_at = NOW()
         WHERE invoice_number = :inv AND entity = :entity"
    );
    $update->execute([
        ':new_date' => $newDate,
        ':inv'      => $invoiceNumber,
        ':entity'   => $currentEntity,
    ]);

    respond(200, [
        'success'  => true,
        'new_date' => $newDate,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
