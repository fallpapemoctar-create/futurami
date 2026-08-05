<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
require_once "config.php";
require_once __DIR__ . "/billing_helpers.php";

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
        exit;
    }

    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "id requis"]);
        exit;
    }

    // S'assure que llx_missionsplanet_mission a bien sa colonne entity propre
    // (auto-réparateur : backfill DEFAULT 1 sur les lignes existantes si besoin).
    ensureMissionEntityColumn($pdo);

    // Cloisonnement multi-entités : filtre direct sur m.entity, générique
    // quelle que soit l'entité courante.
    $chkMission = $pdo->prepare(
        "SELECT 1 FROM llx_missionsplanet_mission m
         WHERE m.rowid = :id AND m.entity = :entity LIMIT 1"
    );
    $chkMission->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$chkMission->fetchColumn()) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Mission introuvable"]);
        exit;
    }

    // Soft-delete: mark mission as deleted (status = 9) to align with queries using status <> 9
    $stmt = $pdo->prepare("UPDATE llx_missionsplanet_mission SET status = 9 WHERE rowid = :id AND entity = :entity");
    $ok = $stmt->execute([':id' => $id, ':entity' => $currentEntity]);

    echo json_encode(["success" => $ok]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
