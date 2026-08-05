<?php
/**
 * entity_bootstrap.php (porté depuis AMI-PTF pour parité d'infrastructure)
 *
 * Logique partagée de duplication des données de référence (clients,
 * contacts, produits/services, users/interprètes) vers une entité cible.
 *
 * NOTE pour futurAMI : configuré sur DOLIBARR_ENTITY=2 (PLANETE TRADUCTION
 * FRANCE), comme AMI-PTF. `login.php` appelle donc runEntityDataDuplicationOnce()
 * au premier login réussi, exactement comme AMI-PTF — les deux apps
 * partagent la même base et la même entité cible, donc le même mécanisme de
 * duplication/auto-heal (idempotent via `tble_entity_dup_map`, sans risque
 * de doublon même si les deux apps le déclenchent chacune de leur côté).
 *
 * Toute duplication est tracée dans `tble_entity_dup_map` (idempotence :
 * relancer ne recrée jamais de doublons).
 */

if (!function_exists('ensureDupMapTable')) {
    function ensureDupMapTable(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS tble_entity_dup_map (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            source_table VARCHAR(64) NOT NULL,
            source_rowid INT NOT NULL,
            target_rowid INT NOT NULL,
            target_entity INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dup (source_table, source_rowid, target_entity)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    }
}

if (!function_exists('ensureEntityBootstrapTable')) {
    function ensureEntityBootstrapTable(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS tble_entity_bootstrap (
            entity INT NOT NULL PRIMARY KEY,
            status VARCHAR(16) NOT NULL DEFAULT 'done',
            summary TEXT DEFAULT NULL,
            completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    }
}

if (!function_exists('hasEntityBootstrapRun')) {
    function hasEntityBootstrapRun(PDO $pdo, int $entity): bool {
        ensureEntityBootstrapTable($pdo);
        $stmt = $pdo->prepare('SELECT 1 FROM tble_entity_bootstrap WHERE entity = :e LIMIT 1');
        $stmt->execute([':e' => $entity]);
        return $stmt->fetchColumn() !== false;
    }
}

if (!function_exists('minutesSinceEntityBootstrapRun')) {
    function minutesSinceEntityBootstrapRun(PDO $pdo, int $entity): ?float {
        ensureEntityBootstrapTable($pdo);
        $stmt = $pdo->prepare('SELECT completed_at FROM tble_entity_bootstrap WHERE entity = :e LIMIT 1');
        $stmt->execute([':e' => $entity]);
        $val = $stmt->fetchColumn();
        if ($val === false) {
            return null;
        }
        return (time() - strtotime($val)) / 60;
    }
}

if (!function_exists('markEntityBootstrapRun')) {
    function markEntityBootstrapRun(PDO $pdo, int $entity, string $summary): void {
        ensureEntityBootstrapTable($pdo);
        $stmt = $pdo->prepare(
            'INSERT INTO tble_entity_bootstrap (entity, status, summary) VALUES (:e, "done", :s)
             ON DUPLICATE KEY UPDATE status = "done", summary = :s, completed_at = NOW()'
        );
        $stmt->execute([':e' => $entity, ':s' => $summary]);
    }
}

if (!function_exists('alreadyDuplicatedToEntity')) {
    function alreadyDuplicatedToEntity(PDO $pdo, string $table, int $sourceRowid, int $targetEntity): ?int {
        $stmt = $pdo->prepare(
            'SELECT target_rowid FROM tble_entity_dup_map WHERE source_table = :t AND source_rowid = :r AND target_entity = :e LIMIT 1'
        );
        $stmt->execute([':t' => $table, ':r' => $sourceRowid, ':e' => $targetEntity]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (int) $val : null;
    }
}

if (!function_exists('recordEntityDuplication')) {
    function recordEntityDuplication(PDO $pdo, string $table, int $sourceRowid, int $targetRowid, int $targetEntity): void {
        $stmt = $pdo->prepare(
            'INSERT INTO tble_entity_dup_map (source_table, source_rowid, target_rowid, target_entity) VALUES (:t, :s, :tr, :e)'
        );
        $stmt->execute([':t' => $table, ':s' => $sourceRowid, ':tr' => $targetRowid, ':e' => $targetEntity]);
    }
}

if (!function_exists('duplicateEntityRow')) {
    /**
     * Duplique une ligne d'une table en copiant toutes ses colonnes (sauf la
     * PK et les colonnes de $overrides), en forçant entity = $targetEntity
     * et en remappant les colonnes de $fkRemap via les tables de mapping
     * fournies (source_id => target_id). Gère les collisions de clé unique
     * en suffixant les colonnes "à risque" de $uniqueColumns.
     *
     * @return int|null Nouveau rowid, ou null si l'insertion a échoué après retries.
     */
    function duplicateEntityRow(
        PDO $pdo,
        string $table,
        string $pkColumn,
        array $row,
        int $targetEntity,
        array $overrides,
        array $fkRemap,
        array $uniqueColumns,
        string $suffix,
        array &$log
    ): ?int {
        unset($row[$pkColumn]);
        if (array_key_exists('entity', $row)) {
            $row['entity'] = $targetEntity;
        }
        foreach ($overrides as $col => $val) {
            if (array_key_exists($col, $row)) {
                $row[$col] = $val;
            }
        }
        foreach ($fkRemap as $col => $map) {
            if (array_key_exists($col, $row) && $row[$col] !== null && isset($map[(int) $row[$col]])) {
                $row[$col] = $map[(int) $row[$col]];
            }
        }

        $attempt = 0;
        while ($attempt < 3) {
            $attempt++;
            $columns = array_keys($row);
            $placeholders = array_map(static fn($c) => ":$c", $columns);
            $sql = "INSERT INTO `$table` (" . implode(',', array_map(static fn($c) => "`$c`", $columns)) . ')'
                . ' VALUES (' . implode(',', $placeholders) . ')';
            try {
                $stmt = $pdo->prepare($sql);
                foreach ($row as $col => $val) {
                    $stmt->bindValue(":$col", $val);
                }
                $stmt->execute();
                return (int) $pdo->lastInsertId();
            } catch (PDOException $e) {
                $isDuplicate = ($e->errorInfo[1] ?? null) === 1062;
                if (!$isDuplicate || empty($uniqueColumns)) {
                    $log[] = "    ! Échec insertion dans $table : " . $e->getMessage();
                    return null;
                }
                foreach ($uniqueColumns as $uc) {
                    if (!empty($row[$uc])) {
                        $row[$uc] = substr($row[$uc] . $suffix . $attempt, 0, 180);
                    }
                }
                $log[] = "    · Collision clé unique sur $table (tentative $attempt), nouvel essai avec suffixe...";
            }
        }
        $log[] = "    ! Abandon insertion dans $table après 3 tentatives (collisions persistantes).";
        return null;
    }
}

if (!function_exists('runEntityDataDuplication')) {
    /**
     * Exécute (ou simule si $apply=false) la duplication complète
     * clients -> contacts -> produits -> users/droits vers $targetEntity.
     *
     * @return array{log: string[], summary: array<string,int>}
     */
    function runEntityDataDuplication(
        PDO $pdo,
        int $targetEntity,
        ?int $sourceEntity,
        string $loginSuffix,
        bool $apply
    ): array {
        $log = [];
        $summary = [];
        ensureDupMapTable($pdo);

        $where = $sourceEntity !== null ? 'entity = :src' : 'entity != :target';
        $params = $sourceEntity !== null ? [':src' => $sourceEntity] : [':target' => $targetEntity];

        // 1) CLIENTS
        $stmt = $pdo->prepare("SELECT * FROM llx_societe WHERE $where");
        $stmt->execute($params);
        $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $socMap = [];
        $clientsCreated = 0;
        $clientsSkipped = 0;
        foreach ($clients as $row) {
            $oldId = (int) $row['rowid'];
            $existing = alreadyDuplicatedToEntity($pdo, 'llx_societe', $oldId, $targetEntity);
            if ($existing !== null) {
                $socMap[$oldId] = $existing;
                $clientsSkipped++;
                continue;
            }
            if (!$apply) {
                $clientsCreated++;
                continue;
            }
            $newId = duplicateEntityRow(
                $pdo, 'llx_societe', 'rowid', $row, $targetEntity, [], [],
                ['code_client', 'code_fournisseur', 'barcode', 'siren', 'siret'], '-E', $log
            );
            if ($newId !== null) {
                $socMap[$oldId] = $newId;
                recordEntityDuplication($pdo, 'llx_societe', $oldId, $newId, $targetEntity);
                $clientsCreated++;
            }
        }
        $summary['clients_source'] = count($clients);
        $summary['clients_created'] = $clientsCreated;
        $summary['clients_skipped'] = $clientsSkipped;

        // 2) CONTACTS
        $stmt = $pdo->prepare("SELECT * FROM llx_socpeople WHERE $where");
        $stmt->execute($params);
        $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $contactsCreated = 0;
        $contactsSkipped = 0;
        $contactsOrphaned = 0;
        foreach ($contacts as $row) {
            $oldId = (int) $row['rowid'];
            $existing = alreadyDuplicatedToEntity($pdo, 'llx_socpeople', $oldId, $targetEntity);
            if ($existing !== null) {
                $contactsSkipped++;
                continue;
            }
            $oldFkSoc = isset($row['fk_soc']) ? (int) $row['fk_soc'] : 0;
            if ($oldFkSoc > 0 && $apply && !isset($socMap[$oldFkSoc])) {
                $log[] = "    · Contact #$oldId ignoré (client parent #$oldFkSoc non dupliqué).";
                $contactsOrphaned++;
                continue;
            }
            if (!$apply) {
                $contactsCreated++;
                continue;
            }
            $newId = duplicateEntityRow(
                $pdo, 'llx_socpeople', 'rowid', $row, $targetEntity, [], ['fk_soc' => $socMap],
                ['code_client', 'code_fournisseur'], '-E', $log
            );
            if ($newId !== null) {
                recordEntityDuplication($pdo, 'llx_socpeople', $oldId, $newId, $targetEntity);
                $contactsCreated++;
            }
        }
        $summary['contacts_source'] = count($contacts);
        $summary['contacts_created'] = $contactsCreated;
        $summary['contacts_skipped'] = $contactsSkipped;
        $summary['contacts_orphaned'] = $contactsOrphaned;

        // 3) PRODUITS / SERVICES
        $stmt = $pdo->prepare("SELECT * FROM llx_product WHERE $where");
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $productMap = [];
        $productsCreated = 0;
        $productsSkipped = 0;
        foreach ($products as $row) {
            $oldId = (int) $row['rowid'];
            $existing = alreadyDuplicatedToEntity($pdo, 'llx_product', $oldId, $targetEntity);
            if ($existing !== null) {
                $productMap[$oldId] = $existing;
                $productsSkipped++;
                continue;
            }
            if (!$apply) {
                $productsCreated++;
                continue;
            }
            $newId = duplicateEntityRow(
                $pdo, 'llx_product', 'rowid', $row, $targetEntity, [], [],
                ['ref', 'barcode'], '-E', $log
            );
            if ($newId !== null) {
                $productMap[$oldId] = $newId;
                recordEntityDuplication($pdo, 'llx_product', $oldId, $newId, $targetEntity);
                $productsCreated++;
            }
        }
        if ($apply && !empty($productMap)) {
            $hasParentCol = $pdo->query("SHOW COLUMNS FROM llx_product LIKE 'fk_product_parent'");
            if ($hasParentCol && $hasParentCol->rowCount() > 0) {
                $upd = $pdo->prepare('UPDATE llx_product SET fk_product_parent = :new WHERE rowid = :id');
                foreach ($products as $row) {
                    $oldParent = isset($row['fk_product_parent']) ? (int) $row['fk_product_parent'] : 0;
                    $oldId = (int) $row['rowid'];
                    if ($oldParent > 0 && isset($productMap[$oldParent]) && isset($productMap[$oldId])) {
                        $upd->execute([':new' => $productMap[$oldParent], ':id' => $productMap[$oldId]]);
                    }
                }
            }
        }
        $summary['products_source'] = count($products);
        $summary['products_created'] = $productsCreated;
        $summary['products_skipped'] = $productsSkipped;

        // 3bis) TERMES / CONDITIONS DE PAIEMENT
        $stmt = $pdo->prepare("SELECT * FROM llx_c_payment_term WHERE $where");
        $stmt->execute($params);
        $paymentTerms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $paymentTermsCreated = 0;
        $paymentTermsSkipped = 0;
        foreach ($paymentTerms as $row) {
            $oldId = (int) $row['rowid'];
            $existing = alreadyDuplicatedToEntity($pdo, 'llx_c_payment_term', $oldId, $targetEntity);
            if ($existing !== null) {
                $paymentTermsSkipped++;
                continue;
            }
            if (!$apply) {
                $paymentTermsCreated++;
                continue;
            }
            // uk_c_payment_term_code porte sur (entity, code) : pas de risque de
            // collision inter-entité, mais on garde le suffixe de secours au cas
            // où la fonction serait rejouée hors du garde-fou de dédoublonnage.
            $newId = duplicateEntityRow(
                $pdo, 'llx_c_payment_term', 'rowid', $row, $targetEntity, [], [],
                ['code'], '-E', $log
            );
            if ($newId !== null) {
                recordEntityDuplication($pdo, 'llx_c_payment_term', $oldId, $newId, $targetEntity);
                $paymentTermsCreated++;
            }
        }
        $summary['payment_terms_source'] = count($paymentTerms);
        $summary['payment_terms_created'] = $paymentTermsCreated;
        $summary['payment_terms_skipped'] = $paymentTermsSkipped;

        // 4) USERS / INTERPRÈTES + DROITS
        $stmt = $pdo->prepare("SELECT * FROM llx_user WHERE $where");
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $userMap = [];
        $usersCreated = 0;
        $usersSkipped = 0;
        foreach ($users as $row) {
            $oldId = (int) $row['rowid'];
            $existing = alreadyDuplicatedToEntity($pdo, 'llx_user', $oldId, $targetEntity);
            if ($existing !== null) {
                $userMap[$oldId] = $existing;
                $usersSkipped++;
                continue;
            }
            if (!$apply) {
                $usersCreated++;
                continue;
            }
            $oldLogin = (string) ($row['login'] ?? '');
            $newLogin = $oldLogin !== '' ? substr($oldLogin . $loginSuffix, 0, 50) : $oldLogin;
            // api_key, fk_socpeople et fk_member portent des UNIQUE KEY globales
            // (non scopées par entity) dans llx_user. Copier tel quel la valeur
            // du user source ferait échouer l'INSERT (1062) pour toute ligne où
            // l'un de ces champs est renseigné : on les remet à NULL sur le
            // duplicata (l'utilisateur pourra régénérer sa clé API si besoin).
            $newId = duplicateEntityRow(
                $pdo, 'llx_user', 'rowid', $row, $targetEntity,
                ['login' => $newLogin, 'api_key' => null, 'fk_socpeople' => null, 'fk_member' => null],
                [], [], '', $log
            );
            if ($newId !== null) {
                $userMap[$oldId] = $newId;
                recordEntityDuplication($pdo, 'llx_user', $oldId, $newId, $targetEntity);
                $usersCreated++;
                $log[] = "    · $oldLogin -> $newLogin (mot de passe inchangé)";
            }
        }
        $summary['users_source'] = count($users);
        $summary['users_created'] = $usersCreated;
        $summary['users_skipped'] = $usersSkipped;

        $rightsCopied = 0;
        if ($apply && !empty($userMap)) {
            $rightsTableCheck = $pdo->query("SHOW TABLES LIKE 'tble_user_rights'");
            if ($rightsTableCheck && $rightsTableCheck->rowCount() > 0) {
                $selRights = $pdo->prepare('SELECT right_id FROM tble_user_rights WHERE user_id = :uid');
                $insRight = $pdo->prepare('INSERT IGNORE INTO tble_user_rights (user_id, right_id) VALUES (:uid, :rid)');
                foreach ($userMap as $oldUid => $newUid) {
                    $selRights->execute([':uid' => $oldUid]);
                    $rightIds = $selRights->fetchAll(PDO::FETCH_COLUMN);
                    foreach ($rightIds as $rid) {
                        $insRight->execute([':uid' => $newUid, ':rid' => $rid]);
                        $rightsCopied++;
                    }
                }
            }
        }
        $summary['rights_copied'] = $rightsCopied;

        return ['log' => $log, 'summary' => $summary];
    }
}

if (!function_exists('runEntityDataDuplicationOnce')) {
    /**
     * Point d'entrée "automatique" : à appeler depuis login.php après une
     * authentification réussie, UNIQUEMENT pour une entité "cible" (ex.
     * AMI-PTF, entity=2) qui doit récupérer les données de référence de
     * l'entité source (AMI, entity=1). futurAMI (entity=1) n'appelle PAS
     * cette fonction — voir note en tête de fichier.
     */
    function runEntityDataDuplicationOnce(PDO $pdo, int $targetEntity, string $loginSuffix = '_ptf', int $recheckIntervalMinutes = 60): void {
        try {
            $minutesSinceLastRun = minutesSinceEntityBootstrapRun($pdo, $targetEntity);
            if ($minutesSinceLastRun !== null && $minutesSinceLastRun < $recheckIntervalMinutes) {
                return;
            }
            $result = runEntityDataDuplication($pdo, $targetEntity, null, $loginSuffix, true);
            $summaryLine = 'entity_bootstrap[' . $targetEntity . ']: ' . json_encode($result['summary'], JSON_UNESCAPED_UNICODE);
            error_log('[entity_bootstrap] ' . $summaryLine);
            foreach ($result['log'] as $line) {
                error_log('[entity_bootstrap] ' . trim($line));
            }
            markEntityBootstrapRun($pdo, $targetEntity, $summaryLine);
        } catch (Throwable $e) {
            error_log('[entity_bootstrap] ECHEC pour entity=' . $targetEntity . ' : ' . $e->getMessage());
        }
    }
}
