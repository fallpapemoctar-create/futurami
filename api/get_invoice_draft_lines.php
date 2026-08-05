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

// Règle v1.3 §3.1 : draft_id prioritaire, sinon fallback draft_key, sinon client_name+period_month
if ($draftIdInput !== null && $draftIdInput > 0) {
    $draftKey = null; // sera ignoré, on lit depuis invoice_draft_lines
} elseif ($draftKeyInput !== '') {
    $draftKey = $draftKeyInput;
} else {
    if ($clientName === '' || $periodMonthKey === null) {
        respond(400, ['success' => false, 'error' => 'draft_id, draft_key ou (client_name + period_month) sont requis.']);
    }
    $draftKey = invoiceDraftKey($clientName, $periodMonthKey);
}

try {
    // -------------------------------------------------------
    // Chemin v1.3 : lecture depuis invoice_draft + invoice_draft_lines
    // -------------------------------------------------------
    if ($draftIdInput !== null && $draftIdInput > 0) {
        ensureInvoiceDraftTable($pdo);

        $draftStmt = $pdo->prepare("SELECT
            id AS draft_id, client_id, client_name, month, payment_condition_id,
            bank_account_id, total_ht, created_by, status, created_at, updated_at
            FROM invoice_draft WHERE id = :id AND entity = :entity");
        $draftStmt->execute([':id' => $draftIdInput, ':entity' => $currentEntity]);
        $draftRow = $draftStmt->fetch(PDO::FETCH_ASSOC);

        if (!$draftRow) {
            respond(404, ['success' => false, 'error' => "Draft introuvable (id=$draftIdInput)."]);
        }

        $linesTableCheck = $pdo->query("SHOW TABLES LIKE 'invoice_draft_lines'");
        $rows = [];
        if ($linesTableCheck && $linesTableCheck->rowCount() > 0) {
            $linesStmt = $pdo->prepare("SELECT
                dl.mission_id,
                dl.description  AS designation,
                dl.quantity,
                dl.unit_price   AS unit_price_ht,
                dl.total        AS total_ht,
                dl.sort_order,
                NULL            AS mission_ref,
                0               AS tva_rate,
                NULL            AS notes
            FROM invoice_draft_lines dl
            WHERE dl.draft_id = :id
            ORDER BY dl.sort_order ASC, dl.id ASC");
            $linesStmt->execute([':id' => $draftIdInput]);
            $rows = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $totalHt = 0.0;
        foreach ($rows as $row) {
            $totalHt += (float) ($row['total_ht'] ?? 0);
        }

        respond(200, [
            'success'              => true,
            'draft_id'             => (int) $draftRow['draft_id'],
            'draft_key'            => null,
            'client_id'            => $draftRow['client_id'] !== null ? (int) $draftRow['client_id'] : null,
            'client_name'          => $draftRow['client_name'],
            'month'                => $draftRow['month'],
            'payment_condition_id' => $draftRow['payment_condition_id'] !== null ? (int) $draftRow['payment_condition_id'] : null,
            'bank_account_id'      => $draftRow['bank_account_id'] !== null ? (int) $draftRow['bank_account_id'] : null,
            'status'               => $draftRow['status'],
            'updated_at'           => $draftRow['updated_at'],
            'lines'                => $rows,
            'total_ht'             => round($totalHt, 2),
        ]);
    }

    // -------------------------------------------------------
    // Chemin legacy v1.2 : lecture depuis tble_client_invoice_lines (draft_key)
    // -------------------------------------------------------
    ensureClientInvoiceLinesTable($pdo);

    $stmt = $pdo->prepare("SELECT
        mission_ref,
        designation,
        tva_rate,
        unit_price_ht,
        quantity,
        total_ht,
        discount,
        notes,
        sort_order
    FROM tble_client_invoice_lines
    WHERE draft_key = :draft AND entity = :entity
    ORDER BY sort_order ASC, id ASC");

    $stmt->execute([':draft' => $draftKey, ':entity' => $currentEntity]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalHt = 0.0;
    foreach ($rows as $row) {
        $totalHt += (float) ($row['total_ht'] ?? 0);
    }

    respond(200, [
        'success'      => true,
        'draft_id'     => null,
        'draft_key'    => $draftKey,
        'client_name'  => $clientName,
        'period_month' => $periodMonthKey,
        'lines'        => $rows,
        'total_ht'     => round($totalHt, 2),
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
