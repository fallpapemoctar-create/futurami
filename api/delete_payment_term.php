<?php
/**
 * delete_payment_term.php — futurAMI
 *
 * Désactive (soft-delete via active = 0) un terme de paiement de l'entité
 * courante. On évite la suppression physique car les factures/devis stockent
 * une référence vers le terme choisi (payment_condition_id) : une
 * suppression dure casserait l'historique.
 */
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucune donnée reçue']);
    exit;
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID invalide']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        'UPDATE llx_c_payment_term SET active = 0 WHERE rowid = :id AND entity = :entity'
    );
    $stmt->execute([':id' => $id, ':entity' => $currentEntity]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Terme de paiement introuvable pour cette entité']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Terme de paiement désactivé'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
