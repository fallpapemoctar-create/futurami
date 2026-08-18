# futurAMI

Petit projet de gestion de missions (frontend React + backend PHP) compatible avec le schéma Dolibarr.

But
----
Fournir une interface pour gérer missions, clients et utilisateurs avec prise en charge multi-entité (colonne `entity` dans Dolibarr).

Ressources
---------
- Documentation technique : [docs/TECHNICAL.md](docs/TECHNICAL.md)
- Guide utilisateur : [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

Démarrage local (rapide)
------------------------
1. Installer les dépendances frontend :

```bash
# avec npm
npm install
# ou pnpm
pnpm install
```

2. Créer `api/.env.local.php` (voir `docs/TECHNICAL.md`) et renseigner `APP_ENV`, `DOLIBARR_ENTITY`, `AUTH_SECRET` et `DB_*` locaux.

3. Lancer le frontend (Vite) :

```bash
npm run dev
# ou pnpm run dev
```

4. Tester l'API login (exemple) :

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"login":"afall","password":"Senegal2024#"}' \
  http://localhost/futurAMI/api/login.php
```

Contribuer
---------
- Faites des branches de fonctionnalité et ouvrez des PR vers `master`.

Support
-------
Consultez les fichiers de documentation dans `docs/` ou contactez l'administrateur applicatif.

  # Améliorer maquette UX/UI

  This is a code bundle for Améliorer maquette UX/UI. The original project is available at https://www.figma.com/design/HvQz0xwkZolOIFo7HLCC25/Am%C3%A9liorer-maquette-UX-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  