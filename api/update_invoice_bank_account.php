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
    respond(400, ['success' => false, 'error' => 'Invalid JSON input']);
}

$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
$bankAccountId = isset($input['bank_account_id']) ? (int) $input['bank_account_id'] : 0;

if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'invoice_number is required']);
}
if ($bankAccountId <= 0) {
    respond(400, ['success' => false, 'error' => 'bank_account_id is required']);
}

try {
    // Fetch bank account from llx_bank_account
    $stmt = $pdo->prepare(
        "SELECT rowid, label, bank FROM llx_bank_account WHERE rowid = :id AND clos = 0 LIMIT 1"
    );
    $stmt->execute([':id' => $bankAccountId]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$account) {
        respond(404, ['success' => false, 'error' => 'Bank account not found']);
    }

    // Build dropdownLabel (same logic as Dart CompanyBankAccount.dropdownLabel)
    $label    = trim((string) ($account['label'] ?? ''));
    $bankName = trim((string) ($account['bank']  ?? ''));
    if ($label === '' && $bankName === '') {
        $bankLabel = 'Compte ' . $bankAccountId;
    } elseif ($label === '' || strtoupper($label) === strtoupper($bankName)) {
        $bankLabel = $bankName !== '' ? $bankName : $label;
    } elseif ($bankName === '') {
        $bankLabel = $label;
    } else {
        $bankLabel = $label . ' - ' . $bankName;
    }

    // Fetch current notes
    $stmt = $pdo->prepare(
        "SELECT notes FROM tble_client_billed WHERE invoice_number = :inv AND entity = :entity LIMIT 1"
    );
    $stmt->execute([':inv' => $invoiceNumber, ':entity' => $currentEntity]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        respond(404, ['success' => false, 'error' => 'Invoice not found']);
    }

    $currentNotes = (string) ($row['notes'] ?? '');
    $newLine      = 'Compte bancaire : ' . $bankLabel;

    // Replace existing "Compte bancaire :" line or append it
    $lines = preg_split('/\r?\n/', $currentNotes);
    $found = false;
    foreach ($lines as &$line) {
        $trimmed = trim($line);
        $colonPos = strpos($trimmed, ':');
        if ($colonPos !== false) {
            $key = strtolower(trim(substr($trimmed, 0, $colonPos)));
            if ($key === 'compte bancaire') {
                $line  = $newLine;
                $found = true;
                break;
            }
        }
    }
    unset($line);

    if (!$found) {
        $lines[] = $newLine;
    }

    $updatedNotes = trim(implode("\n", $lines));

    // Update all rows for this invoice_number
    $update = $pdo->prepare(
        "UPDATE tble_client_billed
         SET notes = :notes, updated_at = NOW()
         WHERE invoice_number = :inv AND entity = :entity"
    );
    $update->execute([
        ':notes' => $updatedNotes,
        ':inv'   => $invoiceNumber,
        ':entity' => $currentEntity,
    ]);

    respond(200, [
        'success'    => true,
        'notes'      => $updatedNotes,
        'bank_label' => $bankLabel,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
