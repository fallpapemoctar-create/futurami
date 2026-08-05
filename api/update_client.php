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

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucune donnée reçue']);
    exit;
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
$name = trim((string)($data['name'] ?? ''));
if ($id <= 0 || $name === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID et nom obligatoires']);
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
$isActive = !isset($data['is_active']) || (int)$data['is_active'] !== 0;
$userId = isset($data['user_id']) ? (int)$data['user_id'] : null;

$fkCountry = resolveCountryId($pdo, $countryInput);
$countryInfo = $fkCountry !== null ? countryInfoFromId($pdo, $fkCountry) : null;
$countryLabel = $countryInfo['label'] ?? ($countryInput !== '' ? $countryInput : '');
$fkDepartment = resolveDepartmentId($pdo, $departmentInput);
$departmentInfo = $fkDepartment !== null ? departmentInfoFromId($pdo, $fkDepartment) : null;
$departmentLabel = $departmentInfo['label'] ?? ($departmentInput !== '' ? $departmentInput : '');

try {
    $stmt = $pdo->prepare(
        "UPDATE llx_societe SET
            nom = :name,
            name_alias = :alias,
            address = :address,
            zip = :zip,
            town = :town,
            phone = :phone,
            fax = :fax,
            email = :email,
            url = :website,
            siren = :siren,
            siret = :siret,
            note_public = :note_public,
            note_private = :note_private,
            fk_pays = :fk_pays,
            fk_departement = :fk_departement,
            status = :status,
            fk_user_modif = :user_id
         WHERE rowid = :id AND entity = :entity"
    );
    $stmt->execute([
        ':id' => $id,
        ':entity' => $currentEntity,
        ':name' => $name,
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
        ':status' => $isActive ? 1 : 0,
        ':user_id' => $userId,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Société mise à jour',
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
            'status' => $isActive ? 1 : 0,
            'statut' => 1,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}