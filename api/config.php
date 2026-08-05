<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Short-circuit CORS preflight requests
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enable PHP error logging to a local file to diagnose 500s on server
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/api_error.log');

// ---------------------------------------------------------------------------
// Fallback env — pour les hébergements où SetEnv (mod_env) est ignoré par
// Apache/PHP-FPM (IONOS mutualisé, OVH shared, o2switch, etc.). Si un fichier
// api/.env.local.php existe, on y lit les secrets et on les pousse dans les
// variables d'environnement du process PHP AVANT que auth_helpers.php ne
// tente `getenv('AUTH_SECRET')`.
//
// Le fichier est ignoré via .gitignore + protégé côté public par le .htaccess
// (Files ".env.local.php" -> Require all denied). Voir api/.env.local.php.example.
// ---------------------------------------------------------------------------
$envLocalPath = __DIR__ . '/.env.local.php';
if (is_readable($envLocalPath)) {
    $localEnv = require $envLocalPath;
    if (is_array($localEnv)) {
        foreach ($localEnv as $key => $value) {
            $key = (string) $key;
            $value = (string) $value;
            // Ne pas écraser une variable déjà présente (SetEnv fonctionne
            // parfois) : le .htaccess reste prioritaire s'il a été lu.
            if (getenv($key) === false && !isset($_SERVER[$key])) {
                putenv("$key=$value");
                $_SERVER[$key] = $value;
                $_ENV[$key] = $value;
            }
        }
    }
}

// Ultime filet de sécurité : si NI .htaccess NI .env.local.php n'ont fourni
// AUTH_SECRET (fichier absent, chemin serveur inhabituel, upload FTP raté),
// on le fixe ici en dur — plutôt que de laisser toute l'app renvoyer
// auth_secret_missing pour cause de config manquante. Ne pas retirer sans
// avoir vérifié en amont que la vraie configuration serveur fonctionne.
if (getenv('AUTH_SECRET') === false && empty($_SERVER['AUTH_SECRET'])) {
    $__fallbackSecret  = '1a697f764c6af586bffcb505b291c930d6cc3a2987b7b16fb4f67e7381bb603826f9394cd913c2aa5a62cb8546a69a95';
    putenv("AUTH_SECRET=$__fallbackSecret");
    $_SERVER['AUTH_SECRET'] = $__fallbackSecret;
    $_ENV['AUTH_SECRET']    = $__fallbackSecret;
}
if (getenv('AUTH_TOKEN_TTL') === false && empty($_SERVER['AUTH_TOKEN_TTL'])) {
    putenv('AUTH_TOKEN_TTL=43200');
    $_SERVER['AUTH_TOKEN_TTL'] = '43200';
    $_ENV['AUTH_TOKEN_TTL']    = '43200';
}
if (getenv('DOLIBARR_ENTITY') === false && empty($_SERVER['DOLIBARR_ENTITY'])) {
    putenv('DOLIBARR_ENTITY=2');
    $_SERVER['DOLIBARR_ENTITY'] = '2';
    $_ENV['DOLIBARR_ENTITY']    = '2';
}

// Determine application environment (prod/local) via env var or heuristics
function getAppEnv(): string {
    // Explicit override via env var
    $env = getenv('APP_ENV');
    if (!$env && isset($_ENV['APP_ENV'])) $env = $_ENV['APP_ENV'];
    if ($env) return strtolower($env);

    // Heuristics based on host
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host) {
        if (stripos($host, 'yourbizapps.com') !== false) return 'prod';
        if (stripos($host, 'planetapplis.fr') !== false) return 'prod';
        if (stripos($host, 'localhost') !== false) return 'local';
    }
    // Fallback to local in unknown cases to avoid hard failures during dev
    return 'local';
}

$__env = getAppEnv();
if ($__env === 'prod') {
    // Remote server credentials
    $host = getenv('DB_HOST_PROD') ?: "db5019265066.hosting-data.io";
    $db   = getenv('DB_NAME_PROD') ?: "dbs15108425";
    $user = getenv('DB_USER_PROD') ?: "dbu1621345";
    $pass = getenv('DB_PASS_PROD') ?: "Paris2026#";
} elseif ($__env === 'local') {
    // Local WAMP defaults
    $host = getenv('DB_HOST_LOCAL') ?: "localhost";
    $db   = getenv('DB_NAME_LOCAL') ?: "dbs13098267";   // adapte le nom
    $user = getenv('DB_USER_LOCAL') ?: "root";
    $pass = getenv('DB_PASS_LOCAL') ?: "";            // adapte selon ton serveur
} else {
    // Fallback (shouldn't happen as getAppEnv defaults to local)
    $host = getenv('DB_HOST') ?: "localhost";
    $db   = getenv('DB_NAME') ?: "dbs13098267";
    $user = getenv('DB_USER') ?: "root";
    $pass = getenv('DB_PASS') ?: "";
}

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => "Connexion MySQL échouée",
        "details" => $e->getMessage()
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// Authentification centralisée (multi-entités)
// ---------------------------------------------------------------------------
// Tout endpoint qui inclut config.php est automatiquement protégé.
// Pour rendre un endpoint public (ex: login.php), déclarer avant l'include :
//     $__SKIP_AUTH = true;
//     require_once __DIR__ . '/config.php';
//
// $currentUser (array) est exposé aux endpoints protégés avec les claims :
//   sub (int), login (string), entity (int), iat, exp
require_once __DIR__ . '/auth_helpers.php';

if (empty($__SKIP_AUTH)) {
    $currentUser = require_auth();
    // Exposition de l'entité courante pour usage direct dans les requêtes SQL.
    // Cas spécial des super-admins Dolibarr (entity=0 && admin=1) : leur claim
    // porte entity=0, mais toutes les requêtes métier doivent cibler l'entité
    // du déploiement courant (sinon WHERE entity=0 ne renvoie rien). On force
    // donc $currentEntity = getConfiguredEntity() pour ces comptes.
    $__claimEntity = (int) ($currentUser['entity'] ?? 0);
    $__isSuperAdmin = ($__claimEntity === 0 && (int) ($currentUser['admin'] ?? 0) === 1);
    $currentEntity = $__isSuperAdmin ? getConfiguredEntity() : $__claimEntity;
}