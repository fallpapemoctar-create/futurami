<?php
/**
 * update_payment_term.php — futurAMI
 *
 * Met à jour un terme de paiement (llx_c_payment_term) appartenant à
 * l'entité courante. Cloisonnement : 404 si hors périmètre.
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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
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
    $ownCheck = $pdo->prepare('SELECT rowid FROM llx_c_payment_term WHERE rowid = :id AND entity = :entity LIMIT 1');
    $ownCheck->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$ownCheck->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Terme de paiement introuvable pour cette entité']);
        exit;
    }

    $fields = [];
    $params = [':id' => $id, ':entity' => $currentEntity];

    if (array_key_exists('label', $data)) {
        $fields[] = 'libelle = :libelle';
        $params[':libelle'] = trim((string)$data['label']);
    }
    if (array_key_exists('label_facture', $data)) {
        $fields[] = 'libelle_facture = :libelle_facture';
        $params[':libelle_facture'] = trim((string)$data['label_facture']);
    }
    if (array_key_exists('code', $data)) {
        $code = trim((string)$data['code']);
        if ($code !== '') {
            $fields[] = 'code = :code';
            $params[':code'] = substr($code, 0, 16);
        }
    }
    if (array_key_exists('days', $data)) {
        $fields[] = 'nbjour = :nbjour';
        $params[':nbjour'] = (int)$data['days'];
    }
    if (array_key_exists('shift', $data)) {
        $fields[] = 'decalage = :decalage';
        $params[':decalage'] = (int)$data['shift'];
    }
    if (array_key_exists('active', $data)) {
        $fields[] = 'active = :active';
        $params[':active'] = !empty($data['active']) ? 1 : 0;
    }

    if (empty($fields)) {
        echo json_encode(['success' => false, 'error' => 'Aucun champ à mettre à jour']);
        exit;
    }

    $sql = 'UPDATE llx_c_payment_term SET ' . implode(', ', $fields) . ' WHERE rowid = :id AND entity = :entity';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['success' => true, 'message' => 'Terme de paiement mis à jour'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
