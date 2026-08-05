<?php
// Public API for UI: returns prepared users data and summary for dashboard
require_once __DIR__ . "/../config.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Select users and compute rights
    $sql = "
        SELECT
            u.rowid AS id,
            u.login AS username,
            CONCAT(u.firstname, ' ', u.lastname) AS fullname,
            u.email AS email,
            u.statut AS statut,
            u.admin AS admin_column,
            MAX(CASE WHEN r.name = 'agent_admin_annuaire' THEN 1 ELSE 0 END) AS can_manage_interpreters,
            MAX(CASE WHEN r.name = 'agent_admin_mission' THEN 1 ELSE 0 END) AS can_manage_missions,
            MAX(CASE WHEN r.name = 'interprete' THEN 1 ELSE 0 END) AS is_interpreter,
            MAX(CASE WHEN r.name = 'admin' THEN 1 ELSE 0 END) AS is_admin_from_rights
        FROM llx_user u
        LEFT JOIN tble_user_rights ur ON ur.user_id = u.rowid
        LEFT JOIN tble_rights r ON r.id = ur.right_id
        WHERE u.entity = :entity
          AND (u.statut IS NULL OR u.statut != -1)
        GROUP BY u.rowid
        ORDER BY u.lastname ASC, u.firstname ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':entity' => $currentEntity]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Prepare per-user display data and summary counters
    $total = 0;
    $active = 0;
    $countInterpreters = 0;
    $countMissions = 0;
    $countAdmins = 0;

    foreach ($users as &$u) {
        $total++;
        $u['can_manage_interpreters'] = !empty($u['can_manage_interpreters']) ? true : false;
        $u['can_manage_missions'] = !empty($u['can_manage_missions']) ? true : false;
        $u['is_interpreter'] = !empty($u['is_interpreter']) ? true : false;

        $isAdmin = (!empty($u['is_admin_from_rights']) ? 1 : 0) || (!empty($u['admin_column']) ? 1 : 0);
        $u['is_admin'] = $isAdmin ? true : false;

        $u['is_active'] = isset($u['statut']) && intval($u['statut']) === 1 ? true : false;
        $u['status_label'] = $u['is_active'] ? 'Actif' : 'Inactif';

        if ($u['is_active']) $active++;
        if ($u['can_manage_interpreters']) $countInterpreters++;
        if ($u['can_manage_missions']) $countMissions++;
        if ($u['is_admin']) $countAdmins++;

        // Build rights array and display metadata
        $rights = [];
        if ($u['is_admin']) $rights[] = 'admin';
        if ($u['can_manage_missions']) $rights[] = 'can_manage_missions';
        if ($u['can_manage_interpreters']) $rights[] = 'can_manage_interpreters';
        if ($u['is_interpreter']) $rights[] = 'interprete';
        $u['rights'] = $rights;

        $rightsDisplay = [];
        foreach ($rights as $s) {
            if ($s === 'admin') {
                $rightsDisplay[] = ['key' => 'admin', 'label' => 'Administrateur', 'icon' => 'shield'];
            } elseif ($s === 'can_manage_missions') {
                $rightsDisplay[] = ['key' => 'can_manage_missions', 'label' => 'Gestionnaire missions', 'icon' => 'work'];
            } elseif ($s === 'can_manage_interpreters') {
                $rightsDisplay[] = ['key' => 'can_manage_interpreters', 'label' => 'Gestionnaire interprètes', 'icon' => 'translate'];
            } elseif ($s === 'interprete') {
                $rightsDisplay[] = ['key' => 'interprete', 'label' => 'Interprète', 'icon' => 'person'];
            }
        }
        $u['rights_display'] = $rightsDisplay;

        // Display helper
        $u['display'] = [
            'title' => $u['fullname'],
            'subtitle' => $u['email'],
        ];

        // Actions allowed for UI
        $u['actions'] = ['edit', 'delete'];

        // Remove intermediate internal columns
        unset($u['is_admin_from_rights'], $u['admin_column']);
    }

    $response = [
        'success' => true,
        'summary' => [
            'total_users' => $total,
            'active_users' => $active,
            'interpreters_count' => $countInterpreters,
            'missions_count' => $countMissions,
            'administrators_count' => $countAdmins,
        ],
        'count' => $total,
        'users' => $users,
    ];

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => $e->getMessage()]);
}
