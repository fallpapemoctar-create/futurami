<?php
/**
 * preview_invoice_pdf.php — Prévisualisation d'un brouillon de facture au format PDF.
 *
 * Utilisé par le bouton "Aperçu PDF" côté frontend AVANT finalisation.
 * NE CONSOMME PAS de numéro de séquence (peek=1) : le PDF affiché porte le
 * numéro qui SERAIT attribué à la prochaine émission + un watermark "APERÇU".
 *
 * Entrée  : GET ?draft_id=NN
 * Sortie  : application/pdf (inline)
 * Erreur  : 4xx/5xx JSON { success:false, error }
 *
 * @author  futurAMI
 * @since   2026-08 (Phase 2c)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/billing_helpers.php';
require_once __DIR__ . '/invoice_line_helpers.php';
require_once __DIR__ . '/pdf_helpers.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respondJsonError(int $status, string $message): void {
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $draftId = isset($_GET['draft_id']) ? (int) $_GET['draft_id'] : 0;
    if ($draftId <= 0) {
        respondJsonError(400, 'Paramètre draft_id requis.');
    }

    // ─── 1. Charger le brouillon (invoice_draft) ────────────────────────
    $stmt = $pdo->prepare(
        "SELECT id, client_id, client_name, month, payment_condition_id, bank_account_id, total_ht, status
         FROM invoice_draft
         WHERE id = :id AND entity = :entity"
    );
    $stmt->execute([':id' => $draftId, ':entity' => $currentEntity]);
    $draft = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$draft) {
        respondJsonError(404, "Brouillon #{$draftId} introuvable pour cette entité.");
    }
    if ($draft['status'] === 'finalized') {
        respondJsonError(409, "Ce brouillon est déjà finalisé — utilisez la facture émise à la place.");
    }

    // ─── 2. Charger le client (llx_societe) ─────────────────────────────
    $clientData = ['name' => $draft['client_name'] ?? '', 'address' => '', 'zip' => '', 'city' => '', 'siret' => ''];
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
                'name' => $row['nom'] ?? ($draft['client_name'] ?? ''),
                'address' => $row['address'] ?? '',
                'zip' => $row['zip'] ?? '',
                'city' => $row['town'] ?? '',
                'siret' => $row['siret'] ?? '',
            ];
        }
    }

    // ─── 3. Charger les lignes (tble_client_invoice_lines) ──────────────
    // Deux stratégies : par draft_key (calculé à partir de client + mois), ou
    // par invoice_draft_lines si l'entrée existe. On privilégie draft_key.
    $periodMonthKey = $draft['month'] ? $draft['month'] . '-01' : null;
    $draftKey = $draft['client_name'] && $periodMonthKey
        ? invoiceDraftKey($draft['client_name'], $periodMonthKey)
        : null;

    $lines = [];
    if ($draftKey) {
        $linesStmt = $pdo->prepare(
            "SELECT mission_ref, designation, tva_rate, unit_price_ht, quantity, total_ht, discount, sort_order
             FROM tble_client_invoice_lines
             WHERE draft_key = :draft_key AND entity = :entity
             ORDER BY sort_order ASC, id ASC"
        );
        $linesStmt->execute([':draft_key' => $draftKey, ':entity' => $currentEntity]);
        $lines = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    // Fallback : lire depuis invoice_draft_lines si aucune ligne trouvée (draft récent v1.3).
    if (empty($lines)) {
        $fallbackCheck = $pdo->query("SHOW TABLES LIKE 'invoice_draft_lines'");
        if ($fallbackCheck && $fallbackCheck->rowCount() > 0) {
            $fbStmt = $pdo->prepare(
                "SELECT mission_id, description AS designation, quantity, unit_price, total, sort_order
                 FROM invoice_draft_lines
                 WHERE draft_id = :draft_id AND entity = :entity
                 ORDER BY sort_order ASC, id ASC"
            );
            $fbStmt->execute([':draft_id' => $draftId, ':entity' => $currentEntity]);
            $rows = $fbStmt->fetchAll(PDO::FETCH_ASSOC);
            $lines = array_map(function ($r) {
                return [
                    'mission_ref' => '',
                    'designation' => $r['designation'] ?? '',
                    'tva_rate' => 0,
                    'unit_price_ht' => (float) ($r['unit_price'] ?? 0),
                    'quantity' => (float) ($r['quantity'] ?? 1),
                    'total_ht' => (float) ($r['total'] ?? 0),
                    'discount' => 0,
                ];
            }, $rows);
        }
    }

    if (empty($lines)) {
        respondJsonError(422, "Ce brouillon ne contient aucune ligne — impossible de générer un PDF.");
    }

    // ─── 4. Compte bancaire ─────────────────────────────────────────────
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
            // Composer l'IBAN si iban_prefix vide
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
    $nbJour = 30; // défaut
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

    // ─── 6. Info entreprise (llx_const MAIN_INFO_SOCIETE_*) ─────────────
    $company = [
        'name' => '',
        'addressLine1' => '',
        'addressLine2' => '',
        'postalCode' => '',
        'city' => '',
        'siret' => '',
        'phone' => '',
        'email' => '',
        'website' => '',
        'logoUrl' => '',
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

    // ─── 7. Numéro APERÇU (peek, ne consomme pas) ───────────────────────
    $year = (int) date('Y');
    $month = (int) date('n');
    if ($draft['month'] && preg_match('/^(\d{4})-(\d{2})$/', $draft['month'], $matches)) {
        $year = (int) $matches[1];
        $month = (int) $matches[2];
    }
    $peekedSeq = peekNextInvoiceSequence($pdo, 'FAC', $currentEntity);
    $previewNumber = formatInvoiceNumber('FAC', $year, $month, $peekedSeq);

    // ─── 8. Dates ────────────────────────────────────────────────────────
    $dateIssued = date('Y-m-d');
    $dueTimestamp = strtotime($dateIssued . " +{$nbJour} days");
    if ($decalage > 0) {
        // Décalage = "fin de mois" (30) ou similaire → ajouter jusqu'à la fin du mois
        $dueTimestamp = strtotime(date('Y-m-t', $dueTimestamp));
    }
    $dateDue = date('Y-m-d', $dueTimestamp);

    // ─── 9. Construire le contexte + générer le PDF ─────────────────────
    $context = [
        'company' => $company,
        'client' => $clientData,
        'bank' => $bankData,
        'invoice' => [
            'number' => $previewNumber,
            'dateIssued' => $dateIssued,
            'dateDue' => $dateDue,
            'paymentTerm' => $paymentTermLabel,
            'periodMonth' => $draft['month'] ?? '',
            'isPreview' => true,
            'watermark' => 'APERÇU - NON DÉFINITIF',
        ],
        'lines' => $lines,
    ];

    $pdfBytes = generateInvoicePdf($context);

    // Streaming PDF inline
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="apercu_' . $previewNumber . '.pdf"');
    header('Content-Length: ' . strlen($pdfBytes));
    header('Cache-Control: no-store, must-revalidate');
    echo $pdfBytes;
    exit;

} catch (Throwable $e) {
    respondJsonError(500, 'Erreur PDF : ' . $e->getMessage());
}
