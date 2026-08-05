<?php
/**
 * convert_quote_to_invoice.php
 * AMI v1.4 — Module Devis (RM-07)
 *
 * Transforme un devis accepté en facture client (tble_client_billed + tble_client_invoice_lines).
 * Le devis passe au statut accepted_converted.
 *
 * POST {
 *   quote_id: int,
 *   user_id?: int,
 *   payment_condition_id?: int,
 *   bank_account_id?: int
 * }
 * → 201 { success: true, invoice_number: string, quote_id: int }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Méthode non autorisée']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide']);
}

$quoteId         = isset($input['quote_id'])           ? (int) $input['quote_id']           : 0;
$userId          = isset($input['user_id'])            ? (int) $input['user_id']            : null;
$paymentTermId   = isset($input['payment_condition_id']) ? (int)$input['payment_condition_id'] : null;
$bankAccountId   = isset($input['bank_account_id'])    ? (int) $input['bank_account_id']    : null;

if ($quoteId <= 0) {
    respond(400, ['success' => false, 'error' => 'quote_id requis']);
}

try {
    ensureInvoiceDraftTable($pdo);

    // ---------------------------------------------------------------
    // 1. Charger le devis — doit être en statut 'accepted' (RM-07)
    // ---------------------------------------------------------------
    $stmt = $pdo->prepare("SELECT * FROM invoice_draft WHERE id = :id AND entity = :entity LIMIT 1");
    $stmt->execute([':id' => $quoteId, ':entity' => $currentEntity]);
    $quote = $stmt->fetch();

    if (!$quote) {
        respond(404, ['success' => false, 'error' => 'Devis introuvable']);
    }
    if ($quote['status'] !== 'accepted') {
        respond(403, [
            'success' => false,
            'error'   => 'Seul un devis accepté peut être converti. Statut actuel : ' . $quote['status'],
        ]);
    }

    // ---------------------------------------------------------------
    // 2. Charger les lignes du devis
    // ---------------------------------------------------------------
    $stmtLines = $pdo->prepare("
        SELECT * FROM invoice_draft_lines WHERE draft_id = :did ORDER BY sort_order ASC, id ASC
    ");
    $stmtLines->execute([':did' => $quoteId]);
    $lines = $stmtLines->fetchAll();

    if (empty($lines)) {
        respond(400, ['success' => false, 'error' => 'Le devis ne contient aucune ligne']);
    }

    // ---------------------------------------------------------------
    // 3. Réserver un numéro de facture (format FAC-YYYYMM-NNN)
    //    NB : le suffixe NNN est perpétuel (pas de reset mensuel/annuel)
    // ---------------------------------------------------------------
    ensureClientBillingTable($pdo);
    ensureClientInvoiceLinesTable($pdo);

    $month = $quote['month'] ?? date('Y-m');
    [$year, $mon] = explode('-', $month . '-01');
    // Réservation atomique (évite les collisions de numéros sous concurrence)
    $nextNum = reserveNextInvoiceSequence($pdo, 'FAC', $currentEntity);
    $invoiceNumber = formatInvoiceNumber('FAC', (int)$year, (int)$mon, $nextNum);

    // Garde-fou anti-collision : si par une race exceptionnelle ou une
    // écriture manuelle le numéro est déjà attribué à un autre client,
    // on re-réserve jusqu'à trouver un numéro libre (borné à 5 essais).
    $quoteClient = (string) ($quote['client_name'] ?? '');
    if ($quoteClient !== '') {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $conflict = invoiceNumberCollisionClient($pdo, $invoiceNumber, $quoteClient, $currentEntity);
            if ($conflict === '') break;
            $nextNum = reserveNextInvoiceSequence($pdo, 'FAC', $currentEntity);
            $invoiceNumber = formatInvoiceNumber('FAC', (int)$year, (int)$mon, $nextNum);
        }
        if (invoiceNumberCollisionClient($pdo, $invoiceNumber, $quoteClient, $currentEntity) !== '') {
            respond(500, [
                'success' => false,
                'error' => "Impossible d'obtenir un numéro de facture libre après plusieurs tentatives.",
            ]);
        }
    }

    // ---------------------------------------------------------------
    // 4. Calculer les totaux
    // ---------------------------------------------------------------
    $totalHt  = 0.0;
    $totalTtc = 0.0;
    foreach ($lines as $line) {
        $ht       = (float)$line['unit_price'] * (float)$line['quantity'] * (1 - (float)$line['discount'] / 100);
        $totalHt  += $ht;
        $totalTtc += $ht * (1 + (float)$line['tva_rate'] / 100);
    }
    $totalHt  = round($totalHt,  2);
    $totalTtc = round($totalTtc, 2);

    $pdo->beginTransaction();

    // ---------------------------------------------------------------
    // 5. Créer l'entrée dans tble_client_billed
    // ---------------------------------------------------------------

    $missionRef = $quote['mission_id'] ? (function() use ($pdo, $quote): string {
        $s = $pdo->prepare("SELECT ref FROM llx_missionsplanet_mission WHERE rowid = :id LIMIT 1");
        $s->execute([':id' => $quote['mission_id']]);
        return (string)($s->fetchColumn() ?? '');
    })() : '';

    $stmtBilled = $pdo->prepare("
        INSERT INTO tble_client_billed
            (entity, mission_ref, client_name, invoice_number, invoice_total_ht,
             amount_ht, billed_at, status_code, status_label, category,
             created_by, created_by_name, notes, created_at, updated_at)
        VALUES
            (:entity, :mission_ref, :client_name, :invoice_number, :invoice_total_ht,
             :amount_ht, NOW(), 'draft', 'Brouillon', 'client',
             :created_by, NULL, :notes, NOW(), NOW())
    ");
    $stmtBilled->execute([
        ':entity'           => $currentEntity,
        ':mission_ref'      => $missionRef,
        ':client_name'      => $quote['client_name'] ?? '',
        ':invoice_number'   => $invoiceNumber,
        ':invoice_total_ht' => $totalHt,
        ':amount_ht'        => $totalHt,
        ':created_by'       => $userId,
        ':notes'            => $quote['notes'] ?? null,
    ]);
    $billedId = (int)$pdo->lastInsertId();

    // ---------------------------------------------------------------
    // 6. Copier les lignes vers tble_client_invoice_lines
    // ---------------------------------------------------------------
    $stmtLine = $pdo->prepare("
        INSERT INTO tble_client_invoice_lines
            (entity, invoice_id, invoice_number, client_name, mission_ref,
             designation, unit_price_ht, quantity, tva_rate,
             total_ht, sort_order, created_at, updated_at)
        VALUES
            (:entity, :invoice_id, :invoice_number, :client_name, :mission_ref,
             :designation, :unit_price, :quantity, :tva_rate,
             :total_ht, :sort_order, NOW(), NOW())
    ");
    foreach ($lines as $i => $line) {
        $lineHt = round(
            (float)$line['unit_price'] * (float)$line['quantity'] * (1 - (float)$line['discount'] / 100),
            4
        );
        $stmtLine->execute([
            ':entity'         => $currentEntity,
            ':invoice_id'     => $billedId,
            ':invoice_number' => $invoiceNumber,
            ':client_name'    => $quote['client_name'] ?? '',
            ':mission_ref'    => $missionRef,
            ':designation'    => $line['description'] ?? '',
            ':unit_price'     => (float)$line['unit_price'],
            ':quantity'       => (float)$line['quantity'],
            ':tva_rate'       => (float)$line['tva_rate'],
            ':total_ht'       => $lineHt,
            ':sort_order'     => (int)($line['sort_order'] ?? $i),
        ]);
    }

    // ---------------------------------------------------------------
    // 7. Passer le devis en accepted_converted
    // ---------------------------------------------------------------
    $pdo->prepare("
        UPDATE invoice_draft
        SET status = 'accepted_converted',
            converted_invoice_number = :inv,
            updated_at = NOW()
        WHERE id = :id AND entity = :entity
    ")->execute([':inv' => $invoiceNumber, ':id' => $quoteId, ':entity' => $currentEntity]);

    $pdo->commit();

    respond(201, [
        'success'        => true,
        'invoice_number' => $invoiceNumber,
        'invoice_id'     => $billedId,
        'quote_id'       => $quoteId,
        'total_ht'       => $totalHt,
        'total_ttc'      => $totalTtc,
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('convert_quote_to_invoice error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur']);
}
