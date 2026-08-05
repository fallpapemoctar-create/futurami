<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/interprete_helpers.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 0;
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === '1';
    if ($limit <= 0) {
        $limit = PHP_INT_MAX; // pas de limite : retourner toutes les societes
    }

        $sql = "SELECT s.rowid AS id, s.nom AS name, s.name_alias, s.address, s.zip, s.town, s.phone, s.fax, s.email, s.url,
                   siren, siret, note_private, note_public,
                 s.fk_pays, s.fk_departement,
                 c.label AS country_label, d.nom AS department_label,
                 COALESCE(s.status, 1) AS status, COALESCE(s.statut, 1) AS statut
             FROM llx_societe s
             LEFT JOIN llx_c_country c ON c.rowid = s.fk_pays
             LEFT JOIN llx_c_departements d ON d.rowid = s.fk_departement
             WHERE s.nom IS NOT NULL AND s.nom <> ''
               AND s.entity = :entity";
    $params = [':entity' => $currentEntity];
    if ($activeOnly) {
        $sql .= " AND COALESCE(s.status, 1) <> 0";
    }
    if ($q !== '') {
        $sql .= " AND (s.nom LIKE :search OR s.name_alias LIKE :search OR s.email LIKE :search OR s.phone LIKE :search OR s.fax LIKE :search OR s.town LIKE :search OR s.siren LIKE :search OR s.siret LIKE :search)";
        $params[':search'] = '%' . $q . '%';
    }
    if ($limit < PHP_INT_MAX) {
        $sql .= " ORDER BY s.nom ASC LIMIT :limit";
    } else {
        $sql .= " ORDER BY s.nom ASC";
    }

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v, PDO::PARAM_STR);
    }
    if ($limit < PHP_INT_MAX) {
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    }
    $stmt->execute();

    $clients = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $clients[] = [
            'id' => isset($row['id']) ? (int)$row['id'] : null,
            'name' => $row['name'] ?? '',
            'alias' => $row['name_alias'] ?? '',
            'address' => $row['address'] ?? '',
            'zip' => $row['zip'] ?? '',
            'town' => $row['town'] ?? '',
            'phone' => $row['phone'] ?? '',
            'fax' => $row['fax'] ?? '',
            'email' => $row['email'] ?? '',
            'website' => $row['url'] ?? '',
            'siren' => $row['siren'] ?? '',
            'siret' => $row['siret'] ?? '',
            'note_private' => $row['note_private'] ?? '',
            'note_public' => $row['note_public'] ?? '',
            'fk_pays' => isset($row['fk_pays']) ? (int)$row['fk_pays'] : 0,
            'country_label' => $row['country_label'] ?? '',
            'fk_departement' => isset($row['fk_departement']) ? (int)$row['fk_departement'] : 0,
            'department_label' => $row['department_label'] ?? '',
            'status' => isset($row['status']) ? (int)$row['status'] : 1,
            'statut' => isset($row['statut']) ? (int)$row['statut'] : 1,
        ];
    }

    echo json_encode([
        'success' => true,
        'count' => count($clients),
        'clients' => $clients,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error',
        'details' => $e->getMessage(),
    ]);
}
