<?php
require_once __DIR__ . "/../config.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Aucune donnée reçue"]);
    exit;
}

$login = trim($data['username'] ?? '');
$fullname = trim($data['fullname'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$canManageInterpreters = !empty($data['can_manage_interpreters']);
$canManageMissions = !empty($data['can_manage_missions']);
$isAdmin = !empty($data['is_admin']);
$isInterpreter = !empty($data['is_interpreter']);

if (empty($login) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "username or password missing"]);
    exit;
}

try {
    // Vérifier existence login
    $stmt = $pdo->prepare("SELECT rowid FROM llx_user WHERE login = ? LIMIT 1");
    $stmt->execute([$login]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Utilisateur déjà existant"]);
        exit;
    }

    // Split fullname into firstname / lastname
    $parts = preg_split('/\s+/', $fullname, -1, PREG_SPLIT_NO_EMPTY);
    $firstname = $parts[0] ?? '';
    $lastname = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '';

    // Hasher le mot de passe
    $passCrypted = password_hash($password, PASSWORD_DEFAULT);

    // Insérer l'utilisateur; set admin column according to isAdmin
    // NB: entity = $currentEntity (issu du token, cf config.php) et non une
    // valeur codée en dur — sinon tout utilisateur créé resterait invisible
    // pour toute entité différente de celle codée en dur (bug corrigé ici).
    $sql = "INSERT INTO llx_user (login, pass_crypted, firstname, lastname, email, entity, statut, admin)
            VALUES (:login, :pass, :firstname, :lastname, :email, :entity, 1, :admin)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':login' => $login,
        ':pass' => $passCrypted,
        ':firstname' => $firstname,
        ':lastname' => $lastname,
        ':email' => $email,
        ':entity' => $currentEntity,
        ':admin' => $isAdmin ? 1 : 0
    ]);

    $userId = $pdo->lastInsertId();

    // Assigner les droits si présents
    $rightsToAssign = [];
    if ($canManageInterpreters) $rightsToAssign[] = 'agent_admin_annuaire';
    if ($canManageMissions) $rightsToAssign[] = 'agent_admin_mission';
    if ($isInterpreter) $rightsToAssign[] = 'interprete';
    if ($isAdmin) $rightsToAssign[] = 'admin';

    foreach ($rightsToAssign as $rname) {
        $s = $pdo->prepare("SELECT id FROM tble_rights WHERE name = ? LIMIT 1");
        $s->execute([$rname]);
        $rid = $s->fetchColumn();
        if ($rid) {
            $ins = $pdo->prepare("INSERT INTO tble_user_rights (user_id, right_id) VALUES (:uid, :rid)");
            $ins->execute([':uid' => $userId, ':rid' => $rid]);
        }
    }

    echo json_encode(["success" => true, "id" => $userId]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}

