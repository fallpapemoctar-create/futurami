<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/interprete_helpers.php';

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

$name = trim((string)($data['name'] ?? ''));
if ($name === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nom obligatoire']);
    exit;
}

$alias = trim((string)($data['alias'] ?? ''));
$address = trim((string)($data['address'] ?? ''));
$zip = trim((string)($data['zip'] ?? ''));
$town = trim((string)($data['town'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$fax = trim((string)($data['fax'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$website = trim((string)($data['website'] ?? ''));
$siren = trim((string)($data['siren'] ?? ''));
$siret = trim((string)($data['siret'] ?? ''));
$notePublic = trim((string)($data['note_public'] ?? ''));
$notePrivate = trim((string)($data['note_private'] ?? ''));
$countryInput = valueFrom($data, ['fk_pays', 'country_id', 'country']);
$departmentInput = valueFrom($data, ['fk_departement', 'department_id', 'department']);
$userId = isset($data['user_id']) ? (int)$data['user_id'] : null;

$fkCountry = resolveCountryId($pdo, $countryInput);
$countryInfo = $fkCountry !== null ? countryInfoFromId($pdo, $fkCountry) : null;
$countryLabel = $countryInfo['label'] ?? ($countryInput !== '' ? $countryInput : '');
$fkDepartment = resolveDepartmentId($pdo, $departmentInput);
$departmentInfo = $fkDepartment !== null ? departmentInfoFromId($pdo, $fkDepartment) : null;
$departmentLabel = $departmentInfo['label'] ?? ($departmentInput !== '' ? $departmentInput : '');

try {
    $stmt = $pdo->prepare(
        "INSERT INTO llx_societe (
            nom, entity, statut, status, fk_stcomm, client, fournisseur,
            name_alias, address, zip, town, phone, fax, email, url,
            siren, siret, note_public, note_private, fk_pays, fk_departement, datec, fk_user_creat
        ) VALUES (
            :name, :entity, 1, 1, 0, 1, 0,
            :alias, :address, :zip, :town, :phone, :fax, :email, :website,
            :siren, :siret, :note_public, :note_private, :fk_pays, :fk_departement, NOW(), :user_id
        )"
    );
    $stmt->execute([
        ':name' => $name,
        ':entity' => $currentEntity,
        ':alias' => $alias,
        ':address' => $address,
        ':zip' => $zip,
        ':town' => $town,
        ':phone' => $phone,
        ':fax' => $fax,
        ':email' => $email,
        ':website' => $website,
        ':siren' => $siren,
        ':siret' => $siret,
        ':note_public' => $notePublic,
        ':note_private' => $notePrivate,
        ':fk_pays' => $fkCountry,
        ':fk_departement' => $fkDepartment,
        ':user_id' => $userId,
    ]);

    $id = (int)$pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Société créée',
        'company' => [
            'id' => $id,
            'name' => $name,
            'alias' => $alias,
            'address' => $address,
            'zip' => $zip,
            'town' => $town,
            'phone' => $phone,
            'fax' => $fax,
            'email' => $email,
            'website' => $website,
            'siren' => $siren,
            'siret' => $siret,
            'note_public' => $notePublic,
            'note_private' => $notePrivate,
            'fk_pays' => $fkCountry,
            'country_label' => $countryLabel,
            'fk_departement' => $fkDepartment,
            'department_label' => $departmentLabel,
            'status' => 1,
            'statut' => 1,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}