# Documentation technique — Application AMI

**Nom du produit :** AMI — Assistance Missions Interprètes
**Version applicative :** 4.0.0 (module Devis : v1.4)
**Date du document :** 17 mai 2026
**Public visé :** développeurs, administrateurs systèmes, équipe support technique
**Format source :** projet Flutter multi-plateforme + back-end PHP/MySQL

---

## 1. Vue d'ensemble

### 1.1 Objet du produit
AMI est une application de gestion métier destinée à un cabinet (ou administration) chargé d'orchestrer le travail des interprètes pour le compte de tiers (sociétés, juridictions). L'outil couvre l'ensemble du cycle :

- annuaire des interprètes et de leurs langues,
- planification et suivi des missions,
- édition de devis et conversion en factures,
- facturation client (mensualisée par société),
- administration des utilisateurs et de leurs droits,
- export des données (CSV).

### 1.2 Stack technique
| Couche | Technologie | Version / Détail |
|---|---|---|
| Front-end | **Flutter / Dart** | SDK Dart `^3.10.4`, Material 3 |
| Back-end | **PHP** (vanilla, sans framework) | PDO + MySQL/MariaDB |
| Base de données | **MySQL/MariaDB** (schéma Dolibarr `llx_*` étendu) | UTF-8 (utf8mb4) |
| Stockage local | `shared_preferences` (session « se souvenir de moi ») | côté client |
| Génération PDF | packages `pdf` 3.11 + `printing` 5.13 | côté client Flutter |
| Hash mot de passe | `password_hash`/`password_verify` (bcrypt) | côté PHP |

L'application Flutter est livrée pour **Web (PWA)**, **Windows**, **Android**, **iOS**, **macOS** et **Linux** (les six dossiers Runner sont présents dans le dépôt). L'usage cible principal est le **Web** déployé derrière Apache/WAMP.

### 1.3 Environnements
La configuration d'environnement est définie dans `assets/config/app_config*.json` côté front, et `api/config.php` côté back :

| Environnement | apiBaseUrl Flutter | Base MySQL |
|---|---|---|
| Dev local | `http://localhost/gesplanet_01/ami/api/` | `localhost` / `dbs13098267` / `root` |
| Production | `https://ami.planetapplis.fr/api/` | `db5014964228.hosting-data.io` / `dbs13098267` / `dbu1316150` |

Le choix de la base se fait par variable d'environnement `APP_ENV=prod|local` ou par heuristique d'hôte (`yourbizapps.com`, `planetapplis.fr` ⇒ prod).

> **⚠ Sécurité** : les identifiants MySQL de production sont actuellement codés en dur dans `api/config.php` comme valeur de repli. À court terme, retirer ces valeurs et n'utiliser que des variables d'environnement (`getenv('DB_PASS_PROD')`).

---

## 2. Architecture générale

### 2.1 Schéma d'architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Flutter)                          │
│                                                                  │
│   ┌────────────┐   ┌─────────────┐   ┌──────────────────────┐  │
│   │  Screens   │←→ │   Pages     │←→ │   Widgets réutil.    │  │
│   │ (Home,     │   │ (Missions,  │   │ (client_autocomplete │  │
│   │  Login,    │   │  Devis,     │   │  custom_scrollbar,   │  │
│   │  Admin,    │   │  Factures,  │   │  brand_footer)       │  │
│   │  Export)   │   │  Interprètes│   │                      │  │
│   └─────┬──────┘   │  Tiers,     │   └──────────────────────┘  │
│         │          │  Entreprise)│                              │
│         │          └──────┬──────┘                              │
│         │                 │                                     │
│         ▼                 ▼                                     │
│   ┌─────────────────────────────────────────┐                  │
│   │              Services (HTTP)             │                  │
│   │  auth, admin, interpreter, mission,     │                  │
│   │  client, contact, billing, quote,       │                  │
│   │  language, country, department, …       │                  │
│   └────────────────────┬────────────────────┘                  │
│                        │ JSON over HTTPS                        │
└────────────────────────┼────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    SERVEUR (Apache + PHP)                        │
│                                                                  │
│   ┌─────────────────────────────────────────┐                  │
│   │              api/*.php (≈ 50 fichiers)   │                  │
│   │  CORS, validation, PDO MySQL            │                  │
│   └────────────────────┬────────────────────┘                  │
│                        │                                         │
│   ┌────────────────────▼────────────────────┐                  │
│   │              MySQL / MariaDB             │                  │
│   │  llx_* (Dolibarr) + tble_* (extensions) │                  │
│   └─────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Découpage du code Flutter
Le dépôt suit une convention claire :

| Dossier | Contenu |
|---|---|
| `lib/main.dart` | Point d'entrée, déclaration des routes, restauration de session |
| `lib/core/` | Code transverse : `app_config.dart`, `app_theme.dart`, `app_text_styles.dart`, `auth_manager.dart`, `user_rights.dart`, `responsive_helper.dart`, `file_downloader*.dart`, `custom_scrollbar.dart`, `brand_footer.dart` |
| `lib/core/models/` | Modèles transverses (`quote.dart`, `invoice_line.dart`) |
| `lib/models/` | Modèles métier (`interpreter`, `mission`, `user`, `company_info`, `company_bank_account`, `country`, `department`) |
| `lib/services/` | Couche d'accès HTTP au back-end PHP |
| `lib/screens/` | Écrans de premier niveau (login, home, admin, export) |
| `lib/pages/` | Pages secondaires accessibles via les onglets de `HomePage` |
| `lib/widgets/` | Widgets réutilisables (ex. `client_autocomplete_field`) |
| `lib/utils/` | Aides plate-forme (téléchargement PDF web vs natif) |
| `api/` | Endpoints PHP groupés par action |
| `assets/` | Logo + fichiers de configuration d'environnement |
| `docs/` | Documentation (ce fichier + DEPLOY_WEB.md + SQL_SUPPORT_GUIDE.md) |
| `scripts/` | Outils auxiliaires (MCP helper pour Copilot) |

### 2.3 Patterns appliqués
- **Configuration injectée** via `AppConfig.load()` au démarrage (asset JSON différent en debug/release).
- **Singleton statique** pour la session utilisateur (`AuthManager`) — pas de DI, accès `static`.
- **Service par domaine** : un fichier `xxx_service.dart` = un domaine métier, méthodes `static`, appels `http`.
- **Modèles immuables** avec `fromJson` / `toJson` tolérants aux variations de schéma (`snake_case` vs `camelCase`, anciennes vs nouvelles clés).
- **Responsive design** centralisé dans `ResponsiveHelper` (4 paliers : mobile < 600, tablet < 900, desktop < 1200, large desktop ≥ 1600 px).
- **Thème centralisé** : 3 thèmes interchangeables (`bleuOfficiel`, `ardoise`, `nuit`) sélectionnés par la constante `kActiveTheme` dans `main.dart`.

---

## 3. Configuration applicative

### 3.1 Côté Flutter
Fichier `lib/core/app_config.dart` :
- charge un asset JSON au démarrage (`AppConfig.load()`),
- sélectionne le fichier selon `--dart-define=APP_CONFIG_ASSET=…` puis `kReleaseMode`,
- expose un singleton `AppConfig.instance.apiBaseUrl` consommé par tous les services.

Les services accèdent ensuite à `${AppConfig.instance.apiBaseUrl}endpoint.php`.

### 3.2 Côté PHP
Fichier `api/config.php` :
- définit les en-têtes CORS larges (`Access-Control-Allow-Origin: *`),
- gère les pré-vol `OPTIONS` (HTTP 204),
- active la journalisation des erreurs PHP vers `api/api_error.log`,
- détecte l'environnement via `APP_ENV` ou l'hôte,
- ouvre une connexion **PDO** MySQL en `utf8mb4` avec `ERRMODE_EXCEPTION` et `FETCH_ASSOC`.

### 3.3 Build & déploiement web
Référence : `docs/DEPLOY_WEB.md`.

```powershell
cd C:\wamp64\www\gesplanet_01\ami
flutter pub get
flutter build web --release `
  --dart-define=APP_CONFIG_ASSET=assets/config/app_config.prod.json
# Optionnel, sous-chemin :
flutter build web --release `
  --base-href /smartbizapp/ `
  --dart-define=APP_CONFIG_ASSET=assets/config/app_config.prod.json
```

Le contenu de `build/web/` est ensuite déployé sur le serveur, idéalement avec compression et en-têtes de sécurité (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Content-Security-Policy — modèle complet dans `DEPLOY_WEB.md`).

---

## 4. Modèle de données

### 4.1 Tables principales
Le back-end s'appuie sur un schéma **Dolibarr** étendu, conservant le préfixe `llx_` :

| Table | Rôle |
|---|---|
| `llx_user` | Utilisateurs ET interprètes (un interprète est un user avec un droit dédié) |
| `llx_missionsplanet_mission` | Missions (la « ref » sert d'identifiant fonctionnel) |
| `llx_societe` | Sociétés clientes (donneurs d'ordre) |
| `llx_socpeople` | Contacts au sein des sociétés clientes (les « demandeurs ») |
| `llx_product` | Catalogue de langues / produits facturables |
| `llx_c_country` | Référentiel pays |
| `llx_c_payment_term` | Conditions de règlement |
| `llx_bank_account` | Comptes bancaires de l'entreprise (IBAN, BIC, RIB…) |
| `llx_const` | Constantes globales (informations société) |

Tables d'extension AMI (préfixe `tble_`) :

| Table | Rôle |
|---|---|
| `tble_mission_billed` | Statut de facturation **interprète** par mission (historisé) |
| `tble_client_billed` | Statut de facturation **client** par mission (historisé) |
| `tble_client_invoice_lines` | Lignes de facture client (post-conversion) |
| `tble_rights` | Catalogue de droits (rôles applicatifs) |
| `tble_user_rights` | Affectation droit ↔ utilisateur |
| `invoice_draft` | En-tête des **devis** (table principale du module Devis v1.4) |
| `invoice_draft_lines` | Lignes des devis (jointes par `draft_id`) |

### 4.2 Statuts métier
**Missions** (`llx_missionsplanet_mission.status`) :
`Brouillon`, `Validée`, `Envoyée`, `Renvoyée au collaborateur`, `Payée`, `Tous` (filtre UI).

**Facturation interprète** (`tble_mission_billed.status`) :
`Non facturée`, `Facturée`, `Payée`.

**Facturation client** (`tble_client_billed.status_code`) :
`draft`, `sent`, `paid`, `overdue`, `cancelled` (avec libellé `status_label` traduisible).

**Devis** (`invoice_draft.status`) :
| Code | Libellé UI | Couleur (hex) |
|---|---|---|
| `draft` | Brouillon | `#6B7280` (gris) |
| `sent` | Envoyé | `#1D4ED8` (bleu) |
| `accepted` | Accepté | `#15803D` (vert) |
| `rejected` | Rejeté | `#B91C1C` (rouge) |
| `expired` | Expiré | `#D97706` (orange) |
| `accepted_converted` | Converti en facture | `#6D28D9` (violet) |

### 4.3 Modèles côté Flutter
Les classes Dart suivantes encapsulent les données métier ; toutes implémentent `fromJson` (tolérant aux variations de clés) et la plupart `toJson` :

- `Interpreter` (`lib/models/interpreter.dart`)
- `Mission` (`lib/models/mission.dart`) — modèle léger « interprète + nb missions »
- `UserModel` (`lib/models/user.dart`)
- `CompanyInfo` + `CompanyBankAccount` (`lib/models/company_info.dart`, `company_bank_account.dart`)
- `Country`, `Department` (`lib/models/`)
- `ClientSummary` (défini dans `lib/services/client_service.dart`)
- `ContactInfo` (`lib/services/contact_service.dart`)
- `LanguageOption` (`lib/services/language_service.dart`)
- `Quote` + `QuoteLine` (`lib/core/models/quote.dart`)
- `InvoiceLine` (`lib/core/models/invoice_line.dart`)

> Particularité : `InvoiceLine.fromJson` infère rétroactivement la `discount` quand l'ancien backend n'enregistrait pas la remise mais persistait un `total_ht` divergent du calcul brut — utile pour rétro-compatibilité avec les factures historiques.

---

## 5. Authentification et autorisations

### 5.1 Flux d'authentification
1. L'utilisateur saisit `login` + `password` dans `LoginPage`.
2. `AuthService.login()` POST `login.php` avec `{ login, password }` en JSON.
3. `login.php` :
   - vérifie l'existence dans `llx_user` (`pass_crypted` = bcrypt),
   - vérifie le mot de passe avec `password_verify`,
   - récupère les droits via `tble_user_rights` ⨝ `tble_rights.name`,
   - répond `{ success, user:{id,prenom,nom,login}, rights:[…] }`.
4. `AuthManager.setUser()` + `AuthManager.setRights(UserRights(list))`.
5. Si « se souvenir de moi » est coché, `persistSession` sérialise `_user` (JSON) et les codes de droits dans `SharedPreferences`.
6. Navigation vers `HomePage`.

Au redémarrage de l'application, `AuthManager.restoreSession()` lit les préférences et restaure l'état si `rememberMe` était vrai.

### 5.2 Modèle de droits (`UserRights`)
Le code de la classe est minimaliste mais expressif :

```dart
bool isAdmin()                 => rights.contains('admin') || rights.contains('agent_admin');
bool canManageInterpreters()   => isAdmin() || rights.contains('agent_admin_annuaire');
bool canManageMissions()       => isAdmin() || rights.contains('agent_admin_mission');
bool isInterpreter()           => rights.contains('interprete');
```

| Rôle UI | Codes de droits | Capacités |
|---|---|---|
| Administrateur | `admin`, `agent_admin` | Accès complet (CRUD users, exports, tout module) |
| Gestionnaire interprètes | `agent_admin_annuaire` | CRUD interprètes, lecture missions |
| Gestionnaire missions | `agent_admin_mission` | CRUD missions, devis, factures, tiers ; lecture interprètes |
| Interprète | `interprete` | Vue restreinte (lecture de ses propres missions) |

### 5.3 Sécurité — points d'attention
- Mots de passe stockés en **bcrypt** (`password_hash(... PASSWORD_DEFAULT)`), bonne pratique.
- CORS actuellement **trop permissif** (`*`). Restreindre à l'origine du front en production.
- **Aucun jeton** échangé entre client et serveur : chaque appel API est anonyme côté serveur (le serveur ne sait pas qui appelle). Les droits sont vérifiés **uniquement côté client**. Risque élevé d'élévation de privilèges si l'on connaît un endpoint sensible. **Priorité haute** : introduire un mécanisme de session côté serveur (JWT, cookie HTTP-only, ou clé d'API par utilisateur) et vérifier le droit à chaque endpoint.
- À la création d'un interprète (`add_interprete.php`), un mot de passe est généré automatiquement par concaténation `lastname + '2026'`. Pratique faible : à remplacer par un mot de passe aléatoire de 16 caractères + envoi par e-mail à l'interprète.
- Les identifiants MySQL de prod sont en dur dans `config.php` comme fallback — à supprimer.

---

## 6. API back-end (PHP)

### 6.1 Conventions
- Toutes les routes acceptent `OPTIONS` pour CORS pré-vol et renvoient un `200`/`204`.
- Réponses JSON : enveloppe `{ success: bool, ... }` ou liste brute (selon les endpoints, à uniformiser).
- Erreurs : code HTTP approprié (`400` payload invalide, `404` non trouvé, `405` méthode, `409` conflit métier, `500` exception serveur) + `{ success:false, error:"…" }`.
- Logs serveurs : `api/api_error.log` (général) et `api/billing_creation.log` (création de factures).

### 6.2 Catalogue des endpoints
**Authentification**
- `POST login.php` — connexion.

**Interprètes**
- `GET get_interpretes.php?limit=N` — liste paginée.
- `POST add_interprete.php` — création (génère login + mdp + droit `interprete`).
- `PUT update_interprete.php` — mise à jour.
- `DELETE delete_interprete.php` (id en query ou body) — suppression.

**Missions**
- `POST get_tab_mission_par_interpreters.php` — agrégat (interprètes ayant des missions).
- `GET get_missions_datatable.php` — DataTable paginée avec filtres (`q`, `requestingCompany`, `dateStart`, `dateEnd`, `billedStatus`, `missionStatus`, `missionType`).
- `POST get_missions_by_interpreter.php` — détails par interprète.
- `POST add_mission.php` — création (variante interprète : `add_mission_interpreter.php`).
- `POST update_mission.php` (variante : `update_mission_interpreter.php`) — mise à jour.
- `POST delete_mission.php` (variante : `delete_mission_interpreter.php`) — suppression.

**Tiers (sociétés clientes + contacts)**
- `GET get_clients.php` — liste sociétés.
- `POST add_client.php`, `POST update_client.php`, `POST delete_client.php`.
- `GET get_contacts.php?client_id=` — contacts d'une société.
- `POST add_contact.php`, `POST update_contact.php`, `POST delete_contact.php`.

**Devis (v1.4)**
- `POST create_quote_from_mission.php` — crée un devis brouillon depuis une mission (RM-01). Conflit `409 QUOTE_ALREADY_EXISTS` si un brouillon/envoyé existe déjà, ou `409 MISSION_ALREADY_BILLED` si la mission est facturée.
- `GET get_quotes.php?status=&client_id=&page=&pageSize=` — liste paginée.
- `GET get_quote.php?quote_id=` — détail entête + lignes.
- `POST update_quote.php` — mise à jour (notes, validité, statut, lignes).
- `POST convert_quote_to_invoice.php` — conversion en facture (RM-07).

**Facturation client**
- `POST get_client_invoices.php` — liste paginée (`page`, `pageSize`, `client`, `status`, `invoice_number`, `mission_ref`, `search`).
- `GET get_client_invoice_lines.php?invoice_number=` — lignes d'une facture.
- `POST update_client_invoice_lines.php` — édition des lignes.
- `POST update_client_invoice_status.php` — changement de statut (sent/paid/overdue/cancelled).
- `POST update_invoice_bank_account.php` — sélection d'un RIB par facture.
- `POST update_invoice_date.php` — changement de date d'émission.
- `POST update_invoice_payment_term.php` — délais de règlement.
- `POST reserve_client_invoice_number.php` — réservation d'un numéro de facture (séquentiel).
- `POST log_client_billing.php` — enregistrement d'une nouvelle facture (avec PDF en base64 optionnel).

**Brouillons de facture (multi-missions/mois)**
- `GET get_invoice_drafts.php`, `GET get_invoice_draft_lines.php`.
- `POST save_invoice_draft.php`, `POST save_invoice_draft_lines.php`.
- `POST delete_invoice_draft.php`.

**Référentiels**
- `GET get_countries.php`, `GET get_departments.php`, `GET get_languages.php?type=&q=&limit=`.
- `GET get_company_info.php`, `GET get_company_bank_accounts.php`, `POST update_company_info.php`.
- `GET get_client_payment_terms.php`.

**Administration (sous-dossier `api/admin/`)**
- `GET admin/get_users.php` — liste utilisateurs + résumé (totaux, actifs).
- `POST admin/add_user.php` — création.
- `POST admin/update_user.php` — mise à jour (mot de passe optionnel).
- `POST admin/delete_user.php` — suppression.

### 6.3 Helpers PHP
| Fichier | Rôle |
|---|---|
| `billing_helpers.php` | Génération de numéros de facture, clés de brouillon, validations |
| `invoice_line_helpers.php` | Manipulation de lignes (parsing, normalisation TVA, calculs) |
| `interprete_helpers.php` | Slugification login, vérification d'unicité, attribution du droit `interprete` |

---

## 7. Couche services Flutter

Chaque service est une classe statique encapsulant les appels HTTP vers un domaine du back-end.

| Service | Endpoints couverts | Particularités |
|---|---|---|
| `AuthService` | `login.php` | Renvoie le `Map` brut au login pour laisser `AuthManager` peupler la session |
| `AdminService` | `admin/*.php` | Inclut un summary (compteurs) en plus de la liste |
| `InterpreterService` | `get_interpretes.php`, `add/update/delete_interprete.php` | Tolère 3 formats de réponse (liste, `data`, `interpretes`) |
| `MissionService` | `get_tab_mission_par_interpreters.php`, `get_missions_datatable.php`, `get_missions_by_interpreter.php`, `add/update/delete_mission*.php` | Renvoie un `Map { total, data }` pour la pagination |
| `ClientService` | `get_clients.php`, `add/update/delete_client.php` | Définit aussi le modèle `ClientSummary` |
| `ContactService` | `get_contacts.php?client_id=`, `add/update/delete_contact.php` | Définit `ContactInfo` |
| `BillingService` | `get_client_invoices.php`, `get_client_invoice_lines.php`, `update_client_invoice_*.php`, `reserve_client_invoice_number.php`, `log_client_billing.php`, brouillons | Gère les hashs/checksums pour intégrité (import `crypto`) |
| `QuoteService` | `create_quote_from_mission.php`, `get_quote.php`, `get_quotes.php`, `update_quote.php`, `convert_quote_to_invoice.php` | Conflit 409 ⇒ ouverture du devis existant |
| `CompanyInfoService` | `get_company_info.php`, `get_company_bank_accounts.php`, `update_company_info.php` | Lecture/écriture des RIB |
| `LanguageService` | `get_languages.php` | Filtrage par `type`, `q`, `limit` |
| `CountryService`, `DepartmentService` | `get_countries.php`, `get_departments.php` | Référentiels simples |

---

## 8. Routage et écrans Flutter

### 8.1 Routes nommées
Définies dans `main.dart` :

| Route | Écran | Garde de droit |
|---|---|---|
| `/login` | `LoginPage` | — |
| (root) | `HomePage` ou `LoginPage` selon `AuthManager.isLogged` | — |
| `/interpreters` | `InterpretersPage` | `canManageInterpreters` ou `isAdmin` |
| `/missions-table` | `MissionsTablePage` | `canManageMissions` ou `isAdmin` |
| `/billing` | `BillingPage` | `canManageMissions` ou `isAdmin` |
| `/admin` | `AdminPage` | `isAdmin` |
| `/export` | `ExportPage` | `isAdmin` |
| `/company-info` | `CompanyInfoPage` | `canManageMissions` ou `isAdmin` |
| `/requesters` | `RequestersManagementPage` | `canManageMissions` ou `isAdmin` |
| `/admin-mockup` | `AdminMockupPreview` | aperçu maquette interne |

### 8.2 HomePage — composition
- **Layout desktop** (largeur ≥ 900 px) : barre supérieure unique avec logo + titre + `TabBar` horizontale (onglets affichés en fonction des droits) + nom utilisateur + bouton déconnexion. Le contenu actif est un `TabBarView`.
- **Layout mobile** (< 900 px) : `Drawer` + `ListView` d'entrées de menu.

Les onglets visibles sont calculés à chaque rendu à partir de `AuthManager.userRights`, ce qui garantit qu'un changement de session est pris en compte sans rechargement.

### 8.3 Cycle de vie d'une page typique
1. `initState()` instancie les contrôleurs (recherche, scroll) et lance `_load()`.
2. `_load()` appelle un service, met `setState` quand la réponse arrive.
3. `dispose()` libère les `TextEditingController`/`ScrollController`/`FocusNode`.
4. Toute action asynchrone vérifie `if (!mounted) return;` avant de toucher `BuildContext` — c'est la convention rappelée en tête de plusieurs fichiers (`// ignore_for_file: use_build_context_synchronously`).

---

## 9. Module Devis (AMI v1.4)

### 9.1 Cycle de vie

```
   Mission                         ┌──► Rejeté ──► (Dupliquer)
       │                           │
       ▼                           │
  Brouillon ──► Envoyé ──► Accepté ────► Converti en facture
       │             │             │
       └──► (modif.) └──► Expiré ──┘ (lecture seule)
```

### 9.2 Règles métier (extraites des commentaires PHP `RM-01` à `RM-07`)
| Code | Règle |
|---|---|
| **RM-01** | Création d'un devis à partir d'une mission (pré-remplissage : client, ref, ligne unique fondée sur la langue du produit). |
| **RM-02** | Un seul devis actif (`draft` ou `sent`) par mission. Conflit 409 sinon. |
| **CT-09** | Une mission déjà facturée (présence dans `tble_client_billed`) interdit la création d'un nouveau devis (409 `MISSION_ALREADY_BILLED`). |
| **RM-04** | Mise à jour autorisée tant que le devis est `draft` ou `sent`. |
| **RM-07** | Conversion `accepted ⇒ accepted_converted` + création de la facture associée (numéro réservé, lignes recopiées). |

### 9.3 Calculs
Effectués côté Dart dans `Quote`/`QuoteLine` :
- `totalHt = unitPrice × quantity × (1 − discount/100)` arrondi à 2 décimales.
- `unitPriceTtc = unitPrice × (1 + tvaRate/100)`.
- `totalTtc = totalHt × (1 + tvaRate/100)`.
- TVA par défaut : 20 %.
- Le serveur stocke le `total_ht` calculé pour traçabilité ; le client le recalcule à l'affichage.

### 9.4 Génération PDF du devis
Centralisée dans `QuoteEditPage`. Utilise le package `pdf` pour produire un document A4 contenant en-tête (numéro, statut, dates), tableau des lignes (désignation, TVA %, P.U. HT, qty, total HT), totaux HT/TTC et notes. Sur Web, le téléchargement est délégué à `pdf_download_helper_web.dart` ; sur natif, à `printing` (impression, partage, enregistrement).

---

## 10. Module Facturation

### 10.1 Numérotation
Une **réservation** est demandée au serveur (`reserve_client_invoice_number.php`) avant l'écriture définitive afin de garantir l'unicité dans `tble_client_billed.invoice_number`. Le format suit une convention par client (préfixe + année + compteur incrémenté).

### 10.2 Statuts et transitions
| Statut | Suivant possible | Action UI |
|---|---|---|
| `draft` | `sent`, `cancelled` | Édition libre des lignes |
| `sent` | `paid`, `overdue`, `cancelled` | Édition limitée (RIB, échéance) |
| `paid` | `cancelled` (exceptionnel) | Lecture seule |
| `overdue` | `paid`, `cancelled` | Édition limitée |
| `cancelled` | — | Lecture seule, archive |

### 10.3 PDF facture
Construit côté client dans `BillingPage` à partir de `CompanyInfo` (en-tête entreprise), `CompanyBankAccount` (RIB sélectionné), lignes (`InvoiceLine`). Le PDF binaire est ensuite encodé en base64 et envoyé à `log_client_billing.php` pour archivage côté serveur (sous-dossier `Factures_PDF/`).

---

## 11. Référentiels et autocomplétion

- **Pays** (`get_countries.php`) et **départements** (`get_departments.php`) : cache mémoire local par page via un `Future` mémoïsé.
- **Langues** (`get_languages.php`) : autocomplétion paramétrable (`q`, `type`).
- **Clients** : composant `ClientAutocompleteField` qui combine un `TextEditingController`, un `FocusNode`, et un overlay de suggestions. Sélectionner un item appelle `onSummarySelected(ClientSummary)` (porteur de l'id numérique nécessaire pour la liaison).

---

## 12. Génération et téléchargement de fichiers

Le code utilise des **stubs conditionnels** :

```dart
import '../utils/pdf_download_helper_stub.dart'
    if (dart.library.html) '../utils/pdf_download_helper_web.dart';
```

- Sur Web : crée un `Blob` + `Anchor` HTML pour déclencher le téléchargement.
- Sur natif : enregistre le fichier dans le dossier temporaire et ouvre le partage système.

Cette technique est appliquée à la fois pour les PDF et pour les CSV produits par `ExportPage`.

---

## 13. Responsive design

`ResponsiveHelper` (dans `lib/core/`) fournit :

```
mobileMaxWidth      = 600
tabletMaxWidth      = 900
desktopMaxWidth     = 1200
largeDesktopMaxWidth = 1600
```

Et expose des helpers utilitaires : `getPagePadding`, `getSpacing`, `getDialogWidth`, `getGridColumns`, `getFontSize`, `getCardElevation`, `getBorderRadius`, plus un widget `ResponsiveBuilder` et un container `ResponsiveContainer` (largeur max 1400 px en desktop).

Toutes les pages métier consomment ces helpers pour adapter padding, nombre de colonnes et layout (`Row` desktop ⇒ `Column` mobile).

---

## 14. Thème graphique

Voir aussi le document UI/UX dédié.
- 3 thèmes : `bleuOfficiel` (Marianne, `#000091`/`#E1000F`), `ardoise` (`#1E3A5F`/`#2D9CDB`), `nuit` (`#1B3A8C`/`#0D1B47`) — actif par défaut.
- Police : **Marianne** (déclarée dans `pubspec.yaml` ; les fichiers `.ttf` doivent être présents dans `assets/fonts/`).
- Backgrounds : `bgLight = #F6F7FB`.
- Système basé sur **Material 3** (`useMaterial3: true`).

---

## 15. Journalisation, observabilité, diagnostic

| Source | Fichier | Contenu |
|---|---|---|
| PHP général | `api/api_error.log` | Erreurs PHP, warnings, exceptions |
| Création de factures | `api/billing_creation.log` | Une ligne JSON par étape (request_received, validations, écritures, PDF stockés) |
| WAMP | `C:\wamp64\logs\php_error.log` | Erreurs HTTP/serveur |
| Console Flutter | `flutter run` / DevTools | Erreurs front + logs développement |

Recommandé : rediriger `api/*.log` vers un agrégateur (ELK, Loki) en production, et masquer/supprimer les mots de passe et payloads sensibles (`pdf_base64` est déjà strippé dans le log billing).

---

## 16. Installation et démarrage (développeur)

### 16.1 Prérequis
- Flutter SDK ≥ 3.10 (Dart SDK fourni)
- WAMP (ou XAMPP/MAMP) avec Apache + PHP 8.0+ + MySQL 5.7+/MariaDB 10.4+
- Une base MySQL `dbs13098267` peuplée du schéma Dolibarr `llx_*` + extensions `tble_*` + `invoice_draft*`

### 16.2 Première utilisation
```bash
git clone <repo> ami
cd ami
flutter pub get
# Démarrer WAMP, importer le dump SQL
flutter run -d windows                # ou -d chrome, -d edge
```

### 16.3 Analyse statique et tests
```bash
flutter analyze
flutter test
```

### 16.4 Tests d'API manuels (cf. `README-UTILISATEUR.md`)
```bash
# JSON
curl -X POST http://localhost/gesplanet_01/ami/api/add_mission.php \
  -H "Content-Type: application/json" \
  -d '{"interpreter_id":1,"reference_devis":"R001","montant_mission":100}'

# Form-encoded
curl -X POST http://localhost/gesplanet_01/ami/api/add_mission.php \
  -d "interpreter_id=1&reference_devis=R001&montant_mission=100"
```

---

## 17. Maintenance et évolution

### 17.1 Backlog connu (cf. `docs/suivi-post-livraison-2026-04-17.md`)
- Page de gestion des **langues** (CRUD du référentiel `llx_product`).
- **Batch mensuel** déclenchable depuis l'UI pour générer toutes les factures clients du mois.
- **Envoi e-mail** des factures au client depuis l'UI (formulaire pré-rempli).
- Découpler les statuts FMI (Planifié/Terminé) du statut persisté de la mission AMI.
- Changement de statut groupé pour le suivi des factures interprètes.

### 17.2 Dette technique repérée
- Fichier `lib/pages/missions_page.dart.bak_20260104` à supprimer (sauvegarde historique).
- Routes commentées vers des écrans expérimentaux (`scrollbar_demo_page.dart`, `admin_mockup_preview.dart`) à isoler dans un build « debug only ».
- `BrandFooter` est aujourd'hui un `SizedBox.shrink()` — soit le retirer partout, soit lui redonner du contenu.
- Doublons d'imports possibles selon le commentaire « Problèmes d'UI après édition : vérifier les doublons d'importation ou classes multiples ».
- Logger Flutter à introduire (actuellement, plusieurs `// Debug logs removed for production cleanliness`).

### 17.3 Recommandations sécurité (prioritaires)
1. Auth serveur (JWT/session) et vérification du droit dans chaque endpoint PHP.
2. Restreindre `Access-Control-Allow-Origin` aux origines connues.
3. Supprimer les identifiants MySQL en dur (utiliser un `.env` PHP).
4. Renforcer la politique de mot de passe (`add_interprete.php`) — actuellement `lastname + 2026`.
5. Limiter les tailles de payload (PDF base64) et imposer du chunking si > N Mo.
6. Activer HTTPS partout (HSTS) et bloquer le HTTP en production.

### 17.4 Recommandations qualité
- Couvrir les services par des tests unitaires avec `http` mockable (`http_mock_adapter` ou interface injectable).
- Introduire un **state management** (Riverpod ou Bloc) pour réduire la verbosité des `setState` et faciliter le testing.
- Centraliser la gestion d'erreur HTTP dans un intercepteur unique (au lieu de répéter `try/catch + jsonDecode`).
- Versionner le schéma SQL via un outil de migration (Phinx, Doctrine Migrations).

---

## 18. Annexes

### 18.1 Liste complète des packages Dart utilisés
```yaml
dependencies:
  flutter_skill: ^0.2.6
  http: ^1.1.0
  intl: ^0.18.1
  crypto: ^3.0.3
  shared_preferences: ^2.1.0
  url_launcher: ^6.1.10
  cupertino_icons: ^1.0.6
  pdf: ^3.11.0
  printing: ^5.13.1
  web: ^1.1.0

dev_dependencies:
  flutter_test: { sdk: flutter }
  flutter_lints: ^6.0.0
```

### 18.2 Arborescence simplifiée du dépôt
```
ami/
├── android/  ios/  linux/  macos/  windows/  web/   ← runners plateformes
├── api/                                              ← back-end PHP
├── assets/                                           ← logo + config JSON
├── build/                                            ← artefacts (gitignored)
├── docs/                                             ← docs (DEPLOY_WEB, SQL_SUPPORT_GUIDE, ce fichier)
├── Factures_PDF/                                     ← PDF générés (prod)
├── lib/
│   ├── core/        (theme, config, auth, responsive, models transverses)
│   ├── models/      (entités métier)
│   ├── services/    (HTTP)
│   ├── screens/     (login, home, admin, export)
│   ├── pages/       (interprètes, missions, devis, facturation, tiers, entreprise)
│   ├── utils/       (téléchargement PDF)
│   └── widgets/     (composants réutilisables)
├── scripts/                                          ← MCP helper, outils
├── test/                                             ← tests Dart
├── pubspec.yaml
└── README.md / README-UTILISATEUR.md
```

### 18.3 Glossaire
| Terme | Définition |
|---|---|
| **AMI** | Assistance Missions Interprètes |
| **Mission** | Prestation d'interprétariat planifiée (date, durée, langue, demandeur) |
| **Devis** | Document prévisionnel adressé au client, convertible en facture |
| **Demandeur** | Contact (`llx_socpeople`) qui sollicite la mission pour une société cliente |
| **Tiers** | Société cliente (`llx_societe`) — donneur d'ordre |
| **Brouillon facture** | Agrégat éditable de plusieurs missions du même client/mois avant émission |
| **DSFR** | Design System de l'État Français (référence visuelle pour le thème `bleuOfficiel`) |
| **Marianne** | Police officielle de l'État Français |

### 18.4 Références
- `docs/SQL_SUPPORT_GUIDE.md` — liste exhaustive des requêtes SQL par endpoint.
- `docs/DEPLOY_WEB.md` — guide de build et déploiement web.
- `README-UTILISATEUR.md` — guide rapide utilisateur (version historique, complétée par `GUIDE_UTILISATEUR_AMI.md`).
- `docs/UI_UX_AMI.md` — charte graphique et audit UX.

---

*Document généré le 17 mai 2026 — à mettre à jour après chaque montée de version majeure ou ajout/suppression d'endpoint.*
