<?php
require_once "config.php";
require_once __DIR__ . "/interprete_helpers.php";

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

try {
    $cache = getDepartmentsCache($pdo);
    $departments = array_values(array_map(function ($entry) {
        return [
            'id' => $entry['id'],
            'label' => $entry['label'],
            'code' => $entry['code'],
        ];
    }, $cache['by_id']));

    usort($departments, function ($a, $b) {
        return strcasecmp($a['label'], $b['label']);
    });

    echo json_encode($departments, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'details' => $e->getMessage(),
    ]);
}
