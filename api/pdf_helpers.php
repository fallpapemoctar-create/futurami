<?php
/**
 * pdf_helpers.php — Génération de facture PDF via mPDF.
 *
 * Point d'entrée : `generateInvoicePdf(array $context): string`
 *   → renvoie les bytes binaires du PDF prêts à écrire dans un fichier ou
 *     à streamer en réponse HTTP `application/pdf`.
 *
 * Le contexte attendu :
 *   [
 *     'company'  => [name, addressLine1, addressLine2, postalCode, city, siret,
 *                    phone, email, website, logoPath (fs absolu, PNG/JPG optionnel)],
 *     'client'   => [name, address, zip, city, siret?, contact?],
 *     'bank'     => [label, iban, bic, holder?, domiciliation?],
 *     'invoice'  => [number, dateIssued (Y-m-d), dateDue (Y-m-d),
 *                    paymentTerm (label), periodMonth (Y-m), isPreview (bool),
 *                    watermark (string ou null)],
 *     'lines'    => [ [designation, quantity, unit_price_ht, tva_rate, total_ht, mission_ref?], ... ],
 *     'totals'   => [ht, tva, ttc]  ← recalculé si absent
 *   ]
 *
 * Sécurité :
 *   - mPDF est isolé (tmp_dir → api/vendor/mpdf/mpdf/tmp/).
 *   - Le PDF ne contient QUE ce qu'on lui passe explicitement — aucun accès
 *     direct à la BDD depuis ce fichier (séparation des responsabilités).
 *
 * @author  futurAMI
 * @since   2026-08 (Phase 2 - Facturation atomique server-side)
 */

require_once __DIR__ . '/vendor/autoload.php';

use Mpdf\Mpdf;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;

/**
 * Formate un montant en euros au format français : "1 234,56 €".
 */
function pdfFormatMoney(float $value, string $currency = '€'): string {
    return number_format($value, 2, ',', ' ') . ' ' . $currency;
}

/**
 * Formate une date ISO (Y-m-d) au format français (d/m/Y).
 * Retourne la chaîne originale si le parsing échoue.
 */
function pdfFormatDate(?string $isoDate): string {
    if (!$isoDate) return '';
    $ts = strtotime($isoDate);
    return $ts ? date('d/m/Y', $ts) : $isoDate;
}

/**
 * Encode une chaîne pour l'insertion sûre dans un template HTML.
 */
function pdfE(?string $s): string {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/**
 * Recalcule les totaux HT / TVA / TTC à partir des lignes fournies.
 * On regroupe la TVA par taux pour permettre l'affichage ventilé.
 *
 * @param array $lines Lignes de facture ([designation, quantity, unit_price_ht, tva_rate, total_ht])
 * @return array{
 *   ht: float,
 *   tva: float,
 *   ttc: float,
 *   tvaBreakdown: array<string, array{base: float, amount: float}>
 * }
 */
function pdfComputeTotals(array $lines): array {
    $ht = 0.0;
    $tva = 0.0;
    $breakdown = [];
    foreach ($lines as $line) {
        $lineHt = isset($line['total_ht']) ? (float) $line['total_ht'] : 0.0;
        if ($lineHt <= 0) {
            $qty = (float) ($line['quantity'] ?? 0);
            $price = (float) ($line['unit_price_ht'] ?? 0);
            $lineHt = $qty * $price;
        }
        $rate = (float) ($line['tva_rate'] ?? 0);
        $lineTva = $lineHt * ($rate / 100);

        $ht += $lineHt;
        $tva += $lineTva;

        $rateKey = number_format($rate, 2, '.', '');
        if (!isset($breakdown[$rateKey])) {
            $breakdown[$rateKey] = ['rate' => $rate, 'base' => 0.0, 'amount' => 0.0];
        }
        $breakdown[$rateKey]['base'] += $lineHt;
        $breakdown[$rateKey]['amount'] += $lineTva;
    }
    return [
        'ht' => round($ht, 2),
        'tva' => round($tva, 2),
        'ttc' => round($ht + $tva, 2),
        'tvaBreakdown' => $breakdown,
    ];
}

/**
 * Résout un chemin de logo depuis diverses formes (URL absolue, chemin relatif à api/, chemin absolu).
 * Retourne un chemin filesystem exploitable par mPDF, ou null.
 */
function pdfResolveLogoPath(?string $rawLogo): ?string {
    if (!$rawLogo) return null;
    $raw = trim($rawLogo);
    if ($raw === '') return null;

    // URL absolue → mPDF sait résoudre si allow_remote_images = true, mais on
    // préfère un chemin local (plus rapide, moins de surprises SSL).
    if (preg_match('~^https?://~i', $raw)) {
        // Extraire le nom de fichier et chercher dans api/uploads/
        $basename = basename(parse_url($raw, PHP_URL_PATH) ?: '');
        if ($basename !== '') {
            $local = __DIR__ . '/uploads/' . $basename;
            if (is_file($local)) return $local;
        }
        return null; // On ne télécharge pas côté serveur (perf).
    }
    // Chemin relatif : essayer api/, api/uploads/
    $candidates = [
        __DIR__ . '/' . ltrim($raw, '/'),
        __DIR__ . '/uploads/' . basename($raw),
        $raw, // Chemin absolu
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) return $candidate;
    }
    return null;
}

/**
 * Construit le HTML de la facture. Séparé de la logique mPDF pour testabilité.
 */
function pdfBuildInvoiceHtml(array $context): string {
    $company = $context['company'] ?? [];
    $client = $context['client'] ?? [];
    $bank = $context['bank'] ?? [];
    $invoice = $context['invoice'] ?? [];
    $lines = $context['lines'] ?? [];
    $totals = $context['totals'] ?? pdfComputeTotals($lines);

    $isPreview = !empty($invoice['isPreview']);
    $watermark = $isPreview ? ($invoice['watermark'] ?? 'APERÇU') : '';

    // ─── En-tête entreprise ────────────────────────────────────────────
    $companyName = pdfE($company['name'] ?? '');
    $companyAddress = pdfE(trim(($company['addressLine1'] ?? '') . ' ' . ($company['addressLine2'] ?? '')));
    $companyZipCity = pdfE(trim(($company['postalCode'] ?? '') . ' ' . ($company['city'] ?? '')));
    $companySiret = pdfE($company['siret'] ?? '');
    $companyPhone = pdfE($company['phone'] ?? '');
    $companyEmail = pdfE($company['email'] ?? '');
    $companyWeb = pdfE($company['website'] ?? '');

    $logoPath = pdfResolveLogoPath($company['logoPath'] ?? $company['logoUrl'] ?? null);
    $logoHtml = $logoPath
        ? '<img src="' . pdfE($logoPath) . '" style="max-height:60px;max-width:200px" />'
        : '<div style="font-size:20pt;font-weight:bold;color:#1e40af">' . $companyName . '</div>';

    // ─── Client ────────────────────────────────────────────────────────
    $clientName = pdfE($client['name'] ?? '');
    $clientAddress = pdfE($client['address'] ?? '');
    $clientZipCity = pdfE(trim(($client['zip'] ?? '') . ' ' . ($client['city'] ?? '')));
    $clientSiret = pdfE($client['siret'] ?? '');
    $clientContact = pdfE($client['contact'] ?? '');

    // ─── Meta facture ─────────────────────────────────────────────────
    $invoiceNumber = pdfE($invoice['number'] ?? '');
    $dateIssued = pdfFormatDate($invoice['dateIssued'] ?? date('Y-m-d'));
    $dateDue = pdfFormatDate($invoice['dateDue'] ?? null);
    $paymentTerm = pdfE($invoice['paymentTerm'] ?? '');
    $periodMonth = pdfE($invoice['periodMonth'] ?? '');

    // ─── Lignes ────────────────────────────────────────────────────────
    $linesHtml = '';
    foreach ($lines as $i => $line) {
        $qty = (float) ($line['quantity'] ?? 0);
        $price = (float) ($line['unit_price_ht'] ?? 0);
        $tva = (float) ($line['tva_rate'] ?? 0);
        $lineTotal = isset($line['total_ht']) && $line['total_ht'] > 0
            ? (float) $line['total_ht']
            : $qty * $price;
        $designation = pdfE($line['designation'] ?? '');
        $missionRef = !empty($line['mission_ref']) ? '<br><span style="color:#6b7280;font-size:8pt">Réf. : ' . pdfE($line['mission_ref']) . '</span>' : '';
        $rowBg = $i % 2 === 0 ? '#ffffff' : '#f9fafb';
        $linesHtml .= '<tr style="background-color:' . $rowBg . '">'
            . '<td class="cell">' . $designation . $missionRef . '</td>'
            . '<td class="cell num">' . number_format($qty, 2, ',', ' ') . '</td>'
            . '<td class="cell num">' . pdfFormatMoney($price) . '</td>'
            . '<td class="cell num">' . number_format($tva, 1, ',', '') . ' %</td>'
            . '<td class="cell num">' . pdfFormatMoney($lineTotal) . '</td>'
            . '</tr>';
    }
    if ($linesHtml === '') {
        $linesHtml = '<tr><td colspan="5" style="padding:20pt;text-align:center;color:#9ca3af">Aucune ligne de facture.</td></tr>';
    }

    // ─── Ventilation TVA ──────────────────────────────────────────────
    $tvaBreakdownHtml = '';
    foreach (($totals['tvaBreakdown'] ?? []) as $entry) {
        $tvaBreakdownHtml .= '<tr>'
            . '<td>TVA ' . number_format($entry['rate'], 1, ',', '') . ' %</td>'
            . '<td class="num">' . pdfFormatMoney($entry['base']) . '</td>'
            . '<td class="num">' . pdfFormatMoney($entry['amount']) . '</td>'
            . '</tr>';
    }
    if ($tvaBreakdownHtml === '') {
        // TVA non applicable (art. 293 B CGI - franchise en base)
        $tvaBreakdownHtml = '<tr><td colspan="3" style="font-style:italic;color:#6b7280">TVA non applicable, art. 293 B du CGI.</td></tr>';
    }

    // ─── RIB / IBAN ────────────────────────────────────────────────────
    $bankLabel = pdfE($bank['label'] ?? $bank['bankLabel'] ?? '');
    $bankIban = pdfE($bank['iban'] ?? $bank['bankIban'] ?? '');
    $bankBic = pdfE($bank['bic'] ?? $bank['bankBic'] ?? '');
    $bankHolder = pdfE($bank['holder'] ?? $bank['bankAccountHolder'] ?? '');
    $bankDomiciliation = pdfE($bank['domiciliation'] ?? $bank['bankDomiciliation'] ?? '');

    // ─── Mentions légales & pénalités ──────────────────────────────────
    $mentionsLegales = "En cas de retard de paiement, seront exigibles, conformément à l'article L 441-6 du Code de Commerce, "
        . "une indemnité calculée sur la base de trois fois le taux d'intérêt légal en vigueur, ainsi qu'une indemnité forfaitaire "
        . "pour frais de recouvrement de 40 €. Pas d'escompte pour paiement anticipé.";

    // ─── Watermark preview ────────────────────────────────────────────
    $watermarkStyle = $isPreview
        ? '<style>body { background: url(""); }</style>' // mPDF gère le watermark via API, pas CSS
        : '';

    // ─── HTML final ────────────────────────────────────────────────────
    $html =
<<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture $invoiceNumber</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #1f2937; margin: 0; }
    .header { width: 100%; }
    .header td { vertical-align: top; padding: 0; }
    .company-block { font-size: 9pt; line-height: 1.4; }
    .company-block .name { font-size: 12pt; font-weight: bold; color: #1e40af; }
    .invoice-title { font-size: 22pt; font-weight: bold; color: #1e40af; text-align: right; margin-bottom: 4pt; }
    .invoice-meta { text-align: right; font-size: 9pt; line-height: 1.6; }
    .invoice-meta .label { color: #6b7280; }
    .client-block { border: 1px solid #e5e7eb; padding: 10pt; margin-top: 30pt; margin-bottom: 20pt; background: #f9fafb; }
    .client-block .heading { font-size: 8pt; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5pt; margin-bottom: 4pt; }
    .client-block .name { font-size: 12pt; font-weight: bold; color: #111827; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 10pt; }
    table.lines th { background: #1e40af; color: white; padding: 8pt 6pt; font-size: 9pt; text-align: left; }
    table.lines th.num, table.lines td.num { text-align: right; }
    table.lines td.cell { padding: 6pt; border-bottom: 1px solid #e5e7eb; font-size: 9pt; vertical-align: top; }
    .totals-table { margin-top: 12pt; margin-left: auto; }
    .totals-table td { padding: 4pt 12pt; font-size: 10pt; }
    .totals-table td.num { text-align: right; font-family: 'DejaVu Sans', sans-serif; }
    .totals-table tr.grand-total td { border-top: 2px solid #1e40af; font-weight: bold; font-size: 12pt; color: #1e40af; padding-top: 8pt; }
    .tva-detail { margin-top: 8pt; font-size: 8pt; }
    .tva-detail th, .tva-detail td { border: 1px solid #e5e7eb; padding: 4pt 8pt; }
    .tva-detail .num { text-align: right; }
    .payment-block { margin-top: 24pt; padding: 10pt; background: #eff6ff; border-left: 4px solid #1e40af; font-size: 9pt; }
    .payment-block .heading { font-weight: bold; color: #1e40af; margin-bottom: 4pt; }
    .footer { position: fixed; bottom: 15mm; left: 15mm; right: 15mm; font-size: 7.5pt; color: #6b7280; text-align: center; line-height: 1.4; border-top: 1px solid #e5e7eb; padding-top: 6pt; }
</style>
$watermarkStyle
</head>
<body>

<!-- En-tête : logo + coordonnées vs. titre facture -->
<table class="header" cellpadding="0" cellspacing="0">
    <tr>
        <td width="55%" class="company-block">
            $logoHtml
            <div style="margin-top:6pt">
                <div class="name">$companyName</div>
                <div>$companyAddress</div>
                <div>$companyZipCity</div>
                <div style="margin-top:4pt">
                    SIRET : $companySiret
                </div>
                <div>
                    Tél : $companyPhone
                    &nbsp;·&nbsp;
                    <a href="mailto:$companyEmail" style="color:#1e40af;text-decoration:none">$companyEmail</a>
                </div>
                <div><a href="$companyWeb" style="color:#1e40af;text-decoration:none">$companyWeb</a></div>
            </div>
        </td>
        <td width="45%">
            <div class="invoice-title">FACTURE</div>
            <div class="invoice-meta">
                <div><span class="label">N° :</span> <strong>$invoiceNumber</strong></div>
                <div><span class="label">Date :</span> $dateIssued</div>
                <div><span class="label">Échéance :</span> $dateDue</div>
                <div><span class="label">Période :</span> $periodMonth</div>
            </div>
        </td>
    </tr>
</table>

<!-- Bloc client -->
<div class="client-block">
    <div class="heading">Facturé à</div>
    <div class="name">$clientName</div>
    <div>$clientAddress</div>
    <div>$clientZipCity</div>
HTML;

    if ($clientSiret !== '') {
        $html .= '<div style="margin-top:4pt;font-size:8pt;color:#6b7280">SIRET : ' . $clientSiret . '</div>';
    }
    if ($clientContact !== '') {
        $html .= '<div style="margin-top:4pt;font-size:8pt;color:#6b7280">À l\'attention de : ' . $clientContact . '</div>';
    }

    $html .=
<<<HTML
</div>

<!-- Lignes de facture -->
<table class="lines">
    <thead>
        <tr>
            <th>Désignation</th>
            <th class="num" style="width:60pt">Quantité</th>
            <th class="num" style="width:70pt">PU HT</th>
            <th class="num" style="width:50pt">TVA</th>
            <th class="num" style="width:80pt">Total HT</th>
        </tr>
    </thead>
    <tbody>
        $linesHtml
    </tbody>
</table>

<!-- Totaux -->
<table class="totals-table" cellpadding="0" cellspacing="0">
    <tr>
        <td>Total HT</td>
        <td class="num">{$totals['ht']}</td>
    </tr>
    <tr>
        <td>TVA</td>
        <td class="num">{$totals['tva']}</td>
    </tr>
    <tr class="grand-total">
        <td>Total TTC</td>
        <td class="num">{$totals['ttc']}</td>
    </tr>
</table>

<!-- Ventilation TVA -->
<table class="tva-detail">
    <thead>
        <tr style="background:#f3f4f6">
            <th>Taux</th><th class="num">Base HT</th><th class="num">Montant TVA</th>
        </tr>
    </thead>
    <tbody>
        $tvaBreakdownHtml
    </tbody>
</table>

<!-- Modalités de paiement -->
<div class="payment-block">
    <div class="heading">Conditions de paiement</div>
    <div>Modalité : $paymentTerm</div>
    <div style="margin-top:8pt">
        <strong>Coordonnées bancaires — $bankLabel</strong><br>
        Titulaire : $bankHolder<br>
        IBAN : <span style="font-family:monospace">$bankIban</span><br>
        BIC : $bankBic<br>
        Domiciliation : $bankDomiciliation
    </div>
</div>

<!-- Mentions légales pied de page -->
<div class="footer">
    $mentionsLegales
</div>

</body>
</html>
HTML;

    // Réinjecter les totaux formatés (le heredoc a mangé l'appel de fonction pour ht/tva/ttc)
    $html = str_replace(
        [
            '<td class="num">' . $totals['ht'] . '</td>',
            '<td class="num">' . $totals['tva'] . '</td>',
            '<td class="num">' . $totals['ttc'] . '</td>',
        ],
        [
            '<td class="num">' . pdfFormatMoney($totals['ht']) . '</td>',
            '<td class="num">' . pdfFormatMoney($totals['tva']) . '</td>',
            '<td class="num">' . pdfFormatMoney($totals['ttc']) . '</td>',
        ],
        $html
    );

    return $html;
}

/**
 * Génère un PDF de facture à partir du contexte fourni.
 * Retourne les bytes binaires (à écrire dans un fichier ou streamer en HTTP).
 *
 * @param array $context Structure décrite en tête de fichier.
 * @return string Bytes du PDF.
 * @throws Exception si mPDF échoue (l'appelant doit gérer les erreurs).
 */
function generateInvoicePdf(array $context): string {
    // Config mPDF : utiliser DejaVu (fournie avec mPDF) pour l'Unicode (€, accents).
    $defaultConfig = (new ConfigVariables())->getDefaults();
    $fontDirs = $defaultConfig['fontDir'];
    $defaultFontConfig = (new FontVariables())->getDefaults();
    $fontData = $defaultFontConfig['fontdata'];

    $mpdf = new Mpdf([
        'mode' => 'utf-8',
        'format' => 'A4',
        'default_font' => 'dejavusans',
        'default_font_size' => 10,
        'margin_left' => 15,
        'margin_right' => 15,
        'margin_top' => 15,
        'margin_bottom' => 25, // Laisser place au footer
        'margin_header' => 5,
        'margin_footer' => 8,
        'tempDir' => __DIR__ . '/vendor/mpdf/mpdf/tmp',
        'fontDir' => $fontDirs,
        'fontdata' => $fontData,
    ]);

    $invoice = $context['invoice'] ?? [];
    $mpdf->SetTitle('Facture ' . ($invoice['number'] ?? ''));
    $mpdf->SetAuthor($context['company']['name'] ?? 'futurAMI');
    $mpdf->SetCreator('futurAMI - PLANETE TRADUCTION FRANCE');

    // Watermark "APERÇU" pour les prévisualisations non consommant de séquence.
    if (!empty($invoice['isPreview'])) {
        $watermark = $invoice['watermark'] ?? 'APERÇU - NON DÉFINITIF';
        $mpdf->SetWatermarkText($watermark, 0.15);
        $mpdf->showWatermarkText = true;
        $mpdf->watermarkTextAlpha = 0.12;
        $mpdf->watermark_font = 'DejaVuSans';
    }

    $html = pdfBuildInvoiceHtml($context);
    $mpdf->WriteHTML($html);

    // Retourne les bytes binaires (mode 'S').
    return $mpdf->Output('', 'S');
}
