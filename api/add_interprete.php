<?php
require_once "config.php";
require_once __DIR__ . "/interprete_helpers.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Aucune donnée reçue"]);
    exit;
}

try {
    $lastname = valueFrom($data, ['Nom', 'lastname']);
    $firstname = valueFrom($data, ['Prenom', 'firstname']);
    if ($lastname === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Nom obligatoire"]);
        exit;
    }

    $numero = valueFrom($data, ['Numero']);
    $email = valueFrom($data, ['Email', 'email']);
    $telMobile = valueFrom($data, ['Tel_Mobile', 'tel_mobile']);
    $telDomicile = valueFrom($data, ['Tel_domicile', 'tel_domicile']);
    $langues = valueFrom($data, ['Langues_parlees', 'langues_parlees']);
    $adresse = valueFrom($data, ['Adresse', 'adresse']);
    $codePostal = valueFrom($data, ['Code_postal', 'code_postal']);
    $ville = valueFrom($data, ['Ville', 'ville']);
    $pays = valueFrom($data, ['Pays', 'pays']);
    $commentaires = valueFrom($data, ['Commentaires', 'commentaires']);
    $status = normalizeStatus(valueFrom($data, ['status', 'statut', 'selectdispo']));

    $countryInput = valueFrom($data, ['fk_country', 'country_id', 'country']);
    if ($countryInput === '') {
        $countryInput = $pays;
    }
    $fkCountry = resolveCountryId($pdo, $countryInput);
    $countryInfo = $fkCountry !== null ? countryInfoFromId($pdo, $fkCountry) : null;
    $countryLabel = $countryInfo['label'] ?? ($pays !== '' ? $pays : null);

    $baseLogin = slugifyLogin($lastname . getFirstLetter($firstname));
    $login = ensureUniqueLogin($pdo, $baseLogin);
    $plainPassword = $lastname . '2026';
    $hashedPassword = password_hash($plainPassword, PASSWORD_DEFAULT);

    $pdo->beginTransaction();

    $sql = "
        INSERT INTO llx_user (
            login,
            pass_crypted,
            lastname,
            firstname,
            email,
            entity,
            statut,
            admin,
            office_phone,
            office_fax,
            user_mobile,
            address,
            zip,
            town,
            fk_country,
            interp_langues,
            interp_commentaires,
            selectdispo,
            datec
        ) VALUES (
            :login,
            :pass,
            :lastname,
            :firstname,
            :email,
            :entity,
            1,
            0,
            :office_phone,
            :office_fax,
            :user_mobile,
            :address,
            :zip,
            :town,
            :fk_country,
            :langues,
            :commentaires,
            :selectdispo,
            NOW()
        )
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':login' => $login,
        ':pass' => $hashedPassword,
        ':lastname' => $lastname,
        ':firstname' => $firstname,
        ':email' => $email,
        ':entity' => $currentEntity,
        ':office_phone' => $numero,
        ':office_fax' => $telDomicile,
        ':user_mobile' => $telMobile,
        ':address' => $adresse,
        ':zip' => $codePostal,
        ':town' => $ville,
        ':fk_country' => $fkCountry,
        ':langues' => $langues,
        ':commentaires' => $commentaires,
        ':selectdispo' => $status,
    ]);

    $userId = (int) $pdo->lastInsertId();

    ensureInterpreterRight($pdo, $userId);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Interprète créé',
        'id' => $userId,
        'login' => $login,
        'generated_password' => $plainPassword,
        'fk_country' => $fkCountry,
        'country_label' => $countryLabel,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}