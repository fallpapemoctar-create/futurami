# Guide utilisateur — futurAMI

Public visé
----------
Utilisateurs finaux (administrateurs, gestionnaires de missions, opérateurs) souhaitant utiliser l'application pour :
- Se connecter et gérer leur compte
- Gérer les utilisateurs (admin)
- Créer, consulter et filtrer des missions

Accès & Login
-------------
- URL d'accès : l'application frontend (Vite/production) sert l'interface utilisateur. L'API est située dans le dossier `api/`.
- Pour se connecter via l'API : envoyer une requête POST JSON vers `api/login.php` contenant `{ "login": "votre_login", "password": "votre_mot_de_passe" }`. Exemple (en local) :

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"votre_mdp"}' \
  http://localhost/futurAMI/api/login.php
```

- En cas d'erreur 500, vérifier la connexion à la base (voir `api/api_error.log`).

Administration des utilisateurs
------------------------------
- Accéder à : menu Administration → Utilisateurs.
- Pour modifier un utilisateur : cliquer sur "Éditer". Le modal permet de modifier : prénom, nom, email, login (username), mot de passe.
- Si vous changez le mot de passe via le modal, sauvegardez ; le backend `api/admin/update_user.php` mettra à jour `llx_user.pass_crypted` de façon sécurisée (hash PHP `password_hash`).

Gestion des missions
--------------------
- Liste des missions : utilisez la page Missions (datatable) pour rechercher, filtrer par statut, type et exporter.
- Filtre d'entité : les missions affichées sont automatiquement filtrées sur l'entité configurée du déploiement. Si vous avez des droits super-admin (entity=0 && admin=1), vous pouvez agir sur l'entité configurée.
- Colonnes importantes : référence, client, interprète, date, statut, durée.

Flux communs
------------
- Créer une mission : bouton "Nouvelle mission" → remplir les champs obligatoires → sauvegarder.
- Éditer une mission : ouvrir la ligne → modifier les champs date/durée/statut → sauvegarder.
- Supprimer une mission : l'application réalise une suppression logique (status = 9). Les missions soft-deleted n'apparaissent plus dans la datatable.

FAQ & dépannage rapide
----------------------
- Je ne peux pas me connecter : vérifiez vos identifiants et que l'API peut joindre la base MySQL. Si `APP_ENV` est mal configuré, le serveur peut tenter de joindre la DB distante (erreur `php_network_getaddresses`).
- Je ne vois pas certains utilisateurs : le listing est filtré par l'entité courante ; demandez à un super-admin de vérifier.
- Comment changer l'entité ciblée ? : configuration serveur (`api/.env.local.php` ou `api/.htaccess`) — contactez l'administrateur.

Contact & support
-----------------
Pour toute question opérationnelle ou création d'un compte administrateur, contacter l'administrateur applicatif ou la personne en charge de la plateforme.
