<?php
require_once "config.php";
require_once __DIR__ . "/interprete_helpers.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: PUT, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucune donnée reçue']);
    exit;
}

$id = (int) ($data['id'] ?? $data['rowid'] ?? $data['id_tble_annuaire_interpretes'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID manquant ou invalide']);
    exit;
}

try {
    $lastname = valueFrom($data, ['Nom', 'lastname']);
    $firstname = valueFrom($data, ['Prenom', 'firstname']);
    if ($lastname === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nom obligatoire']);
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

    $sql = "
        UPDATE llx_user SET
            lastname = :lastname,
            firstname = :firstname,
            email = :email,
            office_phone = :office_phone,
            office_fax = :office_fax,
            user_mobile = :user_mobile,
            address = :address,
            zip = :zip,
            town = :town,
            fk_country = :fk_country,
            interp_langues = :langues,
            interp_commentaires = :commentaires,
            selectdispo = :selectdispo
        WHERE rowid = :id AND entity = :entity
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':lastname' => $lastname,
        ':firstname' => $firstname,
        ':email' => $email,
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
        ':id' => $id,
        ':entity' => $currentEntity,
    ]);

    ensureInterpreterRight($pdo, $id);

    echo json_encode(['success' => true, 'message' => 'Interprète mis à jour']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}