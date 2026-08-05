<?php
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
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$fields = [
    'name' => 150,
    'addressLine1' => 200,
    'addressLine2' => 200,
    'postalCode' => 30,
    'city' => 150,
    'siret' => 50,
    'phone' => 50,
    'email' => 150,
    'website' => 200,
    'logoUrl' => 300,
];

$clean = [];
foreach ($fields as $key => $maxLen) {
    $value = isset($data[$key]) ? trim((string)$data[$key]) : '';
    if (strlen($value) > $maxLen) {
        $value = substr($value, 0, $maxLen);
    }
    $clean[$key] = $value;
}

if ($clean['email'] !== '' && !filter_var($clean['email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email invalide']);
    exit;
}

if ($clean['website'] !== '' && !filter_var($clean['website'], FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'URL du site invalide']);
    exit;
}

if ($clean['logoUrl'] !== '') {
    $clean['logoUrl'] = str_replace(["\r", "\n"], '', $clean['logoUrl']);
    $looksLikeAbsoluteUrl = strpos($clean['logoUrl'], '://') !== false;
    if ($looksLikeAbsoluteUrl && !filter_var($clean['logoUrl'], FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'URL du logo invalide']);
        exit;
    }
}

$entityId = (int) (getenv('DOLIBARR_ENTITY') ?: 2);

function fetchCompanyTimestamps(PDO $pdo, int $entityId): array {
    $stmt = $pdo->prepare(
        "SELECT MIN(tms) AS createdAt, MAX(tms) AS updatedAt\n"
        . "FROM llx_const\n"
        . "WHERE entity = :entity AND name LIKE 'MAIN_INFO_SOCIETE_%'"
    );
    $stmt->execute([':entity' => $entityId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'createdAt' => $row['createdAt'] ?? null,
        'updatedAt' => $row['updatedAt'] ?? null,
    ];
}

function upsertDolibarrConst(PDO $pdo, int $entityId, string $name, string $value): void {
    static $stmt = null;
    if ($stmt === null) {
        $stmt = $pdo->prepare(
            'INSERT INTO llx_const (entity, name, value, type, visible, note, tms)
             VALUES (:entity, :name, :value, :type, :visible, :note, NOW())
             ON DUPLICATE KEY UPDATE value = VALUES(value), tms = NOW()'
        );
    }

    $stmt->execute([
        ':entity' => $entityId,
        ':name' => $name,
        ':value' => $value,
        ':type' => 'chaine',
        ':visible' => 1,
        ':note' => '',
    ]);
}

$constMap = [
    'name' => ['MAIN_INFO_SOCIETE_NOM'],
    'addressLine1' => ['MAIN_INFO_SOCIETE_ADRESSE', 'MAIN_INFO_SOCIETE_ADDRESS'],
    'addressLine2' => ['MAIN_INFO_SOCIETE_ADRESSE2', 'MAIN_INFO_SOCIETE_ADDRESS2'],
    'postalCode' => ['MAIN_INFO_SOCIETE_CP', 'MAIN_INFO_SOCIETE_ZIP'],
    'city' => ['MAIN_INFO_SOCIETE_VILLE', 'MAIN_INFO_SOCIETE_TOWN'],
    'siret' => ['MAIN_INFO_SOCIETE_SIRET'],
    'phone' => ['MAIN_INFO_SOCIETE_TEL'],
    'email' => ['MAIN_INFO_SOCIETE_MAIL'],
    'website' => ['MAIN_INFO_SOCIETE_WEB'],
    'logoUrl' => ['MAIN_INFO_SOCIETE_LOGO_URL', 'MAIN_INFO_SOCIETE_LOGO'],
];

try {
    $pdo->beginTransaction();

    foreach ($constMap as $field => $constNames) {
        $value = $clean[$field] ?? '';
        foreach ($constNames as $constName) {
            upsertDolibarrConst($pdo, $entityId, $constName, $value);
        }
    }

    $sirenValue = '';
    if ($clean['siret'] !== '') {
        $digits = preg_replace('/\D+/', '', $clean['siret']);
        if ($digits !== '') {
            $sirenValue = substr($digits, 0, 9);
        }
    }
    upsertDolibarrConst($pdo, $entityId, 'MAIN_INFO_SOCIETE_SIREN', $sirenValue);

    $pdo->commit();

    $meta = fetchCompanyTimestamps($pdo, $entityId);

    echo json_encode([
        'success' => true,
        'company' => $clean,
        'meta' => $meta,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to save company info',
        'details' => $e->getMessage(),
    ]);
}
