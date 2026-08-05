<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$year = isset($_GET['year']) ? intval($_GET['year']) : null;
$month = isset($_GET['month']) ? intval($_GET['month']) : null;
$typeParam = strtolower(trim((string) ($_GET['type'] ?? 'invoice')));
// peek=1 : aperçu seul (bouton "Générer PDF"), ne consomme PAS de numéro.
$peekParam = strtolower(trim((string) ($_GET['peek'] ?? '')));
$peekOnly = in_array($peekParam, ['1', 'true', 'yes', 'on'], true);
if ($year === null || $year < 2000 || $year > 9999) {
    $year = intval(date('Y'));
}
if ($month === null || $month < 1 || $month > 12) {
    $month = intval(date('n'));
}

try {
    ensureClientBillingTable($pdo);

    // Sequence distincte pour les avoirs (obligation legale FR : numerotation
    // sans trou et serie dediee). Prefixe AV- vs FAC-.
    // NB : le compteur (NNN) est perpetuel - il NE redemarre PAS chaque mois
    // ni chaque annee. La portion AAAAMM ne sert qu'a l'historique/lisibilite.
    $isCreditNote = in_array($typeParam, ['credit_note', 'avoir', 'cn'], true);
    $serie = $isCreditNote ? 'AV' : 'FAC';
    // Réservation ATOMIQUE via tble_invoice_sequence pour éliminer les
    // conditions de course et les ré-attributions de numéros après
    // suppression manuelle en base.
    $nextNumber = $peekOnly
        ? peekNextInvoiceSequence($pdo, $serie, $currentEntity)
        : reserveNextInvoiceSequence($pdo, $serie, $currentEntity);
    $invoiceNumber = formatInvoiceNumber($serie, $year, $month, $nextNumber);

    respond(200, [
        'success' => true,
        'invoice_number' => $invoiceNumber,
        'sequence' => $nextNumber,
        'type' => $isCreditNote ? 'credit_note' : 'invoice',
        'peek' => $peekOnly,
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
