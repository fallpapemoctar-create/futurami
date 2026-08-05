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
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid user id"]);
    exit;
}

try {
    // Cloisonnement : impossible de supprimer un utilisateur d'une autre entité
    $ownCheck = $pdo->prepare("SELECT rowid FROM llx_user WHERE rowid = :id AND entity = :entity LIMIT 1");
    $ownCheck->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$ownCheck->fetch()) {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Utilisateur introuvable"]);
        exit;
    }

    // Remove rights
    $del = $pdo->prepare("DELETE FROM tble_user_rights WHERE user_id = ?");
    $del->execute([$id]);

    // Delete user
    $stmt = $pdo->prepare("DELETE FROM llx_user WHERE rowid = :id AND entity = :entity");
    $stmt->execute([':id' => $id, ':entity' => $currentEntity]);

    echo json_encode(["success" => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}

