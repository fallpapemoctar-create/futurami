<?php
require_once __DIR__ . '/config.php';

function paymentTermColumnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
        return $stmt && $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $clientId = isset($_GET['client_id']) ? (int) $_GET['client_id'] : 0;

    $societeField = null;
    if (paymentTermColumnExists($pdo, 'llx_societe', 'fk_cond_reglement')) {
        $societeField = 'fk_cond_reglement';
    } elseif (paymentTermColumnExists($pdo, 'llx_societe', 'cond_reglement')) {
        $societeField = 'cond_reglement';
    }

    $labelExpr = "COALESCE(NULLIF(TRIM(libelle_facture), ''), NULLIF(TRIM(libelle), ''), NULLIF(TRIM(code), ''), CONCAT('Condition ', rowid))";
    $activeExists = paymentTermColumnExists($pdo, 'llx_c_payment_term', 'active');
    $activeSelect = $activeExists ? 'active' : '1 AS active';
    $activeWhere = $activeExists ? 'WHERE active = 1' : '';

    $defaultTermId = 0;
    if ($societeField !== null && $clientId > 0) {
        $stmtDefault = $pdo->prepare("SELECT COALESCE($societeField, 0) FROM llx_societe WHERE rowid = :client_id AND entity = :entity LIMIT 1");
        $stmtDefault->execute([':client_id' => $clientId, ':entity' => $currentEntity]);
        $defaultTermId = (int) ($stmtDefault->fetchColumn() ?: 0);
    }

    $entityWhere = $activeWhere !== '' ? "$activeWhere AND entity = :entity" : 'WHERE entity = :entity';
    $sql = "SELECT rowid, code, $labelExpr AS label, nbjour, decalage, $activeSelect FROM llx_c_payment_term $entityWhere ORDER BY CASE WHEN rowid = :default_id THEN 0 ELSE 1 END ASC, label ASC, rowid ASC";
    $stmtTerms = $pdo->prepare($sql);
    $stmtTerms->execute([':default_id' => $defaultTermId, ':entity' => $currentEntity]);
    $rows = $stmtTerms->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $terms = array_map(static function (array $row) use ($defaultTermId): array {
        return [
            'id' => (int) ($row['rowid'] ?? 0),
            'code' => trim((string) ($row['code'] ?? '')),
            'label' => trim((string) ($row['label'] ?? '')),
            'days' => isset($row['nbjour']) ? (int) $row['nbjour'] : 0,
            'shift' => isset($row['decalage']) ? (int) $row['decalage'] : 0,
            'isDefault' => (int) ($row['rowid'] ?? 0) === $defaultTermId,
        ];
    }, $rows);

    echo json_encode([
        'success' => true,
        'defaultTermId' => $defaultTermId,
        'paymentTerms' => $terms,
        'fieldName' => $societeField,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to load payment terms',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}