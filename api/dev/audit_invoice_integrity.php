<?php
/**
 * audit_invoice_integrity.php — Audit post-hoc de l'intégrité facturation.
 *
 * Détecte les anomalies après un incident (crash serveur, coupure réseau,
 * plantage BDD au milieu d'un COMMIT) et complète le contrat atomique de
 * `emit_invoice.php` par une vérification défensive.
 *
 * Vérifie :
 *   1. Doublons de `invoice_number` par entité
 *   2. Cohérence `tble_invoice_sequence.last_number` ≥ MAX numéro émis
 *   3. Factures sans lignes de détail (orphelines)
 *   4. Lignes de facture sans facture (invoice_number cassé)
 *   5. Fichiers PDF référencés absents du disque
 *   6. Fichiers PDF orphelins sur disque (non référencés BDD)
 *   7. Fichiers .tmp résiduels (échecs de rename post-commit)
 *   8. Brouillons `invoice_draft` sans lignes associées
 *
 * Usage :
 *   CLI    : php audit_invoice_integrity.php [entity]
 *   Web    : /api/dev/audit_invoice_integrity.php?token=AMI_AUDIT_2026&entity=1
 *
 * Sortie : rapport texte + code de retour (0 = OK, 1 = anomalies détectées).
 *
 * @author  futurAMI
 * @since   2026-08 (Phase 3c)
 */

$isCli = (PHP_SAPI === 'cli');

// ─── Sécurité (mode web uniquement) ─────────────────────────────────────
if (!$isCli) {
    $expectedToken = 'AMI_AUDIT_2026';
    if (($_GET['token'] ?? '') !== $expectedToken) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=UTF-8');
        exit('Accès interdit. Ajouter ?token=... à l\'URL.');
    }
    header('Content-Type: text/plain; charset=UTF-8');
}

// L'audit ne nécessite pas d'auth utilisateur — c'est un outil admin/dev.
$__SKIP_AUTH = true;
require_once __DIR__ . '/../config.php';

// ─── Détermination de l'entité auditée ──────────────────────────────────
$entity = null;
if ($isCli) {
    $entity = isset($argv[1]) ? (int) $argv[1] : (int) getConfiguredEntity();
} else {
    $entity = isset($_GET['entity']) ? (int) $_GET['entity'] : (int) getConfiguredEntity();
}
if ($entity <= 0) {
    $entity = 1;
}

$anomalies = 0;

function section(string $title): void {
    echo "\n" . str_repeat('─', 72) . "\n";
    echo "  $title\n";
    echo str_repeat('─', 72) . "\n";
}

function report(string $status, string $msg): void {
    // $status = 'OK' | 'WARN' | 'FAIL'
    echo sprintf("  [%s] %s\n", $status, $msg);
}

echo "\n╔════════════════════════════════════════════════════════════════════════╗\n";
echo "║  AUDIT INTÉGRITÉ FACTURATION futurAMI — entity=$entity                            ║\n";
echo "║  Lancé le " . date('Y-m-d H:i:s') . "                                                 ║\n";
echo "╚════════════════════════════════════════════════════════════════════════╝\n";

// ─── 1. Doublons de numéro de facture ───────────────────────────────────
section("1. Doublons de invoice_number par entité");
$stmt = $pdo->prepare(
    "SELECT invoice_number, COUNT(*) AS n, GROUP_CONCAT(id ORDER BY id) AS ids
     FROM tble_client_billed
     WHERE entity = :e AND invoice_type = 0
     GROUP BY invoice_number
     HAVING COUNT(*) > 1"
);
$stmt->execute([':e' => $entity]);
$dups = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (!$dups) {
    report('OK', 'Aucun doublon de numéro de facture.');
} else {
    foreach ($dups as $row) {
        report('FAIL', "Doublon : {$row['invoice_number']} ({$row['n']} occurrences, ids=[{$row['ids']}])");
        $anomalies++;
    }
}

// ─── 2. Cohérence tble_invoice_sequence ─────────────────────────────────
section("2. Cohérence tble_invoice_sequence.last_number vs numéros émis");
$stmt = $pdo->prepare(
    "SELECT last_number FROM tble_invoice_sequence WHERE serie = 'FAC' AND entity = :e LIMIT 1"
);
$stmt->execute([':e' => $entity]);
$lastNumber = (int) ($stmt->fetchColumn() ?: 0);

$stmt = $pdo->prepare(
    "SELECT MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) AS max_num
     FROM tble_client_billed
     WHERE entity = :e AND invoice_type = 0
       AND invoice_number LIKE 'FAC-%'"
);
$stmt->execute([':e' => $entity]);
$maxEmitted = (int) ($stmt->fetchColumn() ?: 0);

if ($lastNumber >= $maxEmitted) {
    report('OK', "last_number=$lastNumber ≥ max_émis=$maxEmitted");
} else {
    report('FAIL', "last_number=$lastNumber < max_émis=$maxEmitted (séquence désynchronisée !)");
    $anomalies++;
}

// ─── 3. Factures sans lignes ────────────────────────────────────────────
section("3. Factures sans ligne de détail (orphelines)");
$stmt = $pdo->prepare(
    "SELECT cb.id, cb.invoice_number, cb.client_name, cb.billed_at
     FROM tble_client_billed cb
     WHERE cb.entity = :e AND cb.invoice_type = 0
       AND NOT EXISTS (
         SELECT 1 FROM tble_client_invoice_lines cil
         WHERE cil.invoice_number = cb.invoice_number AND cil.entity = cb.entity
       )
     ORDER BY cb.id DESC
     LIMIT 100"
);
$stmt->execute([':e' => $entity]);
$orphans = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (!$orphans) {
    report('OK', 'Toutes les factures ont au moins une ligne.');
} else {
    foreach ($orphans as $row) {
        report('FAIL', "Facture {$row['invoice_number']} (id={$row['id']}, {$row['client_name']}, {$row['billed_at']}) sans ligne");
        $anomalies++;
    }
}

// ─── 4. Lignes sans facture ─────────────────────────────────────────────
section("4. Lignes tble_client_invoice_lines sans facture (invoice_number cassé)");
$stmt = $pdo->prepare(
    "SELECT cil.id, cil.invoice_number, cil.designation
     FROM tble_client_invoice_lines cil
     WHERE cil.entity = :e AND cil.invoice_number IS NOT NULL AND cil.invoice_number <> ''
       AND cil.draft_key IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM tble_client_billed cb
         WHERE cb.invoice_number = cil.invoice_number AND cb.entity = cil.entity
       )
     ORDER BY cil.id DESC
     LIMIT 100"
);
$stmt->execute([':e' => $entity]);
$brokenLines = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (!$brokenLines) {
    report('OK', 'Toutes les lignes finales pointent vers une facture existante.');
} else {
    foreach ($brokenLines as $row) {
        report('FAIL', "Ligne id={$row['id']} pointe vers facture inexistante '{$row['invoice_number']}'");
        $anomalies++;
    }
}

// ─── 5. Fichiers PDF référencés mais absents du disque ──────────────────
section("5. Fichiers PDF référencés mais absents sur disque");
$stmt = $pdo->prepare(
    "SELECT id, invoice_number, pdf_path
     FROM tble_client_billed
     WHERE entity = :e AND invoice_type = 0
       AND pdf_path IS NOT NULL AND pdf_path <> ''"
);
$stmt->execute([':e' => $entity]);
$missing = 0;
$totalRef = 0;
$referencedFiles = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $totalRef++;
    $absPath = realpath(__DIR__ . '/../../' . $row['pdf_path']);
    // Note : pdf_path est relatif à la racine projet (ex: Factures_PDF/xxx.pdf).
    // On enregistre le nom de fichier pour cross-check en section 6.
    if ($row['pdf_path']) {
        $referencedFiles[basename($row['pdf_path'])] = true;
    }
    if (!$absPath || !is_file($absPath)) {
        report('FAIL', "Facture {$row['invoice_number']} (id={$row['id']}) → PDF absent : {$row['pdf_path']}");
        $missing++;
        $anomalies++;
    }
}
if ($missing === 0) {
    report('OK', "$totalRef PDF référencés — tous présents sur disque.");
}

// ─── 6. Fichiers PDF orphelins sur disque ───────────────────────────────
section("6. Fichiers PDF orphelins dans Factures_PDF/ (non référencés BDD)");
$storageDir = realpath(__DIR__ . '/../../Factures_PDF');
if ($storageDir && is_dir($storageDir)) {
    $orphanPdfs = [];
    $files = scandir($storageDir);
    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        if (!preg_match('/\.pdf$/i', $f)) continue;
        if (!isset($referencedFiles[$f])) {
            $orphanPdfs[] = $f;
        }
    }
    if (!$orphanPdfs) {
        report('OK', 'Aucun PDF orphelin.');
    } else {
        foreach (array_slice($orphanPdfs, 0, 20) as $f) {
            report('WARN', "PDF orphelin : $f");
        }
        if (count($orphanPdfs) > 20) {
            report('WARN', '... et ' . (count($orphanPdfs) - 20) . ' autres PDF orphelins.');
        }
        // Les orphelins ne sont pas des anomalies bloquantes (ils peuvent
        // provenir de tests, de rollbacks anciens, etc.) — d'où WARN pas FAIL.
    }
} else {
    report('WARN', "Dossier Factures_PDF/ introuvable — aucun PDF à cross-checker.");
}

// ─── 7. Fichiers .tmp résiduels ─────────────────────────────────────────
section("7. Fichiers .tmp résiduels dans Factures_PDF/");
if ($storageDir && is_dir($storageDir)) {
    $tmpFiles = [];
    foreach (scandir($storageDir) as $f) {
        if (preg_match('/\.pdf\.tmp$/i', $f)) {
            $tmpFiles[] = $f;
        }
    }
    if (!$tmpFiles) {
        report('OK', 'Aucun .tmp résiduel.');
    } else {
        foreach ($tmpFiles as $f) {
            $stat = @stat($storageDir . '/' . $f);
            $age = $stat ? (time() - $stat['mtime']) : 0;
            report('FAIL', "Fichier .tmp résiduel : $f (âge : " . round($age / 60) . " min)");
            $anomalies++;
        }
        report('WARN', "Ces fichiers indiquent un rename post-COMMIT échoué. À nettoyer manuellement après vérification.");
    }
}

// ─── 8. Brouillons invoice_draft sans lignes ────────────────────────────
section("8. Brouillons invoice_draft sans lignes associées");
$stmt = $pdo->prepare(
    "SELECT d.id, d.client_name, d.month, d.updated_at
     FROM invoice_draft d
     WHERE d.entity = :e
       AND NOT EXISTS (
         SELECT 1 FROM tble_client_invoice_lines cil
         WHERE cil.draft_key = CONCAT('draft-', d.id) AND cil.entity = d.entity
       )
     ORDER BY d.id DESC
     LIMIT 100"
);
try {
    $stmt->execute([':e' => $entity]);
    $emptyDrafts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$emptyDrafts) {
        report('OK', 'Tous les brouillons ont au moins une ligne.');
    } else {
        foreach ($emptyDrafts as $row) {
            report('WARN', "Brouillon id={$row['id']} ({$row['client_name']}, {$row['month']}, MàJ {$row['updated_at']}) sans ligne");
        }
        // WARN car un brouillon vide peut être en cours de saisie — pas
        // forcément une anomalie. À investiguer si le compteur augmente.
    }
} catch (PDOException $e) {
    report('WARN', "Table invoice_draft absente ou schéma différent : " . $e->getMessage());
}

// ─── Résumé ─────────────────────────────────────────────────────────────
echo "\n╔════════════════════════════════════════════════════════════════════════╗\n";
if ($anomalies === 0) {
    echo "║  ✓ INTÉGRITÉ OK — aucune anomalie détectée pour entity=$entity            ║\n";
    echo "╚════════════════════════════════════════════════════════════════════════╝\n\n";
    exit(0);
} else {
    echo "║  ✗ $anomalies ANOMALIE(S) DÉTECTÉE(S) pour entity=$entity                              ║\n";
    echo "╚════════════════════════════════════════════════════════════════════════╝\n\n";
    exit(1);
}
