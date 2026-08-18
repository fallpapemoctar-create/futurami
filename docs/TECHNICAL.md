# Documentation technique — futurAMI

Résumé
------
Ce document décrit l'architecture, la configuration et les composants importants de l'application futurAMI (frontend React + backend PHP). Il vise les développeurs et administrateurs souhaitant déployer, maintenir ou étendre l'application.

Architecture
------------
- Frontend : React + TypeScript + Vite (dossier `src/`).
- Backend : PHP (APIs REST légères dans `api/`, accès PDO MySQL).
- Base de données : schéma Dolibarr (ex : `llx_user`, `llx_missionsplanet_mission`, etc.).

Points d'entrée clés
--------------------
- `api/config.php` : initialise l'environnement, la connexion PDO, et inclut `auth_helpers.php`. ([api/config.php](api/config.php))
- `api/auth_helpers.php` : gestion des tokens, lecture de `DOLIBARR_ENTITY`, fonctions `getConfiguredEntity()` et `require_auth()`. ([api/auth_helpers.php](api/auth_helpers.php))
- `api/login.php` : point de connexion (public) pour obtenir un token.
- Endpoints métier : plusieurs scripts PHP sous `api/` (ex. [api/get_missions_datatable.php](api/get_missions_datatable.php#L106-L123)).
- Frontend Admin : `src/app/components/AdminPage.tsx`, `src/app/components/EditUserModal.tsx`.

Gestion multi-entité (Dolibarr)
-----------------------------
- La valeur configurée pour l'entité Dolibarr est lue via `DOLIBARR_ENTITY` (SetEnv dans `.htaccess` ou `api/.env.local.php`). Voir `getConfiguredEntity()` dans `auth_helpers.php`.
- Les endpoints protègent l'accès via token ; `$currentEntity` est déterminé par la claim du token sauf pour les super-admins (`entity=0 && admin=1`) où on force `getConfiguredEntity()`.
- Les requêtes SQL appliquent systématiquement `:entity` (ex. `m.entity = :entity`), rendant le filtre dynamique pour toute entité configurée.

Configuration et secrets
------------------------
- Fichier local (non commité) : `api/.env.local.php` — contient `AUTH_SECRET`, `DOLIBARR_ENTITY`, `DB_*` (local|prod) et `APP_ENV`.
- `.htaccess` dans `api/` peut aussi définir `SetEnv DOLIBARR_ENTITY 2` et `SetEnv AUTH_SECRET ...` pour les déploiements Apache.
- `api/config.php` choisit les variables DB selon `APP_ENV` (`local` vs `prod`).

Déploiement local
-----------------
- Prérequis : WAMP/Apache + PHP 8.x, MySQL/MariaDB, Node.js (pour le frontend).
- Placer un fichier `api/.env.local.php` contenant au minimum :

```php
<?php
return [
    'APP_ENV' => 'local',
    'DOLIBARR_ENTITY' => '2',
    'AUTH_SECRET' => 'replace_with_a_secure_random_32+_chars',
    'DB_HOST_LOCAL' => 'localhost',
    'DB_NAME_LOCAL' => 'votre_db',
    'DB_USER_LOCAL' => 'root',
    'DB_PASS_LOCAL' => '',
];
```

- Démarrer le frontend (depuis la racine) : `npm run dev` ou `pnpm run dev` (Vite).
- S'assurer qu'Apache sert le dossier et que `api/config.php` peut contacter la base MySQL.

Sécurité & JWT-like tokens
-------------------------
- Les tokens sont signés HMAC-SHA256 via `AUTH_SECRET`. `issueAuthToken()` inclut `entity` et `admin` dans les claims.
- `require_auth()` vérifie la signature, l'expiration et la correspondance d'entité (sauf pour super-admins).

Points d'attention / Debug commun
--------------------------------
- Erreur MySQL de type `php_network_getaddresses` signifie que `APP_ENV` pointe vers `prod` et que le host distant n'est pas résolvable ; vérifier `api/.env.local.php` et `APP_ENV`.
- Si `AUTH_SECRET` manquant ou trop court, `auth_helpers.php` renvoie 500.
- Vérifier `api/api_error.log` et les logs Apache/PHP (`C:\wamp64\logs\...`) pour les traces.

Fichiers utiles (rapide)
-----------------------
- [api/config.php](api/config.php)
- [api/auth_helpers.php](api/auth_helpers.php)
- [api/login.php](api/login.php)
- [api/get_missions_datatable.php](api/get_missions_datatable.php#L106-L123)
- `src/app/components/AdminPage.tsx`
- `src/app/components/EditUserModal.tsx`

Annexes
------
Pour toute modification majeure (nouvelle entité, migration DB, rotation d'`AUTH_SECRET`), testez sur une copie locale de la base Dolibarr et procédez par sauvegardes régulières.
