<?php
/**
 * generate_deployment_pdf.php
 *
 * Génère le document PDF « Procédure de déploiement futurAMI » à partir
 * du contenu embarqué dans ce fichier. Réutilise mPDF (déjà présent dans
 * api/vendor/ pour la génération des factures).
 *
 * Usage : php docs/generate_deployment_pdf.php
 * Sortie : docs/Procedure_Deploiement_futurAMI.pdf
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/vendor/autoload.php';

use Mpdf\Mpdf;

$outputPath = __DIR__ . '/Procedure_Deploiement_futurAMI.pdf';

// Contenu HTML — mise en page inspirée des factures futurAMI (couleurs bleu/gris)
$html = <<<'HTML'
<style>
  @page { margin: 20mm 15mm 20mm 15mm; }
  body { font-family: DejaVuSans, sans-serif; color: #1F2937; font-size: 10pt; line-height: 1.5; }
  h1 { color: #1D4ED8; font-size: 22pt; margin: 0 0 4mm 0; }
  h2 { color: #1D4ED8; font-size: 14pt; margin-top: 8mm; margin-bottom: 3mm; border-bottom: 2px solid #DBEAFE; padding-bottom: 2mm; }
  h3 { color: #1E40AF; font-size: 12pt; margin-top: 6mm; margin-bottom: 2mm; }
  p { margin: 0 0 3mm 0; text-align: justify; }
  ul, ol { margin: 0 0 3mm 4mm; padding: 0; }
  li { margin-bottom: 1mm; }
  code { background: #F3F4F6; padding: 1px 4px; border-radius: 3px; font-family: DejaVuSansMono, monospace; font-size: 9pt; color: #B91C1C; }
  pre { background: #1F2937; color: #F9FAFB; padding: 3mm; border-radius: 4px; font-family: DejaVuSansMono, monospace; font-size: 8.5pt; line-height: 1.4; white-space: pre-wrap; }
  .cover { text-align: center; margin-top: 60mm; }
  .cover .title { font-size: 28pt; color: #1D4ED8; font-weight: bold; }
  .cover .subtitle { font-size: 14pt; color: #6B7280; margin-top: 5mm; }
  .cover .meta { margin-top: 25mm; color: #6B7280; font-size: 10pt; }
  .callout { border-left: 4px solid #F59E0B; background: #FFFBEB; padding: 3mm 4mm; margin: 3mm 0; border-radius: 0 4px 4px 0; }
  .callout.info { border-left-color: #3B82F6; background: #EFF6FF; }
  .callout.danger { border-left-color: #DC2626; background: #FEF2F2; }
  .callout .label { font-weight: bold; margin-bottom: 1mm; display: block; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9.5pt; }
  th { background: #DBEAFE; color: #1E40AF; text-align: left; padding: 2mm; border: 1px solid #BFDBFE; }
  td { padding: 2mm; border: 1px solid #E5E7EB; vertical-align: top; }
  .footer { color: #6B7280; font-size: 8pt; text-align: center; }
</style>

<div class="cover">
  <div class="title">Procédure de déploiement</div>
  <div class="subtitle">futurAMI — Assistance Missions Interprètes</div>
  <div class="subtitle" style="font-size: 11pt;">Planet Traduction France — Entité Dolibarr 2</div>
  <div class="meta">
    Version 1.0 &middot; Août 2026<br/>
    Front React 18 + Vite &middot; API PHP 8 &middot; MySQL 8 (schéma Dolibarr étendu)
  </div>
</div>

<pagebreak />

<h2>1. Vue d'ensemble</h2>
<p>
  futurAMI est une application web multi-entités qui pilote les missions d'interprétariat,
  les devis et les factures pour <b>Planet Traduction France</b>. L'application s'appuie sur
  une base MySQL Dolibarr partagée : chaque déploiement est cloisonné par la valeur
  <code>entity</code> (2 pour Planet Traduction France, 1 pour AMI-PTF).
</p>
<table>
  <tr><th style="width: 30%;">Composant</th><th>Technologie</th></tr>
  <tr><td>Front-end SPA</td><td>React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui, motion/react</td></tr>
  <tr><td>Back-end API</td><td>PHP 8.0+, PDO MySQL, JWT HS256 (auth_helpers.php)</td></tr>
  <tr><td>Base de données</td><td>MySQL 8 (dbs13098267) — préfixe <code>llx_</code> Dolibarr + tables custom <code>tble_</code></td></tr>
  <tr><td>Génération PDF</td><td>mPDF 8.2 (via Composer)</td></tr>
  <tr><td>Serveur web</td><td>Apache 2.4+ avec mod_rewrite et mod_env</td></tr>
</table>

<h2>2. Prérequis serveur</h2>
<ul>
  <li>PHP <b>&ge; 8.0</b> avec extensions <code>pdo_mysql</code>, <code>mbstring</code>, <code>gd</code>, <code>zip</code>, <code>openssl</code>.</li>
  <li>Serveur MySQL <b>&ge; 8.0</b> accessible ; schéma Dolibarr déjà présent (base <code>dbs13098267</code>).</li>
  <li>Apache <b>&ge; 2.4</b> avec <code>mod_rewrite</code> et <code>mod_env</code> chargés.</li>
  <li><code>AllowOverride All</code> (ou au minimum <code>FileInfo Options=None Env</code>) sur le vhost qui sert <code>/api</code>.</li>
  <li>Composer installé pour récupérer <b>mPDF</b> (utilisé pour les factures PDF).</li>
  <li>Node.js <b>&ge; 18</b> et npm sur la machine de build (jamais installés en production).</li>
</ul>

<h2>3. Build du front-end</h2>
<p>
  Le front React est compilé <b>avant</b> déploiement sur la machine de build.
  Le résultat statique (<code>dist/</code>) est ensuite copié tel quel sur le serveur.
</p>
<pre>
# Depuis la racine du dépôt futurAMI
npm install                      # installe les dépendances (une fois par machine)
npm run build                    # produit dist/ (Vite build)

# Vérification rapide : dist/index.html doit exister
ls dist/
</pre>
<div class="callout info">
  <span class="label">Info</span>
  Le proxy Vite <code>/api → http://localhost/futurAMI/api</code> ne concerne que le dev.
  En production, le front et l'API doivent être servis <b>par le même domaine</b>
  (ou l'API doit renvoyer les bons en-têtes CORS pour un domaine distinct).
</div>

<h2>4. Déploiement de l'API PHP</h2>
<ol>
  <li>Copier le dossier <code>api/</code> à la racine web (ex : <code>/var/www/futurami/api/</code>).</li>
  <li>Depuis <code>api/</code>, exécuter <code>composer install --no-dev --optimize-autoloader</code>
      pour installer mPDF dans <code>api/vendor/</code>.</li>
  <li>Copier le contenu de <code>dist/</code> à la racine publique (ex : <code>/var/www/futurami/</code>).</li>
  <li>S'assurer que le serveur web pointe vers cette racine publique (DocumentRoot).</li>
</ol>

<h2>5. Configuration <code>.htaccess</code> de production</h2>
<p>
  Le fichier <code>api/.htaccess</code> <b>n'est pas versionné</b> (il contient le secret
  JWT). Il doit être créé <b>manuellement</b> sur le serveur avec ce contenu&nbsp;:
</p>
<pre>
&lt;IfModule mod_env.c&gt;
    # Entité Dolibarr forcée pour ce déploiement
    SetEnv DOLIBARR_ENTITY 2

    # Secret JWT HS256 — GÉNÉRER UN NOUVEAU ≥ 32 caractères hex pour la prod
    SetEnv AUTH_SECRET "REMPLACER_PAR_UN_SECRET_UNIQUE_HEX_64_CHARS"

    # Durée de vie des tokens en secondes (12 h par défaut)
    SetEnv AUTH_TOKEN_TTL 43200

    # Mot de passe MySQL production
    SetEnv DB_PASS_PROD "REMPLACER_PAR_MOT_DE_PASSE_MYSQL_PROD"
&lt;/IfModule&gt;
</pre>
<div class="callout danger">
  <span class="label">Attention sécurité</span>
  Ne <b>JAMAIS</b> réutiliser le <code>AUTH_SECRET</code> d'un autre déploiement
  (notamment AMI-PTF). Utiliser par exemple <code>openssl rand -hex 32</code>
  pour générer un secret dédié à ce déploiement.
</div>
<div class="callout">
  <span class="label">Rappel</span>
  Sans <code>AUTH_SECRET</code> valide (≥ 32 caractères), <code>login.php</code>
  répond immédiatement <code>500 auth_secret_missing</code>.
</div>

<h2>6. Base de données</h2>
<p>
  La connexion MySQL est ouverte dans <code>api/config.php</code>. Trois éléments
  sont à vérifier avant la première connexion&nbsp;:
</p>
<ol>
  <li><b>Nom d'hôte, base, user</b> : édités en dur dans <code>config.php</code>
      (adapter à l'hébergement).</li>
  <li><b>Mot de passe</b> : lu depuis la variable d'environnement <code>DB_PASS_PROD</code>
      (déclarée dans <code>.htaccess</code>), avec fallback en dur — recommandation forte
      de configurer la variable d'environnement pour ne pas dépendre du fallback.</li>
  <li><b>Entité</b> : <code>SetEnv DOLIBARR_ENTITY 2</code> dans <code>.htaccess</code>.
      Sans cette variable, les super-admins (entity=0) tombent sur le fallback
      <code>getConfiguredEntity()</code> = 2, ce qui est le bon comportement pour PTF.</li>
</ol>

<h3>Scripts de migration — ordre de lancement</h3>
<p>
  Il n'existe qu'<b>un seul script SQL manuel à jouer</b> en production. Tous
  les autres <code>ALTER</code>/<code>CREATE TABLE</code> sont exécutés
  automatiquement par le code PHP à la volée. Ordre strict à respecter&nbsp;:
</p>
<table>
  <tr>
    <th style="width: 6%;">#</th>
    <th style="width: 34%;">Étape</th>
    <th style="width: 30%;">Cible</th>
    <th>Type d'action</th>
  </tr>
  <tr>
    <td>1</td>
    <td><b>Backup complet de la base</b></td>
    <td>MySQL prod</td>
    <td><code>mysqldump</code> avant toute modification.</td>
  </tr>
  <tr>
    <td>2</td>
    <td><b>Migration SQL manuelle</b> (unique)</td>
    <td><code>api/requete_sql_entity1_backfill.sql</code></td>
    <td>À jouer via phpMyAdmin ou client MySQL. Ajoute la colonne
      <code>entity = 1</code> sur les 8 tables métier historiques
      (<code>llx_missionsplanet_mission</code>, <code>invoice_draft</code>,
      <code>invoice_draft_lines</code>, <code>tble_client_billed</code>,
      <code>tble_client_invoice_lines</code>, <code>tble_credit_note_applications</code>,
      <code>tble_mission_billed</code>, <code>tble_invoice_sequence</code>).
      Idempotent : les erreurs "Duplicate column name" peuvent être ignorées.</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Vérification post-migration</td>
    <td>MySQL prod</td>
    <td>Lancer le bloc <code>SELECT ... GROUP BY entity</code> commenté en fin
      de <code>requete_sql_entity1_backfill.sql</code>. Attendu&nbsp;: <code>entity = 1</code>
      partout, aucune ligne à <code>NULL</code>.</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Déploiement du code</td>
    <td>Front build + <code>api/</code> PHP</td>
    <td><code>npm run build</code> puis copie API +
      <code>composer install --no-dev</code>.</td>
  </tr>
  <tr>
    <td>5</td>
    <td>Migrations PHP automatiques</td>
    <td>Fonctions <code>ensureXxxTable()</code></td>
    <td>Aucune action manuelle. Se déclenchent au premier appel HTTP de chaque
      endpoint concerné (<code>ensureInvoiceSequenceTable</code>,
      <code>ensureInvoiceDraftTable</code>, <code>ensureMissionEntityColumn</code>,
      <code>ensureInvoiceDraftLinesEntityColumn</code>,
      <code>ensureClientBillingTable</code>,
      <code>ensureCreditNoteApplicationsTable</code>,
      <code>ensureClientInvoiceLinesTable</code>,
      <code>ensureDupMapTable</code>, <code>ensureEntityBootstrapTable</code>).
      Complètent défensivement le script SQL et ajoutent les colonnes récentes
      (avoirs : <code>invoice_type</code>, <code>source_invoice_number</code>,
      <code>applied_amount</code>, <code>credit_consumed</code>,
      <code>credit_note_reason</code>).</td>
  </tr>
  <tr>
    <td>6</td>
    <td>Bootstrap 1<sup>er</sup> login super-admin</td>
    <td><code>runEntityDataDuplicationOnce()</code></td>
    <td>Aucune action manuelle. Appelée par <code>api/login.php</code>. Duplique
      les référentiels entité 1 → entité 2. Verrouillée par
      <code>tble_entity_bootstrap</code> — ne tourne qu'une seule fois.</td>
  </tr>
  <tr>
    <td>7</td>
    <td><i>(Optionnel)</i> Audit d'intégrité</td>
    <td><code>api/dev/audit_invoice_integrity.php</code></td>
    <td>À lancer uniquement après incident (crash serveur, coupure). Détecte
      doublons de numéros, séquence désynchronisée, PDF orphelins.
      Non nécessaire lors d'un déploiement nominal.</td>
  </tr>
</table>

<div class="callout info">
  <span class="label">Rappel de robustesse</span>
  Le script SQL manuel (étape 2) et les <code>ensureXxxTable()</code> (étape 5)
  font <b>volontairement double emploi</b>. Peu importe l'ordre&nbsp;: si l'un
  a déjà tourné, l'autre détecte que la colonne existe et passe. Objectif&nbsp;:
  aucun trou possible entre migration de données et déploiement du code.
</div>

<div class="callout danger">
  <span class="label">À NE PAS lancer</span>
  Les autres scripts de <code>api/dev/</code> ne sont
  <b>pas</b> des migrations&nbsp;: <code>fix_promote_missions.php</code> (correction
  ponctuelle des statuts brouillon/validé), <code>force_entity_duplication.php</code>
  (relance manuelle de la duplication référentiels — inutile si le 1<sup>er</sup>
  login a bien tourné). À supprimer du serveur après déploiement.
</div>

<h2>7. Premier login post-déploiement — script de duplication</h2>
<p>
  Le premier login super-admin déclenche automatiquement
  <code>runEntityDataDuplicationOnce()</code>
  (<code>api/entity_bootstrap.php</code>, appelé par <code>api/login.php</code>).
  Objectif&nbsp;: rendre l'entité 2 (PLANETE TRADUCTION FRANCE) autonome en
  clonant les <b>référentiels métier</b> de l'entité 1 (AMI historique) vers
  l'entité 2, sans jamais dupliquer deux fois.
</p>

<h3>Ce qui est dupliqué (dans cet ordre)</h3>
<table>
  <tr>
    <th style="width: 8%;">#</th>
    <th style="width: 30%;">Table source</th>
    <th>Contenu et particularité</th>
  </tr>
  <tr>
    <td>1</td>
    <td><code>llx_societe</code><br><i>Clients / tiers</i></td>
    <td>Toutes les colonnes copiées, <code>entity</code> forcé à 2. En cas de
        collision UNIQUE (<code>code_client</code>, <code>siren</code>,
        <code>siret</code>, <code>barcode</code>) → suffixe <code>-E1</code>,
        <code>-E2</code>, <code>-E3</code>.</td>
  </tr>
  <tr>
    <td>2</td>
    <td><code>llx_socpeople</code><br><i>Contacts</i></td>
    <td>Idem, avec <code>fk_soc</code> <b>remappé</b> vers le nouveau
        <code>rowid</code> du client cloné. Contact orphelin (parent non
        dupliqué) → ignoré, compté <code>contacts_orphaned</code>.</td>
  </tr>
  <tr>
    <td>3</td>
    <td><code>llx_product</code><br><i>Langues / produits / services</i></td>
    <td><code>fk_product_parent</code> remappé sur le nouveau parent. Collision
        <code>ref</code>/<code>barcode</code> → suffixage.</td>
  </tr>
  <tr>
    <td>4</td>
    <td><code>llx_c_payment_term</code><br><i>Conditions de paiement</i></td>
    <td>UNIQUE <code>(entity, code)</code> déjà scopé par entité, pas de
        collision attendue.</td>
  </tr>
  <tr>
    <td>5</td>
    <td><code>llx_user</code><br><i>Utilisateurs / interprètes</i></td>
    <td>Login <b>suffixé</b> avec <code>_ptf</code> (<code>mdupont</code> →
        <code>mdupont_ptf</code>). Mot de passe <b>inchangé</b> (hash copié).
        <code>api_key</code>, <code>fk_socpeople</code>, <code>fk_member</code>
        remis à <code>NULL</code> (UNIQUE globales non scopées par entity).</td>
  </tr>
  <tr>
    <td>5 bis</td>
    <td><code>tble_user_rights</code></td>
    <td>Droits utilisateurs recopiés via <code>INSERT IGNORE</code>.</td>
  </tr>
</table>

<h3>Ce qui n'est PAS dupliqué (volontaire)</h3>
<ul>
  <li><b>Comptes bancaires</b> (<code>tble_company_bank_accounts</code>) —
      l'admin PTF les crée à la main via Admin → Comptes bancaires.</li>
  <li><b>Missions</b> (<code>llx_missionsplanet_mission</code>) — les missions
      historiques restent sur entity=1.</li>
  <li><b>Factures / avoirs / brouillons</b> (<code>tble_client_billed</code>,
      <code>invoice_draft*</code>, <code>tble_credit_note_applications</code>) —
      données transactionnelles.</li>
  <li><b>Séquences de numérotation</b> (<code>tble_invoice_sequence</code>) — la
      PK composite <code>(serie, entity)</code> fait démarrer l'entité 2 sur un
      compteur vierge.</li>
</ul>

<h3>Idempotence — mécanisme de sécurité</h3>
<p>
  Chaque duplication est enregistrée dans <code>tble_entity_dup_map</code>
  (source_table, source_rowid, target_rowid, target_entity). Avant chaque
  <code>INSERT</code>, <code>alreadyDuplicatedToEntity()</code> vérifie ce
  registre&nbsp;: si la ligne a déjà été clonée, on saute et on compte en
  <code>skipped</code>. <b>Relancer le script n'a aucun effet secondaire</b>,
  même 10 fois de suite.
</p>

<h3>Verrou temporel — 1 exécution par heure maximum</h3>
<p>
  La table <code>tble_entity_bootstrap</code> enregistre la date du dernier run
  par entité. Si un login intervient dans les 60 minutes qui suivent → sortie
  immédiate, aucune requête inutile. Passé ce délai, la fonction est rejouée
  pour <b>auto-heal</b>&nbsp;: si de nouvelles données ont été ajoutées côté
  entity=1 entre-temps, elles seront clonées à leur tour vers entity=2 (les
  autres, déjà mappées, sont ignorées).
</p>

<div class="callout info">
  <span class="label">Attendu — journal <code>api_error.log</code></span>
  <pre>[entity_bootstrap] entity_bootstrap[2]: {
  "clients_source": 735, "clients_created": 735,
  "contacts_source": 1955, "contacts_created": 1953, "contacts_orphaned": 2,
  "products_source": 422, "products_created": 422,
  "payment_terms_source": 8, "payment_terms_created": 8,
  "users_source": 18, "users_created": 18,
  "rights_copied": 96
}</pre>
  Premier login&nbsp;: 5–15 s selon la charge serveur. Logins suivants&nbsp;: instantanés.
</div>

<div class="callout">
  <span class="label">Rattrapage manuel</span>
  <code>api/dev/force_entity_duplication.php?token=AMI_FIX_2026_ENTITY_DUP</code>
  court-circuite le verrou 60&nbsp;min et rejoue immédiatement la duplication.
  À utiliser uniquement si un ajout urgent sur entity=1 doit être propagé sans
  attendre — sinon inutile. À supprimer du serveur après usage.
</div>

<h2>8. Checklist de vérification post-déploiement</h2>
<table>
  <tr><th style="width: 5%;">#</th><th style="width: 45%;">Vérification</th><th>Comment tester</th></tr>
  <tr><td>1</td><td>Login OK</td><td>Se connecter avec un compte <code>*_ptf</code> (entity=2). Un token JWT doit être délivré.</td></tr>
  <tr><td>2</td><td>Liste des missions non vide</td><td>Page Missions → au moins une ligne visible. Filtrer par statut fonctionne.</td></tr>
  <tr><td>3</td><td>Liste des tiers non vide</td><td>Page Tiers → SPADA / FORUM RÉFUGIÉS visibles. Cliquer sur "voir détails" → contacts affichés.</td></tr>
  <tr><td>4</td><td>Cascade contact fonctionnelle</td><td>Nouvelle mission → sélectionner un tiers → la liste des personnes demandeuses se remplit.</td></tr>
  <tr><td>5</td><td>Aperçu PDF facture</td><td>Facturation → bouton Aperçu PDF sur un brouillon → le PDF s'ouvre dans un nouvel onglet.</td></tr>
  <tr><td>6</td><td>Émission facture</td><td>Émettre une facture définitive → numéro attribué de façon atomique, brouillon supprimé.</td></tr>
  <tr><td>7</td><td>Création manuelle de devis</td><td>Devis → Nouveau devis → sélectionner client + lignes → PDF de devis généré.</td></tr>
</table>

<h2>9. Sécurité — points à vérifier avant mise en ligne</h2>
<ul>
  <li>Le dossier <code>api/dev/</code> contient des scripts de maintenance (
      <code>fix_promote_missions.php</code>, <code>force_entity_duplication.php</code>).
      À <b>supprimer</b> du serveur de prod ou à déplacer hors du webroot.</li>
  <li>Les logs d'erreur PHP sont écrits dans <code>api/api_error.log</code> — vérifier
      les permissions et exclure ce fichier de l'accès public via <code>.htaccess</code>.</li>
  <li>Sauvegarder la base de données <b>avant</b> le premier déploiement pour
      pouvoir rollback si nécessaire.</li>
  <li>Vérifier que <code>Content-Type: application/pdf</code> passe bien à travers
      d'éventuels proxys ou WAF (aperçu PDF).</li>
</ul>

<h2>10. Procédure de rollback</h2>
<ol>
  <li>Restaurer <code>api/</code> et <code>index.html</code>+<code>assets/</code> depuis la sauvegarde
      précédente (idéalement un dossier daté par déploiement).</li>
  <li>Si des tables custom ont été créées par erreur, elles sont idempotentes — laisser
      en place. Aucune donnée Dolibarr <code>llx_*</code> n'est modifiée par le déploiement.</li>
  <li>Si la duplication de l'entité 2 a produit des doublons, restaurer un dump SQL
      antérieur au premier login. Toujours passer par un dump complet, pas des
      <code>DELETE FROM llx_societe WHERE entity=2</code> qui casseraient les FK.</li>
</ol>

<h2>11. Historique des versions</h2>
<table>
  <tr><th>Version</th><th>Date</th><th>Modification</th></tr>
  <tr><td>1.0</td><td>02/08/2026</td><td>Version initiale — déploiement React + PHP + mPDF, entité 2 (PTF).</td></tr>
</table>

<p class="footer">
  Document généré automatiquement via <code>docs/generate_deployment_pdf.php</code>.
  Pour régénérer&nbsp;: <code>php docs/generate_deployment_pdf.php</code>.
</p>
HTML;

// mPDF config : marges, format A4, police par défaut supportant les accents.
$mpdf = new Mpdf([
    'mode'           => 'utf-8',
    'format'         => 'A4',
    'default_font'   => 'dejavusans',
    'margin_left'    => 15,
    'margin_right'   => 15,
    'margin_top'     => 15,
    'margin_bottom'  => 15,
    'margin_header'  => 8,
    'margin_footer'  => 8,
]);

$mpdf->SetTitle('Procédure de déploiement futurAMI');
$mpdf->SetAuthor('Planet Traduction France');
$mpdf->SetCreator('futurAMI docs/generate_deployment_pdf.php');
$mpdf->SetSubject('Procédure de déploiement — futurAMI v1.0');

// Pied de page paginé
$mpdf->SetHTMLFooter('
    <div style="text-align: center; color: #6B7280; font-size: 8pt;">
        futurAMI — Procédure de déploiement &middot; Page {PAGENO} / {nbpg}
    </div>
');

$mpdf->WriteHTML($html);
$mpdf->Output($outputPath, \Mpdf\Output\Destination::FILE);

echo "OK — PDF généré : $outputPath\n";
echo "Taille : " . number_format(filesize($outputPath) / 1024, 1, ',', ' ') . " Ko\n";
