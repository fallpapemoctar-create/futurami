<?php
require_once __DIR__ . "/config.php";
require_once __DIR__ . "/billing_helpers.php";

// Exporting all missions can load a lot of rows; lift resource limits defensively
@ini_set('memory_limit', '512M');
@set_time_limit(120);

function columnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $table = str_replace('`', '', $table);
        $column = str_replace('`', '', $column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
        return $stmt && $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

function normalizeMissionTypesField($value): array {
    $source = [];
    if (is_array($value)) {
        $source = $value;
    } elseif (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $source = $decoded;
        } else {
            $source = explode(',', $value);
        }
    } elseif ($value === null || $value === '') {
        return [];
    } else {
        $source = [$value];
    }

    $result = [];
    foreach ($source as $item) {
        if (is_array($item)) {
            $item = implode(' ', $item);
        }
        $str = trim((string)$item);
        if ($str === '') {
            continue;
        }
        if (!isset($result[$str])) {
            $result[$str] = true;
        }
    }

    return array_keys($result);
}

function isZeroDateValue($value): bool {
    if ($value === null) {
        return true;
    }
    $trimmed = trim((string)$value);
    if ($trimmed === '') {
        return true;
    }
    return preg_match('/^0{4}-0{2}-0{2}(?: 0{2}:0{2}:0{2})?$/', $trimmed) === 1;
}

function normalizeIsoDateValue($value): ?string {
    if (isZeroDateValue($value)) {
        return null;
    }
    try {
        $dateTime = new DateTime((string)$value);
        return $dateTime->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return trim((string)$value) !== '' ? (string)$value : null;
    }
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Params: page, pageSize, q (search), requestingCompany, dateStart, dateEnd, billedStatus, clientBilledStatus, missionStatus, missionType
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $pageSize = isset($_GET['pageSize']) ? intval($_GET['pageSize']) : 50;
    if ($pageSize <= 0) $pageSize = 50;
    if ($pageSize > 500) $pageSize = 500; // safety cap
    $offset = ($page - 1) * $pageSize;
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    $requestingCompany = isset($_GET['requestingCompany']) ? trim($_GET['requestingCompany']) : '';
    $dateStart = isset($_GET['dateStart']) ? trim($_GET['dateStart']) : '';
    $dateEnd = isset($_GET['dateEnd']) ? trim($_GET['dateEnd']) : '';
    $billedStatus = isset($_GET['billedStatus']) ? trim($_GET['billedStatus']) : '';
    $clientBilledStatus = isset($_GET['clientBilledStatus']) ? trim($_GET['clientBilledStatus']) : '';
    $missionStatus = isset($_GET['missionStatus']) ? trim($_GET['missionStatus']) : '';
    $missionType = isset($_GET['missionType']) ? trim($_GET['missionType']) : '';
    $clientId = isset($_GET['clientId']) ? intval($_GET['clientId']) : 0;
    $exportAll = isset($_GET['exportAll']) && ($_GET['exportAll'] === '1' || strtolower($_GET['exportAll']) === 'true');

    // Detect optional columns (compat with varying schemas)
    $modifierColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'fk_user_modif') ? 'fk_user_modif' : null;
    $hasTmsColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'tms');
    $hasMissionTypesColumn = columnExists($pdo, 'llx_missionsplanet_mission', 'mission_types');

    // S'assure que llx_missionsplanet_mission a bien sa colonne entity propre
    // (auto-réparateur : backfill DEFAULT 1 sur les lignes existantes si besoin).
    ensureMissionEntityColumn($pdo);

    $where = "1=1";
    $params = [];
    // Cloisonnement multi-entités : filtre direct sur m.entity — générique pour
    // n'importe quelle entité, et fiable même si le client ou l'interprète
    // référencé par la mission a été supprimé/fusionné entre-temps (l'ancien
    // filtre via JOIN u.entity/s.entity rendait ces missions invisibles pour
    // tout le monde dans ce cas).
    $where .= " AND m.entity = :entity";
    $params[':entity'] = $currentEntity;
    // Suppression logique : `delete_mission_interpreter.php` bascule status = 9.
    // Les missions soft-delete ne doivent PAS remonter dans la datatable UI.
    $where .= " AND m.status <> 9";
    if ($q !== '') {
        $missionTypesSearch = $hasMissionTypesColumn ? " OR m.mission_types LIKE :q" : "";
        $where .= " AND (m.ref LIKE :q OR u.firstname LIKE :q OR u.lastname LIKE :q OR s.nom LIKE :q OR p.ref LIKE :q OR cb.invoice_number LIKE :q OR cb.status_label LIKE :q" . $missionTypesSearch . ")";
        $params[':q'] = "%$q%";
    }
    if ($requestingCompany !== '') {
        $where .= " AND s.nom LIKE :requestingCompany";
        $params[':requestingCompany'] = "%$requestingCompany%";
    }
    if ($clientId > 0) {
        $where .= " AND m.fk_soc = :clientId";
        $params[':clientId'] = $clientId;
    }
    if ($dateStart !== '') {
        $startDate = DateTime::createFromFormat('Y-m-d', $dateStart);
        if ($startDate !== false) {
            $where .= " AND m.datemission >= :dateStart";
            $params[':dateStart'] = $startDate->format('Y-m-d');
        }
    }
    if ($dateEnd !== '') {
        $endDate = DateTime::createFromFormat('Y-m-d', $dateEnd);
        if ($endDate !== false) {
            $endDate->modify('+1 day');
            $where .= " AND m.datemission < :dateEndExclusive";
            $params[':dateEndExclusive'] = $endDate->format('Y-m-d');
        }
    }
    if ($billedStatus !== '') {
        $normalizedBilledStatus = mb_strtolower($billedStatus, 'UTF-8');
        if ($normalizedBilledStatus === 'brouillon') {
            $where .= " AND (b.status IS NULL OR TRIM(b.status) = '' OR LOWER(b.status) = :billedStatus)";
            $params[':billedStatus'] = 'brouillon';
        } else {
            $where .= " AND LOWER(b.status) = :billedStatus";
            $params[':billedStatus'] = $normalizedBilledStatus;
        }
    }
    if ($clientBilledStatus !== '') {
        $normalizedClientStatus = mb_strtolower($clientBilledStatus, 'UTF-8');
        if ($normalizedClientStatus === 'non facturée' || $normalizedClientStatus === 'non facture' || $normalizedClientStatus === 'non facturé') {
            $where .= " AND cb.status_code IS NULL";
        } else {
            $codeMap = [
                'brouillon'  => 'draft',
                'validée'    => 'validated',
                'validee'    => 'validated',
                'envoyée'    => 'sent',
                'envoyee'    => 'sent',
                'payée'      => 'paid',
                'payee'      => 'paid',
                'impayée'    => 'unpaid',
                'impayee'    => 'unpaid',
                'annulée'    => 'cancelled',
                'annulee'    => 'cancelled',
            ];
            $code = $codeMap[$normalizedClientStatus] ?? $normalizedClientStatus;
            $where .= " AND cb.status_code = :clientBilledStatus";
            $params[':clientBilledStatus'] = $code;
        }
    }
    if ($missionStatus !== '') {
        $parsedMissionStatus = intval($missionStatus);
        $where .= " AND m.status = :missionStatus";
        $params[':missionStatus'] = $parsedMissionStatus;
    }
    if ($missionType !== '') {
        if ($hasMissionTypesColumn) {
            $where .= " AND LOWER(m.mission_types) LIKE :missionType";
            $params[':missionType'] = '%' . mb_strtolower($missionType, 'UTF-8') . '%';
        } else {
            $where .= " AND 1 = 0";
        }
    }

    // Detect correct creator column name (fk_user_creator vs fk_user_create)
    $creatorColumn = null;
    try {
        // Common Dolibarr pattern is fk_user_creat (without 'e')
        $colStmt0 = $pdo->query("SHOW COLUMNS FROM llx_missionsplanet_mission LIKE 'fk_user_creat'");
        if ($colStmt0 && $colStmt0->rowCount() > 0) {
            $creatorColumn = 'fk_user_creat';
        } else {
            $colStmt1 = $pdo->query("SHOW COLUMNS FROM llx_missionsplanet_mission LIKE 'fk_user_creator'");
            if ($colStmt1 && $colStmt1->rowCount() > 0) {
                $creatorColumn = 'fk_user_creator';
            } else {
                $colStmt2 = $pdo->query("SHOW COLUMNS FROM llx_missionsplanet_mission LIKE 'fk_user_create'");
                if ($colStmt2 && $colStmt2->rowCount() > 0) {
                    $creatorColumn = 'fk_user_create';
                }
            }
        }
    } catch (Exception $e) {
        // ignore, leave as null
        $creatorColumn = null;
    }

    ensureClientBillingTable($pdo);

    // Count total
    $countSql = "
        SELECT COUNT(*) AS total
        FROM llx_missionsplanet_mission m
        LEFT JOIN llx_user u ON m.nominterprete = u.rowid
        LEFT JOIN llx_product p ON m.langue = p.rowid
        LEFT JOIN llx_societe s ON s.rowid = m.fk_soc
        LEFT JOIN (
            SELECT bb.ref, bb.status
            FROM tble_mission_billed bb
            INNER JOIN (
                SELECT ref, MAX(billed_at) AS max_billed_at
                FROM tble_mission_billed
                GROUP BY ref
            ) last ON last.ref = bb.ref AND last.max_billed_at = bb.billed_at
        ) b ON b.ref = m.ref
        LEFT JOIN (
            SELECT cb_inner.mission_ref,
                   cb_inner.invoice_number,
                   cb_inner.status_code,
                   cb_inner.status_label
            FROM tble_client_billed cb_inner
            INNER JOIN (
                SELECT mission_ref, MAX(billed_at) AS max_billed_at
                FROM tble_client_billed
                WHERE category = 'client'
                GROUP BY mission_ref
            ) latest_cb ON latest_cb.mission_ref = cb_inner.mission_ref AND latest_cb.max_billed_at = cb_inner.billed_at
            WHERE cb_inner.category = 'client'
        ) cb ON cb.mission_ref = m.ref
        WHERE $where";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) $countStmt->bindValue($k, $v);
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Page data
    $selectCreator = $creatorColumn !== null
        ? "uc.firstname AS creator_firstname,\n            uc.lastname AS creator_lastname,"
        : "NULL AS creator_firstname,\n            NULL AS creator_lastname,";
    $joinCreator = $creatorColumn !== null ? "LEFT JOIN llx_user uc ON uc.rowid = m.$creatorColumn" : "";
    $selectModifier = $modifierColumn !== null
        ? "um.firstname AS modifier_firstname,\n            um.lastname AS modifier_lastname,"
        : "NULL AS modifier_firstname,\n            NULL AS modifier_lastname,";
    $joinModifier = $modifierColumn !== null ? "LEFT JOIN llx_user um ON um.rowid = m.$modifierColumn" : "";
    $selectTms = $hasTmsColumn
        ? "m.tms AS date_modification_raw,"
        : "NULL AS date_modification_raw,";
    $selectMissionTypes = $hasMissionTypesColumn
        ? "m.mission_types,"
        : "NULL AS mission_types,";

    $sql = "
        SELECT
            m.rowid,
            m.ref AS reference_devis,
            m.label,
            m.nominterprete,
            m.fk_soc AS client_id,
            m.contactdemandeur AS contact_id,
            m.description AS commentaires,
            m.datemission,
            m.heuredebutmission,
            m.dureemission,
            m.status AS mission_status,
            $selectMissionTypes
            m.date_creation,
            $selectTms
            u.firstname,
            u.lastname,
            $selectCreator
            $selectModifier
            p.ref AS produit_ref,
            p.label AS produit_label,
            p.price AS produit_price,
            p.tva_tx AS produit_tva_tx,
            p.rowid AS id_produit_service,
            s.nom AS client_name,
            s.code_client AS client_code,
            s.address AS client_address,
            s.zip AS client_zip,
            s.town AS client_town,
            socp.firstname AS prenom_demandeur,
            socp.lastname AS nom_demandeur,
            socp.phone AS phone,
            socp.phone_mobile AS phone_mobile,
            b.status AS billed_status,
            cb.status_code AS client_billed_status,
            cb.status_label AS client_billed_status_label,
            cb.invoice_number AS client_invoice_number,
            cb.billed_at AS client_billed_at
        FROM llx_missionsplanet_mission m
        LEFT JOIN llx_user u ON m.nominterprete = u.rowid
        $joinCreator
        $joinModifier
        LEFT JOIN llx_product p ON m.langue = p.rowid
        LEFT JOIN llx_societe s ON s.rowid = m.fk_soc
        LEFT JOIN llx_socpeople socp ON socp.rowid = m.contactdemandeur
        LEFT JOIN (
            SELECT bb.ref, bb.status
            FROM tble_mission_billed bb
            INNER JOIN (
                SELECT ref, MAX(billed_at) AS max_billed_at
                FROM tble_mission_billed
                GROUP BY ref
            ) last ON last.ref = bb.ref AND last.max_billed_at = bb.billed_at
        ) b ON b.ref = m.ref
        LEFT JOIN (
            SELECT cb_inner.mission_ref,
                   cb_inner.invoice_number,
                   cb_inner.status_code,
                   cb_inner.status_label,
                   cb_inner.billed_at
            FROM tble_client_billed cb_inner
            INNER JOIN (
                SELECT mission_ref, MAX(billed_at) AS max_billed_at
                FROM tble_client_billed
                WHERE category = 'client'
                GROUP BY mission_ref
            ) latest_cb ON latest_cb.mission_ref = cb_inner.mission_ref AND latest_cb.max_billed_at = cb_inner.billed_at
            WHERE cb_inner.category = 'client'
        ) cb ON cb.mission_ref = m.ref
        WHERE $where
        ORDER BY m.datemission DESC, m.heuredebutmission ASC
    ";

    if (!$exportAll) {
        $sql .= " LIMIT :limit OFFSET :offset";
    }

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    if (!$exportAll) {
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalize/format fields
    foreach ($rows as &$r) {
        // Build interpreter full name
        $r['interpreter_name'] = trim(($r['firstname'] ?? '') . ' ' . ($r['lastname'] ?? ''));
        // Build creator full name
        $r['creator_name'] = trim(($r['creator_firstname'] ?? '') . ' ' . ($r['creator_lastname'] ?? ''));
        // Format date to ISO if needed
        $r['datemission'] = isZeroDateValue($r['datemission'] ?? null)
            ? null
            : $r['datemission'];
        $r['datemission_iso'] = normalizeIsoDateValue($r['datemission'] ?? null);

        $r['date_creation'] = isZeroDateValue($r['date_creation'] ?? null)
            ? null
            : $r['date_creation'];
        $r['date_creation_iso'] = normalizeIsoDateValue($r['date_creation'] ?? null);

        $rawModDate = $r['date_modification_raw'] ?? null;
        $r['date_modification'] = isZeroDateValue($rawModDate) ? null : $rawModDate;
        $r['date_modification_iso'] = normalizeIsoDateValue($r['date_modification'] ?? null);

        $updatedBy = trim(($r['modifier_firstname'] ?? '') . ' ' . ($r['modifier_lastname'] ?? ''));
        $r['updated_by'] = $updatedBy !== '' ? $updatedBy : null;
        if ($hasMissionTypesColumn) {
            $r['mission_types'] = normalizeMissionTypesField($r['mission_types'] ?? []);
        } else {
            $r['mission_types'] = [];
        }
    }

    echo json_encode([
        'success' => true,
        'count' => count($rows),
        'total' => $total,
        'page' => $exportAll ? 1 : $page,
        'pageSize' => $exportAll ? $total : $pageSize,
        'missions' => $rows
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'details' => $e->getMessage()]);
}
