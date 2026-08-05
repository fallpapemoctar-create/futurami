<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Endpoint public : pas d'exigence de token pour se connecter
$__SKIP_AUTH = true;
require_once __DIR__ . "/config.php";        // Connexion PDO (inclut auth_helpers.php)
require_once __DIR__ . "/entity_bootstrap.php"; // Duplication auto des données de référence (1ère fois / auto-heal horaire)

$data = json_decode(file_get_contents("php://input"), true);
$login = $data["login"] ?? "";
$password = $data["password"] ?? "";

if (empty($login) || empty($password)) {
    echo json_encode([
        "success" => false,
        "message" => "login ou mot de passe manquant"
    ]);
    exit;
}

$configuredEntity = getConfiguredEntity();

// 1. Vérifier si l'utilisateur existe
$stmt = $pdo->prepare("SELECT rowid, firstname, lastname, login, pass_crypted, statut, entity, admin
                       FROM llx_user
                       WHERE login = ? LIMIT 1");
$stmt->execute([$login]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode([
        "success" => false,
        "message" => "Utilisateur introuvable"
    ]);
    exit;
}

// 2. Vérifier le mot de passe
if (!password_verify($password, $user["pass_crypted"])) {
    echo json_encode([
        "success" => false,
        "message" => "Mot de passe incorrect"
    ]);
    exit;
}

// 3. Compte actif ?
if ((int)($user["statut"] ?? 0) !== 1) {
    echo json_encode([
        "success" => false,
        "message" => "Compte désactivé"
    ]);
    exit;
}

// 4. Cloisonnement multi-entités : l'utilisateur doit appartenir à l'entité
//    de ce déploiement (2 = PLANETE TRADUCTION FRANCE). Un compte AMI
//    d'origine (entity=1) qui n'a pas encore été dupliqué vers l'entité 2
//    ne peut pas se connecter ici tant que la duplication n'a pas tourné.
//    EXCEPTION : les super-admins Dolibarr transversaux (entity=0 && admin=1)
//    peuvent se connecter sur n'importe quelle entité. C'est la sémantique
//    standard Dolibarr : entity=0 = compte technique cross-entités.
$userEntity   = (int) ($user["entity"] ?? 0);
$isSuperAdmin = ($userEntity === 0 && (int) ($user["admin"] ?? 0) === 1);
if (!$isSuperAdmin && $userEntity !== $configuredEntity) {
    echo json_encode([
        "success" => false,
        "message" => "Accès refusé : ce compte n'appartient pas à cette entité"
    ]);
    exit;
}

// 4bis. Premier login réussi sur cette entité : dupliquer clients/contacts/
//       produits/interprètes depuis les autres entités (une seule fois,
//       puis auto-heal toutes les heures — sans jamais faire échouer le
//       login en cas de problème). Idempotent : les lignes déjà dupliquées
//       via AMI-PTF sont détectées et sautées, seules les nouvelles/en échec
//       sont (re)traitées.
runEntityDataDuplicationOnce($pdo, $configuredEntity);

// 5. Charger les droits de l'utilisateur
$stmt = $pdo->prepare("
    SELECT r.name
    FROM tble_user_rights ur
    JOIN tble_rights r ON ur.right_id = r.id
    WHERE ur.user_id = ?
");
$stmt->execute([$user["rowid"]]);
$rights = $stmt->fetchAll(PDO::FETCH_COLUMN);

// 6. Émettre le token
$token = issueAuthToken($user);

// 7. Réponse finale
echo json_encode([
    "success"    => true,
    "token"      => $token,
    "expires_in" => getAuthTokenTtl(),
    "user" => [
        "id"     => (int) $user["rowid"],
        "prenom" => $user["firstname"],
        "nom"    => $user["lastname"],
        "login"  => $user["login"],
        "entity" => (int) $user["entity"],
        "admin"  => (int) ($user["admin"] ?? 0),
    ],
    "rights" => $rights
]);
