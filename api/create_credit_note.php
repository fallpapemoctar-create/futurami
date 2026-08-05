<?php
/**
 * create_credit_note.php — Création d'un avoir (credit note) sur une facture
 * existante, façon Dolibarr.
 *
 * Un avoir est stocké dans tble_client_billed avec :
 *   - invoice_type          = 2
 *   - source_invoice_number = ref de la facture origine
 *   - credit_note_reason    = motif libre
 *   - invoice_total_ht / amount_ht en valeurs NÉGATIVES
 *   - status_code           = 'validated' (un avoir naît validé, comme dans Dolibarr)
 *
 * Les lignes sont écrites dans tble_client_invoice_lines avec quantités et
 * montants négatifs (mêmes taux de TVA que la facture origine).
 *
 * Payload JSON attendu :
 * {
 *   "source_invoice_number": "FAC-202606-001",
 *   "mode": "total" | "partial",
 *   "reason": "Erreur de facturation",
 *   "lines": [                                  // requis si mode=partial
 *     { "source_line_id": 12, "quantity": 1, "unit_price_ht": 50.0 },
 *     ...
 *   ],
 *   "user_id": 3,
 *   "user_name": "Anna FALL",
 *   "billed_at": "2026-06-03 14:00:00"          // optionnel
 * }
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';
require_once __DIR__ . '/invoice_line_helpers.php';

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

$sourceInvoiceNumber = trim((string) ($input['source_invoice_number'] ?? ''));
if ($sourceInvoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Le numéro de facture origine est obligatoire.']);
}

$mode = strtolower(trim((string) ($input['mode'] ?? 'total')));
if (!in_array($mode, ['total', 'partial'], true)) {
    respond(400, ['success' => false, 'error' => "Le mode doit être 'total' ou 'partial'."]);
}

$reason = trim((string) ($input['reason'] ?? ''));
if ($reason === '') {
    respond(400, ['success' => false, 'error' => "Le motif de l'avoir est obligatoire."]);
}
if (mb_strlen($reason) > 255) {
    $reason = mb_substr($reason, 0, 255);
}

$partialLines = $input['lines'] ?? [];
if ($mode === 'partial' && (!is_array($partialLines) || empty($partialLines))) {
    respond(400, ['success' => false, 'error' => 'En mode partiel, au moins une ligne est requise.']);
}

$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));

$billedAtRaw = $input['billed_at'] ?? null;
$timestamp = $billedAtRaw ? strtotime((string) $billedAtRaw) : time();
$timestamp = $timestamp ?: time();
$billedAt = date('Y-m-d H:i:s', $timestamp);

try {
    ensureClientBillingTable($pdo);
    ensureClientInvoiceLinesTable($pdo);

    // 1) Récupérer l'en-tête de la facture origine (1 ligne par mission, on prend la première)
    $headStmt = $pdo->prepare(
        "SELECT invoice_number, client_name, category, invoice_type, status_code
         FROM tble_client_billed
         WHERE invoice_number = :inv AND entity = :entity
         ORDER BY id ASC
         LIMIT 1"
    );
    $headStmt->execute([':inv' => $sourceInvoiceNumber, ':entity' => $currentEntity]);
    $sourceHead = $headStmt->fetch(PDO::FETCH_ASSOC);
    if (!$sourceHead) {
        respond(404, ['success' => false, 'error' => "Facture origine introuvable : $sourceInvoiceNumber."]);
    }
    if ((int) ($sourceHead['invoice_type'] ?? 0) === 2) {
        respond(409, ['success' => false, 'error' => "Impossible de créer un avoir sur un avoir."]);
    }
    $sourceStatus = strtolower(trim((string) ($sourceHead['status_code'] ?? '')));
    if (in_array($sourceStatus, ['draft', 'cancelled'], true)) {
        respond(409, ['success' => false, 'error' => "La facture origine doit être validée pour créer un avoir (statut actuel : $sourceStatus)."]);
    }

    $clientName = (string) ($sourceHead['client_name'] ?? '');
    $category = (string) ($sourceHead['category'] ?? 'client');

    // 2) Récupérer les lignes de la facture origine
    $linesStmt = $pdo->prepare(
        "SELECT id, mission_ref, designation, tva_rate, unit_price_ht, quantity,
                total_ht, discount, notes, sort_order, period_month
         FROM tble_client_invoice_lines
         WHERE invoice_number = :inv AND entity = :entity
         ORDER BY sort_order ASC, id ASC"
    );
    $linesStmt->execute([':inv' => $sourceInvoiceNumber, ':entity' => $currentEntity]);
    $sourceLines = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
    if (empty($sourceLines)) {
        respond(404, ['success' => false, 'error' => "Aucune ligne trouvée pour la facture $sourceInvoiceNumber."]);
    }

    // 3) Construire les lignes de l'avoir (en négatif)
    $creditLines = [];
    if ($mode === 'total') {
        foreach ($sourceLines as $idx => $line) {
            $qty = invoiceNormalizeDecimal($line['quantity'] ?? 0);
            $unit = invoiceNormalizeDecimal($line['unit_price_ht'] ?? 0);
            $total = invoiceNormalizeDecimal($line['total_ht'] ?? ($qty * $unit));
            $creditLines[] = [
                'mission_ref'   => $line['mission_ref'] ?? null,
                'designation'   => $line['designation'] ?? '',
                'tva_rate'      => invoiceNormalizeDecimal($line['tva_rate'] ?? 0),
                'unit_price_ht' => $unit, // unit reste positif, c'est la qty qui inverse
                'quantity'      => -abs($qty),
                'total_ht'      => -abs($total),
                'discount'      => invoiceNormalizeDecimal($line['discount'] ?? 0),
                'notes'         => $line['notes'] ?? null,
                'sort_order'    => (int) ($line['sort_order'] ?? $idx),
                'period_month'  => $line['period_month'] ?? null,
            ];
        }
    } else {
        // mode partial : on indexe les lignes source par id
        $byId = [];
        foreach ($sourceLines as $line) {
            $byId[(int) $line['id']] = $line;
        }
        $sortOrder = 0;
        foreach ($partialLines as $req) {
            if (!is_array($req)) continue;
            $sid = (int) ($req['source_line_id'] ?? 0);
            if ($sid <= 0 || !isset($byId[$sid])) {
                respond(400, ['success' => false, 'error' => "Ligne source introuvable : $sid."]);
            }
            $src = $byId[$sid];
            $maxQty = abs(invoiceNormalizeDecimal($src['quantity'] ?? 0));
            $qty = abs(invoiceNormalizeDecimal($req['quantity'] ?? $maxQty));
            if ($qty <= 0) {
                respond(400, ['success' => false, 'error' => "La quantité doit être strictement positive (ligne $sid)."]);
            }
            if ($qty > $maxQty + 0.0001) {
                respond(400, ['success' => false, 'error' => "La quantité ($qty) dépasse celle de la facture origine ($maxQty) pour la ligne $sid."]);
            }
            $unit = invoiceNormalizeDecimal($req['unit_price_ht'] ?? ($src['unit_price_ht'] ?? 0));
            $total = invoiceRoundCurrency($qty * $unit);
            $creditLines[] = [
                'mission_ref'   => $src['mission_ref'] ?? null,
                'designation'   => $src['designation'] ?? '',
                'tva_rate'      => invoiceNormalizeDecimal($src['tva_rate'] ?? 0),
                'unit_price_ht' => $unit,
                'quantity'      => -$qty,
                'total_ht'      => -$total,
                'discount'      => invoiceNormalizeDecimal($src['discount'] ?? 0),
                'notes'         => $src['notes'] ?? null,
                'sort_order'    => $sortOrder++,
                'period_month'  => $src['period_month'] ?? null,
            ];
        }
    }

    if (empty($creditLines)) {
        respond(400, ['success' => false, 'error' => 'Aucune ligne à créditer.']);
    }

    // 4) Réserver un numéro d'avoir (séquence AV-YYYYMM-NNN)
    //    NB : le suffixe NNN est perpétuel (pas de reset mensuel/annuel)
    //    Réservation atomique via tble_invoice_sequence.
    $year = (int) date('Y', $timestamp);
    $month = (int) date('m', $timestamp);
    $nextNum = reserveNextInvoiceSequence($pdo, 'AV', $currentEntity);
    $creditNumber = formatInvoiceNumber('AV', $year, $month, $nextNum);

    // Garde-fou anti-collision : re-réserve si le numéro est déjà
    // associé à un client différent (défense en profondeur).
    if ($clientName !== '') {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $conflict = invoiceNumberCollisionClient($pdo, $creditNumber, $clientName, $currentEntity);
            if ($conflict === '') break;
            $nextNum = reserveNextInvoiceSequence($pdo, 'AV', $currentEntity);
            $creditNumber = formatInvoiceNumber('AV', $year, $month, $nextNum);
        }
        if (invoiceNumberCollisionClient($pdo, $creditNumber, $clientName, $currentEntity) !== '') {
            respond(500, [
                'success' => false,
                'error' => "Impossible d'obtenir un numéro d'avoir libre après plusieurs tentatives.",
            ]);
        }
    }

    // 5) Insérer en transaction : 1 ligne d'en-tête par mission_ref + lignes détail
    $pdo->beginTransaction();
    try {
        $totalHt = 0.0;
        foreach ($creditLines as $line) {
            $totalHt += (float) $line['total_ht'];
        }
        $totalHt = invoiceRoundCurrency($totalHt);

        // Regrouper par mission_ref pour l'en-tête (cohérent avec log_client_billing)
        $byMission = [];
        foreach ($creditLines as $line) {
            $mref = (string) ($line['mission_ref'] ?? '');
            if ($mref === '') $mref = $sourceInvoiceNumber; // fallback
            if (!isset($byMission[$mref])) {
                $byMission[$mref] = 0.0;
            }
            $byMission[$mref] += (float) $line['total_ht'];
        }

        $insertHead = $pdo->prepare(
            "INSERT INTO tble_client_billed
                (entity, mission_ref, client_name, invoice_number, invoice_total_ht, amount_ht,
                 billed_at, status_code, status_label, category,
                 invoice_type, source_invoice_number, credit_note_reason,
                 created_by, created_by_name, notes)
             VALUES
                (:entity, :mref, :client, :inv, :tot_ht, :amt_ht,
                 :billed_at, 'validated', 'Validée', :cat,
                 2, :src, :reason,
                 :uid, :uname, :notes)"
        );
        foreach ($byMission as $mref => $amount) {
            $insertHead->execute([
                ':entity'    => $currentEntity,
                ':mref'      => $mref,
                ':client'    => $clientName,
                ':inv'       => $creditNumber,
                ':tot_ht'    => invoiceRoundCurrency($totalHt),
                ':amt_ht'    => invoiceRoundCurrency($amount),
                ':billed_at' => $billedAt,
                ':cat'       => $category !== '' ? $category : 'client',
                ':src'       => $sourceInvoiceNumber,
                ':reason'    => $reason,
                ':uid'       => $userId,
                ':uname'     => $userName !== '' ? $userName : null,
                ':notes'     => "Avoir sur facture $sourceInvoiceNumber — $reason",
            ]);
        }

        $insertLine = $pdo->prepare(
            "INSERT INTO tble_client_invoice_lines
                (entity, invoice_number, client_name, period_month, mission_ref,
                 designation, tva_rate, unit_price_ht, quantity, total_ht,
                 discount, notes, sort_order,
                 created_by, created_by_name, updated_by, updated_by_name)
             VALUES
                (:entity, :inv, :client, :period, :mref,
                 :desig, :tva, :unit, :qty, :total,
                 :disc, :notes, :sort,
                 :uid, :uname, :uid, :uname)"
        );
        foreach ($creditLines as $line) {
            $insertLine->execute([
                ':entity' => $currentEntity,
                ':inv'    => $creditNumber,
                ':client' => $clientName,
                ':period' => $line['period_month'] ?: null,
                ':mref'   => $line['mission_ref'] ?: null,
                ':desig'  => $line['designation'],
                ':tva'    => $line['tva_rate'],
                ':unit'   => $line['unit_price_ht'],
                ':qty'    => $line['quantity'],
                ':total'  => $line['total_ht'],
                ':disc'   => $line['discount'],
                ':notes'  => $line['notes'],
                ':sort'   => $line['sort_order'],
                ':uid'    => $userId,
                ':uname'  => $userName !== '' ? $userName : null,
            ]);
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    respond(201, [
        'success'               => true,
        'credit_note_number'    => $creditNumber,
        'source_invoice_number' => $sourceInvoiceNumber,
        'mode'                  => $mode,
        'reason'                => $reason,
        'total_ht'              => $totalHt,
        'lines_count'           => count($creditLines),
    ]);
} catch (Exception $e) {
    respond(500, ['success' => false, 'error' => $e->getMessage()]);
}
