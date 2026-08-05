<?php
/**
 * add_bank_account.php — futurAMI
 *
 * Crée un compte bancaire (llx_bank_account) pour l'entité courante.
 * Pas de duplication automatique depuis l'entité 1 (décision explicite) :
 * chaque entité saisit ses propres comptes bancaires via le CRUD.
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

$label = trim((string)($data['bankLabel'] ?? ''));
if ($label === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Libellé obligatoire']);
    exit;
}

$ref = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', $label));
$ref = $ref !== '' ? substr($ref, 0, 12) : substr('BA' . time(), 0, 12);

$bank = trim((string)($data['bankName'] ?? ''));
$codeBanque = trim((string)($data['bankCode'] ?? ''));
$codeGuichet = trim((string)($data['bankBranchCode'] ?? ''));
$number = trim((string)($data['bankAccountNumber'] ?? ''));
$cleRib = trim((string)($data['bankRibKey'] ?? ''));
$bic = trim((string)($data['bankBic'] ?? ''));
$iban = trim((string)($data['bankIban'] ?? ''));
$domiciliation = trim((string)($data['bankDomiciliation'] ?? ''));
$proprio = trim((string)($data['bankAccountHolder'] ?? ''));
$ownerAddress = trim((string)($data['bankOwnerAddress'] ?? ''));
$ownerZip = trim((string)($data['bankOwnerPostalCode'] ?? ''));
$ownerTown = trim((string)($data['bankOwnerCity'] ?? ''));
$fkPays = isset($data['fk_pays']) && (int)$data['fk_pays'] > 0 ? (int)$data['fk_pays'] : 1; // 1 = France (Dolibarr)
$currency = trim((string)($data['currency_code'] ?? 'EUR')) ?: 'EUR';
$isDefault = !empty($data['isDefault']);

try {
    $chk = $pdo->prepare('SELECT 1 FROM llx_bank_account WHERE label = :label AND entity = :entity LIMIT 1');
    $chk->execute([':label' => $label, ':entity' => $currentEntity]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Un compte bancaire avec ce libellé existe déjà']);
        exit;
    }

    $pdo->beginTransaction();

    if ($isDefault) {
        // Un seul compte "courant" par entité, comme dans Dolibarr.
        $pdo->prepare('UPDATE llx_bank_account SET courant = 0 WHERE entity = :entity')
            ->execute([':entity' => $currentEntity]);
    }

    $stmt = $pdo->prepare(
        "INSERT INTO llx_bank_account (
            ref, label, entity, bank, code_banque, code_guichet, number, cle_rib, bic,
            iban_prefix, domiciliation, fk_pays, proprio, owner_address, owner_zip, owner_town,
            courant, clos, currency_code, datec
        ) VALUES (
            :ref, :label, :entity, :bank, :code_banque, :code_guichet, :number, :cle_rib, :bic,
            :iban, :domiciliation, :fk_pays, :proprio, :owner_address, :owner_zip, :owner_town,
            :courant, 0, :currency, NOW()
        )"
    );
    $stmt->execute([
        ':ref' => $ref,
        ':label' => $label,
        ':entity' => $currentEntity,
        ':bank' => $bank,
        ':code_banque' => $codeBanque,
        ':code_guichet' => $codeGuichet,
        ':number' => $number,
        ':cle_rib' => $cleRib,
        ':bic' => $bic,
        ':iban' => $iban,
        ':domiciliation' => $domiciliation,
        ':fk_pays' => $fkPays,
        ':proprio' => $proprio,
        ':owner_address' => $ownerAddress,
        ':owner_zip' => $ownerZip,
        ':owner_town' => $ownerTown,
        ':courant' => $isDefault ? 1 : 0,
        ':currency' => $currency,
    ]);

    $id = (int)$pdo->lastInsertId();
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Compte bancaire créé',
        'bankAccount' => [
            'id' => $id,
            'isDefault' => $isDefault,
            'bankLabel' => $label,
            'bankName' => $bank,
            'bankCode' => $codeBanque,
            'bankBranchCode' => $codeGuichet,
            'bankAccountNumber' => $number,
            'bankRibKey' => $cleRib,
            'bankBic' => $bic,
            'bankIban' => $iban,
            'bankDomiciliation' => $domiciliation,
            'bankAccountHolder' => $proprio,
            'bankOwnerAddress' => $ownerAddress,
            'bankOwnerPostalCode' => $ownerZip,
            'bankOwnerCity' => $ownerTown,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
