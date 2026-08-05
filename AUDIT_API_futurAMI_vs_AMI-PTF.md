# Audit `futurAMI/api` vs `AMI-PTF/api` (référence)

Date : 31/07/2026
Comparaison faite entre `C:\wamp64\www\futurAMI\api` (backend branché sur la réécriture React) et `C:\wamp64\www\gesplanet_01\ami-ptf\api` (référence, backend à jour avec cloisonnement multi-entités).

## Résumé exécutif

`futurAMI/api` est un instantané de l'API PHP **antérieur** à tout le travail de sécurisation et de cloisonnement multi-entités fait sur AMI-PTF. Sur 51 fichiers PHP communs aux deux dossiers, **46 diffèrent**, et l'élément le plus grave est que **le middleware d'authentification JWT n'existe pas du tout** dans `futurAMI/api` : `config.php` s'arrête juste après la connexion PDO, sans jamais appeler `require_auth()`. Concrètement, tous les endpoints de `futurAMI/api` sont actuellement accessibles sans aucun token, à quiconque connaît l'URL.

## 1. Fichiers absents dans `futurAMI/api` (à copier depuis la référence)

- `auth_helpers.php` — JWT HS256 maison, `issueAuthToken()`, `require_auth()`, `getConfiguredEntity()`
- `entity_bootstrap.php` — duplication auto des données de référence vers une autre entité
- `.htaccess` / `.htaccess.example` — définit `DOLIBARR_ENTITY`, `AUTH_SECRET`, `AUTH_TOKEN_TTL`
- `get_credit_note_applications.php`

## 2. Fichiers présents seulement dans `futurAMI/api` (spécifiques à la réécriture, absents côté référence)

- `get_all_contacts.php` — vue transverse contacts toutes sociétés (utilisée par l'onglet Contacts de TiersPage)
- `send_invoice_email.php` — stub d'envoi d'email de facture

Ces deux endpoints ont été créés pour les besoins du front React et n'existent pas dans AMI-PTF : à garder, mais à sécuriser/aligner avec le même middleware une fois celui-ci porté.

## 3. Le problème central : middleware d'auth totalement absent

`config.php` référence (AMI-PTF), après la connexion PDO :

```php
require_once __DIR__ . '/auth_helpers.php';

if (empty($__SKIP_AUTH)) {
    $currentUser = require_auth();
    $currentEntity = (int) $currentUser['entity'];
    ...
}
```

Ce bloc entier (18 lignes) est absent de `futurAMI/api/config.php`. Résultat : aucun endpoint de `futurAMI` ne vérifie de token, `$currentUser` et `$currentEntity` n'existent nulle part dans le code.

`login.php` confirme l'écart : la version référence vérifie le mot de passe, le statut du compte (`statut = 1`), l'appartenance à la bonne entité, déclenche la duplication auto au premier login, puis émet un vrai JWT (`issueAuthToken`). La version `futurAMI` s'arrête à la vérification du mot de passe et renvoie l'utilisateur sans token ni contrôle d'entité — le front (`store/auth.ts`) compense en stockant la chaîne littérale `'session'` en guise de token, faute de mieux.

## 4. Bugs connus retrouvés tels quels dans `futurAMI`

- **`delete_mission_interpreter.php`** : contient deux fois le même bloc `<?php ... ?>` à la suite (bug signalé comme non corrigé dans la référence — confirmé identique dans `futurAMI`, à corriger dans les deux dépôts).
- **`admin/add_user.php`** : `entity` codé en dur à la valeur `1` dans l'`INSERT INTO llx_user` — c'est exactement le bug sévère décrit dans le récap AMI-PTF ("tout interprète ajouté restait invisible sur l'autre entité"). Toujours présent dans `futurAMI`.
- `add_client.php`, `add_contact.php`, `add_interprete.php`, `get_company_bank_accounts.php`, `get_company_info.php`, `update_company_info.php` référencent une colonne `entity`, mais seulement via un `getenv('DOLIBARR_ENTITY') ?: 1` statique — pas de vérité venant du token utilisateur, pas de cloisonnement réel.

## 5. Fichiers avec le plus gros écart de contenu (à revoir en priorité)

| Fichier | Lignes de diff | Nature probable de l'écart |
|---|---|---|
| `billing_helpers.php` | 406 | Colonne `entity` ajoutée sur plusieurs tables, migrations douces `ALTER TABLE`, `ensureInvoiceDraftTable()` |
| `login.php` | 68 | JWT + cloisonnement entity + auto-heal (voir §3) |
| `convert_quote_to_invoice.php` | 54 | Filtrage entity + fix transaction ("There is no active transaction" vu dans les logs `futurAMI`) |
| `log_client_billing.php` | 55 | Filtrage entity sur facturation |
| `create_credit_note.php` | 51 | Filtrage entity avoirs |
| `apply_credit_note.php` | 41 | Filtrage entity avoirs |
| `save_invoice_draft.php` | 40 | Filtrage entity brouillons facture |
| `reserve_client_invoice_number.php` | 36 | Séquences FAC/AV séparées par entité (`tble_invoice_sequence`) |
| `get_available_credit_notes.php` | 23 | Filtrage entity |
| `get_client_invoices.php` | 26 | Filtrage entity |
| `update_client_invoice_lines.php` | 27 | Filtrage entity |
| `get_company_info.php` | 20 | Lecture entity |
| `config.php` | 18 | Middleware auth (§3) |
| `save_invoice_draft_lines.php` | 16 | Filtrage entity |
| `update_quote.php` | 15 | Filtrage entity |
| `delete_invoice_draft.php` | 15 | Filtrage entity |

Une quarantaine d'autres fichiers présentent des diffs plus courts (2 à 15 lignes), essentiellement l'ajout de `require_once auth_helpers.php` / vérifications `$currentEntity` en tête de fichier et dans les clauses `WHERE`.

## 6. Recommandation

1. Porter `auth_helpers.php`, `entity_bootstrap.php`, `.htaccess` (avec un `AUTH_SECRET` propre à `futurAMI`, ne jamais réutiliser celui de prod PTF) dans `futurAMI/api`.
2. Réintégrer le bloc middleware de `config.php` et régénérer `login.php` sur le modèle référence (JWT + vérif statut, sans forcément le filtrage entity si `futurAMI` reste mono-entité).
3. Corriger `admin/add_user.php` (entity codé en dur) et `delete_mission_interpreter.php` (bloc dupliqué) — bugs simples, indépendants du chantier multi-entités.
4. Revoir en priorité les 8 fichiers de facturation/devis/avoirs du tableau ci-dessus : ce sont ceux qui portent la logique métier la plus sensible (séquences de factures, transactions SQL, avoirs).
5. Une fois le middleware en place, exécuter `git add -A && git commit` sur `futurAMI/api` (rappel : ce dossier n'est toujours pas versionné, cf. audit précédent) avant toute autre modification.
