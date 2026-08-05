<?php

function valueFrom(array $source, array $keys, $default = '') {
    foreach ($keys as $key) {
        if (isset($source[$key]) && $source[$key] !== null) {
            return trim((string) $source[$key]);
        }
    }
    return $default;
}

function slugifyLogin($value) {
    $value = trim((string) $value);
    if ($value === '') {
        return 'interprete';
    }
    $login = function_exists('iconv') ? iconv('UTF-8', 'ASCII//TRANSLIT', $value) : $value;
    if ($login === false) {
        $login = $value;
    }
    $login = strtolower($login);
    $login = preg_replace('/[^a-z0-9]/', '', $login ?? '');
    return $login !== '' ? $login : 'interprete';
}

function ensureUniqueLogin(PDO $pdo, $baseLogin) {
    $login = $baseLogin;
    $suffix = 1;
    $stmt = $pdo->prepare("SELECT 1 FROM llx_user WHERE login = ? LIMIT 1");
    while (true) {
        $stmt->execute([$login]);
        if (!$stmt->fetchColumn()) {
            return $login;
        }
        $login = $baseLogin . $suffix;
        $suffix++;
    }
}

function normalizeStatus($value) {
    if ($value === null) {
        return 'Disponible';
    }
    $value = trim((string) $value);
    if ($value === '') {
        return 'Disponible';
    }
    if (is_numeric($value)) {
        return intval($value) === 1 ? 'Disponible' : 'Indisponible';
    }
    $lower = strtolower($value);
    if (in_array($lower, ['disponible', 'available', 'oui', 'yes'], true)) {
        return 'Disponible';
    }
    if (in_array($lower, ['indisponible', 'not available', 'non', 'no'], true)) {
        return 'Indisponible';
    }
    return $value;
}

function ensureInterpreterRight(PDO $pdo, $userId) {
    $rightStmt = $pdo->prepare("SELECT id FROM tble_rights WHERE name = :name LIMIT 1");
    $rightStmt->execute([':name' => 'interprete']);
    $rightId = $rightStmt->fetchColumn();
    if (!$rightId) {
        return;
    }
    $check = $pdo->prepare("SELECT 1 FROM tble_user_rights WHERE user_id = :uid AND right_id = :rid LIMIT 1");
    $check->execute([':uid' => $userId, ':rid' => $rightId]);
    if ($check->fetchColumn()) {
        return;
    }
    $ins = $pdo->prepare("INSERT INTO tble_user_rights (user_id, right_id) VALUES (:uid, :rid)");
    $ins->execute([':uid' => $userId, ':rid' => $rightId]);
}

function getFirstLetter($value) {
    $value = trim((string) $value);
    if ($value === '') {
        return '';
    }
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, 1, 'UTF-8');
    }
    return substr($value, 0, 1);
}

function getCountriesCache(PDO $pdo) {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $stmt = $pdo->query("SELECT rowid, code, code_iso, label FROM llx_c_country");
    $cache = [
        'by_id' => [],
        'by_code' => [],
        'by_label' => [],
    ];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) ($row['rowid'] ?? 0);
        if ($id <= 0) {
            continue;
        }
        $code = strtoupper(trim((string) ($row['code'] ?? '')));
        $codeIso = strtoupper(trim((string) ($row['code_iso'] ?? '')));
        $label = trim((string) ($row['label'] ?? ''));
        $labelKey = $label !== ''
            ? (function_exists('mb_strtoupper') ? mb_strtoupper($label, 'UTF-8') : strtoupper($label))
            : '';

        $cache['by_id'][$id] = [
            'id' => $id,
            'code' => $code,
            'code_iso' => $codeIso,
            'label' => $label,
        ];

        if ($code !== '') {
            $cache['by_code'][$code] = $id;
        }
        if ($codeIso !== '') {
            $cache['by_code'][$codeIso] = $id;
        }
        if ($labelKey !== '') {
            $cache['by_label'][$labelKey] = $id;
        }
    }
    return $cache;
}

function resolveCountryId(PDO $pdo, $value) {
    if ($value === null) {
        return null;
    }
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $cache = getCountriesCache($pdo);

    if (ctype_digit($value)) {
        $id = (int) $value;
        if (isset($cache['by_id'][$id])) {
            return $id;
        }
    }

    $upper = function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
    if (isset($cache['by_code'][$upper])) {
        return $cache['by_code'][$upper];
    }
    if (isset($cache['by_label'][$upper])) {
        return $cache['by_label'][$upper];
    }

    return null;
}

function countryInfoFromId(PDO $pdo, $id) {
    if ($id === null) {
        return null;
    }
    $cache = getCountriesCache($pdo);
    $intId = (int) $id;
    return $cache['by_id'][$intId] ?? null;
}

function getDepartmentsCache(PDO $pdo) {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $stmt = $pdo->query("SELECT rowid, code_departement, nom FROM llx_c_departements WHERE active = 1");
    $cache = [
        'by_id' => [],
        'by_code' => [],
        'by_label' => [],
    ];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) ($row['rowid'] ?? 0);
        if ($id <= 0) {
            continue;
        }

        $code = strtoupper(trim((string) ($row['code_departement'] ?? '')));
        $label = trim((string) ($row['nom'] ?? ''));
        $labelKey = $label !== ''
            ? (function_exists('mb_strtoupper') ? mb_strtoupper($label, 'UTF-8') : strtoupper($label))
            : '';

        $cache['by_id'][$id] = [
            'id' => $id,
            'code' => $code,
            'label' => $label,
        ];

        if ($code !== '') {
            $cache['by_code'][$code] = $id;
        }
        if ($labelKey !== '') {
            $cache['by_label'][$labelKey] = $id;
        }
    }

    return $cache;
}

function resolveDepartmentId(PDO $pdo, $value) {
    if ($value === null) {
        return null;
    }
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $cache = getDepartmentsCache($pdo);

    if (ctype_digit($value)) {
        $id = (int) $value;
        if (isset($cache['by_id'][$id])) {
            return $id;
        }
    }

    $upper = function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
    if (isset($cache['by_code'][$upper])) {
        return $cache['by_code'][$upper];
    }
    if (isset($cache['by_label'][$upper])) {
        return $cache['by_label'][$upper];
    }

    return null;
}

function departmentInfoFromId(PDO $pdo, $id) {
    if ($id === null) {
        return null;
    }
    $cache = getDepartmentsCache($pdo);
    $intId = (int) $id;
    return $cache['by_id'][$intId] ?? null;
}
