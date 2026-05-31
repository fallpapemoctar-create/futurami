# Guide utilisateur — Application AMI

**Nom du produit :** AMI — Assistance Missions Interprètes
**Version :** 4.0.0
**Date :** 17 mai 2026
**Public visé :** administrateurs, gestionnaires d'interprètes, gestionnaires de missions, interprètes

---

## Sommaire
1. [Bienvenue dans AMI](#1-bienvenue-dans-ami)
2. [Premiers pas](#2-premiers-pas)
3. [Vue d'ensemble de l'interface](#3-vue-densemble-de-linterface)
4. [Gestion des interprètes](#4-gestion-des-interprètes)
5. [Gestion des missions](#5-gestion-des-missions)
6. [Module Devis](#6-module-devis)
7. [Module Facturation](#7-module-facturation)
8. [Gestion des tiers (sociétés clientes et contacts)](#8-gestion-des-tiers)
9. [Informations entreprise](#9-informations-entreprise)
10. [Administration des utilisateurs](#10-administration-des-utilisateurs)
11. [Exports](#11-exports)
12. [Profils et droits](#12-profils-et-droits)
13. [Conseils d'utilisation au quotidien](#13-conseils-dutilisation-au-quotidien)
14. [Foire aux questions](#14-foire-aux-questions)
15. [Glossaire](#15-glossaire)

---

## 1. Bienvenue dans AMI

AMI (Assistance Missions Interprètes) est l'outil métier que vous utilisez pour piloter votre activité d'interprétariat de bout en bout :

- **annuaire des interprètes** et de leurs langues parlées,
- **planification des missions** pour le compte de sociétés clientes,
- **édition de devis**, conversion en factures et **suivi des règlements**,
- **gestion des tiers** (sociétés et contacts demandeurs),
- **administration** des utilisateurs et des droits.

L'application est conçue pour fonctionner aussi bien dans un navigateur web (recommandé) que sur un ordinateur Windows, une tablette ou un smartphone — la mise en page s'adapte automatiquement à la taille de l'écran.

---

## 2. Premiers pas

### 2.1 Se connecter
1. Ouvrez l'adresse fournie par votre administrateur (en production : `https://ami.planetapplis.fr/`).
2. L'écran de connexion affiche deux zones : à gauche un visuel de marque, à droite un formulaire **Identifiant + Mot de passe**.
3. Saisissez vos identifiants.
4. Cochez **« Se souvenir de moi »** si vous travaillez sur un poste personnel — l'application restera connectée lors des prochaines visites.
5. Cliquez sur **Se connecter**.

> **Astuce** : la coche « Se souvenir de moi » conserve votre session en local (préférences de l'application). Sur un poste partagé, **ne cochez pas** cette case.

### 2.2 Se déconnecter
- Sur grand écran : bouton **Déconnexion** (icône représentant une porte) en haut à droite de la barre principale.
- Sur mobile : ouvrir le menu latéral (≡), puis **Déconnexion** en bas du menu.

### 2.3 Que faire en cas de mot de passe oublié ?
Contactez un administrateur d'AMI. Depuis l'écran **Admin → Utilisateurs**, il peut réinitialiser votre mot de passe en éditant votre fiche et en saisissant un nouveau mot de passe (le champ apparaît lors de l'édition).

---

## 3. Vue d'ensemble de l'interface

### 3.1 Sur grand écran (ordinateur)
Une **barre supérieure** unique regroupe :

1. **Logo + titre** « AMI — Assistance missions interprètes » à gauche.
2. **Onglets** au centre : Interprètes · Missions · Facturation · Tiers · Admin · Export (les onglets affichés dépendent de vos droits).
3. **Nom de l'utilisateur connecté** + bouton **Déconnexion** à droite.

Le contenu de l'onglet sélectionné occupe toute la zone centrale.

### 3.2 Sur mobile et tablette
La barre supérieure conserve le logo et un bouton menu (≡). En ouvrant ce menu vous accédez aux mêmes entrées, sous forme d'une liste verticale.

### 3.3 Codes visuels communs
- **Bleu** (#1B3A8C) : couleur principale (boutons d'action, en-têtes).
- **Vert** : actions positives, statuts « Payé / Accepté ».
- **Orange / jaune** : alertes douces, statuts en attente / expirés.
- **Rouge** : erreurs, statuts « Rejeté / Annulé ».
- **Gris** : statuts « Brouillon », éléments inactifs.

Les **chips** (petites pastilles arrondies) servent à afficher un statut. Une **barre de défilement** bleue et arrondie indique qu'une zone est défilable.

---

## 4. Gestion des interprètes

> **Onglet** : Interprètes  · **Profils autorisés** : administrateur, gestionnaire interprètes.

### 4.1 Lister les interprètes
À l'ouverture, vous voyez la liste de tous les interprètes enregistrés. Un champ de recherche en haut filtre instantanément par **nom**, **langue parlée** ou **ville**.

Chaque ligne affiche : nom complet, langues parlées, ville, statut de disponibilité, et trois actions selon vos droits :
- 👁 **Consulter** : ouvrir la fiche détaillée et la liste de ses missions.
- ✏️ **Éditer** : modifier la fiche.
- 🗑 **Supprimer** : supprimer l'interprète (confirmation requise).

### 4.2 Ajouter un interprète
1. Cliquez sur **+ Ajouter un interprète** (bouton flottant ou en haut de la liste).
2. Renseignez les champs : **Nom** (obligatoire), Prénom, Numéro, Email, Téléphones (mobile, domicile), Langues parlées, Adresse complète (adresse, code postal, ville, pays), Commentaires, Statut (Disponible / Indisponible).
3. Cliquez sur **Enregistrer**.

> À la création, l'application génère automatiquement un **identifiant de connexion** (`nomprenom` simplifié, unicité garantie) et un mot de passe par défaut (`Nom + 2026`). **Communiquez-les à l'interprète et invitez-le à le changer rapidement.**

### 4.3 Modifier ou supprimer
- **Modifier** : cliquez sur l'icône ✏️, ajustez les champs, **Enregistrer**.
- **Supprimer** : icône 🗑, puis confirmez. La suppression est définitive — vérifiez que l'interprète n'a pas de missions en cours.

### 4.4 Consulter les missions d'un interprète
Cliquez sur le nom d'un interprète pour ouvrir sa page personnelle : informations + tableau de ses missions, filtrable par mois/année.

---

## 5. Gestion des missions

> **Onglet** : Missions  · **Profils autorisés** : administrateur, gestionnaire missions.

### 5.1 Lire le tableau des missions
Le tableau central liste toutes les missions, avec colonnes : Référence, Client, Demandeur, Date de mission, Heure, Durée, Interprète, Langue, Type, Statut mission, Statut facturation interprète, Statut facturation client.

### 5.2 Filtres disponibles
En haut du tableau :
- **Recherche libre** : tape n'importe quel terme (référence, nom, société, langue).
- **Société demandeuse** : filtre par nom de société cliente.
- **Période** : date de début / date de fin.
- **Statut mission** : Tous / Brouillon / Validée / Envoyée / Renvoyée au collaborateur / Payée.
- **Statut facturation** : Tous / Non facturée / Facturée / Payée.
- **Type** : Tous / Tribunal judiciaire / Traduction / Interprétariat.

Cliquer sur une en-tête de colonne trie le tableau ; un second clic inverse le tri.

### 5.3 Pagination
Sous le tableau, choisissez la taille de page (25, 50, 100) et naviguez entre les pages avec les flèches.

### 5.4 Créer une mission
1. Cliquez sur **+ Nouvelle mission** (en haut à droite).
2. Renseignez :
   - **Client** (autocomplétion) → sélectionnez une société existante ou créez-en une (renvoi vers l'onglet Tiers).
   - **Contact demandeur** (autocomplétion parmi les contacts de la société).
   - **Type de mission** : Tribunal judiciaire / Traduction / Interprétariat.
   - **Langue** (autocomplétion sur le référentiel).
   - **Interprète** assigné (autocomplétion).
   - **Date et heure** de début, **durée** (en heures).
   - **Référence** (saisie libre ou générée).
   - **Commentaires** (description, lieu, instructions spéciales).
3. **Enregistrer**.

> Les dates sont saisies au format `JJ/MM/AAAA` (un sélecteur de calendrier est disponible). Les montants utilisent la virgule ou le point comme séparateur décimal.

### 5.5 Modifier ou supprimer une mission
- Icônes ✏️ et 🗑 sur chaque ligne. La suppression demande confirmation et est **bloquée si une facture client existe déjà** pour cette mission.

### 5.6 Créer un devis depuis une mission
Sur la ligne d'une mission, cliquez sur l'icône **📋 Devis**. Voir le chapitre suivant.

---

## 6. Module Devis

### 6.1 Cycle de vie d'un devis
```
Mission → Brouillon → Envoyé → Accepté → Converti en facture
                              ↘ Rejeté (Dupliquer)
                              ↘ Expiré (Dupliquer)
```

### 6.2 Créer un devis depuis une mission
1. Dans l'onglet **Missions**, repérez la mission concernée.
2. Cliquez sur **📋 Devis** sur la ligne.
3. Si aucun devis actif n'existe : un devis **Brouillon** est créé automatiquement (client, référence mission et ligne unique pré-remplis).
4. L'écran d'édition du devis s'ouvre directement.

> **Règles à connaître** :
> - Une mission **déjà facturée** ne permet pas de créer un nouveau devis (message « Cette mission est déjà facturée. »).
> - Une mission ne peut avoir qu'**un seul devis actif** (Brouillon ou Envoyé) à la fois. Si vous essayez d'en créer un second, l'application **ouvre le devis existant**.

### 6.3 Écran d'édition d'un devis

**Bandeau d'en-tête (lecture seule)** : Client, Mission, Statut, Date d'envoi, Numéro de facture associée (si converti).

**Zone éditable** (uniquement si Brouillon ou Envoyé) :
- **Date de validité** (`JJ/MM/AAAA`).
- **Notes** : commentaires libres.
- **Lignes** : tableau avec colonnes Désignation, Quantité, P.U. HT, TVA %, Remise %, Total HT, Total TTC.
  - Bouton **+** : ajouter une ligne.
  - Bouton 🗑 : supprimer une ligne.
  - Les totaux se recalculent à chaque saisie.

**Pied** : Total HT, Total TTC.

### 6.4 Actions disponibles selon le statut
| Statut | Actions affichées |
|---|---|
| Brouillon | **Sauvegarder**, **PDF**, **Envoyer**, *menu ⋯* (Annuler) |
| Envoyé | **Sauvegarder**, **PDF**, *menu ⋯* (Accepter / Rejeter / Marquer expiré) |
| Accepté | **PDF**, **Créer la facture** (bouton vert) |
| Rejeté | **PDF**, **Dupliquer** |
| Expiré | **PDF**, **Dupliquer** |
| Converti | **PDF** (lecture seule, mention « Converti en facture N° … ») |

### 6.5 Générer le PDF
Cliquer sur **PDF** :
- sur navigateur web : le PDF est téléchargé directement,
- sur application Windows/mobile : ouverture de la boîte d'impression/partage système.

Le PDF contient : en-tête avec coordonnées de l'entreprise (cf. Informations entreprise), numéro et statut du devis, tableau des prestations, totaux HT/TTC, notes et conditions.

### 6.6 Envoyer le devis
1. En statut **Brouillon**, cliquez sur **Envoyer**.
2. Le statut passe à **Envoyé** instantanément.
3. **Téléchargez le PDF** et adressez-le au client par e-mail (l'envoi e-mail n'est pas encore intégré dans l'application).

### 6.7 Marquer accepté / rejeté / expiré
Une fois le devis envoyé, ouvrez le menu **⋯** dans la barre d'actions et choisissez :
- **Marquer accepté** → le devis devient prêt à être converti en facture.
- **Marquer rejeté** → archivage avec possibilité de dupliquer.
- **Marquer expiré** → idem, pour un devis dépassé de date de validité.

### 6.8 Convertir un devis accepté en facture
1. Ouvrez le devis en statut **Accepté**.
2. Cliquez sur **Créer la facture** (bouton vert).
3. Un **numéro de facture est réservé** automatiquement et la facture apparaît dans le module Facturation.
4. Le devis passe en statut **Converti en facture** et devient en lecture seule.

### 6.9 Dupliquer un devis rejeté ou expiré
Sur un devis Rejeté ou Expiré, cliquez sur **Dupliquer** : un nouveau devis **Brouillon** est créé pour la même mission. Vous pouvez ensuite l'ajuster avant de le renvoyer.

### 6.10 Liste des devis (onglet Facturation → sous-onglet Devis)
Affiche tous les devis filtrables par statut (Brouillons / Envoyés / Acceptés / Rejetés / Expirés / Convertis). Cliquer sur une ligne ouvre l'écran d'édition.

---

## 7. Module Facturation

> **Onglet** : Facturation  · **Profils autorisés** : administrateur, gestionnaire missions.

### 7.1 Vue d'ensemble
L'onglet Facturation propose plusieurs vues :
- **Factures clients** : la liste paginée des factures émises.
- **Devis** : voir chapitre 6.
- **Brouillons** : factures en préparation (regroupant plusieurs missions du même client sur le même mois).

### 7.2 Lister et filtrer les factures
Filtres disponibles :
- **Client** (autocomplétion),
- **Statut** : Brouillon / Envoyée / Payée / En retard / Annulée,
- **Numéro de facture**,
- **Référence mission**,
- **Recherche libre**.

Chaque ligne affiche : Numéro, Client, Période, Montant HT, Montant TTC, Statut, Échéance.

### 7.3 Ouvrir une facture
Cliquez sur une ligne pour ouvrir le **détail de la facture** :
- En-tête (client, période, dates) avec **chips de statut**.
- **Lignes de facture** (éditables tant que la facture est en Brouillon).
- **Bloc Pilotage** à droite : statut courant, totaux HT/TTC, RIB sélectionné, délai de règlement, échéance.

### 7.4 Modifier le statut d'une facture
Utilisez la liste déroulante **Statut de la facture** dans le bloc Pilotage. Les transitions usuelles :
- Brouillon → Envoyée → Payée
- Envoyée → En retard → Payée
- N'importe quel statut → Annulée (action irréversible, à confirmer).

### 7.5 Changer le RIB ou les délais de règlement
Toujours dans le bloc Pilotage :
- **Compte bancaire** : sélectionnez parmi les RIB renseignés dans **Informations entreprise**.
- **Conditions de règlement** : choisissez parmi les délais référencés (à réception, 30 jours, 45 jours, 60 jours, etc.).
- **Date d'émission** : modifiable tant que la facture n'est pas envoyée.

### 7.6 Générer et archiver le PDF de la facture
À la sauvegarde d'une nouvelle facture, l'application :
1. Réserve un numéro séquentiel propre au client (`reserve_client_invoice_number.php`).
2. Génère le PDF côté client (en-tête entreprise, tableau, totaux, RIB).
3. Encode le PDF en base64 et l'envoie au serveur pour archivage dans `Factures_PDF/`.

Vous pouvez retélécharger le PDF à tout moment depuis le bouton **PDF** sur la facture.

### 7.7 Brouillons multi-missions
Pour les clients facturés mensuellement :
1. Cliquez sur **Préparer un brouillon**.
2. Sélectionnez le **client** et le **mois**.
3. L'application liste les missions facturables du mois.
4. Cochez/décochez les missions à inclure, ajustez les lignes si besoin.
5. **Sauvegarder le brouillon** (vous pourrez y revenir) ou **Finaliser** pour transformer en facture officielle.

---

## 8. Gestion des tiers

> **Onglet** : Tiers  · **Profils autorisés** : administrateur, gestionnaire missions.

### 8.1 Sociétés clientes
- Liste de toutes les sociétés, filtrable par nom.
- Actions : **+ Nouvelle société**, ✏️ Éditer, 🗑 Supprimer.
- Champs : Nom, Alias, Adresse, Code postal, Ville, Pays, Département, Téléphone, Fax, Email, Site web, SIREN, SIRET, Notes publiques/privées, Statut (actif/archivé).

### 8.2 Contacts d'une société
Sélectionnez une société dans la liste pour voir ses contacts à droite (le « volet contacts » s'ouvre).
- Actions : **+ Nouveau contact**, ✏️ Éditer, 🗑 Supprimer.
- Champs : Civilité, Prénom, Nom, Email, Téléphone, Mobile, Fax, Fonction, Adresse personnelle, Notes, Anniversaire.

> Les contacts sont utilisés comme **demandeurs** lors de la création d'une mission. Une société sans contact ne pourra pas être sélectionnée tant qu'au moins un contact n'est pas créé.

---

## 9. Informations entreprise

> **Route** : `/company-info`  · **Profils autorisés** : administrateur, gestionnaire missions.

Cette page définit les **coordonnées de votre cabinet** utilisées dans :
- l'en-tête des devis et factures (PDF),
- les en-têtes de mails (à venir).

Champs :
- **Identité** : Nom commercial, Adresse ligne 1, Adresse ligne 2, Code postal, Ville, SIRET, Téléphone, Email, Site web, URL du logo.
- **Coordonnées bancaires (multi-RIB)** : Nom de banque, Code banque, Code guichet, N° compte, Clé RIB, BIC, IBAN, Domiciliation, Titulaire, Adresse du titulaire.

Vous pouvez gérer **plusieurs comptes bancaires** : un sera marqué « par défaut » et utilisé sur les nouvelles factures, mais vous pouvez en sélectionner un autre au cas par cas.

---

## 10. Administration des utilisateurs

> **Onglet** : Admin  · **Profils autorisés** : administrateur uniquement.

### 10.1 Tableau de bord
Au sommet de la page, quatre cartes indiquent :
- **Total utilisateurs**
- **Utilisateurs actifs**
- **Gestionnaires interprètes**
- **Gestionnaires missions**

### 10.2 Liste des utilisateurs
Tableau filtrable par nom / email / identifiant. Chaque ligne affiche les rôles assignés sous forme de **chips** (Admin, Interprète, Gestion interprètes, Gestion missions).

### 10.3 Créer un utilisateur
1. Cliquez sur **+ Nouvel utilisateur**.
2. Renseignez : Identifiant (login), Nom complet, Email, **Mot de passe**, et cochez les rôles.
3. **Enregistrer**.

### 10.4 Modifier un utilisateur
- Icône ✏️ pour éditer les champs et/ou les rôles.
- Pour **réinitialiser le mot de passe** : saisissez un nouveau mot de passe dans le champ dédié (sinon laissez vide).
- **Cocher/décocher un rôle** met à jour les droits en temps réel.

### 10.5 Supprimer un utilisateur
Icône 🗑, confirmation requise. **Ne pas supprimer un compte interprète** ayant des missions associées — vous risquez de casser l'historique. Préférez le passage en **statut inactif**.

---

## 11. Exports

> **Onglet** : Export  · **Profils autorisés** : administrateur.

Permet d'exporter au format **CSV** :
- **Interprètes** : tous les champs (id, numéro, identité, contacts, adresse, langues, statut).
- **Utilisateurs** : tous les comptes avec leurs rôles.
- **Missions** : selon les filtres appliqués (période, statut, client…).

Le fichier généré est téléchargé directement par le navigateur (ou enregistré localement sur application native).

---

## 12. Profils et droits

| Rôle | Onglets visibles | Actions clés |
|---|---|---|
| **Administrateur** | Interprètes · Missions · Facturation · Tiers · Admin · Export | Tout |
| **Gestionnaire interprètes** | Interprètes (uniquement) | CRUD interprètes |
| **Gestionnaire missions** | Missions · Facturation · Tiers | CRUD missions, devis, factures, tiers |
| **Interprète** | Vue restreinte de ses missions | Consultation uniquement |

Les onglets se réorganisent automatiquement selon vos droits — vous ne verrez jamais une fonction à laquelle vous n'avez pas accès.

---

## 13. Conseils d'utilisation au quotidien

### 13.1 Workflow recommandé pour une mission complète
```
1. Créer / vérifier la société cliente et le contact (Tiers)
2. Créer la mission (Missions → + Nouvelle mission)
3. Générer le devis (Missions → 📋)  → l'envoyer au client par mail
4. Marquer le devis accepté quand le client confirme
5. Convertir en facture (bouton vert sur le devis)
6. Suivre le règlement (Facturation → statut Payé)
```

### 13.2 Bonnes pratiques
- **Sauvegardez régulièrement** : l'application enregistre à chaque action explicite mais ne fait pas de sauvegarde automatique pendant que vous tapez.
- **Profitez de la recherche** : tous les tableaux ont un champ de recherche en haut. Pas besoin de scroller.
- **Filtres conservés** : les filtres restent actifs tant que vous restez sur la page. Changer d'onglet réinitialise certains filtres.
- **Doubles écrans** : sur grand écran, plusieurs pages s'ouvrent en deux colonnes (ex. interprète + ses missions) — profitez de cette vue côte à côte.
- **Raccourcis clavier** : `Entrée` pour valider un formulaire, `Échap` pour fermer une boîte de dialogue.

### 13.3 Ce que l'application **ne fait pas encore**
Fonctionnalités prévues à terme :
- Gestion du référentiel **Langues** depuis l'UI (aujourd'hui en base seulement).
- **Batch mensuel** de génération automatique de toutes les factures clients.
- **Envoi e-mail intégré** des devis et factures.
- Découplage des statuts FMI ↔ AMI sur les missions.
- **Changement de statut groupé** pour les factures.

Ces évolutions feront l'objet de mises à jour signalées par votre administrateur.

---

## 14. Foire aux questions

**Q : J'ai oublié mon mot de passe, que faire ?**
R : Contactez un administrateur d'AMI, il peut le réinitialiser depuis l'onglet **Admin**.

**Q : Pourquoi je ne vois pas l'onglet « Admin » ?**
R : Cet onglet est réservé aux administrateurs. Vérifiez vos droits avec votre responsable.

**Q : Je clique sur 📋 Devis, mais rien ne se passe et j'ai un message « Cette mission est déjà facturée. »**
R : Une facture client existe déjà pour cette mission ; il n'est plus possible de produire un nouveau devis. Si c'est une erreur, annulez la facture concernée (Facturation → statut Annulée) puis recommencez.

**Q : Pourquoi mon devis n'est-il plus modifiable ?**
R : Seuls les devis en statut **Brouillon** ou **Envoyé** sont éditables. Une fois accepté, rejeté, expiré ou converti, le devis devient en lecture seule (vous pouvez cependant le dupliquer).

**Q : Le PDF du devis n'a pas l'en-tête de mon entreprise.**
R : Renseignez les coordonnées dans **/company-info** (nom, adresse, SIRET, RIB principal). Elles seront reprises sur tous les nouveaux PDF.

**Q : J'ai ajouté un interprète, quel est son mot de passe ?**
R : Le mot de passe initial est `Nom + 2026` (par exemple : `Dupont2026` pour un interprète nommé Dupont). Communiquez-le-lui et invitez-le à le changer.

**Q : Pourquoi certains champs ont-ils plusieurs orthographes (Nom / nom / lastname) dans le code ?**
R : Le back-end accepte plusieurs formats pour la rétro-compatibilité avec d'anciennes versions. Côté utilisateur, vous ne voyez qu'un seul libellé clair.

**Q : La page reste blanche / un export échoue.**
R : Rechargez la page (`F5`). Si le problème persiste, vérifiez votre connexion réseau et contactez le support technique en indiquant l'onglet, l'heure et la nature du problème.

**Q : Puis-je travailler hors connexion ?**
R : Non. AMI est une application connectée à un serveur distant. Une connexion réseau est nécessaire pour toute opération.

---

## 15. Glossaire

| Terme | Définition |
|---|---|
| **AMI** | Assistance Missions Interprètes — nom de l'application |
| **Tiers** | Société cliente qui commande des missions d'interprétariat |
| **Demandeur** | Contact (personne) au sein d'un tiers qui passe commande |
| **Mission** | Prestation d'interprétariat planifiée (date, durée, langue, lieu, demandeur) |
| **Devis** | Document prévisionnel adressé au client avant la mission |
| **Facture client** | Document de facturation émis après la mission ou groupé par période |
| **Brouillon de facture** | Ensemble de missions sélectionnées pour une future facture, sans numéro encore réservé |
| **Statut mission** | État administratif de la mission : Brouillon, Validée, Envoyée, Renvoyée au collaborateur, Payée |
| **Statut facturation** | État de la facture : Brouillon, Envoyée, Payée, En retard, Annulée |
| **RIB** | Relevé d'Identité Bancaire affiché sur les factures |
| **SIRET / SIREN** | Identifiants français des entreprises |
| **CSV** | Format de fichier tableur (séparateur virgule) lisible par Excel ou LibreOffice |

---

## Support et contact

En cas de question ou de bug :
1. Vérifiez d'abord la **FAQ** ci-dessus.
2. Notez l'**heure** de l'événement, l'**onglet**, le **message d'erreur** et la dernière action effectuée.
3. Contactez votre administrateur AMI ou le support technique de votre éditeur.

---

*Document généré le 17 mai 2026 — version 4.0.0. Pour les guides plus techniques : voir `DOC_TECHNIQUE_AMI.md` et `UI_UX_AMI.md`.*
