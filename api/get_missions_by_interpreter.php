<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
require_once "config.php";

function columnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $table = str_replace('`', '', $table);
        $column = str_replace('`', '', $column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
        return $stmt && $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Récupérer les données JSON envoyées
$input = json_decode(file_get_contents('php://input'), true);
$interpreter_id = $input['interpreter_id'] ?? null;

try {
    if ($interpreter_id) {
        // Return missions for the specified interpreter (existing behavior)
        $hasStatusPaymentColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'status_payment');
        $hasDatePaymentColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'date_payment');
        $statusFallbackExpr = $hasStatusPaymentColumn ? 'm.status_payment' : '0';
        $datePaymentSelect = $hasDatePaymentColumn ? 'm.date_payment' : 'NULL';
			$sql = "SELECT
                        m.rowid,
                        m.ref as reference_devis,
                        m.nominterprete,
                        m.debutmission,
                        m.finmission,
                        m.montant_mission,
                        -- status_payment is derived from billed.status when present
                        CASE
                            WHEN b.status IS NULL THEN {$statusFallbackExpr}
                            WHEN LOWER(b.status) IN ('paid','payé','payee','paye','1','yes','true') THEN 1
                            ELSE 0
                        END AS status_payment,
                        {$datePaymentSelect} AS date_payment,
                        b.status AS billed_status,
                        u.firstname,
                        u.lastname,
                        p.ref as produit_ref,
                        p.rowid as id_produit_service,
                        p.price_min AS prix_achat_ht,
                        p.price AS prix_vente_ht
                FROM llx_missionsplanet_mission m
                INNER JOIN llx_user u ON m.nominterprete = u.rowid
                LEFT JOIN llx_product p ON m.langue = p.rowid
                -- Join latest billed status per mission by matching on ref
                LEFT JOIN (
                    SELECT bb.ref, bb.status
                    FROM tble_mission_billed bb
                    INNER JOIN (
                        SELECT ref, MAX(billed_at) AS max_billed_at
                        FROM tble_mission_billed
                        GROUP BY ref
                    ) last ON last.ref = bb.ref AND last.max_billed_at = bb.billed_at
                ) b ON b.ref = m.ref
                WHERE m.nominterprete = :interpreter_id
                AND m.status <> 9
                AND u.entity = :entity
                ORDER BY m.debutmission DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(['interpreter_id' => $interpreter_id, 'entity' => $currentEntity]);
        $missions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['total' => count($missions), 'data' => $missions]);
        exit;
    }

    // When no interpreter_id provided, return interpreters who have at least one mission
    // (this lets the client display a list with a 'consulter' button for each interpreter)
    $sqlInterpreters = "SELECT
        u.rowid as id,
        u.firstname,
        u.lastname,
        COUNT(m.rowid) as missions_count
    FROM llx_user u
    INNER JOIN llx_missionsplanet_mission m ON m.nominterprete = u.rowid
    WHERE m.status <> 9
    AND u.entity = :entity
    GROUP BY u.rowid, u.firstname, u.lastname
    HAVING COUNT(m.rowid) >= 1
    ORDER BY u.lastname ASC, u.firstname ASC";

    $stmt = $pdo->prepare($sqlInterpreters);
    $stmt->execute([':entity' => $currentEntity]);
    $interpreters = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Map to UI-friendly structure
    $result = array_map(function($r) {
        $display = trim((($r['lastname'] ?? '') . ' ' . ($r['firstname'] ?? '')));
        return [
            'id' => $r['id'],
            'display_name' => mb_strtoupper($display, 'UTF-8'),
            'firstname' => $r['firstname'] ?? '',
            'lastname' => $r['lastname'] ?? '',
            'missions_count' => (int)$r['missions_count'],
            // client will call this same endpoint with interpreter_id to get missions
            'can_consulter' => true,
        ];
    }, $interpreters);

    echo json_encode($result, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => "Erreur serveur",
        "details" => $e->getMessage()
    ]);
}
?>