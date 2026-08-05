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
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$invoiceNumber = trim((string) ($input['invoice_number'] ?? $input['invoice'] ?? ''));
if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Le numéro de facture est obligatoire.']);
}

$statusInput = $input['status'] ?? $input['status_code'] ?? $input['status_label'] ?? null;
[$statusCode, $statusLabel] = normalizeClientBillingStatus($statusInput);
$customLabel = trim((string) ($input['status_label'] ?? ''));
if ($customLabel !== '') {
    $statusLabel = $customLabel;
}

$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));

try {
    ensureClientBillingTable($pdo);

    $stmt = $pdo->prepare("UPDATE tble_client_billed SET status_code = :code, status_label = :label, updated_at = CURRENT_TIMESTAMP WHERE invoice_number = :invoice AND entity = :entity");
    $stmt->execute([
        ':code' => $statusCode,
        ':label' => $statusLabel,
        ':invoice' => $invoiceNumber,
        ':entity' => $currentEntity,
    ]);

    if ($stmt->rowCount() === 0) {
        respond(404, ['success' => false, 'error' => 'Facture introuvable.']);
    }

    // Quand la facture client passe en "validée", promouvoir les missions
    // associées de Brouillon (0) vers Validée (1). Les missions annulées (9)
    // ne sont jamais modifiées.
    if ($statusCode === 'validated') {
        $missionRefs = $pdo->prepare(
            "SELECT DISTINCT mission_ref FROM tble_client_billed WHERE invoice_number = :invoice AND entity = :entity"
        );
        $missionRefs->execute([':invoice' => $invoiceNumber, ':entity' => $currentEntity]);
        $refs = $missionRefs->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($refs)) {
            ensureMissionEntityColumn($pdo);
            $placeholders = implode(',', array_fill(0, count($refs), '?'));
            $upd = $pdo->prepare(
                "UPDATE llx_missionsplanet_mission
                 SET status = 1
                 WHERE ref IN ($placeholders)
                   AND status = 0   -- uniquement les brouillons
                   AND entity = ?"  // défense en profondeur, générique quelle que soit l'entité
            );
            $upd->execute([...$refs, $currentEntity]);
        }
    }

    respond(200, [
        'success' => true,
        'invoice_number' => $invoiceNumber,
        'status_code' => $statusCode,
        'status_label' => $statusLabel,
        'updated_by' => $userId,
        'updated_by_name' => $userName,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
