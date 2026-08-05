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

// ensureInvoiceDraftTable() vit désormais dans billing_helpers.php (appelée
// défensivement par tous les endpoints touchant invoice_draft).

// ---------------------------------------------------------------
// Résolution client_id depuis client_name si nécessaire
// ---------------------------------------------------------------
function resolveClientId(PDO $pdo, ?int $clientId, ?string $clientName): ?int {
    if ($clientId !== null && $clientId > 0) {
        return $clientId;
    }
    if ($clientName === null || trim($clientName) === '') {
        return null;
    }
    $stmt = $pdo->prepare("SELECT rowid FROM llx_societe WHERE nom = :nom LIMIT 1");
    $stmt->execute([':nom' => trim($clientName)]);
    $row = $stmt->fetchColumn();
    return $row ? (int) $row : null;
}

// ---------------------------------------------------------------
// Lecture du payload
// ---------------------------------------------------------------
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$draftId      = isset($input['draft_id']) && $input['draft_id'] !== null ? (int) $input['draft_id'] : null;
$clientId     = isset($input['client_id']) ? (int) $input['client_id'] : null;
$clientName   = trim((string) ($input['client_name'] ?? ''));
$monthRaw     = trim((string) ($input['month'] ?? ''));
$paymentTermId = isset($input['payment_condition_id']) ? (int) $input['payment_condition_id'] : null;
$bankAccountId = isset($input['bank_account_id']) ? (int) $input['bank_account_id'] : null;
$totalHt      = isset($input['total_ht']) ? (float) $input['total_ht'] : 0.0;
$userId       = isset($input['user_id']) ? (int) $input['user_id'] : null;

// Normalise le mois au format YYYY-MM
$periodMonth = $monthRaw !== '' ? invoiceParsePeriodMonth($monthRaw) : null;
$monthKey = $periodMonth ? $periodMonth->format('Y-m') : null;

if ($monthKey === null) {
    respond(400, ['success' => false, 'error' => 'Le champ month est requis (format YYYY-MM).']);
}
if ($clientName === '' && ($clientId === null || $clientId <= 0)) {
    respond(400, ['success' => false, 'error' => 'client_id ou client_name est requis.']);
}

try {
    ensureInvoiceDraftTable($pdo);

    // Résoudre client_id si absent
    $resolvedClientId = resolveClientId($pdo, $clientId, $clientName);

    if ($draftId !== null && $draftId > 0) {
        // -------------------------------------------------------
        // Mise à jour d'un draft existant (statut doit être 'draft')
        // -------------------------------------------------------
        $checkStmt = $pdo->prepare("SELECT id, status FROM invoice_draft WHERE id = :id AND entity = :entity");
        $checkStmt->execute([':id' => $draftId, ':entity' => $currentEntity]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            respond(404, ['success' => false, 'error' => "Draft introuvable (id=$draftId)."]);
        }
        if ($existing['status'] === 'finalized') {
            respond(409, ['success' => false, 'error' => 'Ce draft est finalisé et ne peut plus être modifié.']);
        }

        $updateStmt = $pdo->prepare("UPDATE invoice_draft SET
            client_id            = :client_id,
            client_name          = :client_name,
            month                = :month,
            payment_condition_id = :payment_condition_id,
            bank_account_id      = :bank_account_id,
            total_ht             = :total_ht,
            updated_at           = NOW()
        WHERE id = :id AND entity = :entity");
        $updateStmt->execute([
            ':client_id'            => $resolvedClientId,
            ':client_name'          => $clientName !== '' ? $clientName : null,
            ':month'                => $monthKey,
            ':payment_condition_id' => $paymentTermId,
            ':bank_account_id'      => $bankAccountId,
            ':total_ht'             => round($totalHt, 2),
            ':id'                   => $draftId,
            ':entity'               => $currentEntity,
        ]);

        respond(200, ['success' => true, 'draft_id' => $draftId, 'status' => 'saved']);

    } else {
        // -------------------------------------------------------
        // Création d'un nouveau draft
        // -------------------------------------------------------
        $insertStmt = $pdo->prepare("INSERT INTO invoice_draft
            (entity, client_id, client_name, month, payment_condition_id, bank_account_id, total_ht, created_by, status)
            VALUES
            (:entity, :client_id, :client_name, :month, :payment_condition_id, :bank_account_id, :total_ht, :created_by, 'draft')");
        $insertStmt->execute([
            ':entity'               => $currentEntity,
            ':client_id'            => $resolvedClientId,
            ':client_name'          => $clientName !== '' ? $clientName : null,
            ':month'                => $monthKey,
            ':payment_condition_id' => $paymentTermId,
            ':bank_account_id'      => $bankAccountId,
            ':total_ht'             => round($totalHt, 2),
            ':created_by'           => $userId,
        ]);

        $newDraftId = (int) $pdo->lastInsertId();
        respond(200, ['success' => true, 'draft_id' => $newDraftId, 'status' => 'saved']);
    }

} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
