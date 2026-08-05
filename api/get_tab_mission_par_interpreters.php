<?php
require_once "config.php";

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

try {
    $sql = "SELECT
        m.nominterprete,
        u.firstname,
        u.lastname
    FROM llx_missionsplanet_mission m
    INNER JOIN llx_user u ON m.nominterprete = u.rowid
    WHERE u.entity = :entity
      AND m.status <> 9
    GROUP BY m.nominterprete, u.firstname, u.lastname
    ORDER BY u.lastname ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':entity' => $currentEntity]);

    $missions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($missions);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => "Erreur serveur",
        "details" => $e->getMessage()
    ]);
}