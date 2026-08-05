<?php

/**
 * Normalise le nom d'une série de numérotation ("FAC", "AV", ...).
 * Retire tout caractère non alphabétique et met en majuscules.
 */
function normalizeInvoiceSerie(string $serie): string {
    $serie = strtoupper(preg_replace('/[^A-Z]/i', '', $serie));
    return $serie === '' ? 'FAC' : $serie;
}

/**
 * Renvoie le plus grand suffixe séquentiel déjà présent dans
 * tble_client_billed pour la série donnée (0 si aucune facture).
 * Utilisé comme filet de sécurité (amorçage / rattrapage du compteur).
 */
function currentMaxInvoiceSequence(PDO $pdo, string $serie, int $entity): int {
    $serie = normalizeInvoiceSerie($serie);
    $stmt = $pdo->prepare(
        "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 0)
         FROM tble_client_billed
         WHERE invoice_number LIKE :pfx AND entity = :entity"
    );
    $stmt->execute([':pfx' => $serie . '-%', ':entity' => $entity]);
    return (int) $stmt->fetchColumn();
}

/**
 * Crée la table `tble_invoice_sequence` si elle n'existe pas.
 *
 * Cette table remplace l'ancien calcul MAX+1 sur tble_client_billed qui,
 * sous concurrence ou en cas de suppression d'une ligne, provoquait
 * l'attribution de numéros déjà utilisés (ex : la facture "…12" qui
 * se voyait ré-attribuée en "…11").
 */
function ensureInvoiceSequenceTable(PDO $pdo): void {
    static $ensuredSeq = false;
    if ($ensuredSeq) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tble_invoice_sequence (
            serie VARCHAR(16) NOT NULL,
            entity INT NOT NULL DEFAULT 1,
            last_number INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (serie, entity)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
    );

    // Migration douce n°1 : une très ancienne version de la table (une seule
    // ligne pour la série FAC, sans colonne `serie`) a existé. Si on la
    // détecte, on la renomme en _legacy_YYYYMMDD_HHMM et on recrée la
    // nouvelle structure. Le compteur sera ré-amorcé automatiquement à
    // partir des factures existantes via `ensureInvoiceSequenceRow` → `currentMax`.
    try {
        $col = $pdo->query(
            "SHOW COLUMNS FROM tble_invoice_sequence LIKE 'serie'"
        );
        $hasSerie = $col ? (bool) $col->fetch(PDO::FETCH_ASSOC) : false;
    } catch (Throwable $_) {
        $hasSerie = true; // en cas d'erreur, on ne bloque pas
    }
    if (!$hasSerie) {
        $backup = 'tble_invoice_sequence_legacy_' . date('Ymd_His');
        try {
            $pdo->exec(
                "RENAME TABLE tble_invoice_sequence TO `$backup`"
            );
            $pdo->exec(
                "CREATE TABLE tble_invoice_sequence (
                    serie VARCHAR(16) NOT NULL,
                    entity INT NOT NULL DEFAULT 1,
                    last_number INT UNSIGNED NOT NULL DEFAULT 0,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (serie, entity)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
            );
            error_log(
                "[billing] tble_invoice_sequence migré vers la nouvelle "
                . "structure. Ancienne table sauvegardée : $backup"
            );
        } catch (Throwable $migrationError) {
            error_log(
                "[billing] Migration tble_invoice_sequence a échoué : "
                . $migrationError->getMessage()
            );
            // On ne relance pas : le CREATE IF NOT EXISTS ci-dessus a déjà
            // idempotamment tenté la création — si elle a échoué c'est que
            // la table existe encore sans la colonne. L'erreur d'origine
            // sera renvoyée en amont.
        }
    }

    // Migration douce n°2 : la table existait déjà avec `serie` en clé
    // primaire SEULE (avant l'introduction du multi-entités), sans colonne
    // `entity`. On l'ajoute, on bascule la clé primaire sur (serie, entity)
    // et on affecte l'entité "historique" (1) aux compteurs déjà amorcés.
    try {
        $colEntity = $pdo->query("SHOW COLUMNS FROM tble_invoice_sequence LIKE 'entity'");
        $hasEntity = $colEntity ? (bool) $colEntity->fetch(PDO::FETCH_ASSOC) : true;
        if (!$hasEntity) {
            $pdo->exec("ALTER TABLE tble_invoice_sequence ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER serie");
            $pdo->exec("ALTER TABLE tble_invoice_sequence DROP PRIMARY KEY, ADD PRIMARY KEY (serie, entity)");
            error_log("[billing] tble_invoice_sequence : colonne entity ajoutée, clé primaire basculée sur (serie, entity).");
        }
    } catch (Throwable $migrationError2) {
        error_log("[billing] Migration entity de tble_invoice_sequence a échoué : " . $migrationError2->getMessage());
    }

    $ensuredSeq = true;
}

/**
 * S'assure qu'une ligne existe dans tble_invoice_sequence pour la série
 * donnée. Si aucune n'existe encore, on amorce à `MAX(existant)` dans
 * tble_client_billed afin de garantir la continuité de la numérotation.
 */
function ensureInvoiceSequenceRow(PDO $pdo, string $serie, int $entity): void {
    $serie = normalizeInvoiceSerie($serie);
    ensureInvoiceSequenceTable($pdo);

    $check = $pdo->prepare("SELECT 1 FROM tble_invoice_sequence WHERE serie = :s AND entity = :e LIMIT 1");
    $check->execute([':s' => $serie, ':e' => $entity]);
    if ($check->fetchColumn() !== false) {
        return;
    }

    $seed = currentMaxInvoiceSequence($pdo, $serie, $entity);
    // INSERT IGNORE : si un autre process a déjà amorcé la ligne entre
    // le SELECT et l'INSERT, on l'accepte silencieusement.
    $ins = $pdo->prepare(
        "INSERT IGNORE INTO tble_invoice_sequence (serie, entity, last_number) VALUES (:s, :e, :n)"
    );
    $ins->execute([':s' => $serie, ':e' => $entity, ':n' => $seed]);
}

/**
 * Réserve atomiquement le prochain numéro de séquence pour la série
 * donnée. Deux appels concurrents ne peuvent jamais recevoir le même
 * numéro (grâce au trick `LAST_INSERT_ID(expr)` sous MySQL/MariaDB).
 *
 * Un filet de sécurité rattrape le compteur si `MAX(tble_client_billed)`
 * dépasse le compteur (ex : insertion manuelle en base).
 */
function reserveNextInvoiceSequence(PDO $pdo, string $serie, int $entity): int {
    $serie = normalizeInvoiceSerie($serie);
    ensureInvoiceSequenceRow($pdo, $serie, $entity);

    // Incrément atomique : la valeur retournée par LAST_INSERT_ID() est
    // propre à la connexion et garantie unique pour chaque appel.
    $upd = $pdo->prepare(
        "UPDATE tble_invoice_sequence
         SET last_number = LAST_INSERT_ID(last_number + 1)
         WHERE serie = :s AND entity = :e"
    );
    $upd->execute([':s' => $serie, ':e' => $entity]);
    $next = (int) $pdo->lastInsertId();

    // Filet de sécurité : si une écriture directe en base a créé une
    // facture avec un suffixe > compteur, on rattrape ici (sans jamais
    // reculer, pour ne pas ré-émettre un numéro).
    $currentMax = currentMaxInvoiceSequence($pdo, $serie, $entity);
    if ($next <= $currentMax) {
        $target = $currentMax + 1;
        $catchUp = $pdo->prepare(
            "UPDATE tble_invoice_sequence
             SET last_number = LAST_INSERT_ID(:n1)
             WHERE serie = :s AND entity = :e AND last_number < :n2"
        );
        $catchUp->execute([':n1' => $target, ':s' => $serie, ':e' => $entity, ':n2' => $target]);
        $bumped = (int) $pdo->lastInsertId();
        $next = $bumped > $currentMax ? $bumped : $target;
    }
    return $next;
}

/**
 * Renvoie le numéro qui SERAIT attribué au prochain appel de
 * `reserveNextInvoiceSequence`, SANS consommer de numéro. Utilisé pour
 * l'aperçu PDF (bouton "Générer PDF") afin de ne pas gaspiller la
 * séquence légale à chaque prévisualisation.
 */
function peekNextInvoiceSequence(PDO $pdo, string $serie, int $entity): int {
    $serie = normalizeInvoiceSerie($serie);
    ensureInvoiceSequenceRow($pdo, $serie, $entity);

    $stmt = $pdo->prepare("SELECT last_number FROM tble_invoice_sequence WHERE serie = :s AND entity = :e LIMIT 1");
    $stmt->execute([':s' => $serie, ':e' => $entity]);
    $last = (int) $stmt->fetchColumn();
    $currentMax = currentMaxInvoiceSequence($pdo, $serie, $entity);
    return max($last, $currentMax) + 1;
}

/**
 * @deprecated Utiliser reserveNextInvoiceSequence() (atomique).
 * Conservé pour compatibilité : redirige vers la nouvelle implémentation.
 */
function getNextInvoiceSequence(PDO $pdo, string $serie, int $entity): int {
    return reserveNextInvoiceSequence($pdo, $serie, $entity);
}

/**
 * Renvoie la liste des `client_name` distincts déjà associés à ce
 * `invoice_number` dans `tble_client_billed`. Vide si le numéro n'existe
 * pas encore.
 */
function invoiceExistingClients(PDO $pdo, string $invoiceNumber, int $entity): array {
    $stmt = $pdo->prepare(
        "SELECT DISTINCT COALESCE(client_name, '') AS c
         FROM tble_client_billed
         WHERE invoice_number = :inv AND entity = :entity"
    );
    $stmt->execute([':inv' => $invoiceNumber, ':entity' => $entity]);
    $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
    return array_map('strval', $rows);
}

/**
 * Compare deux libellés clients de manière tolérante (trim + comparaison
 * insensible à la casse) pour éviter des faux positifs de collision dus à
 * des différences typographiques mineures.
 */
function invoiceClientLabelMatches(string $a, string $b): bool {
    $norm = static function (string $s): string {
        return strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
    };
    return $norm($a) === $norm($b);
}

/**
 * Garde-fou anti-collision (à appeler avant tout INSERT dans
 * `tble_client_billed`). Vérifie qu'aucune ligne existante avec le même
 * `invoice_number` n'appartient à un client différent. Retourne :
 *   - '' si aucune collision (OK d'insérer)
 *   - le nom du client déjà attributaire si collision (à traiter)
 *
 * Cette fonction est le complément indispensable du compteur atomique :
 * elle protège contre toute écriture via un ancien client, un appel
 * manuel, ou un cas résiduel non couvert par la nouvelle réservation.
 */
function invoiceNumberCollisionClient(PDO $pdo, string $invoiceNumber, string $clientName, int $entity): string {
    $existing = invoiceExistingClients($pdo, $invoiceNumber, $entity);
    if (empty($existing)) {
        return '';
    }
    foreach ($existing as $c) {
        if ($c === '' || invoiceClientLabelMatches($c, $clientName)) {
            continue;
        }
        return $c;
    }
    return '';
}

/**
 * Construit le numéro complet à partir de la série, de l'année/mois
 * (pour la portion AAAAMM uniquement, à des fins d'historique/lisibilité)
 * et du numéro de séquence perpétuel.
 *
 * Format : "<SERIE>-AAAAMM-NNN" (NNN minimum 3 chiffres, s'étend
 * automatiquement au-delà de 999).
 */
function formatInvoiceNumber(string $serie, int $year, int $month, int $sequence): string {
    $serie = strtoupper(preg_replace('/[^A-Z]/i', '', $serie));
    if ($serie === '') {
        $serie = 'FAC';
    }
    return sprintf(
        '%s-%04d%02d-%s',
        $serie,
        $year,
        $month,
        str_pad((string) $sequence, 3, '0', STR_PAD_LEFT)
    );
}

/**
 * Crée/migre la table `invoice_draft` (devis / préparation facture).
 * Appelée défensivement par TOUS les endpoints qui touchent invoice_draft
 * (pas seulement save_invoice_draft.php), pour ne jamais dépendre de
 * l'ordre dans lequel les endpoints sont appelés la première fois.
 */
function ensureInvoiceDraftTable(PDO $pdo): void {
    static $ensuredDraft = false;
    if ($ensuredDraft) {
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS `invoice_draft` (
        `id`                   INT          NOT NULL AUTO_INCREMENT,
        `entity`               INT          NOT NULL DEFAULT 1,
        `client_id`            INT          DEFAULT NULL,
        `client_name`          VARCHAR(255) DEFAULT NULL,
        `month`                VARCHAR(7)   NOT NULL,
        `payment_condition_id` INT          DEFAULT NULL,
        `bank_account_id`      INT          DEFAULT NULL,
        `total_ht`             DECIMAL(10,2) DEFAULT 0.00,
        `created_by`           INT          DEFAULT NULL,
        `status`               ENUM('draft','finalized') NOT NULL DEFAULT 'draft',
        `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_invoice_draft_client_id`   (`client_id`),
        KEY `idx_invoice_draft_client_name` (`client_name`(64)),
        KEY `idx_invoice_draft_status`      (`status`),
        KEY `idx_invoice_draft_month`       (`month`),
        KEY `idx_invoice_draft_entity`      (`entity`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    // Migration douce : table déjà existante avant l'introduction du multi-entités.
    try {
        $col = $pdo->query("SHOW COLUMNS FROM `invoice_draft` LIKE 'entity'");
        $hasEntity = $col ? (bool) $col->fetch(PDO::FETCH_ASSOC) : true;
        if (!$hasEntity) {
            $pdo->exec("ALTER TABLE `invoice_draft` ADD COLUMN `entity` INT NOT NULL DEFAULT 1 AFTER `id`");
            $pdo->exec("ALTER TABLE `invoice_draft` ADD KEY `idx_invoice_draft_entity` (`entity`)");
        }
    } catch (Exception $e) {
        // ignore (race condition / déjà migré)
    }

    $ensuredDraft = true;
}

/**
 * Ajoute la colonne `entity` à `llx_missionsplanet_mission` si elle
 * n'existe pas encore.
 *
 * Contexte : cette table Dolibarr custom n'a jamais eu de colonne entity
 * propre — le cloisonnement multi-entités reposait uniquement sur un JOIN
 * vers llx_user (interprète) et/ou llx_societe (client). Problème : quand
 * fk_soc et/ou nominterprete pointent vers une ligne supprimée/fusionnée,
 * la mission ne matche plus aucune entité et disparaît silencieusement
 * des listes, pour tout le monde — et rien ne garantit qu'une nouvelle
 * mission créée pour l'entité 2 reste bien rattachée à l'entité 2 si son
 * client/interprète change plus tard.
 *
 * Le ALTER TABLE ci-dessous force `DEFAULT 1` : MySQL/MariaDB remplit
 * automatiquement cette valeur sur TOUTES les lignes déjà existantes au
 * moment de l'ALTER (comportement standard, pas besoin d'UPDATE séparé).
 * Idempotent et auto-réparateur comme les autres ensureXxxTable() de ce
 * fichier : peu importe si la migration SQL manuelle
 * (requete_sql_entity1_backfill.sql) a déjà tourné ou non en prod, le
 * premier appel à cette fonction termine le travail si besoin.
 */
function ensureMissionEntityColumn(PDO $pdo): void {
    static $ensuredMissionEntity = false;
    if ($ensuredMissionEntity) {
        return;
    }
    try {
        if (!billingColumnExists($pdo, 'llx_missionsplanet_mission', 'entity')) {
            $pdo->exec("ALTER TABLE llx_missionsplanet_mission ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER rowid");
            $pdo->exec("ALTER TABLE llx_missionsplanet_mission ADD KEY idx_mission_entity (entity)");
            error_log("[billing] llx_missionsplanet_mission : colonne entity ajoutée (backfill DEFAULT 1 sur les lignes existantes).");
        }
    } catch (Exception $e) {
        // ignore (race condition / déjà migré)
    }
    $ensuredMissionEntity = true;
}

/**
 * Ajoute la colonne `entity` à `invoice_draft_lines` (lignes de devis) si
 * elle n'existe pas encore.
 *
 * Contexte : cette table n'a jamais eu de colonne entity propre — elle
 * était protégée uniquement de façon indirecte : chaque endpoint vérifie
 * d'abord que le `draft_id` (invoice_draft) parent appartient bien à
 * $currentEntity avant de toucher aux lignes. Cette fonction ajoute une
 * barrière directe sur la ligne elle-même (défense en profondeur), au cas
 * où une requête future toucherait invoice_draft_lines sans repasser par
 * ce contrôle parent.
 *
 * Comme pour ensureMissionEntityColumn() : le ALTER ... DEFAULT 1 backfill
 * automatiquement toutes les lignes déjà existantes, idempotent.
 */
function ensureInvoiceDraftLinesEntityColumn(PDO $pdo): void {
    static $ensuredDraftLinesEntity = false;
    if ($ensuredDraftLinesEntity) {
        return;
    }
    try {
        if (!billingColumnExists($pdo, 'invoice_draft_lines', 'entity')) {
            $pdo->exec("ALTER TABLE invoice_draft_lines ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id");
            $pdo->exec("ALTER TABLE invoice_draft_lines ADD KEY idx_invoice_draft_lines_entity (entity)");
            error_log("[billing] invoice_draft_lines : colonne entity ajoutée (backfill DEFAULT 1 sur les lignes existantes).");
        }
    } catch (Exception $e) {
        // ignore (race condition / déjà migré)
    }
    $ensuredDraftLinesEntity = true;
}

function billingColumnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $table = str_replace('`', '', $table);
        $column = str_replace('`', '', $column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
        return $stmt && $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

function ensureClientBillingTable(PDO $pdo): void {
    static $ensured = false;
    if ($ensured) {
        return;
    }

    $sql = "CREATE TABLE IF NOT EXISTS tble_client_billed (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity INT NOT NULL DEFAULT 1,
        mission_ref VARCHAR(128) NOT NULL,
        client_name VARCHAR(255) DEFAULT NULL,
        invoice_number VARCHAR(128) NOT NULL,
        invoice_total_ht DECIMAL(15,2) DEFAULT NULL,
        amount_ht DECIMAL(15,2) DEFAULT NULL,
        billed_at DATETIME NOT NULL,
        status_code VARCHAR(32) NOT NULL,
        status_label VARCHAR(128) DEFAULT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'client',
        pdf_path VARCHAR(255) DEFAULT NULL,
        pdf_filename VARCHAR(255) DEFAULT NULL,
        pdf_size INT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_by_name VARCHAR(255) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_client_billed_ref_invoice (mission_ref, invoice_number),
        KEY idx_client_billed_invoice (invoice_number),
        KEY idx_client_billed_mission (mission_ref),
        KEY idx_client_billed_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

    $pdo->exec($sql);

    // Ensure columns added after initial creation are present
    $clientBilledMigrations = [
        'entity'           => "entity INT NOT NULL DEFAULT 1 AFTER id",
        'status_code'      => "status_code VARCHAR(32) NOT NULL DEFAULT 'draft' AFTER billed_at",
        'status_label'     => "status_label VARCHAR(128) DEFAULT NULL AFTER status_code",
        'category'         => "category VARCHAR(32) NOT NULL DEFAULT 'client' AFTER status_label",
        'pdf_path'         => "pdf_path VARCHAR(255) DEFAULT NULL AFTER category",
        'pdf_filename'     => "pdf_filename VARCHAR(255) DEFAULT NULL AFTER pdf_path",
        'pdf_size'         => "pdf_size INT DEFAULT NULL AFTER pdf_filename",
        'created_by'       => "created_by INT DEFAULT NULL AFTER pdf_size",
        'created_by_name'  => "created_by_name VARCHAR(255) DEFAULT NULL AFTER created_by",
        'notes'            => "notes TEXT DEFAULT NULL AFTER created_by_name",
        'invoice_total_ht' => "invoice_total_ht DECIMAL(15,2) DEFAULT NULL AFTER invoice_number",
        'amount_ht'        => "amount_ht DECIMAL(15,2) DEFAULT NULL AFTER invoice_total_ht",
        // AMI v2 — avoirs (credit notes) façon Dolibarr
        'invoice_type'          => "invoice_type TINYINT NOT NULL DEFAULT 0 COMMENT '0=facture, 2=avoir' AFTER category",
        'source_invoice_number' => "source_invoice_number VARCHAR(128) DEFAULT NULL COMMENT 'Ref facture origine pour les avoirs' AFTER invoice_type",
        'credit_note_reason'    => "credit_note_reason VARCHAR(255) DEFAULT NULL AFTER source_invoice_number",
        // Suivi des imputations d'avoir (Dolibarr-like)
        // - sur un avoir : montant déjà consommé (en valeur absolue)
        // - sur une facture : montant d'avoir déjà imputé en réduction du reste à payer
        'applied_amount'        => "applied_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER credit_note_reason",
        'credit_consumed'       => "credit_consumed TINYINT NOT NULL DEFAULT 0 COMMENT '1 si avoir totalement consommé' AFTER applied_amount",
    ];
    foreach ($clientBilledMigrations as $col => $def) {
        if (!billingColumnExists($pdo, 'tble_client_billed', $col)) {
            try {
                $pdo->exec("ALTER TABLE tble_client_billed ADD COLUMN $def");
            } catch (Exception $e) {
                // ignore if already exists (race condition)
            }
        }
    }

    // Index sur source_invoice_number pour rechercher tous les avoirs d'une facture
    try {
        $idxCheck = $pdo->query("SHOW INDEX FROM tble_client_billed WHERE Key_name = 'idx_client_billed_source'");
        if ($idxCheck && $idxCheck->rowCount() === 0) {
            $pdo->exec("ALTER TABLE tble_client_billed ADD KEY idx_client_billed_source (source_invoice_number)");
        }
    } catch (Exception $e) {
        // ignore
    }
    try {
        $idxEntity = $pdo->query("SHOW INDEX FROM tble_client_billed WHERE Key_name = 'idx_client_billed_entity'");
        if ($idxEntity && $idxEntity->rowCount() === 0) {
            $pdo->exec("ALTER TABLE tble_client_billed ADD KEY idx_client_billed_entity (entity)");
        }
    } catch (Exception $e) {
        // ignore
    }

    $ensured = true;
}

function ensureCreditNoteApplicationsTable(PDO $pdo): void {
    static $ensuredApp = false;
    if ($ensuredApp) {
        return;
    }
    $sql = "CREATE TABLE IF NOT EXISTS tble_credit_note_applications (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity INT NOT NULL DEFAULT 1,
        credit_note_number VARCHAR(128) NOT NULL,
        target_invoice_number VARCHAR(128) NOT NULL,
        client_name VARCHAR(255) DEFAULT NULL,
        applied_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_by INT DEFAULT NULL,
        applied_by_name VARCHAR(255) DEFAULT NULL,
        notes VARCHAR(255) DEFAULT NULL,
        KEY idx_cna_credit (credit_note_number),
        KEY idx_cna_target (target_invoice_number),
        KEY idx_cna_client (client_name),
        KEY idx_cna_entity (entity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
    $pdo->exec($sql);

    if (!billingColumnExists($pdo, 'tble_credit_note_applications', 'entity')) {
        try {
            $pdo->exec("ALTER TABLE tble_credit_note_applications ADD COLUMN entity INT NOT NULL DEFAULT 1 AFTER id");
            $pdo->exec("ALTER TABLE tble_credit_note_applications ADD KEY idx_cna_entity (entity)");
        } catch (Exception $e) {
            // ignore if already exists (race condition)
        }
    }

    $ensuredApp = true;
}

function ensureClientInvoiceLinesTable(PDO $pdo): void {
    static $ensuredLines = false;
    if ($ensuredLines) {
        return;
    }

    $sql = "CREATE TABLE IF NOT EXISTS tble_client_invoice_lines (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity INT NOT NULL DEFAULT 1,
        invoice_id INT DEFAULT NULL,
        invoice_number VARCHAR(128) NOT NULL,
        draft_key VARCHAR(64) DEFAULT NULL,
        client_name VARCHAR(255) DEFAULT NULL,
        period_month DATE DEFAULT NULL,
        mission_ref VARCHAR(128) DEFAULT NULL,
        designation TEXT,
        tva_rate DECIMAL(6,3) DEFAULT 0,
        unit_price_ht DECIMAL(15,4) DEFAULT 0,
        quantity DECIMAL(15,4) DEFAULT 0,
        total_ht DECIMAL(15,4) DEFAULT 0,
        discount DECIMAL(6,3) DEFAULT 0,
        notes TEXT,
        sort_order INT DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_by_name VARCHAR(255) DEFAULT NULL,
        updated_by INT DEFAULT NULL,
        updated_by_name VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_invoice_lines_invoice (invoice_number),
        KEY idx_invoice_lines_draft (draft_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

    $pdo->exec($sql);

    // Ensure new columns exist even if table was created previously
    $columnsToAdd = [
        'invoice_id INT DEFAULT NULL AFTER id',
        'draft_key VARCHAR(64) DEFAULT NULL AFTER invoice_number',
        'client_name VARCHAR(255) DEFAULT NULL AFTER draft_key',
        'period_month DATE DEFAULT NULL AFTER client_name',
        'created_by INT DEFAULT NULL AFTER sort_order',
        'created_by_name VARCHAR(255) DEFAULT NULL AFTER created_by',
        'updated_by INT DEFAULT NULL AFTER created_by_name',
        'updated_by_name VARCHAR(255) DEFAULT NULL AFTER updated_by'
    ];

    $columnMap = [
        'entity' => 'entity INT NOT NULL DEFAULT 1 AFTER id',
        'invoice_id' => $columnsToAdd[0],
        'draft_key' => $columnsToAdd[1],
        'client_name' => $columnsToAdd[2],
        'period_month' => $columnsToAdd[3],
        'created_by' => $columnsToAdd[4],
        'created_by_name' => $columnsToAdd[5],
        'updated_by' => $columnsToAdd[6],
        'updated_by_name' => $columnsToAdd[7],
        'discount' => 'discount DECIMAL(6,3) DEFAULT 0 AFTER total_ht',
    ];

    foreach ($columnMap as $column => $definition) {
        if (!billingColumnExists($pdo, 'tble_client_invoice_lines', $column)) {
            $pdo->exec("ALTER TABLE tble_client_invoice_lines ADD COLUMN $definition");
        }
    }

    // Ensure new index exists
    $indexCheck = $pdo->query("SHOW INDEX FROM tble_client_invoice_lines WHERE Key_name = 'idx_invoice_lines_draft'");
    if (!$indexCheck || $indexCheck->rowCount() === 0) {
        $pdo->exec("ALTER TABLE tble_client_invoice_lines ADD KEY idx_invoice_lines_draft (draft_key)");
    }
    $indexEntityCheck = $pdo->query("SHOW INDEX FROM tble_client_invoice_lines WHERE Key_name = 'idx_invoice_lines_entity'");
    if (!$indexEntityCheck || $indexEntityCheck->rowCount() === 0) {
        $pdo->exec("ALTER TABLE tble_client_invoice_lines ADD KEY idx_invoice_lines_entity (entity)");
    }

    $ensuredLines = true;
}

function invoiceIsLocked(PDO $pdo, string $invoiceNumber, ?int $entity = null): bool {
    $sql = "SELECT status_code FROM tble_client_billed WHERE invoice_number = :invoice";
    $params = [':invoice' => $invoiceNumber];
    if ($entity !== null) {
        $sql .= " AND entity = :entity";
        $params[':entity'] = $entity;
    }
    $sql .= " ORDER BY billed_at DESC LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $status = $stmt->fetchColumn();
    if (!$status) {
        return false;
    }
    $status = strtolower(trim((string) $status));
    $lockedStatuses = ['paid', 'payee', 'payée', 'reglee', 'réglée', 'paid_partially', 'payee_partiellement'];
    return in_array($status, $lockedStatuses, true);
}

function normalizeClientBillingStatus($value): array {
    $code = 'draft';
    $label = 'Brouillon';
    if ($value === null) {
        return [$code, $label];
    }

    $normalized = strtolower(trim((string) $value));
    switch ($normalized) {
        case 'annulee':
        case 'annulée':
        case 'annule':
        case 'annulé':
        case 'cancelled':
        case 'canceled':
        case 'cancel':
            $code = 'cancelled';
            $label = 'Annulée';
            break;
        case 'validée':
        case 'validee':
        case 'valide':
        case 'validated':
        case 'validate':
            $code = 'validated';
            $label = 'Validée';
            break;
        case 'envoyee':
        case 'envoyée':
        case 'envoye':
        case 'envoyé':
        case 'sent':
        case 'env':
            $code = 'sent';
            $label = 'Envoyée';
            break;
        case 'payee':
        case 'payée':
        case 'payee_partiellement':
        case 'payee partiellement':
        case 'reglee':
        case 'réglée':
        case 'paid':
        case 'paid_partially':
            $code = 'paid';
            $label = 'Payée';
            break;
        case 'impayee':
        case 'impayée':
        case 'overdue':
        case 'unpaid':
        case 'retard':
            $code = 'unpaid';
            $label = 'Impayée';
            break;
        case 'brouillon':
        case 'draft':
        case 'afacturer':
        case 'a_facturer':
        default:
            $code = 'draft';
            $label = 'Brouillon';
            break;
    }
    return [$code, $label];
}

function sanitizeInvoiceFilename(string $value): string {
    $value = trim($value);
    if ($value === '') {
        return 'facture-client';
    }
    $value = preg_replace('/[^A-Za-z0-9-_]/', '_', $value);
    return $value !== '' ? strtolower($value) : 'facture-client';
}

function decodePdfPayload(?string $value): ?string {
    if ($value === null) {
        return null;
    }
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    if (strpos($value, 'base64,') !== false) {
        $parts = explode('base64,', $value, 2);
        $value = $parts[1];
    }
    $decoded = base64_decode($value, true);
    return $decoded === false ? null : $decoded;
}
