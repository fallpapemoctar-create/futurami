<?php
require_once "config.php";
require_once __DIR__ . "/interprete_helpers.php";

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

try {
    $cache = getCountriesCache($pdo);
    $countries = array_values(array_map(function ($entry) {
        return [
            'id' => $entry['id'],
            'label' => $entry['label'],
            'code' => $entry['code'],
            'code_iso' => $entry['code_iso'],
        ];
    }, $cache['by_id']));

    usort($countries, function ($a, $b) {
        return strcasecmp($a['label'], $b['label']);
    });

    echo json_encode($countries, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'details' => $e->getMessage(),
    ]);
}
