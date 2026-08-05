<?php
require_once "config.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: DELETE, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? [];

$id = (int) ($_GET['id'] ?? $data['id'] ?? $data['rowid'] ?? $data['id_tble_annuaire_interpretes'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID manquant ou invalide']);
    exit;
}

try {
    // Soft delete : statut = -1 (suppression logique) pour éviter les erreurs
    // de contrainte FK depuis llx_facture, llx_missionsplanet_mission, etc.
    $stmt = $pdo->prepare("UPDATE llx_user SET statut = -1 WHERE rowid = :id AND entity = :entity AND statut != -1");
    $stmt->execute([':id' => $id, ':entity' => $currentEntity]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Interprète introuvable ou déjà supprimé"]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Interprète supprimé']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}