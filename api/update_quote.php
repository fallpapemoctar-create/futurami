<?php
/**
 * update_quote.php
 * AMI v1.4 — Module Devis
 *
 * Modifie les champs d'un devis (RM-04 : modifiable si draft ou sent).
 * Rejette la modification si statut accepted/rejected/expired (RM-05/06).
 *
 * POST {
 *   quote_id: int,
 *   description?: string,
 *   notes?: string,
 *   date_valid_until?: string (YYYY-MM-DD),
 *   status?: 'draft'|'sent'|'accepted'|'rejected'|'expired',
 *   lines?: [{ id?: int, description, quantity, unit_price, tva_rate, discount, sort_order }]
 * }
 * → 200 { success: true, quote_id: int }
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

$quoteId = isset($input['quote_id']) ? (int) $input['quote_id'] : 0;
if ($quoteId <= 0) {
    respond(400, ['success' => false, 'error' => 'quote_id requis']);
}

try {
    ensureInvoiceDraftTable($pdo);

    // Charger le devis courant
    $stmt = $pdo->prepare("SELECT * FROM invoice_draft WHERE id = :id AND entity = :entity LIMIT 1");
    $stmt->execute([':id' => $quoteId, ':entity' => $currentEntity]);
    $quote = $stmt->fetch();

    if (!$quote) {
        respond(404, ['success' => false, 'error' => 'Devis introuvable']);
    }

    // RM-04/05/06 — Vérifier que le devis est modifiable
    $lockedStatuses = ['accepted', 'rejected', 'expired', 'accepted_converted'];
    if (in_array($quote['status'], $lockedStatuses, true)) {
        respond(403, [
            'success' => false,
            'error'   => 'Devis verrouillé — statut : ' . $quote['status'],
        ]);
    }

    $pdo->beginTransaction();

    // ---------------------------------------------------------------
    // Mise à jour du header
    // ---------------------------------------------------------------
    $fields = [];
    $params = [':id' => $quoteId, ':entity' => $currentEntity];

    if (array_key_exists('notes', $input)) {
        $fields[]        = '`notes` = :notes';
        $params[':notes'] = $input['notes'] !== null ? trim($input['notes']) : null;
    }
    if (array_key_exists('date_valid_until', $input)) {
        $fields[]                = '`date_valid_until` = :date_valid_until';
        $params[':date_valid_until'] = $input['date_valid_until'] ?: null;
    }
    // Changement de statut autorisé uniquement vers draft/sent/accepted/rejected/expired
    if (array_key_exists('status', $input)) {
        $allowed = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
        $newStatus = $input['status'];
        if (!in_array($newStatus, $allowed, true)) {
            $pdo->rollBack();
            respond(400, ['success' => false, 'error' => 'Statut invalide : ' . $newStatus]);
        }
        $fields[]          = '`status` = :status';
        $params[':status']  = $newStatus;

        // Enregistrer date d'envoi si passage à 'sent'
        if ($newStatus === 'sent' && $quote['status'] !== 'sent') {
            $fields[] = '`sent_at` = NOW()';
        }
    }

    if (!empty($fields)) {
        $fields[] = '`updated_at` = NOW()';
        $sql = 'UPDATE `invoice_draft` SET ' . implode(', ', $fields) . ' WHERE id = :id AND entity = :entity';
        $pdo->prepare($sql)->execute($params);
    }

    // ---------------------------------------------------------------
    // Mise à jour des lignes (upsert)
    // ---------------------------------------------------------------
    if (isset($input['lines']) && is_array($input['lines'])) {
        ensureInvoiceDraftLinesEntityColumn($pdo);
        $totalHt = 0.0;

        foreach ($input['lines'] as $i => $line) {
            $lineId     = isset($line['id']) && $line['id'] ? (int) $line['id'] : null;
            $desc       = trim($line['description'] ?? '');
            $qty        = max(0.0, (float)($line['quantity']   ?? 1));
            $unitPrice  = max(0.0, (float)($line['unit_price'] ?? 0));
            $tvaRate    = max(0.0, (float)($line['tva_rate']   ?? 0));
            $discount   = min(100.0, max(0.0, (float)($line['discount'] ?? 0)));
            $sortOrder  = (int)($line['sort_order'] ?? $i);
            $lineTotal  = round($unitPrice * $qty * (1 - $discount / 100), 4);
            $totalHt   += $lineTotal;

            if ($lineId) {
                $pdo->prepare("
                    UPDATE `invoice_draft_lines`
                    SET description = :desc,
                        quantity    = :qty,
                        unit_price  = :up,
                        tva_rate    = :tva,
                        discount    = :disc,
                        total       = :total,
                        sort_order  = :sort,
                        updated_at  = NOW()
                    WHERE id = :lid AND draft_id = :did AND entity = :entity
                ")->execute([
                    ':desc'   => $desc,
                    ':qty'    => $qty,
                    ':up'     => $unitPrice,
                    ':tva'    => $tvaRate,
                    ':disc'   => $discount,
                    ':total'  => $lineTotal,
                    ':sort'   => $sortOrder,
                    ':lid'    => $lineId,
                    ':did'    => $quoteId,
                    ':entity' => $currentEntity,
                ]);
            } else {
                $pdo->prepare("
                    INSERT INTO `invoice_draft_lines`
                        (entity, draft_id, description, quantity, unit_price,
                         tva_rate, discount, total, sort_order, updated_at)
                    VALUES
                        (:entity, :did, :desc, :qty, :up,
                         :tva, :disc, :total, :sort, NOW())
                ")->execute([
                    ':entity' => $currentEntity,
                    ':did'   => $quoteId,
                    ':desc'  => $desc,
                    ':qty'   => $qty,
                    ':up'    => $unitPrice,
                    ':tva'   => $tvaRate,
                    ':disc'  => $discount,
                    ':total' => $lineTotal,
                    ':sort'  => $sortOrder,
                ]);
            }
        }

        // Mettre à jour total_ht du devis
        $pdo->prepare("UPDATE `invoice_draft` SET total_ht = :ht, updated_at = NOW() WHERE id = :id AND entity = :entity")
            ->execute([':ht' => round($totalHt, 2), ':id' => $quoteId, ':entity' => $currentEntity]);
    }

    $pdo->commit();
    respond(200, ['success' => true, 'quote_id' => $quoteId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('update_quote error: ' . $e->getMessage());
    respond(500, ['success' => false, 'error' => 'Erreur serveur']);
}
