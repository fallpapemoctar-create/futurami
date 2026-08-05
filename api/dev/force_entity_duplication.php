<?php
// Script one-shot : force l'exécution immédiate de runEntityDataDuplication()
// vers l'entité 2 (PLANETE TRADUCTION FRANCE), sans attendre le throttle
// horaire de runEntityDataDuplicationOnce() (déjà "done" depuis une
// connexion précédente à l'ajout de la duplication des conditions de
// paiement). Idempotent : les lignes déjà dupliquées (clients, contacts,
// produits, users) sont ignorées via tble_entity_dup_map ; seules les
// conditions de paiement (nouvellement gérées) seront réellement créées.
// À supprimer après exécution.

$expectedToken = 'AMI_FIX_2026_ENTITY_DUP';
if (($_GET['token'] ?? '') !== $expectedToken) {
    http_response_code(403);
    exit('Accès interdit.');
}

// Script one-shot déclenché directement par URL (token ci-dessus) : pas de
// JWT disponible ici, donc on court-circuite le middleware require_auth()
// de config.php (sinon "missing_token" avant même d'atteindre ce code).
$__SKIP_AUTH = true;
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../entity_bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

$targetEntity = isset($_GET['entity']) ? (int) $_GET['entity'] : 2;

$result = runEntityDataDuplication($pdo, $targetEntity, null, '_ptf', true);
markEntityBootstrapRun($pdo, $targetEntity, 'force_entity_duplication[' . $targetEntity . ']: ' . json_encode($result['summary'], JSON_UNESCAPED_UNICODE));

echo json_encode([
    'success' => true,
    'target_entity' => $targetEntity,
    'summary' => $result['summary'],
    'log' => $result['log'],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
