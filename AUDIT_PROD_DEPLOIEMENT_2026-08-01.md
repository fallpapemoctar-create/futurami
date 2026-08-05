# Audit pré-déploiement — dump prod `dbs12436960 (19).sql` (1er août 2026)

Comparaison avec le dump précédent (`(18).sql`, 30 juillet 2026) et vérification de compatibilité avec le code actuel de futurAMI/api.

## 1. Constat principal : la duplication entité 1 → entité 2 a été effacée en prod

Entre le 30 juillet et le 1er août, sur la base de production :

| Table | Entity=2 (30 juil.) | Entity=2 (1er août) |
|---|---|---|
| `llx_societe` (clients) | 735 | **0** |
| `llx_socpeople` (contacts) | 1955 | **0** |
| `llx_product` (langues/services) | 422 | **0** |
| `llx_user` (interprètes dupliqués `_ptf`) | 18 | **0** |

Les deux tables de suivi de la duplication ont aussi disparu :
- `tble_entity_bootstrap` : existait (1 ligne) → **supprimée**
- `tble_entity_dup_map` : existait (3129 lignes de mapping) → **supprimée**

**Ce n'est pas une perte de données métier** : les vraies données (missions, factures, brouillons) sont intactes et ont même augmenté sur la période (`tble_client_billed` 744 → 5473, `invoice_draft` 35 → 227, `llx_missionsplanet_mission` 22787 → 27232 lignes). Seules les données *dupliquées automatiquement* pour l'entité 2 (référentiels + interprètes) et leur registre de suivi ont été retirées — ça ressemble à un nettoyage volontaire, pas à une restauration de sauvegarde ancienne.

**Question pour toi : ce nettoyage était-il intentionnel** (remise à zéro avant le vrai lancement de futurAMI) **ou accidentel** ? La réponse change la suite :

- **Si intentionnel** : bonne nouvelle, le code actuel gère ce cas proprement. `entity_bootstrap.php` recrée les tables de suivi via `CREATE TABLE IF NOT EXISTS` et relance une duplication propre au premier login sur l'entité 2 — sans collision puisque l'ancien registre a été purgé en même temps que les données.
- **Si accidentel** : il faut vérifier s'il existe une sauvegarde antérieure au 31 juillet pour restaurer `tble_entity_dup_map`/`tble_entity_bootstrap` et les lignes entité=2, avant que le code ne relance une nouvelle duplication par-dessus.

Dans les deux cas, **`llx_c_payment_term`** (termes de paiement) reste à 13 lignes, toutes entity=1 — cette table n'a jamais été dupliquée automatiquement (fonctionnalité ajoutée récemment, jamais exécutée en prod). C'est attendu et couvert par le point 3 ci-dessous.

## 2. Anomalie concrète à corriger avant déploiement : missions avec référence client/interprète cassée

En comparant les `nominterprete`/`fk_soc` des missions (`llx_missionsplanet_mission`) aux `rowid` réellement présents dans `llx_user`/`llx_societe` du dump 19 :

- **1418 missions** référencent 8 `fk_soc` (client) qui n'existent plus.
- **27 missions** référencent 3 `nominterprete` (interprète) qui n'existent plus.

C'est **~5% des missions** (1418+27 sur 27232). Vérification faite : ce ne sont pas des restes de la duplication entité 2 (les IDs orphelins étaient déjà en entity=1 dans le dump 18, ou n'existaient pas encore) — c'est une anomalie de qualité de données préexistante et indépendante (clients/interprètes supprimés ou fusionnés alors que des missions les référençaient encore).

**Pourquoi c'est un risque de déploiement précisément maintenant** : `get_missions_datatable.php` filtre avec `WHERE (u.entity = :entity OR s.entity = :entity)`. Pour une mission dont le client ET l'interprète sont introuvables, `u.entity` et `s.entity` valent tous les deux NULL → la condition ne matche **aucune** entité. Avant l'ajout du filtre entity, ces missions étaient visibles par tout le monde ; après déploiement, **elles disparaîtront silencieusement de la liste des missions, pour tous les utilisateurs**, entité 1 comme entité 2.

Trois options, à trancher avec toi plutôt qu'à choisir seul (impact business) :
1. Nettoyer les 8 fiches client et 3 fiches interprète manquantes (recréer ou relier les missions à un client/interprète existant) — la solution la plus propre.
2. Modifier la requête pour ne pas masquer ces missions orphelines (les rendre visibles par défaut, au prix d'une petite fuite inter-entités sur ce sous-ensemble précis).
3. Accepter que ces ~1445 missions historiques deviennent invisibles dans les listes (elles resteraient en base, juste non affichées).

Je peux fournir la liste exacte des 8 ID clients et 3 ID interprètes concernés si tu veux investiguer.

## 3. Ce qui est déjà prêt côté code (rien à faire)

- Toutes les tables custom attendues par le code (`invoice_draft`, `tble_invoice_sequence`, `tble_client_billed`, `tble_client_invoice_lines`, `tble_credit_note_applications`, `tble_mission_billed`, etc.) existent en prod avec la structure attendue.
- `llx_product`, `llx_c_payment_term`, `llx_bank_account`, `llx_societe`, `llx_user` ont tous une colonne `entity` avec le bon type/défaut — compatible avec les nouveaux endpoints CRUD (langues, termes de paiement, comptes bancaires) créés récemment.
- Les fonctions `ensureXxxTable()` de `billing_helpers.php` et `entity_bootstrap.php` sont idempotentes (`CREATE TABLE IF NOT EXISTS`) : elles s'auto-réparent même si une table a été supprimée entre-temps.
- Note mineure : `tble_invoice_sequence_legacy_20260728_215911` (30 juillet) a été remplacée par `tble_invoice_sequence_legacy_20260731_165034` — la migration douce de `ensureInvoiceSequenceTable()` a retourné une seconde fois. Pas grave en soi (idempotent), mais si ça se reproduit à chaque déploiement, la table `tble_invoice_sequence` mérite un coup d'œil pour vérifier qu'elle garde bien le bon format entre deux exécutions.

## 4. Checklist opérationnelle de déploiement (à faire, indépendamment du dump)

1. **`.htaccess` prod** : `api/.htaccess` n'est pas versionné (volontairement, il contient `AUTH_SECRET`). Il faut le créer manuellement sur le serveur de prod avec `DOLIBARR_ENTITY=2`, un `AUTH_SECRET` réel (≥32 caractères), `AUTH_TOKEN_TTL`. Sans ça, `login.php` renverra une erreur 500 `auth_secret_missing` dès le premier essai de connexion.
2. **Mot de passe DB en dur dans `config.php`** (`Paris2024#`) : toujours présent en fallback si `DB_PASS_PROD` n'est pas défini côté serveur. Recommandé de configurer la vraie variable d'environnement sur l'hébergement plutôt que de compter sur ce fallback (risque de sécurité déjà signalé plus tôt, jamais traité).
3. **Scripts `api/dev/*`** (`fix_promote_missions.php`, `force_entity_duplication.php`) : protégés par un token en dur dans le code, mais accessibles publiquement par URL si déployés tels quels. À supprimer du dossier de prod une fois leur usage terminé (ou à déplacer hors du webroot).
4. **Premier login post-déploiement** : c'est ce qui déclenche `runEntityDataDuplicationOnce()`. Vu le nettoyage du point 1, la première connexion après déploiement va relancer une duplication complète (735 clients, 1955 contacts, 422 langues, 18 interprètes, + les nouveaux termes de paiement). Ça peut prendre quelques secondes de plus que d'habitude sur ce premier login — normal, pas un bug.
5. **Comptes bancaires** : pas de duplication automatique (décision volontaire) — l'onglet "Comptes bancaires" sera vide pour l'entité 2 tant que personne ne les crée via le nouveau CRUD. Attendu, pas une anomalie.

## Résumé pour toi

Le code est prêt techniquement (tables auto-créées, filtres entity cohérents, CRUD référentiels en place). Les deux points qui demandent une décision de ta part avant déploiement : confirmer que le nettoyage entité 2 était voulu (§1), et décider quoi faire des ~1445 missions à référence cassée (§2) — sinon elles disparaîtront silencieusement des listes après déploiement.
