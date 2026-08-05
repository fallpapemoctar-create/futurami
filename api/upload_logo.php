<?php
/**
 * upload_logo.php — futurAMI
 *
 * Upload du logo de l'entreprise (multipart/form-data, champ "logo").
 * Enregistre le fichier sur disque (api/uploads/logos/) sous un nom propre à
 * l'entité courante, et renvoie l'URL relative à stocker via
 * update_company_info.php (champ logoUrl). On évite volontairement
 * d'encoder l'image en base64 dans llx_const : la colonne "value" n'est pas
 * dimensionnée pour ça et update_company_info.php tronque logoUrl à 300
 * caractères — un chemin de fichier reste court, une image encodée non.
 */
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

if (empty($_FILES['logo']) || !isset($_FILES['logo']['tmp_name']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
    $uploadError = $_FILES['logo']['error'] ?? null;
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucun fichier reçu ou erreur d\'upload', 'php_upload_error' => $uploadError]);
    exit;
}

$file = $_FILES['logo'];

// 2 Mo max, types image courants uniquement.
$maxSize = 2 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Fichier trop volumineux (2 Mo max)']);
    exit;
}

$allowedMime = [
    'image/png' => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/svg+xml' => 'svg',
];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!isset($allowedMime[$mime])) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'Format non supporté (PNG, JPEG, WEBP ou SVG uniquement)', 'detected_mime' => $mime]);
    exit;
}

$ext = $allowedMime[$mime];
$uploadDir = __DIR__ . '/uploads/logos';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0775, true);
}

$filename = 'entity_' . $currentEntity . '_' . time() . '.' . $ext;
$destPath = $uploadDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Échec de l\'enregistrement du fichier sur le serveur']);
    exit;
}

// URL relative servie directement par Apache (api/uploads/logos/... n'est
// pas un .php, donc pas soumis à require_auth()).
$relativeUrl = 'uploads/logos/' . $filename;

echo json_encode([
    'success' => true,
    'logoUrl' => $relativeUrl,
], JSON_UNESCAPED_UNICODE);
