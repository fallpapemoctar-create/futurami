<?php
/**
 * get_available_credit_notes.php — Liste les avoirs disponibles (non consommés
 * et non annulés) pour un client donné, afin de les imputer sur une facture
 * impayée. Inspiré du bloc « Avoirs disponibles » de Dolibarr.
 *
 * Paramètres :
 *   - client_name        (requis) nom du client
 *   - target_invoice     (optionnel) si fourni, filtre client_name à partir de
 *                         la facture cible et expose son reste à payer.
 *
 * Réponse :
 * {
 *   "success": true,
 *   "client_name": "ACME",
 *   "target_invoice": { "number": "...", "total_ht": x, "applied_amount": y,
 *                       "remaining": z, "status_code": "..." } | null,
 *   "credit_notes": [
 *     {
 *       "credit_note_number": "AV-202606-001",
 *       "billed_at": "2026-06-01 12:00:00",
 *       "total_ht_abs": 150.00,
 *       "applied_amount": 50.00,
 *       "remaining": 100.00,
 *       "credit_consumed": false,
 *       "reason": "Erreur de saisie"
 *     }
 *   ]
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

$clientName = trim((string) ($_GET['client_name'] ?? ''));
$targetInvoiceNumber = trim((string) ($_GET['target_invoice'] ?? ''));

try {
    /** @var PDO $pdo */ // fourni globalement par api/config.php
    ensureClientBillingTable($pdo);

    $targetSummary = null;
    if ($targetInvoiceNumber !== '') {
        // `invoice_total_ht` est stocké répété sur chaque ligne : on prend
        // MAX(NULLIF(...)) pour éviter de multiplier le total par le nombre de
        // lignes. Fallback sur SUM(amount_ht) pour les enregistrements sans
        // `invoice_total_ht` renseigné.
        $stmt = $pdo->prepare(
            "SELECT
                invoice_number,
                MAX(client_name) AS client_name,
                MAX(status_code) AS status_code,
                COALESCE(MAX(invoice_type), 0) AS invoice_type,
                COALESCE(MAX(NULLIF(invoice_total_ht, 0)), SUM(COALESCE(amount_ht, 0))) AS total_ht,
                COALESCE(MAX(NULLIF(applied_amount, 0)), 0) AS applied_amount
             FROM tble_client_billed
             WHERE invoice_number = :inv AND entity = :entity
             GROUP BY invoice_number"
        );
        $stmt->execute([':inv' => $targetInvoiceNumber, ':entity' => $currentEntity]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $total = (float) $row['total_ht'];
            $applied = (float) $row['applied_amount'];
            $targetSummary = [
                'number'         => $row['invoice_number'],
                'status_code'    => $row['status_code'],
                'invoice_type'   => (int) $row['invoice_type'],
                'total_ht'       => round($total, 2),
                'applied_amount' => round($applied, 2),
                'remaining'      => round($total - $applied, 2),
            ];
            if ($clientName === '' && !empty($row['client_name'])) {
                $clientName = (string) $row['client_name'];
            }
        }
    }

    if ($clientName === '') {
        echo json_encode([
            'success'        => false,
            'error'          => 'client_name est requis (ou target_invoice valide).',
            'target_invoice' => $targetSummary,
            'credit_notes'   => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Cf. remarque ci-dessus : total_ht doit venir de MAX(NULLIF(invoice_total_ht)),
    // pas de SUM, sinon on multiplie par le nombre de lignes de l'avoir.
    $sql = "SELECT
                invoice_number AS credit_note_number,
                MAX(billed_at) AS billed_at,
                COALESCE(MAX(NULLIF(invoice_total_ht, 0)), SUM(COALESCE(amount_ht, 0))) AS total_ht,
                COALESCE(MAX(NULLIF(applied_amount, 0)), 0) AS applied_amount,
                MAX(credit_consumed) AS credit_consumed,
                MAX(credit_note_reason) AS reason,
                MAX(source_invoice_number) AS source_invoice_number,
                MAX(status_code) AS status_code
             FROM tble_client_billed
             WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(:client))
               AND entity = :entity
               AND COALESCE(invoice_type, 0) = 2
               AND COALESCE(credit_consumed, 0) = 0
               AND LOWER(COALESCE(status_code, '')) <> 'cancelled'
             GROUP BY invoice_number
             ORDER BY MAX(billed_at) DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':client' => $clientName, ':entity' => $currentEntity]);

    $items = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $totalAbs = abs((float) $row['total_ht']);
        $applied = (float) $row['applied_amount'];
        $remaining = round($totalAbs - $applied, 2);
        if ($remaining <= 0) {
            continue;
        }
        $items[] = [
            'credit_note_number'    => $row['credit_note_number'],
            'billed_at'             => $row['billed_at'],
            'source_invoice_number' => $row['source_invoice_number'],
            'total_ht_abs'          => round($totalAbs, 2),
            'applied_amount'        => round($applied, 2),
            'remaining'             => $remaining,
            'credit_consumed'       => (int) $row['credit_consumed'] === 1,
            'reason'                => $row['reason'],
            'status_code'           => $row['status_code'],
        ];
    }

    echo json_encode([
        'success'        => true,
        'client_name'    => $clientName,
        'target_invoice' => $targetSummary,
        'credit_notes'   => $items,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Erreur serveur : ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
