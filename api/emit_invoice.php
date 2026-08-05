<?php
/**
 * emit_invoice.php — Émission ATOMIQUE d'une facture définitive.
 *
 * Séquence unique dans une transaction PDO :
 *   1. Réserver le prochain N° de séquence via `reserveNextInvoiceSequence`
 *   2. Générer le PDF côté serveur avec ce N° définitif (via `generateInvoicePdf`)
 *   3. Écrire le PDF sur disque (dans un `.tmp` pour permettre le rollback)
 *   4. INSERT dans `tble_client_billed`
 *   5. Réécrire les lignes dans `tble_client_invoice_lines`
 *   6. DELETE brouillon (`invoice_draft` + lignes brouillon)
 *   7. COMMIT — puis renommer atomiquement le `.tmp` en fichier final
 *
 * Contrat garanti :
 *   - Impossible que deux utilisateurs reçoivent le même N° (LAST_INSERT_ID atomique).
 *   - Impossible qu'un PDF soit archivé sans ligne BDD (rollback → unlink).
 *   - Impossible qu'une ligne BDD soit créée sans PDF (échec de `file_put_contents`
 *     déclenche un rollback avant l'INSERT).
 *
 * Entrée (POST JSON) :
 *   { draft_id: int, user_id?: int, user_name?: string,
 *     notes?: string, status?: 'draft'|'validated'|'sent' }
 *
 * Sortie (200) :
 *   { success: true, invoice_number, pdf_path, pdf_filename, total_ht,
 *     status_code, status_label }
 *
 * @author  futurAMI
 * @since   2026-08 (Phase 3a)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';
require_once __DIR__ . '/invoice_line_helpers.php';
require_once __DIR__ . '/pdf_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function emitInvoiceRespond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function emitInvoiceLog(string $event, array $context = []): void {
    $safe = $context;
    if (isset($safe['pdf_bytes'])) {
        $safe['pdf_size'] = strlen($safe['pdf_bytes']);
        unset($safe['pdf_bytes']);
    }
    $line = sprintf(
        "[%s] %s %s%s",
        date('Y-m-d H:i:s'),
        $event,
        json_encode($safe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        PHP_EOL
    );
    @file_put_contents(__DIR__ . '/emit_invoice.log', $line, FILE_APPEND);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    emitInvoiceRespond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$draftId = isset($input['draft_id']) ? (int) $input['draft_id'] : 0;
if ($draftId <= 0) {
    emitInvoiceRespond(400, ['success' => false, 'error' => 'Paramètre draft_id requis.']);
}

$userId = isset($input['user_id']) ? (int) $input['user_id'] : null;
$userName = trim((string) ($input['user_name'] ?? ''));
$notes = trim((string) ($input['notes'] ?? ''));
[$statusCode, $statusLabel] = normalizeClientBillingStatus($input['status'] ?? 'validated');

// Fichier temporaire (écrit AVANT commit ; renommé APRÈS commit). Sur rollback,
// il sera supprimé pour ne laisser aucun PDF orphelin.
$tmpPath = null;
$finalPath = null;
$pdfFilename = null;

try {
    ensureClientBillingTable($pdo);
    ensureClientInvoiceLinesTable($pdo);
    ensureInvoiceDraftTable($pdo);

    // ─── 1. Charger le brouillon ────────────────────────────────────────
    $draftStmt = $pdo->prepare(
        "SELECT id, client_id, client_name, month, payment_condition_id, bank_account_id, total_ht, status
         FROM invoice_draft
         WHERE id = :id AND entity = :entity"
    );
    $draftStmt->execute([':id' => $draftId, ':entity' => $currentEntity]);
    $draft = $draftStmt->fetch(PDO::FETCH_ASSOC);
    if (!$draft) {
        emitInvoiceRespond(404, ['success' => false, 'error' => "Brouillon #{$draftId} introuvable."]);
    }
    if (($draft['status'] ?? '') === 'finalized') {
        emitInvoiceRespond(409, ['success' => false, 'error' => 'Ce brouillon a déjà été finalisé.']);
    }

    $clientName = trim((string) ($draft['client_name'] ?? ''));
    $periodMonthKey = $draft['month'] ? $draft['month'] . '-01' : null;
    $draftKey = ($clientName !== '' && $periodMonthKey)
        ? invoiceDraftKey($clientName, $periodMonthKey)
        : null;
    if ($draftKey === null) {
        emitInvoiceRespond(422, ['success' => false, 'error' => 'Brouillon incomplet : client ou mois manquant.']);
    }

    // ─── 2. Charger les lignes brouillon ────────────────────────────────
    $linesStmt = $pdo->prepare(
        "SELECT mission_ref, designation, tva_rate, unit_price_ht, quantity, total_ht, discount, notes, sort_order
         FROM tble_client_invoice_lines
         WHERE draft_key = :draft_key AND entity = :entity
         ORDER BY sort_order ASC, id ASC"
    );
    $linesStmt->execute([':draft_key' => $draftKey, ':entity' => $currentEntity]);
    $lines = $linesStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($lines)) {
        emitInvoiceRespond(422, ['success' => false, 'error' => "Ce brouillon ne contient aucune ligne — impossible d'émettre."]);
    }

    // ─── 3. Charger le client (llx_societe) pour le PDF ─────────────────
    $clientData = ['name' => $clientName, 'address' => '', 'zip' => '', 'city' => '', 'siret' => ''];
    if (!empty($draft['client_id'])) {
        $clientStmt = $pdo->prepare(
            "SELECT nom, address, zip, town, siret
             FROM llx_societe
             WHERE rowid = :id AND (entity = :entity OR entity = 0)
             LIMIT 1"
        );
        $clientStmt->execute([':id' => (int) $draft['client_id'], ':entity' => $currentEntity]);
        if ($row = $clientStmt->fetch(PDO::FETCH_ASSOC)) {
            $clientData = [
                'name' => $row['nom'] ?? $clientName,
                'address' => $row['address'] ?? '',
                'zip' => $row['zip'] ?? '',
                'city' => $row['town'] ?? '',
                'siret' => $row['siret'] ?? '',
            ];
        }
    }

    // ─── 4. Charger le compte bancaire ──────────────────────────────────
    $bankData = ['label' => '', 'iban' => '', 'bic' => '', 'holder' => '', 'domiciliation' => ''];
    if (!empty($draft['bank_account_id'])) {
        $bankStmt = $pdo->prepare(
            "SELECT label, bank, code_banque, code_guichet, number, cle_rib, bic,
                    iban_prefix, country_iban, cle_iban, domiciliation, proprio
             FROM llx_bank_account
             WHERE rowid = :id AND entity = :entity
             LIMIT 1"
        );
        $bankStmt->execute([':id' => (int) $draft['bank_account_id'], ':entity' => $currentEntity]);
        if ($row = $bankStmt->fetch(PDO::FETCH_ASSOC)) {
            $iban = trim((string) ($row['iban_prefix'] ?? ''));
            if ($iban === '') {
                $parts = array_filter([
                    trim((string) ($row['country_iban'] ?? '')),
                    trim((string) ($row['cle_iban'] ?? '')),
                    trim((string) ($row['code_banque'] ?? '')),
                    trim((string) ($row['code_guichet'] ?? '')),
                    trim((string) ($row['number'] ?? '')),
                    trim((string) ($row['cle_rib'] ?? '')),
                ], fn($p) => $p !== '');
                $iban = implode(' ', $parts);
            }
            $bankData = [
                'label' => trim($row['label'] ?? '') ?: trim($row['bank'] ?? ''),
                'iban' => $iban,
                'bic' => trim($row['bic'] ?? ''),
                'holder' => trim($row['proprio'] ?? ''),
                'domiciliation' => trim($row['domiciliation'] ?? ''),
            ];
        }
    }

    // ─── 5. Condition de paiement ───────────────────────────────────────
    $paymentTermLabel = '';
    $nbJour = 30;
    $decalage = 0;
    if (!empty($draft['payment_condition_id'])) {
        $ptStmt = $pdo->prepare(
            "SELECT COALESCE(NULLIF(TRIM(libelle_facture), ''), NULLIF(TRIM(libelle), ''), NULLIF(TRIM(code), '')) AS label,
                    nbjour, decalage
             FROM llx_c_payment_term
             WHERE rowid = :id
             LIMIT 1"
        );
        $ptStmt->execute([':id' => (int) $draft['payment_condition_id']]);
        if ($row = $ptStmt->fetch(PDO::FETCH_ASSOC)) {
            $paymentTermLabel = $row['label'] ?? '';
            $nbJour = (int) ($row['nbjour'] ?? 30);
            $decalage = (int) ($row['decalage'] ?? 0);
        }
    }

    // ─── 6. Infos entreprise (llx_const MAIN_INFO_SOCIETE_*) ────────────
    $company = [
        'name' => '', 'addressLine1' => '', 'addressLine2' => '',
        'postalCode' => '', 'city' => '', 'siret' => '',
        'phone' => '', 'email' => '', 'website' => '', 'logoUrl' => '',
    ];
    $mapping = [
        'MAIN_INFO_SOCIETE_NOM' => 'name',
        'MAIN_INFO_SOCIETE_ADRESSE' => 'addressLine1',
        'MAIN_INFO_SOCIETE_ADDRESS' => 'addressLine1',
        'MAIN_INFO_SOCIETE_ADRESSE2' => 'addressLine2',
        'MAIN_INFO_SOCIETE_CP' => 'postalCode',
        'MAIN_INFO_SOCIETE_ZIP' => 'postalCode',
        'MAIN_INFO_SOCIETE_VILLE' => 'city',
        'MAIN_INFO_SOCIETE_TOWN' => 'city',
        'MAIN_INFO_SOCIETE_TEL' => 'phone',
        'MAIN_INFO_SOCIETE_MAIL' => 'email',
        'MAIN_INFO_SOCIETE_WEB' => 'website',
        'MAIN_INFO_SOCIETE_LOGO' => 'logoUrl',
        'MAIN_INFO_SOCIETE_LOGO_URL' => 'logoUrl',
        'MAIN_INFO_SOCIETE_SIRET' => 'siret',
    ];
    $constStmt = $pdo->prepare(
        "SELECT name, value FROM llx_const WHERE entity = :entity AND name LIKE 'MAIN_INFO_SOCIETE_%'"
    );
    $constStmt->execute([':entity' => $currentEntity]);
    foreach ($constStmt->fetchAll(PDO::FETCH_KEY_PAIR) as $name => $value) {
        if (isset($mapping[$name])) {
            $company[$mapping[$name]] = trim((string) $value);
        }
    }

    // ─── 7. Prévalider anti-duplicate (hors transaction) ────────────────
    // Ce contrôle est doublé côté transaction avec le N° réel, mais un
    // pré-check évite de gaspiller un numéro pour un doublon évident.
    if ($clientName !== '' && $periodMonthKey !== null) {
        $dupStmt = $pdo->prepare(
            "SELECT cb.invoice_number
             FROM tble_client_billed cb
             WHERE cb.client_name = :client_name
               AND cb.entity = :entity
               AND LOWER(TRIM(cb.status_code)) IN ('draft', 'validated')
               AND EXISTS (
                   SELECT 1 FROM tble_client_invoice_lines cil
                   WHERE cil.invoice_number = cb.invoice_number
                     AND cil.entity = cb.entity
                     AND cil.period_month = :period_month
               )
             ORDER BY cb.billed_at DESC, cb.id DESC
             LIMIT 1"
        );
        $dupStmt->execute([
            ':client_name' => $clientName,
            ':entity' => $currentEntity,
            ':period_month' => $periodMonthKey,
        ]);
        $existing = $dupStmt->fetchColumn();
        if ($existing) {
            emitInvoiceRespond(409, [
                'success' => false,
                'error' => 'Une facture existe déjà pour ce client et ce mois.',
                'invoice_number' => $existing,
            ]);
        }
    }

    // ═══ TRANSACTION ATOMIQUE ═══════════════════════════════════════════
    $pdo->beginTransaction();

    // 8. Réserver le prochain N° (atomique via LAST_INSERT_ID)
    $sequence = reserveNextInvoiceSequence($pdo, 'FAC', $currentEntity);
    $year = (int) date('Y');
    $month = (int) date('n');
    if ($draft['month'] && preg_match('/^(\d{4})-(\d{2})$/', $draft['month'], $matches)) {
        $year = (int) $matches[1];
        $month = (int) $matches[2];
    }
    $invoiceNumber = formatInvoiceNumber('FAC', $year, $month, $sequence);

    // 9. Anti-collision sur le N° réservé (paranoïa : ne peut arriver sauf
    //    insertion manuelle en base entre le peek et le reserve).
    if ($clientName !== '') {
        $conflict = invoiceNumberCollisionClient($pdo, $invoiceNumber, $clientName, $currentEntity);
        if ($conflict !== '') {
            $pdo->rollBack();
            emitInvoiceRespond(409, [
                'success' => false,
                'error' => "Le numéro $invoiceNumber est déjà attribué au client « $conflict ».",
                'code' => 'client_collision',
            ]);
        }
    }

    // 10. Dates
    $dateIssued = date('Y-m-d');
    $dueTimestamp = strtotime($dateIssued . " +{$nbJour} days");
    if ($decalage > 0) {
        $dueTimestamp = strtotime(date('Y-m-t', $dueTimestamp));
    }
    $dateDue = date('Y-m-d', $dueTimestamp);

    // 11. Normaliser les lignes pour le PDF (mêmes clés que preview)
    $pdfLines = array_map(function ($row) {
        return [
            'mission_ref' => $row['mission_ref'] ?? '',
            'designation' => $row['designation'] ?? '',
            'tva_rate' => (float) ($row['tva_rate'] ?? 0),
            'unit_price_ht' => (float) ($row['unit_price_ht'] ?? 0),
            'quantity' => (float) ($row['quantity'] ?? 1),
            'total_ht' => (float) ($row['total_ht'] ?? 0),
            'discount' => (float) ($row['discount'] ?? 0),
        ];
    }, $lines);

    // 12. Générer le PDF avec le N° définitif (PAS de watermark, PAS d'aperçu)
    $context = [
        'company' => $company,
        'client' => $clientData,
        'bank' => $bankData,
        'invoice' => [
            'number' => $invoiceNumber,
            'dateIssued' => $dateIssued,
            'dateDue' => $dateDue,
            'paymentTerm' => $paymentTermLabel,
            'periodMonth' => $draft['month'] ?? '',
            'isPreview' => false,
        ],
        'lines' => $pdfLines,
    ];
    $pdfBytes = generateInvoicePdf($context);
    $pdfSize = strlen($pdfBytes);

    // 13. Écrire le PDF dans un fichier temporaire (avant commit)
    $storageDir = __DIR__ . '/../Factures_PDF';
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0775, true);
    }
    $filenameBase = sanitizeInvoiceFilename($invoiceNumber);
    $uniqueSuffix = bin2hex(random_bytes(4));
    $pdfFilename = $filenameBase . '_' . date('Ymd_His') . '_' . $uniqueSuffix . '.pdf';
    $finalPath = $storageDir . '/' . $pdfFilename;
    $tmpPath = $finalPath . '.tmp';

    if (file_put_contents($tmpPath, $pdfBytes) === false) {
        throw new RuntimeException("Impossible d'écrire le PDF dans $tmpPath");
    }
    $pdfRelativePath = str_replace(__DIR__ . '/../', '', $finalPath);

    // 14. Recalcul du total HT depuis les lignes
    $totalHt = 0.0;
    foreach ($pdfLines as $l) {
        $totalHt += (float) $l['total_ht'];
    }
    $totalHt = round($totalHt, 2);

    // 15. INSERT tble_client_billed
    $insertBilled = $pdo->prepare(
        "INSERT INTO tble_client_billed (
            entity, mission_ref, client_name, invoice_number,
            invoice_total_ht, amount_ht, billed_at,
            status_code, status_label, category,
            pdf_path, pdf_filename, pdf_size,
            created_by, created_by_name, notes
        ) VALUES (
            :entity, :mission_ref, :client_name, :invoice_number,
            :invoice_total_ht, :amount_ht, :billed_at,
            :status_code, :status_label, 'client',
            :pdf_path, :pdf_filename, :pdf_size,
            :created_by, :created_by_name, :notes
        )"
    );
    $billedAt = date('Y-m-d H:i:s');
    // Ligne récapitulative (mission_ref = premier mission_ref des lignes, ou NULL)
    $firstMissionRef = null;
    foreach ($pdfLines as $l) {
        if (!empty($l['mission_ref'])) {
            $firstMissionRef = $l['mission_ref'];
            break;
        }
    }
    $insertBilled->execute([
        ':entity' => $currentEntity,
        ':mission_ref' => $firstMissionRef,
        ':client_name' => $clientName !== '' ? $clientName : null,
        ':invoice_number' => $invoiceNumber,
        ':invoice_total_ht' => $totalHt,
        ':amount_ht' => $totalHt,
        ':billed_at' => $billedAt,
        ':status_code' => $statusCode,
        ':status_label' => $statusLabel,
        ':pdf_path' => $pdfRelativePath,
        ':pdf_filename' => $pdfFilename,
        ':pdf_size' => $pdfSize,
        ':created_by' => $userId,
        ':created_by_name' => $userName !== '' ? $userName : null,
        ':notes' => $notes !== '' ? $notes : null,
    ]);

    // 16. Écrire les lignes finales (invoice_number défini, draft_key nulled)
    $insertLine = $pdo->prepare(
        "INSERT INTO tble_client_invoice_lines (
            entity, invoice_number, mission_ref, designation,
            tva_rate, unit_price_ht, quantity, total_ht,
            discount, notes, sort_order,
            client_name, period_month, created_by, created_by_name
        ) VALUES (
            :entity, :invoice_number, :mission_ref, :designation,
            :tva_rate, :unit_price_ht, :quantity, :total_ht,
            :discount, :notes, :sort_order,
            :client_name, :period_month, :created_by, :created_by_name
        )"
    );
    foreach ($lines as $idx => $row) {
        $insertLine->execute([
            ':entity' => $currentEntity,
            ':invoice_number' => $invoiceNumber,
            ':mission_ref' => !empty($row['mission_ref']) ? $row['mission_ref'] : null,
            ':designation' => (string) ($row['designation'] ?? ''),
            ':tva_rate' => (float) ($row['tva_rate'] ?? 0),
            ':unit_price_ht' => (float) ($row['unit_price_ht'] ?? 0),
            ':quantity' => (float) ($row['quantity'] ?? 1),
            ':total_ht' => (float) ($row['total_ht'] ?? 0),
            ':discount' => (float) ($row['discount'] ?? 0),
            ':notes' => trim((string) ($row['notes'] ?? '')) !== '' ? (string) $row['notes'] : null,
            ':sort_order' => (int) ($row['sort_order'] ?? $idx),
            ':client_name' => $clientName !== '' ? $clientName : null,
            ':period_month' => $periodMonthKey,
            ':created_by' => $userId,
            ':created_by_name' => $userName !== '' ? $userName : null,
        ]);
    }

    // 17. Supprimer les lignes brouillon (draft_key)
    $pdo->prepare('DELETE FROM tble_client_invoice_lines WHERE draft_key = :dk AND entity = :entity')
        ->execute([':dk' => $draftKey, ':entity' => $currentEntity]);

    // 18. Supprimer le brouillon (invoice_draft)
    $pdo->prepare('DELETE FROM invoice_draft WHERE id = :id AND entity = :entity')
        ->execute([':id' => $draftId, ':entity' => $currentEntity]);

    // 19. COMMIT
    $pdo->commit();

    // 20. Renommer atomiquement le fichier .tmp en fichier final
    //     (dans le même dossier → rename atomique sur NTFS/ext4)
    if (!@rename($tmpPath, $finalPath)) {
        // Cas très rare : commit réussi mais rename échoué. On log et
        // on essaie une copie de secours.
        emitInvoiceLog('rename_failed_after_commit', [
            'invoice_number' => $invoiceNumber,
            'tmp' => $tmpPath,
            'final' => $finalPath,
        ]);
        if (@copy($tmpPath, $finalPath)) {
            @unlink($tmpPath);
        } else {
            // Dernier recours : mettre à jour pdf_path pour pointer vers le .tmp
            $newRelPath = str_replace(__DIR__ . '/../', '', $tmpPath);
            $pdo->prepare(
                "UPDATE tble_client_billed
                 SET pdf_path = :p, pdf_filename = :f, updated_at = CURRENT_TIMESTAMP
                 WHERE invoice_number = :inv AND entity = :entity"
            )->execute([
                ':p' => $newRelPath,
                ':f' => $pdfFilename . '.tmp',
                ':inv' => $invoiceNumber,
                ':entity' => $currentEntity,
            ]);
            $pdfRelativePath = $newRelPath;
            $pdfFilename = $pdfFilename . '.tmp';
        }
    }

    emitInvoiceLog('emit_success', [
        'draft_id' => $draftId,
        'invoice_number' => $invoiceNumber,
        'client_name' => $clientName,
        'total_ht' => $totalHt,
        'pdf_path' => $pdfRelativePath,
        'pdf_size' => $pdfSize,
        'user_id' => $userId,
    ]);

    emitInvoiceRespond(200, [
        'success' => true,
        'invoice_number' => $invoiceNumber,
        'pdf_path' => $pdfRelativePath,
        'pdf_filename' => $pdfFilename,
        'pdf_size' => $pdfSize,
        'total_ht' => $totalHt,
        'status_code' => $statusCode,
        'status_label' => $statusLabel,
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($tmpPath !== null && is_file($tmpPath)) {
        @unlink($tmpPath);
    }
    emitInvoiceLog('emit_failed', [
        'draft_id' => $draftId,
        'error' => $e->getMessage(),
        'trace_first_line' => strtok($e->getTraceAsString(), "\n"),
    ]);
    emitInvoiceRespond(500, [
        'success' => false,
        'error' => 'Émission facture : ' . $e->getMessage(),
    ]);
}
