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

$clientId = isset($data['client_id']) ? (int)$data['client_id'] : 0;
$firstname = trim((string)($data['firstname'] ?? ''));
$lastname = trim((string)($data['lastname'] ?? ''));
if ($clientId <= 0 || ($firstname === '' && $lastname === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Société et nom obligatoires']);
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
$userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;

$fkCountry = resolveCountryId($pdo, $countryInput);
$countryInfo = $fkCountry !== null ? countryInfoFromId($pdo, $fkCountry) : null;
$countryLabel = $countryInfo['label'] ?? ($countryInput !== '' ? $countryInput : '');
$fkDepartment = resolveDepartmentId($pdo, $departmentInput);
$departmentInfo = $fkDepartment !== null ? departmentInfoFromId($pdo, $fkDepartment) : null;
$departmentLabel = $departmentInfo['label'] ?? ($departmentInput !== '' ? $departmentInput : '');

try {
    // Vérifier que le client appartient bien à l'entité courante
    $chk = $pdo->prepare('SELECT 1 FROM llx_societe WHERE rowid = :id AND entity = :entity');
    $chk->execute([':id' => $clientId, ':entity' => $currentEntity]);
    if (!$chk->fetchColumn()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Client hors entité']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO llx_socpeople (
            fk_soc, entity, civility, firstname, lastname, poste, email, phone,
            phone_perso, phone_mobile, fax, birthday, address, zip, town,
            note_public, note_private, fk_pays, fk_departement, no_email, priv,
            fk_stcommcontact, fk_user_creat, statut, datec
        ) VALUES (
            :client_id, :entity, :civility, :firstname, :lastname, :position, :email, :phone,
            :personal_phone, :mobile, :fax, :birthday, :address, :zip, :town,
            :note_public, :note_private, :fk_pays, :fk_departement, 0, 0,
            0, :user_id, 1, NOW()
        )"
    );
    $stmt->execute([
        ':client_id' => $clientId,
        ':entity' => $currentEntity,
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
        ':user_id' => $userId,
    ]);

    $id = (int)$pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Contact créé',
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
            'status' => 1,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}