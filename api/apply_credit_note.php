<?php
/**
 * apply_credit_note.php — Imputer un avoir (credit note) sur une facture
 * impayée du même client, façon Dolibarr.
 *
 * Règles :
 *   - L'avoir doit avoir invoice_type=2, status_code != 'cancelled', credit_consumed=0.
 *   - La facture cible doit avoir invoice_type=0, status_code in ('validated','sent')
 *     (donc non payée, non brouillon, non annulée).
 *   - Même client (clé : client_name).
 *   - Le montant imputé doit être > 0 et <= min(reste avoir, reste facture).
 *
 * Tous les montants sont en HT (cohérent avec tble_client_billed.invoice_total_ht).
 *
 * Effets :
 *   - Crée une ligne dans tble_credit_note_applications.
 *   - Incrémente applied_amount sur l'avoir ET sur la facture cible.
 *   - Si l'avoir est totalement consommé : credit_consumed=1 + status_code='paid'.
 *   - Si la facture cible est totalement couverte : status_code='paid'.
 *
 * Payload :
 * {
 *   "credit_note_number":     "AV-202606-001",
 *   "target_invoice_number":  "FAC-202606-007",
 *   "applied_amount":         120.50,
 *   "user_id":                3,
 *   "user_name":              "Anna FALL",
 *   "notes":                  "Imputation suite à avoir client"   // optionnel
 * }
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$creditNoteNumber    = trim((string) ($input['credit_note_number'] ?? ''));
$targetInvoiceNumber = trim((string) ($input['target_invoice_number'] ?? ''));
$rawAmount           = $input['applied_amount'] ?? null;
$userId              = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName            = trim((string) ($input['user_name'] ?? ''));
$notes               = trim((string) ($input['notes'] ?? ''));

if ($creditNoteNumber === '' || $targetInvoiceNumber === '') {
    respond(400, [
        'success' => false,
        'error'   => 'credit_note_number et target_invoice_number sont requis.',
    ]);
}
if ($creditNoteNumber === $targetInvoiceNumber) {
    respond(400, ['success' => false, 'error' => 'Un avoir ne peut pas être imputé sur lui-même.']);
}
if (!is_numeric($rawAmount)) {
    respond(400, ['success' => false, 'error' => 'applied_amount doit être un nombre.']);
}
$appliedAmount = round((float) $rawAmount, 2);
if ($appliedAmount <= 0) {
    respond(400, ['success' => false, 'error' => 'applied_amount doit être strictement positif.']);
}

try {
    /** @var PDO $pdo */ // fourni globalement par api/config.php
    ensureClientBillingTable($pdo);
    ensureCreditNoteApplicationsTable($pdo);

    $pdo->beginTransaction();

    // --- Avoir : agrégation sur toutes les lignes header de l'avoir (multi-missions) ---
    // NOTE: `invoice_total_ht` est stocké répété sur chaque ligne (même valeur
    // pour toutes les lignes d'une même facture). On utilise donc MAX(NULLIF)
    // pour récupérer la valeur unique, avec fallback sur SUM(amount_ht) si
    // `invoice_total_ht` n'est pas renseigné (anciens enregistrements).
    $stmt = $pdo->prepare(
        "SELECT
            invoice_number,
            MAX(client_name) AS client_name,
            COALESCE(MAX(invoice_type), 0) AS invoice_type,
            MAX(status_code) AS status_code,
            MAX(credit_consumed) AS credit_consumed,
            COALESCE(MAX(NULLIF(invoice_total_ht, 0)), SUM(COALESCE(amount_ht, 0))) AS total_ht,
            COALESCE(MAX(NULLIF(applied_amount, 0)), 0) AS applied_amount
         FROM tble_client_billed
         WHERE invoice_number = :inv AND entity = :entity
         GROUP BY invoice_number
         FOR UPDATE"
    );
    $stmt->execute([':inv' => $creditNoteNumber, ':entity' => $currentEntity]);
    $avoir = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$avoir) {
        $pdo->rollBack();
        respond(404, ['success' => false, 'error' => "Avoir introuvable : $creditNoteNumber."]);
    }
    if ((int) $avoir['invoice_type'] !== 2) {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "$creditNoteNumber n'est pas un avoir."]);
    }
    $avoirStatus = strtolower((string) $avoir['status_code']);
    if ($avoirStatus === 'cancelled' || $avoirStatus === 'draft') {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "L'avoir doit être validé pour être imputé."]);
    }
    if ((int) $avoir['credit_consumed'] === 1) {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "Cet avoir est déjà totalement consommé."]);
    }

    // Montant nominal de l'avoir = valeur absolue du total HT (stocké négatif)
    $avoirTotalAbs    = abs((float) $avoir['total_ht']);
    $avoirAppliedSoFar = (float) $avoir['applied_amount'];
    $avoirRemaining   = round($avoirTotalAbs - $avoirAppliedSoFar, 2);
    if ($avoirRemaining <= 0) {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "Aucun montant restant sur cet avoir."]);
    }

    // --- Facture cible ---
    // Cf. remarque ci-dessus : total_ht doit venir de MAX(NULLIF(invoice_total_ht)),
    // pas de SUM, sinon on multiplie par le nombre de lignes de la facture.
    $stmt = $pdo->prepare(
        "SELECT
            invoice_number,
            MAX(client_name) AS client_name,
            COALESCE(MAX(invoice_type), 0) AS invoice_type,
            MAX(status_code) AS status_code,
            COALESCE(MAX(NULLIF(invoice_total_ht, 0)), SUM(COALESCE(amount_ht, 0))) AS total_ht,
            COALESCE(MAX(NULLIF(applied_amount, 0)), 0) AS applied_amount
         FROM tble_client_billed
         WHERE invoice_number = :inv AND entity = :entity
         GROUP BY invoice_number
         FOR UPDATE"
    );
    $stmt->execute([':inv' => $targetInvoiceNumber, ':entity' => $currentEntity]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$target) {
        $pdo->rollBack();
        respond(404, ['success' => false, 'error' => "Facture cible introuvable : $targetInvoiceNumber."]);
    }
    if ((int) $target['invoice_type'] === 2) {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "Impossible d'imputer un avoir sur un autre avoir."]);
    }
    $targetStatus = strtolower((string) $target['status_code']);
    if (!in_array($targetStatus, ['validated', 'sent'], true)) {
        $pdo->rollBack();
        respond(400, [
            'success' => false,
            'error'   => "La facture cible doit être validée ou envoyée (statut actuel : $targetStatus).",
        ]);
    }

    // Même client (comparaison insensible casse/espaces)
    $normalize = static function ($v) {
        return strtolower(trim((string) $v));
    };
    if ($normalize($avoir['client_name']) !== $normalize($target['client_name'])) {
        $pdo->rollBack();
        respond(400, [
            'success' => false,
            'error'   => "L'avoir et la facture cible doivent appartenir au même client.",
        ]);
    }

    $targetTotal      = (float) $target['total_ht'];
    $targetApplied    = (float) $target['applied_amount'];
    $targetRemaining  = round($targetTotal - $targetApplied, 2);
    if ($targetRemaining <= 0) {
        $pdo->rollBack();
        respond(400, ['success' => false, 'error' => "La facture cible n'a plus de reste à payer."]);
    }

    $maxApplicable = min($avoirRemaining, $targetRemaining);
    if ($appliedAmount > $maxApplicable + 0.001) {
        $pdo->rollBack();
        respond(400, [
            'success' => false,
            'error'   => sprintf(
                "Le montant imputé (%.2f) dépasse le maximum applicable (%.2f).",
                $appliedAmount,
                $maxApplicable
            ),
        ]);
    }

    // --- Enregistrement de l'imputation ---
    $stmt = $pdo->prepare(
        "INSERT INTO tble_credit_note_applications
            (entity, credit_note_number, target_invoice_number, client_name,
             applied_amount, applied_at, applied_by, applied_by_name, notes)
         VALUES (:entity, :cn, :tgt, :client, :amt, NOW(), :uid, :uname, :notes)"
    );
    $stmt->execute([
        ':entity' => $currentEntity,
        ':cn'     => $creditNoteNumber,
        ':tgt'    => $targetInvoiceNumber,
        ':client' => $target['client_name'],
        ':amt'    => $appliedAmount,
        ':uid'    => $userId,
        ':uname'  => $userName !== '' ? $userName : null,
        ':notes'  => $notes !== '' ? $notes : null,
    ]);

    // --- Mise à jour AVOIR (toutes les lignes header agrégées) ---
    $newAvoirApplied = round($avoirAppliedSoFar + $appliedAmount, 2);
    $avoirFullyConsumed = ($avoirRemaining - $appliedAmount) <= 0.001;

    $stmt = $pdo->prepare(
        "UPDATE tble_client_billed
            SET applied_amount = :amt,
                credit_consumed = :consumed,
                status_code = CASE WHEN :consumed = 1 THEN 'paid' ELSE status_code END,
                status_label = CASE WHEN :consumed = 1 THEN 'Consommé' ELSE status_label END
          WHERE invoice_number = :inv AND entity = :entity"
    );
    $stmt->execute([
        ':amt'      => $newAvoirApplied,
        ':consumed' => $avoirFullyConsumed ? 1 : 0,
        ':inv'      => $creditNoteNumber,
        ':entity'   => $currentEntity,
    ]);

    // --- Mise à jour FACTURE CIBLE ---
    $newTargetApplied = round($targetApplied + $appliedAmount, 2);
    $targetFullyCovered = ($targetRemaining - $appliedAmount) <= 0.001;

    $stmt = $pdo->prepare(
        "UPDATE tble_client_billed
            SET applied_amount = :amt,
                status_code = CASE WHEN :paid = 1 THEN 'paid' ELSE status_code END,
                status_label = CASE WHEN :paid = 1 THEN 'Payée' ELSE status_label END
          WHERE invoice_number = :inv AND entity = :entity"
    );
    $stmt->execute([
        ':amt'    => $newTargetApplied,
        ':paid'   => $targetFullyCovered ? 1 : 0,
        ':inv'    => $targetInvoiceNumber,
        ':entity' => $currentEntity,
    ]);

    $pdo->commit();

    respond(200, [
        'success'                  => true,
        'credit_note_number'       => $creditNoteNumber,
        'target_invoice_number'    => $targetInvoiceNumber,
        'applied_amount'           => $appliedAmount,
        'credit_note_remaining'    => round($avoirRemaining - $appliedAmount, 2),
        'credit_note_consumed'     => $avoirFullyConsumed,
        'target_invoice_remaining' => round($targetRemaining - $appliedAmount, 2),
        'target_invoice_paid'      => $targetFullyCovered,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, [
        'success' => false,
        'error'   => 'Erreur serveur : ' . $e->getMessage(),
    ]);
}
