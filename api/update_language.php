<?php
/**
 * update_language.php — futurAMI
 *
 * Met à jour une langue/prestation (llx_product) appartenant à l'entité
 * courante. Cloisonnement : impossible de modifier une langue d'une autre
 * entité (404 si non trouvée dans le périmètre).
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
    $ownCheck = $pdo->prepare('SELECT rowid FROM llx_product WHERE rowid = :id AND entity = :entity LIMIT 1');
    $ownCheck->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$ownCheck->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Langue introuvable pour cette entité']);
        exit;
    }

    $fields = [];
    $params = [':id' => $id, ':entity' => $currentEntity];

    if (array_key_exists('label', $data)) {
        $fields[] = 'label = :label';
        $params[':label'] = trim((string)$data['label']);
    }
    if (array_key_exists('ref', $data)) {
        $ref = trim((string)$data['ref']);
        if ($ref !== '') {
            $fields[] = 'ref = :ref';
            $params[':ref'] = substr($ref, 0, 128);
        }
    }
    if (array_key_exists('price', $data)) {
        $fields[] = 'price = :price';
        $params[':price'] = (float)$data['price'];
    }
    if (array_key_exists('price_ttc', $data)) {
        $fields[] = 'price_ttc = :price_ttc';
        $params[':price_ttc'] = (float)$data['price_ttc'];
    }
    if (array_key_exists('tva_tx', $data)) {
        $fields[] = 'tva_tx = :tva_tx';
        $params[':tva_tx'] = (float)$data['tva_tx'];
    }
    if (array_key_exists('fk_product_type', $data)) {
        $fields[] = 'fk_product_type = :fk_product_type';
        $params[':fk_product_type'] = (int)$data['fk_product_type'];
    }

    if (empty($fields)) {
        echo json_encode(['success' => false, 'error' => 'Aucun champ à mettre à jour']);
        exit;
    }

    $sql = 'UPDATE llx_product SET ' . implode(', ', $fields) . ' WHERE rowid = :id AND entity = :entity';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['success' => true, 'message' => 'Langue mise à jour'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
