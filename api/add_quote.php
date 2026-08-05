<?php
/**
 * add_quote.php
 * AMI v1.4 — Module Devis (création manuelle)
 *
 * Crée un devis "à la main" (sans mission source) depuis la page Devis.
 * Contrairement à create_quote_from_mission.php, ce endpoint autorise :
 *   - mission_id = NULL (devis libre)
 *   - lignes saisies manuellement (description, quantité, PU, TVA, remise)
 *
 * POST JSON {
 *   client_id: int (obligatoire),
 *   date_valid_until?: string YYYY-MM-DD (défaut : +30 jours),
 *   month?: string YYYY-MM (défaut : mois courant),
 *   notes?: string,
 *   lines: [{
 *     description: string,
 *     quantity: number,
 *     unit_price: number,
 *     tva_rate?: number,
 *     discount?: number
 *   }]
 * }
 * → 201 { success:true, quote_id:int, total_ht:float, status:'draft_created' }
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

$clientId       = isset($input['client_id']) ? (int) $input['client_id'] : 0;
$dateValidUntil = isset($input['date_valid_until']) ? trim((string)$input['date_valid_until']) : '';
$month          = isset($input['month']) ? trim((string)$input['month']) : '';
$notes          = isset($input['notes']) ? trim((string)$input['notes']) : '';
$lines          = isset($input['lines']) && is_array($input['lines']) ? $input['lines'] : [];
$userId         = isset($currentUser['sub']) ? (int) $currentUser['sub'] : null;

if ($clientId <= 0) {
    respond(400, ['success' => false, 'error' => 'client_id requis']);
}

// Défauts métier — date de validité +30j, mois courant.
if (!$dateValidUntil || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateValidUntil)) {
    $dateValidUntil = date('Y-m-d', strtotime('+30 days'));
}
if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

try {
    // 1. Vérifier que le client appartient à l'entité courante (sécurité multi-entité)
    $stmtC = $pdo->prepare("SELECT rowid, nom FROM llx_societe WHERE rowid = :id AND entity = :entity LIMIT 1");
    $stmtC->execute([':id' => $clientId, ':entity' => $currentEntity]);
    $client = $stmtC->fetch();
    if (!$client) {
        respond(404, ['success' => false, 'error' => "Client introuvable (id=$clientId) pour cette entité."]);
    }

    // 2. S'assurer que les tables sont prêtes
    ensureInvoiceDraftTable($pdo);
    ensureInvoiceDraftLinesEntityColumn($pdo);

    $pdo->beginTransaction();

    // 3. Insérer l'entête (invoice_draft) — mission_id=NULL car devis manuel
    $stmtInsert = $pdo->prepare("
        INSERT INTO invoice_draft
            (entity, client_id, client_name, mission_id, month, total_ht,
             status, date_valid_until, notes, created_by, created_at, updated_at)
        VALUES
            (:entity, :client_id, :client_name, NULL, :month, 0.00,
             'draft', :date_valid_until, :notes, :created_by, NOW(), NOW())
    ");
    $stmtInsert->execute([
        ':entity'          => $currentEntity,
        ':client_id'       => $clientId,
        ':client_name'     => $client['nom'] ?? null,
        ':month'           => $month,
        ':date_valid_until'=> $dateValidUntil,
        ':notes'           => $notes ?: null,
        ':created_by'      => $userId,
    ]);
    $quoteId = (int) $pdo->lastInsertId();

    // 4. Insérer les lignes — total_ht est la somme des lignes.
    $totalHt = 0.0;
    $sortOrder = 0;
    $stmtLine = $pdo->prepare("
        INSERT INTO invoice_draft_lines
            (entity, draft_id, mission_id, description, quantity, unit_price,
             tva_rate, discount, total, sort_order, updated_at)
        VALUES
            (:entity, :draft_id, NULL, :description, :quantity, :unit_price,
             :tva_rate, :discount, :total, :sort_order, NOW())
    ");
    foreach ($lines as $line) {
        $description = isset($line['description']) ? trim((string)$line['description']) : '';
        $quantity    = isset($line['quantity']) ? (float)$line['quantity'] : 0.0;
        $unitPrice   = isset($line['unit_price']) ? (float)$line['unit_price'] : 0.0;
        $tvaRate     = isset($line['tva_rate']) ? (float)$line['tva_rate'] : 0.0;
        $discount    = isset($line['discount']) ? (float)$line['discount'] : 0.0;
        if ($description === '' && $quantity <= 0 && $unitPrice <= 0) {
            continue; // ligne totalement vide → ignorée
        }
        // Total ligne = quantité × PU × (1 - remise/100)
        $lineTotal = round($quantity * $unitPrice * (1 - ($discount / 100)), 2);
        $totalHt += $lineTotal;

        $stmtLine->execute([
            ':entity'      => $currentEntity,
            ':draft_id'    => $quoteId,
            ':description' => $description !== '' ? $description : 'Prestation',
            ':quantity'    => $quantity,
            ':unit_price'  => $unitPrice,
            ':tva_rate'    => $tvaRate,
            ':discount'    => $discount,
            ':total'       => $lineTotal,
            ':sort_order'  => $sortOrder,
        ]);
        $sortOrder++;
    }

    // 5. Mettre à jour le total_ht de l'entête
    if ($totalHt > 0) {
        $stmtUpd = $pdo->prepare("UPDATE invoice_draft SET total_ht = :total WHERE id = :id");
        $stmtUpd->execute([':total' => round($totalHt, 2), ':id' => $quoteId]);
    }

    $pdo->commit();

    respond(201, [
        'success'  => true,
        'quote_id' => $quoteId,
        'total_ht' => round($totalHt, 2),
        'status'   => 'draft_created',
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('add_quote error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur', 'details' => $e->getMessage()]);
}
