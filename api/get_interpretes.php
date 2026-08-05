<?php
require_once "config.php";
require_once __DIR__ . "/interprete_helpers.php";

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

try {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 250;
    if ($limit <= 0 || $limit > 10000) {
        $limit = 250;
    }

    $sql = "
        SELECT 
            u.rowid,
            u.lastname,
            u.firstname,
            u.email,
            u.user_mobile,
            u.office_phone,
            u.office_fax,
            u.address,
            u.zip,
            u.town,
            u.fk_country,
            u.interp_langues,
            u.interp_commentaires,
            u.selectdispo,
            c.label AS country_label,
            c.code AS country_code,
            c.code_iso AS country_iso
                FROM llx_user u
                LEFT JOIN llx_c_country c ON c.rowid = u.fk_country
                WHERE u.rowid IS NOT NULL
                AND u.entity = :entity
                AND (u.statut IS NULL OR u.statut != -1)
    ";

    $params = [':entity' => $currentEntity];
    if ($q !== '') {
        $sql .= " AND (
            u.lastname LIKE :search
            OR u.firstname LIKE :search
            OR CONCAT_WS(' ', u.lastname, u.firstname) LIKE :search
            OR CONCAT_WS(' ', u.firstname, u.lastname) LIKE :search
            OR u.email LIKE :search
            OR u.interp_langues LIKE :search
            OR u.login LIKE :search
        )";
        $params[':search'] = '%' . $q . '%';
    }

    $sql .= "
        ORDER BY u.lastname ASC, u.firstname ASC
        LIMIT :limit
    ";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        if ($key === ':entity') {
            $stmt->bindValue($key, $value, PDO::PARAM_INT);
        } else {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        }
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $interpretes = array_map(function($r) {
        $lastname = $r['lastname'] ?? '';
        $firstname = $r['firstname'] ?? '';
        $nom = trim($lastname . ' ' . $firstname);

        $status = normalizeStatus($r['selectdispo'] ?? null);

        $displayName = $nom !== '' ? $nom : ($r['email'] ?? '');
        if ($displayName !== '' && function_exists('mb_strtoupper')) {
            $displayName = mb_strtoupper($displayName, 'UTF-8');
        } else {
            $displayName = strtoupper($displayName);
        }

        return [
            'id' => $r['rowid'] ?? null,
            'numero' => $r['office_phone'] ?? null,
            'display_name' => $displayName,
            'firstname' => $firstname,
            'lastname' => $lastname,
            'email' => $r['email'] ?? null,
            'tel_mobile' => $r['user_mobile'] ?? null,
            'tel_domicile' => $r['office_fax'] ?? null,
            'langues_parlees' => $r['interp_langues'] ?? null,
            'adresse' => $r['address'] ?? null,
            'code_postal' => $r['zip'] ?? null,
            'ville' => $r['town'] ?? null,
            'pays' => $r['country_label'] ?? null,
            'country_label' => $r['country_label'] ?? null,
            'fk_country' => $r['fk_country'] ?? null,
            'country_code' => $r['country_code'] ?? $r['country_iso'] ?? null,
            'country_iso' => $r['country_iso'] ?? null,
            'commentaires' => $r['interp_commentaires'] ?? null,
            'status' => $status,
            'selectdispo' => $r['selectdispo'] ?? null,
        ];
    }, $rows);

    echo json_encode($interpretes, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'details' => $e->getMessage()
    ]);
}