<?php
/**
 * get_credit_note_applications.php — Liste les imputations d'avoirs.
 *
 * Filtres (au moins un requis) :
 *   - target_invoice = numéro d'une facture cible : renvoie les avoirs qui lui
 *     ont été imputés.
 *   - credit_note   = numéro d'un avoir : renvoie les factures sur lesquelles
 *     il a été imputé.
 *
 * Réponse :
 * {
 *   "success": true,
 *   "applications": [
 *     {
 *       "id": 12,
 *       "credit_note_number": "AV-202606-001",
 *       "target_invoice_number": "FAC-202606-007",
 *       "client_name": "ACME",
 *       "applied_amount": 120.50,
 *       "applied_at": "2026-06-15 14:32:10",
 *       "applied_by": 3,
 *       "applied_by_name": "Anna FALL",
 *       "notes": "..."
 *     }
 *   ],
 *   "total_applied": 120.50
 * }
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$targetInvoice = trim((string) ($_GET['target_invoice'] ?? ''));
$creditNote    = trim((string) ($_GET['credit_note'] ?? ''));

if ($targetInvoice === '' && $creditNote === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'target_invoice ou credit_note est requis.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    /** @var PDO $pdo */ // fourni globalement par api/config.php
    ensureCreditNoteApplicationsTable($pdo);

    $conditions = ['entity = :entity'];
    $params = [':entity' => $currentEntity];
    if ($targetInvoice !== '') {
        $conditions[] = 'target_invoice_number = :tgt';
        $params[':tgt'] = $targetInvoice;
    }
    if ($creditNote !== '') {
        $conditions[] = 'credit_note_number = :cn';
        $params[':cn'] = $creditNote;
    }
    $whereSql = implode(' AND ', $conditions);

    $sql = "SELECT
                id,
                credit_note_number,
                target_invoice_number,
                client_name,
                applied_amount,
                applied_at,
                applied_by,
                applied_by_name,
                notes
            FROM tble_credit_note_applications
            WHERE $whereSql
            ORDER BY applied_at ASC, id ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $items = [];
    $total = 0.0;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $amount = round((float) $row['applied_amount'], 2);
        $total += $amount;
        $items[] = [
            'id'                    => (int) $row['id'],
            'credit_note_number'    => $row['credit_note_number'],
            'target_invoice_number' => $row['target_invoice_number'],
            'client_name'           => $row['client_name'],
            'applied_amount'        => $amount,
            'applied_at'            => $row['applied_at'],
            'applied_by'            => $row['applied_by'] !== null
                                        ? (int) $row['applied_by']
                                        : null,
            'applied_by_name'       => $row['applied_by_name'],
            'notes'                 => $row['notes'],
        ];
    }

    echo json_encode([
        'success'       => true,
        'applications'  => $items,
        'total_applied' => round($total, 2),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Erreur serveur : ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
