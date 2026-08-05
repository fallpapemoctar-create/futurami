<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$clientName = trim((string) ($input['client_name'] ?? ''));
$draftKeyInput = trim((string) ($input['draft_key'] ?? ''));
// AMI v1.3 : support draft_id (priorité sur draft_key)
$draftIdInput = isset($input['draft_id']) && $input['draft_id'] !== null ? (int) $input['draft_id'] : null;
$periodMonthValue = $input['period_month'] ?? null;
$periodMonth = $periodMonthValue !== null ? invoiceParsePeriodMonth($periodMonthValue) : null;
$periodMonthKey = $periodMonth ? $periodMonth->format('Y-m-01') : null;

if ($draftKeyInput === '') {
    if ($clientName === '' || $periodMonthKey === null) {
        respond(400, ['success' => false, 'error' => 'client_name et period_month sont requis pour générer le brouillon.']);
    }
    $draftKey = invoiceDraftKey($clientName, $periodMonthKey);
} else {
    $draftKey = $draftKeyInput;
}

$lines = $input['lines'] ?? [];
if (!is_array($lines) || empty($lines)) {
    respond(400, ['success' => false, 'error' => 'La liste des lignes est vide.']);
}

$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));

try {
    ensureClientInvoiceLinesTable($pdo);

    $pdo->beginTransaction();

    $deleteStmt = $pdo->prepare('DELETE FROM tble_client_invoice_lines WHERE draft_key = :draft AND entity = :entity');
    $deleteStmt->execute([':draft' => $draftKey, ':entity' => $currentEntity]);

    $insertSql = "INSERT INTO tble_client_invoice_lines (
        entity,
        draft_key,
        client_name,
        period_month,
        mission_ref,
        designation,
        tva_rate,
        unit_price_ht,
        quantity,
        total_ht,
        discount,
        notes,
        sort_order,
        created_by,
        created_by_name
    ) VALUES (
        :entity,
        :draft_key,
        :client_name,
        :period_month,
        :mission_ref,
        :designation,
        :tva_rate,
        :unit_price_ht,
        :quantity,
        :total_ht,
        :discount,
        :notes,
        :sort_order,
        :created_by,
        :created_by_name
    )";

    $insertStmt = $pdo->prepare($insertSql);

    foreach ($lines as $idx => $line) {
        if (!is_array($line)) {
            continue;
        }
        $designation = trim((string) ($line['designation'] ?? ''));
        if ($designation === '') {
            $designation = 'Ligne de facture';
        }
        $missionRef = trim((string) ($line['mission_ref'] ?? ''));
        $tvaRate = invoiceNormalizeDecimal($line['tva_rate'] ?? 0);
        $unitPrice = invoiceNormalizeDecimal($line['unit_price_ht'] ?? $line['unit_price'] ?? 0);
        $quantity = invoiceNormalizeDecimal($line['quantity'] ?? 1, 1.0);
        $discount = invoiceNormalizeDecimal($line['discount'] ?? 0);
        if ($discount < 0) $discount = 0;
        if ($discount > 100) $discount = 100;
        $total = invoiceNormalizeDecimal($line['total_ht'] ?? ($unitPrice * $quantity * (1 - $discount / 100)));
        if ($total <= 0 && $unitPrice > 0 && $quantity > 0) {
            $total = $unitPrice * $quantity * (1 - $discount / 100);
        }
        if ($unitPrice <= 0 && $quantity > 0 && $total > 0) {
            $unitPrice = $total / $quantity;
        }
        if ($quantity <= 0) {
            $quantity = 1.0;
        }

        $insertStmt->execute([
            ':entity' => $currentEntity,
            ':draft_key' => $draftKey,
            ':client_name' => $clientName !== '' ? $clientName : null,
            ':period_month' => $periodMonthKey,
            ':mission_ref' => $missionRef === '' ? null : $missionRef,
            ':designation' => $designation,
            ':tva_rate' => $tvaRate,
            ':unit_price_ht' => $unitPrice,
            ':quantity' => $quantity,
            ':total_ht' => $total,
            ':discount' => $discount,
            ':notes' => trim((string) ($line['notes'] ?? '')) ?: null,
            ':sort_order' => (int) $idx,
            ':created_by' => $userId,
            ':created_by_name' => $userName !== '' ? $userName : null,
        ]);
    }

    // AMI v1.3 — Phase 2 : si draft_id fourni, synchroniser invoice_draft_lines
    if ($draftIdInput !== null && $draftIdInput > 0) {
        ensureInvoiceDraftTable($pdo);
        $draftTableCheck = $pdo->query("SHOW TABLES LIKE 'invoice_draft'");
        if ($draftTableCheck && $draftTableCheck->rowCount() > 0) {
            // Vérifier que le draft existe et n'est pas finalisé
            $draftCheckStmt = $pdo->prepare("SELECT id, status FROM invoice_draft WHERE id = :id AND entity = :entity");
            $draftCheckStmt->execute([':id' => $draftIdInput, ':entity' => $currentEntity]);
            $draftRow = $draftCheckStmt->fetch(PDO::FETCH_ASSOC);

            if ($draftRow && $draftRow['status'] === 'draft') {
                $linesTableCheck = $pdo->query("SHOW TABLES LIKE 'invoice_draft_lines'");
                if ($linesTableCheck && $linesTableCheck->rowCount() > 0) {
                    ensureInvoiceDraftLinesEntityColumn($pdo);

                    // Remplacer les lignes du draft
                    $pdo->prepare("DELETE FROM invoice_draft_lines WHERE draft_id = :id AND entity = :entity")
                        ->execute([':id' => $draftIdInput, ':entity' => $currentEntity]);

                    $draftLineStmt = $pdo->prepare("INSERT INTO invoice_draft_lines
                        (entity, draft_id, mission_id, description, quantity, unit_price, total, sort_order)
                        VALUES (:entity, :draft_id, :mission_id, :description, :quantity, :unit_price, :total, :sort_order)");

                    $recalcTotal = 0.0;
                    foreach ($lines as $idx2 => $line) {
                        if (!is_array($line)) {
                            continue;
                        }
                        $desc     = trim((string) ($line['designation'] ?? '')) ?: 'Ligne de facture';
                        $qty      = invoiceNormalizeDecimal($line['quantity'] ?? 1, 1.0);
                        $price    = invoiceNormalizeDecimal($line['unit_price_ht'] ?? $line['unit_price'] ?? 0);
                        $lineTotal = invoiceNormalizeDecimal($line['total_ht'] ?? ($price * $qty));
                        if ($lineTotal <= 0 && $price > 0 && $qty > 0) {
                            $lineTotal = $price * $qty;
                        }
                        $recalcTotal += $lineTotal;

                        $missionIdRaw = $line['mission_id'] ?? null;
                        $missionId = ($missionIdRaw !== null && (int) $missionIdRaw > 0) ? (int) $missionIdRaw : null;

                        $draftLineStmt->execute([
                            ':entity'      => $currentEntity,
                            ':draft_id'    => $draftIdInput,
                            ':mission_id'  => $missionId,
                            ':description' => $desc,
                            ':quantity'    => $qty,
                            ':unit_price'  => $price,
                            ':total'       => $lineTotal,
                            ':sort_order'  => (int) $idx2,
                        ]);
                    }

                    // Mettre à jour le total_ht du draft header
                    $pdo->prepare("UPDATE invoice_draft SET total_ht = :total, updated_at = NOW() WHERE id = :id AND entity = :entity")
                        ->execute([':total' => round($recalcTotal, 2), ':id' => $draftIdInput, ':entity' => $currentEntity]);
                }
            }
        }
    }

    $pdo->commit();

    $responsePayload = [
        'success'   => true,
        'draft_key' => $draftKey,
        'lines'     => count($lines),
    ];
    if ($draftIdInput !== null && $draftIdInput > 0) {
        $responsePayload['draft_id'] = $draftIdInput;
    }
    respond(200, $responsePayload);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
