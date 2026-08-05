-- =====================================================================
-- Migration DB (prod) — rattacher toutes les données métier existantes
-- à entity = 1 (données historiques AMI / Planet Traduction).
--
-- A EXECUTER DIRECTEMENT SUR LA BASE (phpMyAdmin / client SQL). Ce script
-- ne touche à aucun fichier PHP / endpoint : c'est une migration de
-- données pure.
--
-- Contexte : ces 8 tables métier custom n'ont jamais eu de colonne
-- `entity` propre en prod. Vérifié le 01/08/2026 sur le dump
-- dbs12436960 (19).sql : aucune des 8 tables ci-dessous n'a de colonne
-- entity à ce jour. La plus critique est llx_missionsplanet_mission :
-- son "entity" était jusqu'ici déduit par JOIN vers llx_user/llx_societe,
-- ce qui rend invisibles les ~1445 missions dont le client ou
-- l'interprète référencé a été supprimé/fusionné entre-temps.
--
-- Effet du ADD COLUMN entity INT NOT NULL DEFAULT 1 : MySQL/MariaDB
-- remplit automatiquement la valeur 1 sur TOUTES les lignes déjà
-- existantes au moment de l'ALTER (pas d'UPDATE séparé nécessaire,
-- aucune ligne ne peut se retrouver à NULL).
--
-- Sans risque pour le code actuellement déployé en prod (futurAMI /
-- entity=2) : aucun endpoint ne lit encore ces nouvelles colonnes, ce
-- script prépare uniquement la donnée, il ne change aucun comportement
-- applicatif.
--
-- Idempotence : si une colonne existe déjà (ex: après un futur déploiement
-- du code qui la crée aussi via ensureXxxTable()), relancer la ligne
-- correspondante échouera avec "Duplicate column name" — sans danger,
-- il suffit de sauter cette ligne.
-- =====================================================================

-- 1) Missions — la plus sensible (pas de colonne entity du tout aujourd'hui)
ALTER TABLE llx_missionsplanet_mission
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER rowid;
ALTER TABLE llx_missionsplanet_mission
  ADD KEY idx_mission_entity (entity);

-- 2) Brouillons de facture
ALTER TABLE invoice_draft
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE invoice_draft
  ADD KEY idx_invoice_draft_entity (entity);

-- 3) Factures / avoirs clients
ALTER TABLE tble_client_billed
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE tble_client_billed
  ADD KEY idx_client_billed_entity (entity);

-- 4) Lignes de facture
ALTER TABLE tble_client_invoice_lines
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE tble_client_invoice_lines
  ADD KEY idx_invoice_lines_entity (entity);

-- 5) Imputations d'avoirs
ALTER TABLE tble_credit_note_applications
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE tble_credit_note_applications
  ADD KEY idx_cna_entity (entity);

-- 6) Facturation interprète par mission (PK = ref, pas de colonne id)
ALTER TABLE tble_mission_billed
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER ref;

-- 7) Séquences de numérotation FAC/AV — cas particulier : la PK actuelle
--    est sur (serie) seul -> bascule sur (serie, entity) composite, pour
--    permettre des compteurs FAC/AV séparés par entité (entity=2 pourra
--    ensuite avoir ses propres séquences sans collision avec entity=1).
ALTER TABLE tble_invoice_sequence
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER serie;
ALTER TABLE tble_invoice_sequence
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (serie, entity);

-- 8) Lignes de devis (défense en profondeur — protégées indirectement via
--    invoice_draft.entity jusqu'ici, ajout d'une barrière directe)
ALTER TABLE invoice_draft_lines
  ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE invoice_draft_lines
  ADD KEY idx_invoice_draft_lines_entity (entity);

-- =====================================================================
-- Vérification post-migration (à lancer après coup, doit renvoyer
-- entity=1 partout, aucune ligne à 0 ou NULL) :
-- =====================================================================
-- SELECT 'llx_missionsplanet_mission' AS tbl, entity, COUNT(*) FROM llx_missionsplanet_mission GROUP BY entity
-- UNION ALL SELECT 'invoice_draft', entity, COUNT(*) FROM invoice_draft GROUP BY entity
-- UNION ALL SELECT 'tble_client_billed', entity, COUNT(*) FROM tble_client_billed GROUP BY entity
-- UNION ALL SELECT 'tble_client_invoice_lines', entity, COUNT(*) FROM tble_client_invoice_lines GROUP BY entity
-- UNION ALL SELECT 'tble_credit_note_applications', entity, COUNT(*) FROM tble_credit_note_applications GROUP BY entity
-- UNION ALL SELECT 'tble_mission_billed', entity, COUNT(*) FROM tble_mission_billed GROUP BY entity
-- UNION ALL SELECT 'tble_invoice_sequence', entity, COUNT(*) FROM tble_invoice_sequence GROUP BY entity
-- UNION ALL SELECT 'invoice_draft_lines', entity, COUNT(*) FROM invoice_draft_lines GROUP BY entity;
