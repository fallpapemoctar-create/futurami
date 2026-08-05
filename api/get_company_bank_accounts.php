<?php
require_once __DIR__ . '/config.php';

function normalizeBankAccountField(?string $value): string {
    return trim((string) $value);
}

function composeBankAccountIban(array $row): string {
    $iban = normalizeBankAccountField($row['iban_prefix'] ?? '');
    if ($iban !== '') {
        return $iban;
    }

    $parts = [
        normalizeBankAccountField($row['country_iban'] ?? ''),
        normalizeBankAccountField($row['cle_iban'] ?? ''),
        normalizeBankAccountField($row['code_banque'] ?? ''),
        normalizeBankAccountField($row['code_guichet'] ?? ''),
        normalizeBankAccountField($row['number'] ?? ''),
        normalizeBankAccountField($row['cle_rib'] ?? ''),
    ];
    $parts = array_values(array_filter($parts, static fn ($part) => $part !== ''));

    return implode(' ', $parts);
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$entityId = $currentEntity;

try {
    $stmt = $pdo->prepare(
        "SELECT rowid, label, bank, code_banque, code_guichet, number, cle_rib, bic, iban_prefix, country_iban, cle_iban, domiciliation, proprio, owner_address, owner_zip, owner_town, courant\n"
        . "FROM llx_bank_account\n"
        . "WHERE entity = :entity AND clos = 0\n"
        . "ORDER BY CASE\n"
        . "    WHEN UPPER(TRIM(COALESCE(bank, ''))) = 'BANQUE POPULAIRE RIVES DE PARIS' THEN 0\n"
        . "    WHEN UPPER(TRIM(COALESCE(label, ''))) IN ('BP RIVES DE PARIS', 'RIB_BANQUE_P') THEN 0\n"
        . "    ELSE 1\n"
        . "  END ASC,\n"
        . "  courant DESC,\n"
        . "  ((CASE WHEN TRIM(COALESCE(iban_prefix, '')) <> '' THEN 1 ELSE 0 END)\n"
        . "   + (CASE WHEN TRIM(COALESCE(bic, '')) <> '' THEN 1 ELSE 0 END)\n"
        . "   + (CASE WHEN TRIM(COALESCE(proprio, '')) <> '' THEN 1 ELSE 0 END)\n"
        . "   + (CASE WHEN TRIM(COALESCE(number, '')) <> '' THEN 1 ELSE 0 END)) DESC,\n"
        . "  rowid ASC"
    );
    $stmt->execute([':entity' => $entityId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $accounts = array_map(static function (array $row): array {
        return [
            'id' => (int) ($row['rowid'] ?? 0),
            'isDefault' => (int) ($row['courant'] ?? 0) === 1,
            'bankLabel' => normalizeBankAccountField($row['label'] ?? ''),
            'bankName' => normalizeBankAccountField($row['bank'] ?? ''),
            'bankCode' => normalizeBankAccountField($row['code_banque'] ?? ''),
            'bankBranchCode' => normalizeBankAccountField($row['code_guichet'] ?? ''),
            'bankAccountNumber' => normalizeBankAccountField($row['number'] ?? ''),
            'bankRibKey' => normalizeBankAccountField($row['cle_rib'] ?? ''),
            'bankBic' => normalizeBankAccountField($row['bic'] ?? ''),
            'bankIban' => composeBankAccountIban($row),
            'bankDomiciliation' => normalizeBankAccountField($row['domiciliation'] ?? ''),
            'bankAccountHolder' => normalizeBankAccountField($row['proprio'] ?? ''),
            'bankOwnerAddress' => normalizeBankAccountField($row['owner_address'] ?? ''),
            'bankOwnerPostalCode' => normalizeBankAccountField($row['owner_zip'] ?? ''),
            'bankOwnerCity' => normalizeBankAccountField($row['owner_town'] ?? ''),
        ];
    }, $rows);

    echo json_encode([
        'success' => true,
        'bankAccounts' => $accounts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to load company bank accounts',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}