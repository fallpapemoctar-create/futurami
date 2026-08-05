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

$id = intval($data['id'] ?? 0);
$login = trim($data['username'] ?? '');
$fullname = trim($data['fullname'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? null; // optional
$canManageInterpreters = !empty($data['can_manage_interpreters']);
$canManageMissions = !empty($data['can_manage_missions']);
$isAdmin = !empty($data['is_admin']);
$isInterpreter = !empty($data['is_interpreter']);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid user id"]);
    exit;
}

try {
    // Cloisonnement : impossible de modifier un utilisateur d'une autre entité
    $ownCheck = $pdo->prepare("SELECT rowid FROM llx_user WHERE rowid = :id AND entity = :entity LIMIT 1");
    $ownCheck->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$ownCheck->fetch()) {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Utilisateur introuvable"]);
        exit;
    }

    // Split fullname into firstname / lastname
    $parts = preg_split('/\s+/', $fullname, -1, PREG_SPLIT_NO_EMPTY);
    $firstname = $parts[0] ?? '';
    $lastname = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '';

    // Update user fields
    $fields = [
        'login' => $login,
        'firstname' => $firstname,
        'lastname' => $lastname,
        'email' => $email,
        'admin' => $isAdmin ? 1 : 0
    ];

    $setSql = "login = :login, firstname = :firstname, lastname = :lastname, email = :email, admin = :admin";

    if (!is_null($password) && $password !== '') {
        $passCrypted = password_hash($password, PASSWORD_DEFAULT);
        $setSql .= ", pass_crypted = :pass";
        $fields['pass'] = $passCrypted;
    }

    $sql = "UPDATE llx_user SET $setSql WHERE rowid = :id AND entity = :entity";
    $stmt = $pdo->prepare($sql);
    $fields['id'] = $id;
    $fields['entity'] = $currentEntity;
    $stmt->execute($fields);

    // Replace rights: remove existing and insert selected
    $del = $pdo->prepare("DELETE FROM tble_user_rights WHERE user_id = ?");
    $del->execute([$id]);

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
            $ins->execute([':uid' => $id, ':rid' => $rid]);
        }
    }

    echo json_encode(["success" => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}


