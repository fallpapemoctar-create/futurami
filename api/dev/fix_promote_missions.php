<?php
// Script one-shot : promeut en "Validé" (status=1) toutes les missions
// en "Brouillon" (status=0) dont la facture client est au statut "validated".
// À supprimer après exécution.

// Sécurité minimale : token dans l'URL
$expectedToken = 'AMI_FIX_2026_PROMOTE';
if (($_GET['token'] ?? '') !== $expectedToken) {
    http_response_code(403);
    exit('Accès interdit.');
}

require_once __DIR__ . '/../config.php';

$sql = "
    UPDATE llx_missionsplanet_mission m
    INNER JOIN tble_client_billed cb ON cb.mission_ref = m.ref
    SET m.status = 1
    WHERE cb.status_code = 'validated'
      AND m.status = 0
";

$pdo->exec($sql);
$promoted = (int) $pdo->query('SELECT ROW_COUNT()')->fetchColumn();

echo "OK — missions promues en Validé : $promoted\n";
