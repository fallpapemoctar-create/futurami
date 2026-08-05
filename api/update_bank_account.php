<?php
/**
 * update_bank_account.php — futurAMI
 *
 * Met à jour un compte bancaire (llx_bank_account) appartenant à l'entité
 * courante. Cloisonnement : 404 si hors périmètre.
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

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucune donnée reçue']);
    exit;
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID invalide']);
    exit;
}

$map = [
    'bankLabel' => 'label',
    'bankName' => 'bank',
    'bankCode' => 'code_banque',
    'bankBranchCode' => 'code_guichet',
    'bankAccountNumber' => 'number',
    'bankRibKey' => 'cle_rib',
    'bankBic' => 'bic',
    'bankIban' => 'iban_prefix',
    'bankDomiciliation' => 'domiciliation',
    'bankAccountHolder' => 'proprio',
    'bankOwnerAddress' => 'owner_address',
    'bankOwnerPostalCode' => 'owner_zip',
    'bankOwnerCity' => 'owner_town',
];

try {
    $ownCheck = $pdo->prepare('SELECT rowid FROM llx_bank_account WHERE rowid = :id AND entity = :entity LIMIT 1');
    $ownCheck->execute([':id' => $id, ':entity' => $currentEntity]);
    if (!$ownCheck->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Compte bancaire introuvable pour cette entité']);
        exit;
    }

    $pdo->beginTransaction();

    $fields = [];
    $params = [':id' => $id, ':entity' => $currentEntity];
    foreach ($map as $inputKey => $column) {
        if (array_key_exists($inputKey, $data)) {
            $fields[] = "$column = :$column";
            $params[":$column"] = trim((string)$data[$inputKey]);
        }
    }

    if (array_key_exists('isDefault', $data)) {
        if (!empty($data['isDefault'])) {
            $pdo->prepare('UPDATE llx_bank_account SET courant = 0 WHERE entity = :entity')
                ->execute([':entity' => $currentEntity]);
            $fields[] = 'courant = 1';
        } else {
            $fields[] = 'courant = 0';
        }
    }

    if (empty($fields)) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Aucun champ à mettre à jour']);
        exit;
    }

    $sql = 'UPDATE llx_bank_account SET ' . implode(', ', $fields) . ' WHERE rowid = :id AND entity = :entity';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Compte bancaire mis à jour'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
