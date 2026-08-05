<?php
require_once __DIR__ . '/config.php';

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

function normalizeBankField(?string $value): string {
    return trim((string) $value);
}

function composeBankIban(array $row): string {
    $iban = normalizeBankField($row['iban_prefix'] ?? '');
    if ($iban !== '') {
        return $iban;
    }

    $parts = [
        normalizeBankField($row['country_iban'] ?? ''),
        normalizeBankField($row['cle_iban'] ?? ''),
        normalizeBankField($row['code_banque'] ?? ''),
        normalizeBankField($row['code_guichet'] ?? ''),
        normalizeBankField($row['number'] ?? ''),
        normalizeBankField($row['cle_rib'] ?? ''),
    ];
    $parts = array_values(array_filter($parts, static fn ($part) => $part !== ''));

    return implode(' ', $parts);
}

function fetchPrimaryBankAccount(PDO $pdo, int $entityId): array {
    $empty = [
        'bankLabel' => '',
        'bankName' => '',
        'bankCode' => '',
        'bankBranchCode' => '',
        'bankAccountNumber' => '',
        'bankRibKey' => '',
        'bankBic' => '',
        'bankIban' => '',
        'bankDomiciliation' => '',
        'bankAccountHolder' => '',
        'bankOwnerAddress' => '',
        'bankOwnerPostalCode' => '',
        'bankOwnerCity' => '',
    ];

    $stmt = $pdo->prepare(
        "SELECT label, bank, code_banque, code_guichet, number, cle_rib, bic, iban_prefix, country_iban, cle_iban, domiciliation, proprio, owner_address, owner_zip, owner_town, courant, clos\n"
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
        . "  rowid ASC\n"
        . "LIMIT 1"
    );
    $stmt->execute([':entity' => $entityId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return $empty;
    }

    return [
        'bankLabel' => normalizeBankField($row['label'] ?? ''),
        'bankName' => normalizeBankField($row['bank'] ?? ''),
        'bankCode' => normalizeBankField($row['code_banque'] ?? ''),
        'bankBranchCode' => normalizeBankField($row['code_guichet'] ?? ''),
        'bankAccountNumber' => normalizeBankField($row['number'] ?? ''),
        'bankRibKey' => normalizeBankField($row['cle_rib'] ?? ''),
        'bankBic' => normalizeBankField($row['bic'] ?? ''),
        'bankIban' => composeBankIban($row),
        'bankDomiciliation' => normalizeBankField($row['domiciliation'] ?? ''),
        'bankAccountHolder' => normalizeBankField($row['proprio'] ?? ''),
        'bankOwnerAddress' => normalizeBankField($row['owner_address'] ?? ''),
        'bankOwnerPostalCode' => normalizeBankField($row['owner_zip'] ?? ''),
        'bankOwnerCity' => normalizeBankField($row['owner_town'] ?? ''),
    ];
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$defaults = [
    'name' => 'PLANETE TRADUCTION FRANCE',
    'addressLine1' => '142 rue de Clignancourt',
    'addressLine2' => '75018 Paris',
    'postalCode' => '75018',
    'city' => 'Paris',
    'siret' => '10544999500017',
    'phone' => '',
    'email' => 'contact@planete-traduction.fr',
    'website' => 'https://ptf.planetapplis.fr/',
    'logoUrl' => '',
    'bankLabel' => '',
    'bankName' => '',
    'bankCode' => '',
    'bankBranchCode' => '',
    'bankAccountNumber' => '',
    'bankRibKey' => '',
    'bankBic' => '',
    'bankIban' => '',
    'bankDomiciliation' => '',
    'bankAccountHolder' => '',
    'bankOwnerAddress' => '',
    'bankOwnerPostalCode' => '',
    'bankOwnerCity' => '',
];

$mapping = [
    'MAIN_INFO_SOCIETE_NOM' => 'name',
    'MAIN_INFO_SOCIETE_ADRESSE' => 'addressLine1',
    'MAIN_INFO_SOCIETE_ADDRESS' => 'addressLine1',
    'MAIN_INFO_SOCIETE_ADRESSE2' => 'addressLine2',
    'MAIN_INFO_SOCIETE_ADDRESS2' => 'addressLine2',
    'MAIN_INFO_SOCIETE_CP' => 'postalCode',
    'MAIN_INFO_SOCIETE_ZIP' => 'postalCode',
    'MAIN_INFO_SOCIETE_VILLE' => 'city',
    'MAIN_INFO_SOCIETE_TOWN' => 'city',
    'MAIN_INFO_SOCIETE_TEL' => 'phone',
    'MAIN_INFO_SOCIETE_MAIL' => 'email',
    'MAIN_INFO_SOCIETE_WEB' => 'website',
    'MAIN_INFO_SOCIETE_LOGO_URL' => 'logoUrl',
    'MAIN_INFO_SOCIETE_LOGO' => 'logoUrl',
];

$entityId = (int) (getenv('DOLIBARR_ENTITY') ?: 2);

try {
    $stmt = $pdo->prepare("SELECT name, value FROM llx_const WHERE entity = :entity AND name LIKE 'MAIN_INFO_SOCIETE_%'");
    $stmt->execute([':entity' => $entityId]);
    $pairs = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $company = $defaults;
    foreach ($pairs as $name => $value) {
        $value = trim((string) $value);

        if ($name === 'MAIN_INFO_SOCIETE_SIRET' || $name === 'MAIN_INFO_SOCIETE_SIREN') {
            if ($name === 'MAIN_INFO_SOCIETE_SIRET' || $company['siret'] === $defaults['siret']) {
                $company['siret'] = $value;
            }
            continue;
        }

        $key = $mapping[$name] ?? null;
        if ($key !== null) {
            $company[$key] = $value;
        }
    }

    $meta = fetchCompanyTimestamps($pdo, $entityId);
    $company = array_merge($company, fetchPrimaryBankAccount($pdo, $entityId));

    echo json_encode([
        'success' => true,
        'company' => $company,
        'meta' => $meta,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to load company info',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
