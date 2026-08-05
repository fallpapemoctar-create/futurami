<?php
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $limitParam = isset($_GET['limit']) ? (int) $_GET['limit'] : 250;
    $limit = max(1, min($limitParam, 10000));
    $typeParam = isset($_GET['type']) ? trim((string) $_GET['type']) : '';

    $sql = [
        'SELECT rowid, ref, label, price, price_ttc, tva_tx',
        'FROM llx_product',
        'WHERE entity = :entity',
        'AND tosell = 1',
        'AND ((ref IS NOT NULL AND ref <> \'\') OR (label IS NOT NULL AND label <> \'\'))'
    ];
    $conditions = [];
    $bindings = [':entity' => $currentEntity];

    if ($typeParam !== '') {
        $sql[] = 'AND fk_product_type = :type';
        $bindings[':type'] = (int) $typeParam;
    }

    if ($query !== '') {
        $conditions[] = '(ref LIKE :q OR label LIKE :q)';
        $bindings[':q'] = '%' . $query . '%';
    }

    if ($conditions) {
        $sql[] = 'AND ' . implode(' AND ', $conditions);
    }

    $sql[] = 'ORDER BY label COLLATE utf8mb4_unicode_ci ASC, ref ASC';
    $sql[] = 'LIMIT :limit';
    $finalSql = implode(' ', $sql);

    $stmt = $pdo->prepare($finalSql);
    foreach ($bindings as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $languages = array_map(function ($row) {
        return [
            'id' => isset($row['rowid']) ? (int) $row['rowid'] : null,
            'ref' => $row['ref'] ?? '',
            'label' => $row['label'] ?? '',
            'price' => isset($row['price']) ? (float) $row['price'] : null,
            'price_ttc' => isset($row['price_ttc']) ? (float) $row['price_ttc'] : null,
            'tva_tx' => isset($row['tva_tx']) ? (float) $row['tva_tx'] : null,
            'display_name' => trim((string) ($row['label'] ?? $row['ref'] ?? '')),
        ];
    }, $rows);

    echo json_encode([
        'success' => true,
        'count' => count($languages),
        'languages' => $languages,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erreur serveur',
        'details' => $e->getMessage(),
    ]);
}
