<?php
/**
 * add_language.php — futurAMI
 *
 * Crée une langue/prestation (référentiel llx_product) pour l'entité courante.
 * Chaque entité dispose désormais de son propre référentiel de langues
 * (cloisonnement multi-entités), au même titre que les clients/contacts.
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

$label = trim((string)($data['label'] ?? ''));
if ($label === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Libellé obligatoire']);
    exit;
}

$ref = trim((string)($data['ref'] ?? ''));
if ($ref === '') {
    // Génère une référence à partir du libellé si absente.
    $ref = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', $label));
    $ref = trim($ref, '-');
    if ($ref === '') {
        $ref = 'LANG-' . time();
    }
}
$ref = substr($ref, 0, 128);

$price = isset($data['price']) ? (float)$data['price'] : 0.0;
$priceTtc = isset($data['price_ttc']) ? (float)$data['price_ttc'] : $price;
$tvaTx = isset($data['tva_tx']) ? (float)$data['tva_tx'] : 0.0;
$fkProductType = isset($data['fk_product_type']) ? (int)$data['fk_product_type'] : 1; // 1 = service (langue/prestation)

try {
    // Unicité (ref, entity) : on vérifie en amont pour renvoyer un message clair.
    $chk = $pdo->prepare('SELECT 1 FROM llx_product WHERE ref = :ref AND entity = :entity LIMIT 1');
    $chk->execute([':ref' => $ref, ':entity' => $currentEntity]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Une langue avec cette référence existe déjà']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO llx_product (
            ref, entity, label, price, price_ttc, price_base_type, tva_tx,
            fk_product_type, tosell, tobuy, datec
        ) VALUES (
            :ref, :entity, :label, :price, :price_ttc, 'HT', :tva_tx,
            :fk_product_type, 1, 1, NOW()
        )"
    );
    $stmt->execute([
        ':ref' => $ref,
        ':entity' => $currentEntity,
        ':label' => $label,
        ':price' => $price,
        ':price_ttc' => $priceTtc,
        ':tva_tx' => $tvaTx,
        ':fk_product_type' => $fkProductType,
    ]);

    $id = (int)$pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Langue créée',
        'language' => [
            'id' => $id,
            'ref' => $ref,
            'label' => $label,
            'price' => $price,
            'price_ttc' => $priceTtc,
            'tva_tx' => $tvaTx,
            'display_name' => $label,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
