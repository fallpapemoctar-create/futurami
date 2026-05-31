# Document UI / UX — Application AMI

**Nom du produit :** AMI — Assistance Missions Interprètes
**Version :** 4.0.0
**Date :** 17 mai 2026
**Public visé :** designers, développeurs front-end, product owners, équipe qualité
**Source :** code Flutter (`lib/core/app_theme.dart`, `lib/core/app_text_styles.dart`, `lib/core/responsive_helper.dart`, ensemble des pages et écrans)

---

## Sommaire
1. [Principes directeurs](#1-principes-directeurs)
2. [Design system — Identité visuelle](#2-design-system--identité-visuelle)
3. [Design system — Composants](#3-design-system--composants)
4. [Design system — Layout & grille](#4-design-system--layout--grille)
5. [Design system — Iconographie et illustrations](#5-design-system--iconographie-et-illustrations)
6. [Patterns d'interaction](#6-patterns-dinteraction)
7. [Audit UX — Parcours utilisateurs](#7-audit-ux--parcours-utilisateurs)
8. [Audit UX — Points forts](#8-audit-ux--points-forts)
9. [Audit UX — Frictions identifiées](#9-audit-ux--frictions-identifiées)
10. [Recommandations priorisées](#10-recommandations-priorisées)
11. [Accessibilité (synthèse)](#11-accessibilité-synthèse)
12. [Roadmap UI/UX proposée](#12-roadmap-uiux-proposée)
13. [Annexe — Tokens à exporter](#13-annexe--tokens-à-exporter)

---

## 1. Principes directeurs

L'application AMI suit cinq principes que toute évolution de l'interface devrait préserver :

1. **Densité maîtrisée** — l'utilisateur cible passe sa journée sur l'outil ; les tableaux doivent afficher beaucoup d'information sans surcharge. Les tailles de typographie sont volontairement compactes (12–13 px pour le corps, 11 px pour les badges).
2. **Familiarité administrative française** — inspiration **DSFR** (Design System de l'État) : palette bleu/rouge Marianne, typographie Marianne, scrollbars « tube » bleues, sobriété visuelle.
3. **Lisibilité avant flatterie** — peu d'ombres portées, pas de dégradés sur les composants opérationnels (uniquement sur l'écran de connexion), bordures fines (1 px) plutôt qu'élévation.
4. **Cohérence multi-plateforme** — la même interface fonctionne sur Web (cible principale), Windows, mobile, sans repenser le parcours.
5. **Droits visibles** — la barre supérieure et les boutons d'action s'adaptent au rôle de l'utilisateur ; on ne voit jamais une action interdite.

---

## 2. Design system — Identité visuelle

### 2.1 Thèmes
Trois thèmes sont définis dans `lib/core/app_theme.dart` et interchangeables via la constante `kActiveTheme` :

| Thème | Primaire | Secondaire | Gradient (login) | Usage |
|---|---|---|---|---|
| `bleuOfficiel` | `#000091` (Bleu Marianne) | `#E1000F` (Rouge Marianne) | `#000091 → #0010C8` | Variante DSFR « administration » |
| `ardoise` | `#1E3A5F` | `#2D9CDB` | `#1E3A5F → #2D6A9F` | Variante chaleureuse / professionnelle |
| `nuit` | `#1B3A8C` | `#0D1B47` | `#0D1B47 → #1B3A8C` | **Thème actif par défaut** — sobre, business |

### 2.2 Couleurs communes
| Token | Hex | Usage |
|---|---|---|
| `surfaceWhite` | `#FFFFFF` | Cartes, barres, dialogues |
| `bgLight` | `#F6F7FB` | Fond de page |
| `border` | `#E5E7EB` | Bordures de cartes, divisions |
| `textPrimary` | `#161616` | Texte principal |
| `textSecondary` | `#6B7280` | Texte secondaire, métadonnées |
| `errorRed` | `#E1000F` | Erreurs, statuts critiques |

### 2.3 Couleurs sémantiques (statuts)
Ces couleurs sont définies inline dans les écrans (à externaliser, cf. recommandations) :

| Statut | Couleur texte | Couleur fond | Hex |
|---|---|---|---|
| Brouillon | `#6B7280` (gris) | `#F1F5F9` | gris neutre |
| Envoyé / Information | `#1D4ED8` (bleu) | `#DBEAFE` | bleu |
| Accepté / Payé / Succès | `#15803D` (vert) | `#DCFCE7` | vert |
| Rejeté / Erreur | `#B91C1C` (rouge) | `#FEE2E2` | rouge |
| Expiré / Attention | `#D97706` (orange) | `#FEF3C7` | orange |
| Converti / Spécial | `#6D28D9` (violet) | `#EDE9FE` | violet |
| Verrou / En attente | `#92400E` (ambre foncé) | `#FEF3C7` | ambre |
| Validé / Mise en avant | `#000091` | `#E8EEFF` | bleu Marianne |

### 2.4 Typographie
Police principale : **Marianne** (`fontFamily: 'Marianne'`). Fallback : police système.

Échelle définie dans `lib/core/app_text_styles.dart` :

| Style | Taille | Poids | Couleur | Usage |
|---|---|---|---|---|
| `body` | 13 px | 400 | `#161616` | Corps de texte général |
| `bodySmall` | 12 px | 400 | `#6B7280` | Métadonnées, helpers de formulaire |
| `tableCell` | 12 px | 400 | `#0F172A` | Cellules de tableau |
| `tableHeader` | 12 px | 600 | `#374151` | En-têtes de colonnes |
| `fieldLabel` | 12 px | 600 | `#374151` | Étiquettes de champ |
| `fieldValue` | 12 px | 500 | `#374151` | Valeurs en lecture seule |
| `menuItem` | 13 px | 400 | `#161616` | Onglets, items de menu |
| `menuItemActive` | 13 px | 700 | `#000091` | Onglet sélectionné |
| `subTitle` | 13 px | 600 | `#374151` | Sous-titres |
| `sectionTitle` | 15 px | 700 | `#161616` | Titres de section |
| `pageTitle` | 18 px | 700 | `#161616` | Titres de page |
| `totalMain` | 14 px | 700 | `#000091` | Totaux HT |
| `totalFullscreen` | 16 px | 700 | `#000091` | Totaux HT en pleine page |
| `totalTtc` | 14 px | 700 | `#1D4ED8` | Totaux TTC |
| `totalTtcFullscreen` | 16 px | 700 | `#1D4ED8` | Totaux TTC en pleine page |
| `badge` | 11 px | 700 | (variable) | Pastilles de statut |

> **Observation** : la grille typographique est dense et bien rationalisée. Elle se distingue d'une stack web classique (Tailwind par exemple) par des tailles plus petites — ce qui convient à un outil métier, mais demande vigilance côté accessibilité (cf. § 11).

### 2.5 Élévation et effets
- **Cartes** : `elevation: 0`, bordure 1 px `#E5E7EB`, rayon 10 px. Pas d'ombre.
- **Boutons** : `elevation: 0`, rayon 7 px.
- **Barre supérieure** : `elevation: 0` + `shadowColor: Colors.black12` + ligne de 1 px en bas (`#DDDDDD`).
- **Boîtes de dialogue** : ombre Material 3 standard.
- **Tooltips** : fond `#1F2937`, texte blanc 11 px, rayon 5 px.

### 2.6 Rayons (border-radius)
| Élément | Rayon |
|---|---|
| Boutons (tous) | 7 px |
| Champs (`InputDecoration`) | 7 px |
| Cartes | 10 px |
| Chips (statuts) | 999 px (pill) ou 20 px |
| Tooltips | 5 px |
| Popups menu | 8 px |
| Tab indicator | 10 px |
| Dialogues sur mobile | 8 px (`ResponsiveHelper.getBorderRadius`) |
| Dialogues sur desktop | 12 px |
| Hero login logo | 18 px |

### 2.7 Espacement
Pas de système strict (4/8/12/16/24 implicite). `ResponsiveHelper.getSpacing` retourne 8 / 12 / 16 selon mobile / tablet / desktop. Padding de page : 12 / 20 / 24 px.

---

## 3. Design system — Composants

### 3.1 Boutons

**ElevatedButton / FilledButton (action primaire)**
- Fond : couleur primaire du thème
- Texte : blanc, 13 px, semi-bold 600
- Hauteur min : 40 px ; padding 20 × 10
- Rayon : 7 px
- Pas d'ombre

**OutlinedButton (action secondaire)**
- Bordure : 1 px couleur primaire
- Texte : couleur primaire, 13 px, 600
- Hauteur min : 38 px ; padding 16 × 9

**TextButton (action tertiaire / navigation discrète)**
- Texte : couleur primaire, 13 px, 500
- Hauteur min : 36 px

**Bouton vert (call-to-action spécial)** — non standardisé dans le thème, codé inline dans `QuoteEditPage` pour « Créer la facture ». À promouvoir comme variante `success`.

### 3.2 Champs de formulaire (`InputDecoration`)
- Fond : `#F9FAFB`
- Bordure : 1 px `#E5E7EB` (normal), 2 px couleur primaire (focus)
- Padding : 12 × 9
- Rayon : 7 px
- Label : `fieldLabel` (12 px, 600, gris foncé)
- Hint : `bodySmall` (12 px, gris moyen)
- Erreur : 11 px (très compact — à porter à 12 px pour lisibilité)

### 3.3 Tableaux (`DataTable`)
- En-tête : fond `#F1F5F9`, texte `tableHeader` (12 px, 600)
- Lignes : hauteur 36–44 px, texte `tableCell` (12 px)
- Espacement entre colonnes : 16 px ; marge horizontale 12 px
- Divisions : 1 px

### 3.4 Onglets (`TabBar`)
- Texte actif : couleur primaire, 13 px, 700
- Texte inactif : `#6B7280`, 13 px, 400
- Indicateur : fond couleur primaire à 8 % d'opacité + barre 2,5 px en bas, rayon 8 px
- Pas de séparateur sous les onglets (`dividerColor: transparent`)

### 3.5 Chips (statuts, filtres)
- Fond : `#F1F5F9` (normal) ou couleur primaire à 12 % (sélectionné)
- Bordure : 1 px `#E5E7EB`
- Texte : 12 px, 500
- Padding : 8 × 2
- Rayon : 20 px (très arrondi, presque pill)

**Variante badge de statut** (`AppTextStyles.badge`, 11 px, 700) : pill avec fond clair + texte foncé selon couleur sémantique (cf. § 2.3).

### 3.6 Cases à cocher
- Cocher = couleur primaire ; check blanc
- Non coché = bordure `#CFCFD3` 1,5 px
- Compact (`shrinkWrap`, `VisualDensity.compact`)
- Rayon 3 px

### 3.7 Dialogues
- Largeur adaptative : 95 % en mobile, 70 % en tablet, 600 px (desktop < 1200 px), 700 px (large desktop)
- Padding intérieur cohérent avec les pages
- Boutons en pied de dialogue (texte tertiaire à gauche, primaire à droite)

### 3.8 Popups menu
- Fond blanc, bordure 1 px `#E5E7EB`, élévation 4, rayon 8 px
- Items : `AppTextStyles.body`

### 3.9 Tooltips
- Fond `#1F2937` (gris très foncé), texte blanc 11 px
- Délai d'affichage : 400 ms
- Padding 10 × 5, rayon 5 px

### 3.10 Scrollbars (composant maison `CustomScrollbar` — v2 mai 2026)
**Style par défaut — natif sobre :**
- Toujours visibles (`thumbVisibility: true`, `trackVisibility: true`)
- Pouce : `#BFC4CC` (gris moyen) au repos · `#8A909A` au **survol** · `#6B7280` pendant le **drag**
- Piste : `#F1F2F4` (gris très clair)
- Épaisseur : **8 px** (9 px sur mobile pour la cible tactile)
- Rayon de coin : **4 px**
- Longueur minimale du pouce : 48 px
- Interactif (`interactive: true`) — cliquer la piste fait sauter le pouce

Le style est appliqué à deux niveaux pour couvrir tous les usages :
1. **`ScrollbarThemeData`** dans `AmiTheme.of(...)` — propage à tous les `Scrollbar` natifs Flutter.
2. **`CustomScrollbar` / `DsfrScrollbar`** (alias) dans `lib/core/custom_scrollbar.dart` — pour les pages qui passent un `ScrollController` explicite.

**Variantes nommées disponibles :**
- `NativeScrollbar` — alias documentaire du nouveau style sobre (à privilégier pour clarifier l'intention).
- `DsfrScrollbar` — alias rétro-compatible, désormais **identique au style sobre par défaut**.
- `DsfrScrollbarGray` — équivalent (compat).
- `DsfrScrollbarLegacy` — ancien style bleu DSFR `#000091` (12 px, rayon 6), réservé aux cas exceptionnels où l'on veut un accent marqué.
- `DsfrScrollbarRed` — ancien style rouge Marianne `#E1000F`, idem cas exceptionnels.

> **Rationale UX** : sur une session longue avec de larges tableaux, une scrollbar bleue épaisse capte le regard et fatigue. Le style natif gris s'efface au profit du contenu tout en restant repérable. Au survol/drag, il devient plus contrasté pour confirmer l'interaction.

### 3.11 Barre supérieure (AppBar)
- Hauteur 68 px (custom dans HomePage)
- Fond blanc, élévation 0, séparation par ligne 1 px `#DDDDDD`
- Logo 34 × 34 px à gauche
- Titre « AMI – Assistance missions interprètes » 15 px, 700
- TabBar centrale (scrollable si nécessaire)
- Nom utilisateur + bouton déconnexion à droite (icône 20 px, fond gris clair, target 44 × 44 — bonne pratique tactile)

### 3.12 Drawer (mobile)
- Liste verticale d'items, mêmes libellés que les onglets desktop
- Item actif mis en évidence via `menuItemActive`

---

## 4. Design system — Layout & grille

### 4.1 Breakpoints (`ResponsiveHelper`)
```
mobile          : < 600 px
tablet          : 600–900 px
desktop         : 900–1200 px
desktop (large) : 1200–1600 px
xl desktop      : ≥ 1600 px
```

### 4.2 Largeur maximale
Container responsif limité à **1400 px** en desktop (`ResponsiveContainer`). Au-delà, les marges latérales s'ajustent automatiquement, ce qui évite des lignes de tableau interminables sur écrans 4K.

### 4.3 Padding de page
| Palier | Padding |
|---|---|
| Mobile | 12 px |
| Tablet | 20 px |
| Desktop | 24 px |

### 4.4 Grille
La grille n'est pas formalisée ; les pages utilisent `Row` / `Column` / `Wrap` directement. Pour les vues « maître ↔ détail » (interprète + missions, société + contacts), une disposition en **deux colonnes** est privilégiée en desktop (ratio 38 / 62 sur l'écran de connexion, plus libre sur les autres pages).

### 4.5 Layout login (référence visuelle)
- **Desktop (≥ 900 px)** : split-screen 38 % gauche / 62 % droite.
  - Gauche : panneau « hero » avec gradient du thème, logo 80 × 80 px sur fond blanc + ombre, titre « AMI » 32 px / 800, sous-titre 14 px, 3 badges fonctionnels.
  - Droite : formulaire en carte centrale, largeur max 400 px, padding 64 × 40.
- **Mobile (< 900 px)** : layout vertical, header gradient compact, formulaire dessous.

---

## 5. Design system — Iconographie et illustrations

### 5.1 Icônes
- Famille : **Material Icons** (filled + outlined) via `MaterialIcons-Regular.otf`.
- Compléments : **Cupertino Icons** pour les widgets iOS.
- Taille standard : 20 px (boutons icon, tooltips).
- Couleur : couleur primaire pour les actions, gris pour les états neutres.

### 5.2 Logo
- Asset : `assets/logo.png` (PNG, fond transparent recommandé).
- Affichage : carré sans déformation (`BoxFit.contain`).
- Fallback (`errorBuilder`) : carré bordé bleu avec initiales « RF » en 12 px / 700, lettres espacées 1,2.

### 5.3 Illustrations
Aucune illustration / image décorative au-delà du logo et des gradients du panneau de login. Le ton est volontairement administratif.

---

## 6. Patterns d'interaction

### 6.1 Feedback utilisateur
- **SnackBar** pour les confirmations / erreurs non bloquantes (« Interprète créé », « Erreur de connexion »).
- **Dialogues** pour les confirmations destructives (suppressions).
- **CircularProgressIndicator** pour les états de chargement.
- **Indicateur de busy** via `_busy` (booléen d'état) qui désactive le formulaire pendant l'envoi.

### 6.2 Validation des formulaires
- **Synchronisation côté client** (`Form` + `_formKey.currentState.validate()`).
- Messages d'erreur sous le champ (11 px) — **à agrandir** (cf. accessibilité).
- Le bouton primaire reste cliquable en cas d'erreur (la validation s'exécute au clic, pas en live).

### 6.3 Navigation
- **Onglets** en desktop, **Drawer** en mobile (pattern adaptatif standard Material).
- **Routes nommées** dans `MaterialApp.routes` pour les deep links (`/missions-table`, `/admin`, etc.).
- **Push** classique pour les écrans détaillés (édition de devis, fiche interprète).

### 6.4 Autocomplétion
Le composant `ClientAutocompleteField` est le pattern de référence :
- champ texte + débounce sur la frappe,
- overlay de suggestions (max 8 items) avec mise en évidence du texte saisi,
- sélection au clic OU à `Entrée`,
- callback dédié `onSummarySelected` qui transmet l'objet complet (utile pour récupérer l'id numérique).

### 6.5 Tableaux
- **Sticky header** (en-tête figée lors du scroll).
- **Pagination** classique (taille de page configurable 25/50/100, flèches précédent/suivant).
- **Filtres en haut** sous forme de chips/dropdowns.
- **Actions par ligne** : icônes en fin de ligne (✏️, 🗑, 📋).

### 6.6 Génération PDF
Pattern « générer + télécharger en un clic » :
1. Bouton **PDF** dans l'AppBar de l'écran d'édition.
2. État `_generatingPdf = true` désactive le bouton et affiche un spinner inline.
3. Une fois le PDF prêt, déclenchement automatique du téléchargement (web) ou de la boîte d'impression/partage (natif).

---

## 7. Audit UX — Parcours utilisateurs

### 7.1 Persona 1 — Aïcha, Gestionnaire missions
**Objectifs** : créer la mission d'un client habitué, générer le devis, l'envoyer, suivre l'acceptation, facturer.

**Parcours observé** :
```
Login (10s) → Onglet Missions → + Nouvelle mission (20s)
   → Saisie client (autocomplétion ✓) → Contact (autocomplétion ✓)
   → Langue (autocomplétion ✓) → Interprète (autocomplétion ✓)
   → Date / heure / durée (sélecteur calendrier ✓)
   → Référence / Type / Commentaires
   → Enregistrer (1 clic)
→ 📋 Devis (sur la ligne) → Devis brouillon ouvert pré-rempli (✓)
   → Ajustement de ligne (P.U., TVA) → Sauvegarder
   → PDF (téléchargement direct) → Envoi mail externe
   → Retour devis → Marquer envoyé → … → Marquer accepté
   → Créer la facture (bouton vert) → Numéro réservé → PDF auto archivé
```

**Forces** : workflow naturel, autocomplétion partout, peu de saisie redondante.
**Points de friction** : envoi e-mail manuel (sortir de l'app), doublons potentiels de cliquer sur 📋 Devis si on a oublié qu'un devis existait déjà (ouverture transparente, mais sans message d'information).

### 7.2 Persona 2 — Marc, Administrateur
**Objectifs** : ajouter un nouvel interprète, lui attribuer ses droits, suivre l'activité du cabinet.

**Parcours observé** :
```
Login → Admin → Tableau de bord (4 KPI) → Liste utilisateurs
→ + Nouvel utilisateur → Saisie identité + rôles → Mot de passe → Enregistrer
→ Onglet Interprètes → + Ajouter interprète (s'il faut créer la fiche métier)
→ Onglet Export → Export CSV interprètes / missions
```

**Forces** : tableau de bord compact, gestion des rôles par cases à cocher (très clair).
**Points de friction** : pas de **lien direct** entre la création d'un utilisateur « interprète » et la création de la fiche interprète associée (potentielles doublures). Pas de **journal d'audit** des actions admin.

### 7.3 Persona 3 — Anne, Comptable
**Objectifs** : suivre les factures impayées, relancer les clients, marquer les paiements.

**Parcours observé** :
```
Login → Facturation → Filtre statut = En retard
→ Liste paginée → Ouverture facture → Bloc Pilotage → Statut Payée
→ Sauvegarder
```

**Forces** : filtres efficaces, vue 2 colonnes facture/pilotage très claire.
**Points de friction** : **pas de vue agrégée des montants en attente** (total dû, total payé sur la période). À ajouter en pied de liste.

### 7.4 Persona 4 — Sami, Interprète (lecture seule)
**Objectifs** : consulter ses missions à venir, vérifier les coordonnées du demandeur.

**Parcours observé** :
- Connexion → écran restreint à ses propres missions.
- **Frictions notables** : actuellement le rôle « interprète » dans `UserRights` est défini, mais l'application ne propose pas (encore) d'écran dédié — l'interprète voit potentiellement l'onglet Missions vide ou le drawer mobile sans entrée. **Voir recommandations.**

---

## 8. Audit UX — Points forts

✅ **Cohérence visuelle excellente** — palette restreinte, typographie centralisée, composants stylés au niveau du `ThemeData`. Très peu de styles inline orphelins.

✅ **Densité bien dosée** — 12–13 px de corps, lignes de tableau à 36 px : adapté à des sessions longues sans fatigue oculaire excessive.

✅ **Responsive bien pensé** — `ResponsiveHelper` est appliqué partout, et la décision « TabBar desktop / Drawer mobile » est prise au niveau de la HomePage de manière non ambigüe.

✅ **Autocomplétions partout** — clients, contacts, langues, interprètes, pays : le composant `ClientAutocompleteField` (et ses variantes) fluidifie énormément la saisie.

✅ **Statuts colorés et systématiques** — les chips de statut sont visuellement immédiats (vert = OK, rouge = problème, etc.).

✅ **Droits invisibles** — un utilisateur ne voit jamais une fonction qu'il ne peut pas faire. Pas de message « accès refusé » frustrant.

✅ **Scrollbars personnalisées** — toujours visibles, claires, dimensionnées en fonction de la taille de l'écran. Bon pour la découvrabilité.

✅ **Bouton de déconnexion tactile** — cible 44 × 44 px, tooltip, position cohérente. Très bonne pratique mobile.

✅ **Adaptation gracieuse aux APIs hétérogènes** — les modèles tolèrent plusieurs nommages (`Nom`/`nom`/`lastname`) sans casser le rendu. Invisible côté utilisateur mais participe à la robustesse perçue.

✅ **Page de login soignée** — gradient hero + badges fonctionnels = excellente première impression.

---

## 9. Audit UX — Frictions identifiées

### 9.1 Critiques (impact élevé)

🟥 **Écran interprète absent ou incomplet** — le rôle `interprete` est défini côté droits, mais il n'y a pas d'écran dédié à un interprète qui se connecte pour consulter ses missions. Cette population utilise potentiellement l'app de façon dégradée.

🟥 **Pas de message explicite lors d'un conflit Devis** — quand on clique sur 📋 sur une mission qui a déjà un devis actif, l'app ouvre transparente le devis existant. C'est élégant mais l'utilisateur peut être désorienté (« j'ai cliqué sur Nouveau, pourquoi c'est rempli ? »). Afficher une bannière en haut du devis : « Ce devis existe déjà depuis le … ».

🟥 **Pas de barre de progression / d'avancement** sur les opérations longues (export CSV de 5000 missions, génération de PDF lourd, archivage). Aujourd'hui c'est un spinner indéfini.

🟥 **Pas d'avertissement avant fermeture si des modifications non sauvegardées** — un clic sur un autre onglet ou un retour navigateur peut faire perdre les saisies.

### 9.2 Importantes (impact moyen)

🟧 **Étiquettes parfois techniques** — exemples : « Renvoyée au collaborateur » (peu clair pour un nouveau), « Brouillon » de devis et « Brouillon » de facture peuvent prêter à confusion.

🟧 **Pas de fil d'Ariane** dans les écrans détaillés (devis, facture). En cas de navigation profonde, l'utilisateur perd le contexte.

🟧 **Messages d'erreur génériques** — beaucoup d'erreurs renvoient un `Exception('Erreur')` ou « Erreur serveur » sans détail actionnable.

🟧 **Pas d'état vide pédagogique** — une liste vide affiche un message neutre. Un « état vide » avec illustration + CTA « Créer votre premier interprète » améliorerait l'onboarding.

🟧 **Confirmation de suppression trop simple** — un seul clic « Confirmer » sans rappel du nom de l'élément supprimé est risqué pour les actions destructives. Préférer une confirmation typographique (« tapez le nom pour confirmer ») sur les suppressions de clients.

🟧 **Pas de raccourcis clavier documentés** — `Entrée` valide, `Échap` ferme, mais cela n'est mentionné nulle part.

🟧 **Le `BrandFooter` est vide** (`SizedBox.shrink()`) — incohérence : soit on retire l'invocation partout, soit on lui redonne du contenu (mentions légales, version, n° de support).

### 9.3 Mineures (polish)

🟨 **Champ erreur trop petit** (11 px) — risque d'oublier qu'il y a une erreur.

🟨 **Hauteur de ligne de tableau variable** (36 → 44 px) peut produire un effet d'irrégularité.

🟨 **Pas d'indicateur de tri visible** sur les en-têtes de colonnes triables.

🟨 **Pas d'option de réorganisation/persistance des colonnes** pour les utilisateurs avancés.

🟨 **Pas de thème sombre** — le code est prêt (Material 3 + 3 thèmes), un `darkMode` serait un ajout naturel.

🟨 **Mot de passe par défaut faible** (`Nom + 2026`) — visible pour un humain qui connaît le pattern.

🟨 **Footer marque vide alors qu'invoqué dans 6+ pages** : signal sonore de dette technique.

---

## 10. Recommandations priorisées

### Priorité 1 — À traiter rapidement

1. **Construire un écran « Mes missions »** dédié au rôle `interprete` (liste filtrée par `nominterprete = userId`, lecture seule, export PDF de son planning).
2. **Bannière contextuelle de devis** : « Ce devis a été créé le … et est actuellement en statut … » lorsqu'on rouvre un devis existant via 📋.
3. **Garde de modifications non sauvegardées** : `WillPopScope` + dialogue « Quitter sans enregistrer ? » sur toutes les pages d'édition.
4. **Améliorer la politique de mots de passe** des interprètes : génération aléatoire 12 caractères + envoi par e-mail au lieu de `Nom + 2026`.
5. **Externaliser les couleurs sémantiques** dans `AppColors.statusXxx` (aujourd'hui éparpillées en hex inline dans les pages). Une seule source de vérité.

### Priorité 2 — Court terme

6. **Standardiser un composant `StatusChip`** consommant un enum `StatusType` et affichant la bonne couleur/libellé.
7. **Ajouter un fil d'Ariane** (composant `AmiBreadcrumb`) en haut des pages secondaires (devis, facture, fiche interprète).
8. **Composant `EmptyState`** réutilisable (icône + titre + sous-titre + CTA principal).
9. **Composant `DataTableHeader`** unifié avec indicateur de tri (flèche haut/bas) sur les en-têtes triables.
10. **Total agrégé en pied de liste** facturation (Σ HT, Σ TTC, Σ Dû, Σ Payé).
11. **Messages d'erreur enrichis** : afficher le code HTTP + suggestion d'action (« Vérifiez votre connexion », « Contactez l'admin »).
12. **Confirmation typographique** pour les suppressions sensibles (sociétés, utilisateurs).

### Priorité 3 — Moyen terme

13. **Mode sombre** complet (déclinaison de `AmiTheme` avec `Brightness.dark`).
14. **Persistance des préférences utilisateur** (taille de page, colonnes affichées, dernier onglet ouvert) dans `SharedPreferences`.
15. **Onboarding interactif** pour les nouveaux utilisateurs (tooltips séquentiels au premier login).
16. **Centre de notifications** in-app : devis acceptés, factures impayées, missions sans interprète assigné.
17. **Skeleton loaders** plutôt que spinners (perception de performance améliorée).
18. **Tests d'accessibilité** automatisés (Axe / `flutter_test` semantics).

---

## 11. Accessibilité (synthèse)

### 11.1 Contrastes
| Couple texte / fond | Ratio approx. | WCAG 2.1 AA (4.5:1) |
|---|---|---|
| `#161616` sur `#FFFFFF` | 18 : 1 | ✅ |
| `#161616` sur `#F6F7FB` | 16 : 1 | ✅ |
| `#6B7280` sur `#FFFFFF` | 4,7 : 1 | ✅ (limite) |
| `#000091` sur `#FFFFFF` | 13 : 1 | ✅ |
| `#FFFFFF` sur `#000091` | 13 : 1 | ✅ |
| `#FFFFFF` sur `#1B3A8C` (thème nuit) | 9 : 1 | ✅ |
| `#92400E` sur `#FEF3C7` (badge attention) | 5,4 : 1 | ✅ |
| `#D97706` sur `#FEF3C7` | 2,8 : 1 | ❌ (à ajuster) |
| Erreur 11 px | n/a | ⚠ (taille trop petite) |

### 11.2 Cibles tactiles
- Boutons primaires : 40 px de hauteur → ✅ (recommandation WCAG : 44 × 44).
- Boutons icon : `IconButton` 44 × 44 → ✅.
- Cases à cocher compactes : risque sous mobile → à vérifier sur petit écran.

### 11.3 Sémantique
- Pas d'attribution explicite de `Semantics` dans les écrans audités → les lecteurs d'écran liront les libellés visibles mais pas de descriptifs longs.
- Recommandation : envelopper les badges de statut dans `Semantics(label: 'Statut accepté')`.

### 11.4 Navigation clavier
- Les `TextField` reçoivent le focus correctement (utilisation de `FocusNode`).
- Les `TabBar` sont accessibles au clavier.
- Les boutons icon doivent avoir un `tooltip` (déjà fait pour Déconnexion — à généraliser).

### 11.5 Préférences système
- Tailles de texte système non honorées (`textScaleFactor` non testé).
- Mode sombre non géré.

---

## 12. Roadmap UI/UX proposée

| Trimestre | Livrable | Effort |
|---|---|---|
| Q1 | Écran interprète, bannière conflit devis, garde modifications non sauvegardées | M |
| Q1 | Externalisation couleurs sémantiques + `StatusChip` réutilisable | S |
| Q2 | Fil d'Ariane, `EmptyState`, indicateurs de tri | M |
| Q2 | Total agrégé facturation, messages d'erreur enrichis | S |
| Q3 | Mode sombre, persistance préférences | M |
| Q3 | Onboarding interactif | M |
| Q4 | Skeleton loaders, centre de notifications | L |
| Q4 | Audit accessibilité complet + corrections | L |

*S = Small (1-3 jours), M = Medium (1-2 semaines), L = Large (1 mois+)*

---

## 13. Annexe — Tokens à exporter

Pour faciliter une future intégration dans Figma / un design system formel, voici les **tokens** à extraire en JSON :

```json
{
  "color": {
    "brand": {
      "primary":    "#1B3A8C",
      "primaryAlt": "#0D1B47",
      "marianne":   "#000091",
      "rouge":      "#E1000F"
    },
    "surface": {
      "white":   "#FFFFFF",
      "page":    "#F6F7FB",
      "subtle":  "#F9FAFB",
      "muted":   "#F1F5F9"
    },
    "border": {
      "default": "#E5E7EB",
      "strong":  "#CFCFD3"
    },
    "text": {
      "primary":   "#161616",
      "secondary": "#6B7280",
      "tertiary":  "#374151",
      "muted":     "#0F172A"
    },
    "status": {
      "draftText":   "#6B7280",   "draftBg":   "#F1F5F9",
      "sentText":    "#1D4ED8",   "sentBg":    "#DBEAFE",
      "successText": "#15803D",   "successBg": "#DCFCE7",
      "errorText":   "#B91C1C",   "errorBg":   "#FEE2E2",
      "warningText": "#92400E",   "warningBg": "#FEF3C7",
      "specialText": "#6D28D9",   "specialBg": "#EDE9FE"
    }
  },
  "type": {
    "family": "Marianne",
    "scale": {
      "bodyS":  { "size": 12, "weight": 400 },
      "body":   { "size": 13, "weight": 400 },
      "label":  { "size": 12, "weight": 600 },
      "menu":   { "size": 13, "weight": 400 },
      "menuOn": { "size": 13, "weight": 700 },
      "subT":   { "size": 13, "weight": 600 },
      "sectT":  { "size": 15, "weight": 700 },
      "pageT":  { "size": 18, "weight": 700 },
      "badge":  { "size": 11, "weight": 700 }
    }
  },
  "radius": {
    "input":  7,
    "button": 7,
    "card":   10,
    "chip":   20,
    "pill":   999,
    "popup":  8,
    "tooltip": 5
  },
  "spacing": {
    "xs": 4, "s": 8, "m": 12, "l": 16, "xl": 24, "xxl": 32
  },
  "breakpoint": {
    "mobile":  600,
    "tablet":  900,
    "desktop": 1200,
    "largeDt": 1600
  },
  "elevation": {
    "card":    0,
    "tooltip": 4,
    "menu":    4
  }
}
```

---

## Synthèse

L'interface d'AMI repose sur des fondations solides : une **palette restreinte et professionnelle** inspirée du DSFR, une **typographie compacte mais lisible**, et un **système de composants cohérent** orchestré par `AmiTheme`. La couverture responsive est bonne, l'expérience de saisie est fluidifiée par des autocomplétions partout, et les droits utilisateurs sont reflétés dans l'interface de manière transparente.

Les axes d'amélioration prioritaires concernent :
- la **prise en charge complète du rôle interprète**,
- la **prévention des pertes de saisie** et la **clarification des conflits métier** (notamment Devis),
- l'**externalisation des couleurs sémantiques** pour faciliter la maintenance,
- la **lisibilité des messages d'erreur** et la **politique de mots de passe**.

Une fois ces points adressés, AMI aura tous les atouts d'un outil métier mature, sobre et accessible.

---

*Document généré le 17 mai 2026. Pour les fondations techniques : voir `DOC_TECHNIQUE_AMI.md`. Pour l'utilisation au quotidien : voir `GUIDE_UTILISATEUR_AMI.md`.*
