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

function billingCreationLog(string $event, array $context = []): void {
    $safeContext = $context;
    if (isset($safeContext['pdf_base64'])) {
        unset($safeContext['pdf_base64']);
    }
    if (isset($safeContext['invoice_lines']) && is_array($safeContext['invoice_lines'])) {
        $safeContext['invoice_lines_count'] = count($safeContext['invoice_lines']);
        unset($safeContext['invoice_lines']);
    }
    if (isset($safeContext['missions']) && is_array($safeContext['missions'])) {
        $safeContext['missions_count'] = count($safeContext['missions']);
    }

    $line = sprintf(
        "[%s] %s %s%s",
        date('Y-m-d H:i:s'),
        $event,
        json_encode($safeContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        PHP_EOL
    );
    @file_put_contents(__DIR__ . '/billing_creation.log', $line, FILE_APPEND);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    billingCreationLog('invalid_payload', ['raw_type' => gettype($input)]);
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$missions = $input['missions'] ?? [];
if (!is_array($missions) || empty($missions)) {
    respond(400, ['success' => false, 'error' => 'La liste des missions est obligatoire.']);
}

$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Le numéro de facture est obligatoire.']);
}

$clientName = trim((string) ($input['client_name'] ?? ''));
$periodMonthRaw = $input['period_month'] ?? null;
$periodMonth = $periodMonthRaw !== null ? invoiceParsePeriodMonth($periodMonthRaw) : null;
$periodMonthKey = $periodMonth ? $periodMonth->format('Y-m-01') : null;
$draftKeyInput = trim((string) ($input['draft_key'] ?? ''));
$draftKey = $draftKeyInput !== '' ? $draftKeyInput : null;
if ($draftKey === null && $clientName !== '' && $periodMonthKey) {
    $draftKey = invoiceDraftKey($clientName, $periodMonthKey);
}
$draftIdInput = isset($input['draft_id']) ? (int) $input['draft_id'] : 0;
$billedAtRaw = $input['billed_at'] ?? null;
$timestamp = $billedAtRaw ? strtotime((string) $billedAtRaw) : time();
$timestamp = $timestamp ?: time();
$billedAt = date('Y-m-d H:i:s', $timestamp);

[$statusCode, $defaultStatusLabel] = normalizeClientBillingStatus($input['status'] ?? null);
$statusLabel = trim((string) ($input['status_label'] ?? ''));
if ($statusLabel === '') {
    $statusLabel = $defaultStatusLabel;
}

$amountTotal = isset($input['amount_total']) ? (float) $input['amount_total'] : null;
$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));
$notes = trim((string) ($input['notes'] ?? ''));
$pdfFilenameRaw = trim((string) ($input['pdf_filename'] ?? ''));
$pdfFilenameBase = sanitizeInvoiceFilename($pdfFilenameRaw);
$pdfBinary = decodePdfPayload($input['pdf_base64'] ?? null);
$pdfRelativePath = null;
$pdfSize = null;
$pdfStoredFilename = null;

billingCreationLog('request_received', [
    'client_name' => $clientName,
    'invoice_number' => $invoiceNumber,
    'period_month' => $periodMonthKey,
    'status_code' => $statusCode,
    'status_label' => $statusLabel,
    'amount_total' => $amountTotal,
    'draft_key' => $draftKey,
    'user_id' => $userId,
    'user_name' => $userName,
    'has_pdf' => $pdfBinary !== null,
    'missions' => $missions,
    'invoice_lines' => $input['invoice_lines'] ?? [],
]);

try {
    ensureClientBillingTable($pdo);
    ensureClientInvoiceLinesTable($pdo);

    // Garde-fou anti-collision : si le numéro fourni est déjà utilisé pour
    // un client différent, on refuse l'insertion. Combiné au compteur
    // atomique tble_invoice_sequence, ceci rend structurellement
    // impossible qu'un même numéro soit attribué à deux clients.
    if ($clientName !== '') {
        $conflict = invoiceNumberCollisionClient($pdo, $invoiceNumber, $clientName, $currentEntity);
        if ($conflict !== '') {
            billingCreationLog('client_collision_blocked', [
                'invoice_number' => $invoiceNumber,
                'client_name' => $clientName,
                'existing_client' => $conflict,
            ]);
            respond(409, [
                'success' => false,
                'error' => "Le numéro $invoiceNumber est déjà attribué au client « $conflict ». Réessayez : un nouveau numéro sera automatiquement généré.",
                'code' => 'client_collision',
                'existing_client' => $conflict,
            ]);
        }
    }

    if ($clientName !== '' && $periodMonthKey !== null) {
                $duplicateStmt = $pdo->prepare("SELECT cb.invoice_number
                        FROM tble_client_billed cb
                        WHERE cb.client_name = :client_name
                            AND cb.entity = :entity
                            AND cb.invoice_number <> :invoice_number
                            AND LOWER(TRIM(cb.status_code)) IN ('draft', 'validated')
                            AND EXISTS (
                                    SELECT 1
                                    FROM tble_client_invoice_lines cil
                                    WHERE cil.invoice_number = cb.invoice_number
                                        AND cil.entity = cb.entity
                                        AND cil.period_month = :period_month
                            )
                        ORDER BY cb.billed_at DESC, cb.id DESC
                        LIMIT 1");
        $duplicateStmt->execute([
            ':client_name' => $clientName,
            ':entity' => $currentEntity,
            ':period_month' => $periodMonthKey,
            ':invoice_number' => $invoiceNumber,
        ]);
        $existingInvoice = $duplicateStmt->fetchColumn();
        if ($existingInvoice) {
            billingCreationLog('duplicate_detected', [
                'client_name' => $clientName,
                'period_month' => $periodMonthKey,
                'invoice_number' => $invoiceNumber,
                'existing_invoice_number' => $existingInvoice,
            ]);
            respond(409, [
                'success' => false,
                'error' => 'Une facture existe déjà pour ce client et ce mois.',
                'invoice_number' => $existingInvoice,
            ]);
        }
    }

    if ($pdfBinary !== null) {
        $storageDir = __DIR__ . '/../Factures_PDF';
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0775, true);
        }
        $uniqueSuffix = bin2hex(random_bytes(4));
        $pdfStoredFilename = $pdfFilenameBase . '_' . date('Ymd_His') . '_' . $uniqueSuffix . '.pdf';
        $target = $storageDir . '/' . $pdfStoredFilename;
        if (file_put_contents($target, $pdfBinary) === false) {
            billingCreationLog('pdf_write_failed', [
                'invoice_number' => $invoiceNumber,
                'target' => $target,
            ]);
            respond(500, ['success' => false, 'error' => "Impossible d'enregistrer le PDF."]);
        }
        $pdfRelativePath = str_replace(__DIR__ . '/../', '', $target);
        $pdfSize = strlen($pdfBinary);
        billingCreationLog('pdf_written', [
            'invoice_number' => $invoiceNumber,
            'pdf_path' => $pdfRelativePath,
            'pdf_size' => $pdfSize,
        ]);
    }

    $invoiceLines = [];
    if (isset($input['invoice_lines']) && is_array($input['invoice_lines'])) {
        foreach ($input['invoice_lines'] as $idx => $line) {
            if (!is_array($line)) {
                continue;
            }
            $designation = trim((string) ($line['designation'] ?? ''));
            $missionRefLine = trim((string) ($line['mission_ref'] ?? ''));
            $tvaRate = invoiceNormalizeDecimal($line['tva_rate'] ?? 0);
            $unitPrice = invoiceNormalizeDecimal($line['unit_price_ht'] ?? $line['unit_price'] ?? 0);
            $quantity = invoiceNormalizeDecimal($line['quantity'] ?? 1, 1.0);
            $discount = invoiceNormalizeDecimal($line['discount'] ?? 0);
            $discount = max(0.0, min(100.0, $discount));
            $totalLine = invoiceNormalizeDecimal($line['total_ht'] ?? ($unitPrice * $quantity * (1 - $discount / 100)));
            $invoiceLines[] = [
                'mission_ref' => $missionRefLine === '' ? null : $missionRefLine,
                'designation' => $designation,
                'tva_rate' => $tvaRate,
                'unit_price_ht' => $unitPrice,
                'quantity' => $quantity <= 0 ? 1.0 : $quantity,
                'total_ht' => $totalLine,
                'discount' => $discount,
                'sort_order' => $idx,
                'notes' => trim((string) ($line['notes'] ?? '')),
            ];
        }
    }

    if (empty($invoiceLines) && $draftKey !== null) {
        $draftStmt = $pdo->prepare("SELECT
            mission_ref,
            designation,
            tva_rate,
            unit_price_ht,
            quantity,
            total_ht,
            discount,
            notes
        FROM tble_client_invoice_lines
        WHERE draft_key = :draft AND entity = :entity
        ORDER BY sort_order ASC, id ASC");

        $draftStmt->execute([':draft' => $draftKey, ':entity' => $currentEntity]);
        $draftRows = $draftStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($draftRows as $idx => $row) {
            $designation = trim((string) ($row['designation'] ?? ''));
            if ($designation === '') {
                $designation = 'Ligne de facture';
            }
            $draftDiscount = invoiceNormalizeDecimal($row['discount'] ?? 0);
            $draftDiscount = max(0.0, min(100.0, $draftDiscount));
            $invoiceLines[] = [
                'mission_ref' => isset($row['mission_ref']) && $row['mission_ref'] !== '' ? $row['mission_ref'] : null,
                'designation' => $designation,
                'tva_rate' => invoiceNormalizeDecimal($row['tva_rate'] ?? 0),
                'unit_price_ht' => invoiceNormalizeDecimal($row['unit_price_ht'] ?? 0),
                'quantity' => invoiceNormalizeDecimal($row['quantity'] ?? 1, 1.0),
                'total_ht' => invoiceNormalizeDecimal($row['total_ht'] ?? 0),
                'discount' => $draftDiscount,
                'sort_order' => $idx,
                'notes' => trim((string) ($row['notes'] ?? '')),
            ];
        }
    }

    if (empty($invoiceLines)) {
        foreach ($missions as $idx => $mission) {
            if (!is_array($mission)) {
                continue;
            }
            $invoiceLines[] = invoiceLineFromMission($mission, $idx);
        }
    }

    $insertSql = "INSERT INTO tble_client_billed (
        entity,
        mission_ref,
        client_name,
        invoice_number,
        invoice_total_ht,
        amount_ht,
        billed_at,
        status_code,
        status_label,
        category,
        pdf_path,
        pdf_filename,
        pdf_size,
        created_by,
        created_by_name,
        notes
    ) VALUES (
        :entity,
        :mission_ref,
        :client_name,
        :invoice_number,
        :invoice_total_ht,
        :amount_ht,
        :billed_at,
        :status_code,
        :status_label,
        'client',
        :pdf_path,
        :pdf_filename,
        :pdf_size,
        :created_by,
        :created_by_name,
        :notes
    ) ON DUPLICATE KEY UPDATE
        invoice_total_ht = VALUES(invoice_total_ht),
        amount_ht = VALUES(amount_ht),
        billed_at = VALUES(billed_at),
        status_code = VALUES(status_code),
        status_label = VALUES(status_label),
        pdf_path = VALUES(pdf_path),
        pdf_filename = VALUES(pdf_filename),
        pdf_size = VALUES(pdf_size),
        created_by = VALUES(created_by),
        created_by_name = VALUES(created_by_name),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP";

    $stmt = $pdo->prepare($insertSql);
    $inserted = 0;

    $pdo->beginTransaction();

    foreach ($missions as $mission) {
        if (!is_array($mission)) {
            continue;
        }
        $missionRef = trim((string) ($mission['reference'] ?? $mission['mission_ref'] ?? ''));
        if ($missionRef === '') {
            continue;
        }
        $lineAmount = isset($mission['amount_ht']) ? (float) $mission['amount_ht'] : null;
        $stmt->execute([
            ':entity' => $currentEntity,
            ':mission_ref' => $missionRef,
            ':client_name' => $clientName !== '' ? $clientName : null,
            ':invoice_number' => $invoiceNumber,
            ':invoice_total_ht' => $amountTotal,
            ':amount_ht' => $lineAmount,
            ':billed_at' => $billedAt,
            ':status_code' => $statusCode,
            ':status_label' => $statusLabel,
            ':pdf_path' => $pdfRelativePath,
            ':pdf_filename' => $pdfBinary !== null ? $pdfStoredFilename : null,
            ':pdf_size' => $pdfSize,
            ':created_by' => $userId,
            ':created_by_name' => $userName !== '' ? $userName : null,
            ':notes' => $notes !== '' ? $notes : null,
        ]);
        $inserted += $stmt->rowCount();
    }

    $deleteLines = $pdo->prepare('DELETE FROM tble_client_invoice_lines WHERE invoice_number = :invoice AND entity = :entity');
    $deleteLines->execute([':invoice' => $invoiceNumber, ':entity' => $currentEntity]);

    $lineStmt = $pdo->prepare("INSERT INTO tble_client_invoice_lines (
        entity,
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
        period_month,
        created_by,
        created_by_name
    ) VALUES (
        :entity,
        :invoice_number,
        :mission_ref,
        :designation,
        :tva_rate,
        :unit_price_ht,
        :quantity,
        :total_ht,
        :discount,
        :notes,
        :sort_order,
        :client_name,
        :period_month,
        :created_by,
        :created_by_name
    )");

    foreach ($invoiceLines as $line) {
        $lineStmt->execute([
            ':entity' => $currentEntity,
            ':invoice_number' => $invoiceNumber,
            ':mission_ref' => $line['mission_ref'],
            ':designation' => $line['designation'],
            ':tva_rate' => $line['tva_rate'],
            ':unit_price_ht' => $line['unit_price_ht'],
            ':quantity' => $line['quantity'],
            ':total_ht' => $line['total_ht'],
            ':discount' => $line['discount'] ?? 0,
            ':notes' => $line['notes'],
            ':sort_order' => $line['sort_order'],
            ':client_name' => $clientName !== '' ? $clientName : null,
            ':period_month' => $periodMonthKey,
            ':created_by' => $userId,
            ':created_by_name' => $userName !== '' ? $userName : null,
        ]);
    }

    if ($draftKey !== null) {
        $cleanupDraftStmt = $pdo->prepare('DELETE FROM tble_client_invoice_lines WHERE draft_key = :draft AND entity = :entity');
        $cleanupDraftStmt->execute([':draft' => $draftKey, ':entity' => $currentEntity]);
    }
    // Supprimer la préparation (invoice_draft) après création de la facture
    if ($draftIdInput > 0) {
        ensureInvoiceDraftTable($pdo);
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'invoice_draft'");
        if ($tableCheck && $tableCheck->rowCount() > 0) {
            $pdo->prepare('DELETE FROM invoice_draft WHERE id = :id AND entity = :entity')
                ->execute([':id' => $draftIdInput, ':entity' => $currentEntity]);
        }
    }

    // Recalcule le total réel depuis les lignes insérées et met à jour invoice_total_ht
    $recalcStmt = $pdo->prepare(
        'SELECT COALESCE(SUM(total_ht), 0) FROM tble_client_invoice_lines WHERE invoice_number = :invoice AND entity = :entity'
    );
    $recalcStmt->execute([':invoice' => $invoiceNumber, ':entity' => $currentEntity]);
    $realTotal = round((float) $recalcStmt->fetchColumn(), 2);

    $pdo->prepare("UPDATE tble_client_billed SET invoice_total_ht = :t, updated_at = CURRENT_TIMESTAMP WHERE invoice_number = :invoice AND entity = :entity")
        ->execute([':t' => $realTotal, ':invoice' => $invoiceNumber, ':entity' => $currentEntity]);

    $pdo->commit();

    billingCreationLog('request_succeeded', [
        'invoice_number' => $invoiceNumber,
        'client_name' => $clientName,
        'period_month' => $periodMonthKey,
        'status_code' => $statusCode,
        'inserted_rows' => $inserted,
        'invoice_lines_count' => count($invoiceLines),
        'pdf_path' => $pdfRelativePath,
    ]);

    respond(200, [
        'success' => true,
        'rows' => $inserted,
        'invoice_number' => $invoiceNumber,
        'status_code' => $statusCode,
        'status_label' => $statusLabel,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    billingCreationLog('request_failed', [
        'invoice_number' => $invoiceNumber,
        'client_name' => $clientName,
        'period_month' => $periodMonthKey,
        'error' => $e->getMessage(),
    ]);
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
