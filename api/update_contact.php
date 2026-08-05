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
$clientId = isset($data['client_id']) ? (int)$data['client_id'] : 0;
$firstname = trim((string)($data['firstname'] ?? ''));
$lastname = trim((string)($data['lastname'] ?? ''));
if ($id <= 0 || $clientId <= 0 || ($firstname === '' && $lastname === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID, société et nom obligatoires']);
    exit;
}

$civility = trim((string)($data['civility'] ?? ''));
$position = trim((string)($data['position'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$personalPhone = trim((string)($data['personal_phone'] ?? ''));
$mobile = trim((string)($data['mobile'] ?? ''));
$fax = trim((string)($data['fax'] ?? ''));
$birthday = trim((string)($data['birthday'] ?? ''));
$address = trim((string)($data['address'] ?? ''));
$zip = trim((string)($data['zip'] ?? ''));
$town = trim((string)($data['town'] ?? ''));
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
        "UPDATE llx_socpeople SET
            fk_soc = :client_id,
            civility = :civility,
            firstname = :firstname,
            lastname = :lastname,
            poste = :position,
            email = :email,
            phone = :phone,
            phone_perso = :personal_phone,
            phone_mobile = :mobile,
            fax = :fax,
            birthday = :birthday,
            address = :address,
            zip = :zip,
            town = :town,
            note_public = :note_public,
            note_private = :note_private,
            fk_pays = :fk_pays,
            fk_departement = :fk_departement,
            statut = :status,
            fk_user_modif = :user_id
         WHERE rowid = :id AND entity = :entity"
    );
    $stmt->execute([
        ':id' => $id,
        ':entity' => $currentEntity,
        ':client_id' => $clientId,
        ':civility' => $civility,
        ':firstname' => $firstname,
        ':lastname' => $lastname,
        ':position' => $position,
        ':email' => $email,
        ':phone' => $phone,
        ':personal_phone' => $personalPhone,
        ':mobile' => $mobile,
        ':fax' => $fax,
        ':birthday' => $birthday !== '' ? $birthday : null,
        ':address' => $address,
        ':zip' => $zip,
        ':town' => $town,
        ':note_public' => $notePublic,
        ':note_private' => $notePrivate,
        ':fk_pays' => $fkCountry,
        ':fk_departement' => $fkDepartment,
        ':status' => $isActive ? 1 : 0,
        ':user_id' => $userId,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Contact mis à jour',
        'contact' => [
            'id' => $id,
            'client_id' => $clientId,
            'civility' => $civility,
            'firstname' => $firstname,
            'lastname' => $lastname,
            'email' => $email,
            'phone' => $phone,
            'phone_perso' => $personalPhone,
            'phone_mobile' => $mobile,
            'fax' => $fax,
            'birthday' => $birthday,
            'position' => $position,
            'address' => $address,
            'zip' => $zip,
            'town' => $town,
            'note_public' => $notePublic,
            'note_private' => $notePrivate,
            'fk_pays' => $fkCountry,
            'country_label' => $countryLabel,
            'fk_departement' => $fkDepartment,
            'department_label' => $departmentLabel,
            'status' => $isActive ? 1 : 0,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}