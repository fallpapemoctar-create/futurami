<?php
/**
 * Smoke test CRUD Missions — end-to-end (front→back via HTTP local).
 *
 * Usage (CLI) :
 *   php api/dev/_crud_smoke_test.php
 *
 * Objectif : valider la boucle CREATE / READ / UPDATE / DELETE sur
 * `add|get|update|delete_mission_interpreter.php` en tapant directement l'API
 * HTTP locale (http://localhost/futurAMI/api/...), exactement comme le fait le
 * front React. Génère son propre token JWT signé avec le secret du .htaccess.
 *
 * ⚠️ Fichier temporaire de diagnostic — safe à supprimer une fois validé.
 */

declare(strict_types=1);

// --- 1. Charger le secret JWT depuis .htaccess ---------------------------------
$htaccess = file_get_contents(__DIR__ . '/../.htaccess');
if ($htaccess === false) {
    fwrite(STDERR, "Impossible de lire .htaccess\n");
    exit(1);
}
if (!preg_match('/SetEnv\s+AUTH_SECRET\s+"?([A-Fa-f0-9]{32,})"?/', $htaccess, $m)) {
    fwrite(STDERR, "AUTH_SECRET introuvable dans .htaccess\n");
    exit(1);
}
$AUTH_SECRET = $m[1];
$DOLIBARR_ENTITY = 2;
if (preg_match('/SetEnv\s+DOLIBARR_ENTITY\s+(\d+)/', $htaccess, $m2)) {
    $DOLIBARR_ENTITY = (int)$m2[1];
}

// --- 2. Trouver un super-admin (entity=0) pour signer un token ------------------
$pdo = new PDO(
    'mysql:host=localhost;dbname=dbs13098267;charset=utf8mb4',
    'root',
    '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);
$superAdmin = $pdo->query(
    "SELECT rowid, login, entity, admin FROM llx_user
     WHERE entity = 0 AND admin = 1 AND (statut IS NULL OR statut = 1)
     ORDER BY rowid ASC LIMIT 1"
)->fetch();
if (!$superAdmin) {
    fwrite(STDERR, "Aucun super-admin (entity=0, admin=1) trouvé\n");
    exit(1);
}

// --- 3. Émettre un JWT HS256 manuel (compatible auth_helpers.php) --------------
function b64url(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}
$now = time();
$header  = ['alg' => 'HS256', 'typ' => 'JWT'];
$payload = [
    'sub'    => (int)$superAdmin['rowid'],
    'login'  => $superAdmin['login'],
    'entity' => (int)$superAdmin['entity'],
    'admin'  => (int)$superAdmin['admin'],
    'iat'    => $now,
    'exp'    => $now + 3600,
];
$h = b64url(json_encode($header));
$p = b64url(json_encode($payload));
$sig = b64url(hash_hmac('sha256', "$h.$p", $AUTH_SECRET, true));
$TOKEN = "$h.$p.$sig";

// --- 4. Trouver un interprète et un client valides pour l'entité PTF -----------
$interp = $pdo->prepare(
    "SELECT rowid, firstname, lastname FROM llx_user
     WHERE entity = :e AND (statut IS NULL OR statut = 1)
       AND interp_langues IS NOT NULL AND interp_langues <> ''
     ORDER BY rowid ASC LIMIT 1"
);
$interp->execute([':e' => $DOLIBARR_ENTITY]);
$interpRow = $interp->fetch();
if (!$interpRow) {
    fwrite(STDERR, "Aucun interprète en entity=$DOLIBARR_ENTITY\n");
    exit(1);
}
$client = $pdo->prepare(
    "SELECT rowid, nom FROM llx_societe
     WHERE entity = :e AND (client = 1 OR client = 3)
     ORDER BY rowid ASC LIMIT 1"
);
$client->execute([':e' => $DOLIBARR_ENTITY]);
$clientRow = $client->fetch();
if (!$clientRow) {
    // fallback : tout tiers de l'entité
    $client = $pdo->prepare("SELECT rowid, nom FROM llx_societe WHERE entity = :e ORDER BY rowid ASC LIMIT 1");
    $client->execute([':e' => $DOLIBARR_ENTITY]);
    $clientRow = $client->fetch();
}
if (!$clientRow) {
    fwrite(STDERR, "Aucun client en entity=$DOLIBARR_ENTITY\n");
    exit(1);
}

$produit = $pdo->prepare("SELECT rowid, ref, label FROM llx_product WHERE entity = :e ORDER BY rowid ASC LIMIT 1");
$produit->execute([':e' => $DOLIBARR_ENTITY]);
$produitRow = $produit->fetch();

echo "── Contexte test ──────────────────────────────────────────────\n";
echo "Entity        : $DOLIBARR_ENTITY (PTF)\n";
echo "Super-admin   : id={$superAdmin['rowid']} login={$superAdmin['login']}\n";
echo "Interprète    : id={$interpRow['rowid']} {$interpRow['firstname']} {$interpRow['lastname']}\n";
echo "Client        : id={$clientRow['rowid']} {$clientRow['nom']}\n";
if ($produitRow) {
    echo "Produit/langue: id={$produitRow['rowid']} ref={$produitRow['ref']}\n";
}
echo "\n";

// --- 5. Helper HTTP ------------------------------------------------------------
function apiCall(string $method, string $endpoint, ?array $body, string $token): array
{
    $url = "http://localhost/futurAMI/api/$endpoint";
    $ch  = curl_init($url);
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
    ];
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw   = curl_exec($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err   = curl_error($ch);
    curl_close($ch);
    return [
        'http'   => $code,
        'body'   => $raw,
        'json'   => $raw !== false ? json_decode($raw, true) : null,
        'error'  => $err ?: null,
    ];
}

// --- 6. Résultat des tests -----------------------------------------------------
$results = [];
function report(string $name, bool $ok, string $detail = ''): void
{
    global $results;
    $mark = $ok ? '✅' : '❌';
    echo "$mark $name" . ($detail ? " — $detail" : '') . "\n";
    $results[] = ['name' => $name, 'ok' => $ok, 'detail' => $detail];
}

// ============================================================================
// TEST 1 : CREATE (add_mission_interpreter.php)
// ============================================================================
echo "\n=== TEST 1 — CREATE ===========================================\n";
$today = date('Y-m-d');
$createPayload = [
    'interpreter_id'      => (int)$interpRow['rowid'],
    'client_id'           => (int)$clientRow['rowid'],
    'contact_id'          => 0,
    'label'               => 'Mission smoke-test CRUD',
    'reference_devis'     => '', // laisser générer PROVxxxxx
    'datemission'         => $today,
    'heuredebutmission'   => '14:30',
    'dureemission'        => 90,
    'mission_status'      => 0,
    'mission_types'       => ['presentiel'],
    'id_produit_service'  => $produitRow ? (int)$produitRow['rowid'] : null,
    'commentaires'        => 'Test automatisé — à supprimer',
];
echo "POST add_mission_interpreter.php\n";
echo "Payload: " . json_encode($createPayload, JSON_UNESCAPED_UNICODE) . "\n";
$r = apiCall('POST', 'add_mission_interpreter.php', $createPayload, $TOKEN);
echo "HTTP {$r['http']} — Body: {$r['body']}\n";
$createdId  = $r['json']['id']  ?? null;
$createdRef = $r['json']['ref'] ?? null;
report('CREATE HTTP 200',        $r['http'] === 200,                'HTTP=' . $r['http']);
report('CREATE success = true',  ($r['json']['success'] ?? false) === true, 'success=' . var_export($r['json']['success'] ?? null, true));
report('CREATE id retourné',     is_int($createdId) && $createdId > 0, 'id=' . var_export($createdId, true));
report('CREATE ref PROVxxxxx',   is_string($createdRef) && preg_match('/^PROV\d+$/', $createdRef) === 1, 'ref=' . var_export($createdRef, true));

if (!$createdId) {
    fwrite(STDERR, "\n⛔ Impossible de continuer sans id créé.\n");
    exit(2);
}

// Vérif directe en base : entity = 2 + valeurs
$check = $pdo->prepare("SELECT rowid, ref, entity, nominterprete, fk_soc, datemission, heuredebutmission, dureemission, status, description
                        FROM llx_missionsplanet_mission WHERE rowid = :id");
$check->execute([':id' => $createdId]);
$row = $check->fetch();
report('CREATE ligne en DB',                     $row !== false,                                           'rowid=' . ($row['rowid'] ?? 'n/a'));
report('CREATE entity = ' . $DOLIBARR_ENTITY,   (int)($row['entity'] ?? 0) === $DOLIBARR_ENTITY,          'entity=' . ($row['entity'] ?? 'n/a'));
report('CREATE nominterprete OK',                (int)($row['nominterprete'] ?? 0) === (int)$interpRow['rowid']);
report('CREATE fk_soc OK',                       (int)($row['fk_soc'] ?? 0) === (int)$clientRow['rowid']);
report('CREATE datemission OK',                  ($row['datemission'] ?? '') === $today,                   'db=' . ($row['datemission'] ?? ''));
report('CREATE heuredebutmission OK',            substr((string)($row['heuredebutmission'] ?? ''), 0, 5) === '14:30');
report('CREATE dureemission OK',                 (int)($row['dureemission'] ?? 0) === 90);
report('CREATE status = 0 (brouillon)',          (int)($row['status'] ?? -1) === 0);

// ============================================================================
// TEST 2 : READ (get_missions_datatable.php)
// ============================================================================
echo "\n=== TEST 2 — READ =============================================\n";
$r = apiCall('GET', 'get_missions_datatable.php?exportAll=1', null, $TOKEN);
echo "HTTP {$r['http']} — bytes=" . strlen((string)$r['body']) . "\n";
report('READ HTTP 200', $r['http'] === 200, 'HTTP=' . $r['http']);
$missions = $r['json']['missions'] ?? [];
report('READ missions[] non vide', is_array($missions) && count($missions) > 0, 'count=' . (is_array($missions) ? count($missions) : 'n/a'));
$found = null;
foreach ($missions as $m) {
    if ((int)($m['rowid'] ?? 0) === (int)$createdId) {
        $found = $m;
        break;
    }
}
report('READ mission créée visible dans la datatable', $found !== null, 'ref=' . ($found['reference_devis'] ?? 'introuvable'));
if ($found) {
    report('READ ref = ' . $createdRef, ($found['reference_devis'] ?? '') === $createdRef);
    report('READ client_name renseigné', !empty($found['client_name']), 'client_name=' . ($found['client_name'] ?? ''));
    report('READ interpreter_name renseigné', !empty($found['firstname'] . $found['lastname']));
}

// ============================================================================
// TEST 3 : UPDATE (update_mission_interpreter.php)
// ============================================================================
echo "\n=== TEST 3 — UPDATE ===========================================\n";
$updatePayload = [
    'id'                => $createdId,
    'interpreter_id'    => (int)$interpRow['rowid'],
    'client_id'         => (int)$clientRow['rowid'],
    'label'             => 'Mission smoke-test CRUD (MISE À JOUR)',
    'datemission'       => $today,
    'heuredebutmission' => '16:45',
    'dureemission'      => 120,
    'mission_status'    => 1, // Validée
    'mission_types'     => ['presentiel'],
    'commentaires'      => 'Mise à jour test',
];
echo "POST update_mission_interpreter.php id=$createdId\n";
$r = apiCall('POST', 'update_mission_interpreter.php', $updatePayload, $TOKEN);
echo "HTTP {$r['http']} — Body: {$r['body']}\n";
report('UPDATE HTTP 200',       $r['http'] === 200,                                    'HTTP=' . $r['http']);
report('UPDATE success = true', ($r['json']['success'] ?? false) === true,             'success=' . var_export($r['json']['success'] ?? null, true));

// Vérif DB
$check->execute([':id' => $createdId]);
$row = $check->fetch();
report('UPDATE heuredebutmission → 16:45',  substr((string)($row['heuredebutmission'] ?? ''), 0, 5) === '16:45', 'db=' . ($row['heuredebutmission'] ?? ''));
report('UPDATE dureemission → 120',          (int)($row['dureemission'] ?? 0) === 120,                           'db=' . ($row['dureemission'] ?? ''));
report('UPDATE status → 1 (Validée)',        (int)($row['status'] ?? -1) === 1,                                  'db=' . ($row['status'] ?? ''));

// ============================================================================
// TEST 4 : DELETE (delete_mission_interpreter.php → soft-delete status=9)
// ============================================================================
echo "\n=== TEST 4 — DELETE (soft-delete) =============================\n";
$r = apiCall('POST', 'delete_mission_interpreter.php', ['id' => $createdId], $TOKEN);
echo "HTTP {$r['http']} — Body: {$r['body']}\n";
report('DELETE HTTP 200',        $r['http'] === 200,                              'HTTP=' . $r['http']);
report('DELETE success = true',  ($r['json']['success'] ?? false) === true,       'success=' . var_export($r['json']['success'] ?? null, true));

// Vérif DB : soft-delete → ligne conservée avec status=9, PAS supprimée physiquement
$check->execute([':id' => $createdId]);
$row = $check->fetch();
report('DELETE ligne conservée en DB (soft-delete)', $row !== false,             'exists=' . var_export($row !== false, true));
report('DELETE status → 9 (supprimée logique)',      (int)($row['status'] ?? -1) === 9, 'status=' . ($row['status'] ?? 'n/a'));

// ============================================================================
// TEST 5 : READ post-DELETE (la datatable doit exclure les soft-delete)
// ============================================================================
echo "\n=== TEST 5 — READ post-DELETE =================================\n";
$r = apiCall('GET', 'get_missions_datatable.php?exportAll=1', null, $TOKEN);
$missions = $r['json']['missions'] ?? [];
$stillThere = false;
foreach ($missions as $m) {
    if ((int)($m['rowid'] ?? 0) === (int)$createdId) {
        $stillThere = true;
        break;
    }
}
report('READ post-DELETE : mission masquée de la datatable', !$stillThere,
       $stillThere ? 'BUG : mission status=9 remonte encore dans la liste' : 'OK');

// Nettoyage physique du test (hard-delete de la ligne créée pour ne pas polluer)
$pdo->prepare("DELETE FROM llx_missionsplanet_mission WHERE rowid = :id")->execute([':id' => $createdId]);
echo "\n[cleanup] ligne test rowid=$createdId supprimée physiquement.\n";

// ============================================================================
// Résumé
// ============================================================================
$total = count($results);
$ok    = count(array_filter($results, fn($r) => $r['ok']));
$ko    = $total - $ok;
echo "\n═══════════════════════════════════════════════════════════════\n";
echo "RÉSUMÉ : $ok / $total réussis" . ($ko > 0 ? " — $ko ÉCHEC(s)" : ' — 🟢 tout OK') . "\n";
echo "═══════════════════════════════════════════════════════════════\n";

exit($ko > 0 ? 1 : 0);
