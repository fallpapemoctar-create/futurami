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

$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
$missionRef = trim((string) ($input['mission_ref'] ?? ''));
$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));
$rawLines = isset($input['lines']) && is_array($input['lines']) ? $input['lines'] : [];

if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Le numero de facture est obligatoire.']);
}

if ($missionRef === '') {
    respond(400, ['success' => false, 'error' => 'La reference mission est obligatoire.']);
}

if ($rawLines === []) {
    respond(400, ['success' => false, 'error' => 'Aucune ligne a mettre a jour.']);
}

try {
    ensureClientBillingTable($pdo);
    ensureClientInvoiceLinesTable($pdo);

    if (invoiceIsLocked($pdo, $invoiceNumber, $currentEntity)) {
        respond(403, ['success' => false, 'error' => 'Cette facture est verrouillee car elle est payee.']);
    }

    $metaStmt = $pdo->prepare("SELECT client_name, period_month
        FROM tble_client_invoice_lines
        WHERE invoice_number = :invoice AND mission_ref = :mission_ref AND entity = :entity
        ORDER BY id ASC
        LIMIT 1");
    $metaStmt->execute([
        ':invoice' => $invoiceNumber,
        ':mission_ref' => $missionRef,
        ':entity' => $currentEntity,
    ]);
    $meta = $metaStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    if (!$meta) {
        $fallbackStmt = $pdo->prepare("SELECT client_name
            FROM tble_client_billed
            WHERE invoice_number = :invoice AND mission_ref = :mission_ref AND entity = :entity
            LIMIT 1");
        $fallbackStmt->execute([
            ':invoice' => $invoiceNumber,
            ':mission_ref' => $missionRef,
            ':entity' => $currentEntity,
        ]);
        $fallback = $fallbackStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $meta = [
            'client_name' => $fallback['client_name'] ?? null,
            'period_month' => null,
        ];
    }

    $normalizedLines = [];
    foreach ($rawLines as $index => $line) {
        if (!is_array($line)) {
            continue;
        }
        $designation = trim((string) ($line['designation'] ?? ''));
        $quantity = isset($line['quantity']) ? (float) $line['quantity'] : 0;
        $unitPrice = isset($line['unit_price_ht']) ? (float) $line['unit_price_ht'] : (isset($line['unit_price']) ? (float) $line['unit_price'] : 0);
        $tvaRate = isset($line['tva_rate']) ? (float) $line['tva_rate'] : 0;
        $notes = trim((string) ($line['notes'] ?? ''));
        if ($designation === '') {
            $designation = 'Ligne de facture';
        }
        if ($quantity <= 0) {
            $quantity = 1;
        }
        $totalHt = round($quantity * $unitPrice, 2);
        $normalizedLines[] = [
            'mission_ref' => $missionRef,
            'designation' => $designation,
            'quantity' => $quantity,
            'unit_price_ht' => $unitPrice,
            'tva_rate' => $tvaRate,
            'total_ht' => $totalHt,
            'notes' => $notes !== '' ? $notes : null,
            'sort_order' => isset($line['sort_order']) ? (int) $line['sort_order'] : $index,
        ];
    }

    if ($normalizedLines === []) {
        respond(400, ['success' => false, 'error' => 'Aucune ligne valide a mettre a jour.']);
    }

    $pdo->beginTransaction();

    $deleteStmt = $pdo->prepare('DELETE FROM tble_client_invoice_lines WHERE invoice_number = :invoice AND mission_ref = :mission_ref AND entity = :entity');
    $deleteStmt->execute([
        ':invoice' => $invoiceNumber,
        ':mission_ref' => $missionRef,
        ':entity' => $currentEntity,
    ]);

    $insertStmt = $pdo->prepare("INSERT INTO tble_client_invoice_lines (
        entity,
        invoice_number,
        mission_ref,
        designation,
        tva_rate,
        unit_price_ht,
        quantity,
        total_ht,
        notes,
        sort_order,
        client_name,
        period_month,
        created_by,
        created_by_name,
        updated_by,
        updated_by_name
    ) VALUES (
        :entity,
        :invoice_number,
        :mission_ref,
        :designation,
        :tva_rate,
        :unit_price_ht,
        :quantity,
        :total_ht,
        :notes,
        :sort_order,
        :client_name,
        :period_month,
        :created_by,
        :created_by_name,
        :updated_by,
        :updated_by_name
    )");

    foreach ($normalizedLines as $line) {
        $insertStmt->execute([
            ':entity' => $currentEntity,
            ':invoice_number' => $invoiceNumber,
            ':mission_ref' => $missionRef,
            ':designation' => $line['designation'],
            ':tva_rate' => $line['tva_rate'],
            ':unit_price_ht' => $line['unit_price_ht'],
            ':quantity' => $line['quantity'],
            ':total_ht' => $line['total_ht'],
            ':notes' => $line['notes'],
            ':sort_order' => $line['sort_order'],
            ':client_name' => $meta['client_name'] ?? null,
            ':period_month' => $meta['period_month'] ?? null,
            ':created_by' => $userId,
            ':created_by_name' => $userName !== '' ? $userName : null,
            ':updated_by' => $userId,
            ':updated_by_name' => $userName !== '' ? $userName : null,
        ]);
    }

    $missionTotalStmt = $pdo->prepare('SELECT COALESCE(SUM(total_ht), 0) FROM tble_client_invoice_lines WHERE invoice_number = :invoice AND mission_ref = :mission_ref AND entity = :entity');
    $missionTotalStmt->execute([
        ':invoice' => $invoiceNumber,
        ':mission_ref' => $missionRef,
        ':entity' => $currentEntity,
    ]);
    $missionTotal = round((float) $missionTotalStmt->fetchColumn(), 2);

    $invoiceTotalStmt = $pdo->prepare('SELECT COALESCE(SUM(total_ht), 0) FROM tble_client_invoice_lines WHERE invoice_number = :invoice AND entity = :entity');
    $invoiceTotalStmt->execute([':invoice' => $invoiceNumber, ':entity' => $currentEntity]);
    $invoiceTotal = round((float) $invoiceTotalStmt->fetchColumn(), 2);

    $updateMissionStmt = $pdo->prepare("UPDATE tble_client_billed
        SET amount_ht = :amount_ht,
            updated_at = CURRENT_TIMESTAMP
        WHERE invoice_number = :invoice AND mission_ref = :mission_ref AND entity = :entity");
    $updateMissionStmt->execute([
        ':amount_ht' => $missionTotal,
        ':invoice' => $invoiceNumber,
        ':mission_ref' => $missionRef,
        ':entity' => $currentEntity,
    ]);

    $updateInvoiceStmt = $pdo->prepare("UPDATE tble_client_billed
        SET invoice_total_ht = :invoice_total_ht,
            updated_at = CURRENT_TIMESTAMP
        WHERE invoice_number = :invoice AND entity = :entity");
    $updateInvoiceStmt->execute([
        ':invoice_total_ht' => $invoiceTotal,
        ':invoice' => $invoiceNumber,
        ':entity' => $currentEntity,
    ]);

    $pdo->commit();

    respond(200, [
        'success' => true,
        'invoice_number' => $invoiceNumber,
        'mission_ref' => $missionRef,
        'total_ht' => $missionTotal,
        'invoice_total_ht' => $invoiceTotal,
        'lines' => $normalizedLines,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}