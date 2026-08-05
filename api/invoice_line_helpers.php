<?php

function invoiceNormalizeDecimal($value, float $fallback = 0.0): float {
    if ($value === null) {
        return $fallback;
    }
    if (is_numeric($value)) {
        return (float) $value;
    }
    $cleaned = preg_replace('/[^0-9,.-]/', '', (string) $value);
    $cleaned = str_replace(',', '.', $cleaned);
    if ($cleaned === '' || $cleaned === '-' || $cleaned === '+') {
        return $fallback;
    }
    return (float) $cleaned;
}

function invoiceRoundCurrency(float $value, int $precision = 2): float {
    $factor = pow(10, $precision);
    return round($value * $factor) / $factor;
}

function invoiceDraftKey(string $clientName, string $periodMonthKey): string {
    $normalizedClient = trim($clientName);
    if (function_exists('mb_strtolower')) {
        $normalizedClient = mb_strtolower($normalizedClient, 'UTF-8');
    } else {
        $normalizedClient = strtolower($normalizedClient);
    }
    $hash = substr(sha1($normalizedClient . '|' . $periodMonthKey), 0, 16);
    return $periodMonthKey . '_' . $hash;
}

function invoiceParsePeriodMonth($value): ?DateTime {
    if ($value instanceof DateTime) {
        return DateTime::createFromFormat('Y-m-d', $value->format('Y-m-01')) ?: $value;
    }
    if (is_string($value)) {
        $text = trim($value);
        if ($text === '') {
            return null;
        }
        $formats = ['Y-m-d', 'Y-m', 'Y/m', 'm/Y'];
        foreach ($formats as $fmt) {
            $dt = DateTime::createFromFormat($fmt, $text);
            if ($dt instanceof DateTime) {
                return DateTime::createFromFormat('Y-m-d', $dt->format('Y-m-01')) ?: $dt;
            }
        }
        try {
            $dt = new DateTime($text);
            return DateTime::createFromFormat('Y-m-d', $dt->format('Y-m-01')) ?: $dt;
        } catch (Exception $e) {
            return null;
        }
    }
    if (is_int($value)) {
        try {
            $dt = (new DateTime())->setTimestamp($value);
            return DateTime::createFromFormat('Y-m-d', $dt->format('Y-m-01')) ?: $dt;
        } catch (Exception $e) {
            return null;
        }
    }
    return null;
}

function invoiceMissionRef(array $mission): ?string {
    $candidates = [
        $mission['reference_devis'] ?? null,
        $mission['reference'] ?? null,
        $mission['ref'] ?? null,
        $mission['mission_ref'] ?? null,
    ];
    foreach ($candidates as $value) {
        if ($value === null) {
            continue;
        }
        $text = trim((string) $value);
        if ($text !== '') {
            return $text;
        }
    }
    return null;
}

function invoiceMissionDate(array $mission): ?DateTime {
    $candidates = [
        $mission['datemission_iso'] ?? null,
        $mission['datemission'] ?? null,
        $mission['date_mission'] ?? null,
        $mission['mission_date'] ?? null,
        $mission['date'] ?? null,
    ];
    foreach ($candidates as $value) {
        if ($value === null) {
            continue;
        }
        if ($value instanceof DateTime) {
            return $value;
        }
        $text = trim((string) $value);
        if ($text === '') {
            continue;
        }
        $formats = ['Y-m-d H:i:s', 'Y-m-d', 'd/m/Y', 'd/m/Y H:i'];
        foreach ($formats as $fmt) {
            $dt = DateTime::createFromFormat($fmt, $text);
            if ($dt instanceof DateTime) {
                return $dt;
            }
        }
        try {
            return new DateTime($text);
        } catch (Exception $e) {
            continue;
        }
    }
    return null;
}

function invoiceParseDurationMinutes($value): ?float {
    if ($value === null) {
        return null;
    }
    if (is_numeric($value)) {
        return (float) $value;
    }
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    $text = str_replace(',', '.', $text);
    if (preg_match('/^(\d{1,2})[:hH](\d{1,2})$/', $text, $m)) {
        $hours = (int) $m[1];
        $minutes = (int) $m[2];
        return ($hours * 60.0) + $minutes;
    }
    if (is_numeric($text)) {
        return (float) $text;
    }
    return null;
}

function invoiceResolveQuantity(array $mission): float {
    $candidates = [
        $mission['quantity'] ?? null,
        $mission['qty'] ?? null,
    ];
    foreach ($candidates as $value) {
        if ($value === null) {
            continue;
        }
        $parsed = invoiceNormalizeDecimal($value, -1);
        if ($parsed > 0) {
            return $parsed;
        }
    }

    $duration = invoiceExtractDurationMinutes($mission);
    if ($duration !== null && $duration > 0) {
        if ($duration <= 15) {
            $duration = 15;
        } elseif ($duration <= 30) {
            $duration = 30;
        } elseif ($duration <= 60) {
            $duration = 60;
        } else {
            $duration = ceil($duration / 15) * 15;
        }
        return $duration / 60.0;
    }

    return 1.0;
}

function invoiceExtractDurationMinutes(array $mission): ?float {
    $direct = $mission['dureemission'] ?? $mission['duration'] ?? $mission['duration_minutes'] ?? null;
    $parsed = invoiceParseDurationMinutes($direct);
    if ($parsed !== null) {
        return $parsed;
    }
    $startRaw = $mission['heuredebutmission'] ?? $mission['heure_debut'] ?? $mission['start_time'] ?? null;
    $endRaw = $mission['heurefinmission'] ?? $mission['heure_fin'] ?? $mission['end_time'] ?? null;
    if ($startRaw === null || $endRaw === null) {
        return null;
    }
    $start = invoiceParseTimeOfDay($startRaw);
    $end = invoiceParseTimeOfDay($endRaw);
    if ($start === null || $end === null) {
        return null;
    }
    $duration = $end->getTimestamp() - $start->getTimestamp();
    if ($duration <= 0) {
        $duration = $end->modify('+1 day')->getTimestamp() - $start->getTimestamp();
    }
    return $duration > 0 ? $duration / 60.0 : null;
}

function invoiceParseTimeOfDay($value): ?DateTime {
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    if (preg_match('/^(\d{1,2})[:hH](\d{1,2})$/', $text, $m)) {
        $hours = max(0, min(23, (int) $m[1]));
        $minutes = max(0, min(59, (int) $m[2]));
        return DateTime::createFromFormat('Y-m-d H:i', '2000-01-01 ' . sprintf('%02d:%02d', $hours, $minutes));
    }
    return null;
}

function invoiceResolveUnitPrice(array $mission): float {
    $productPrice = invoiceNormalizeDecimal($mission['produit_price'] ?? null, -1);
    if ($productPrice > 0) {
        return $productPrice;
    }
    $total = invoiceResolveLineTotal($mission);
    $qty = invoiceResolveQuantity($mission);
    if ($total > 0 && $qty > 0) {
        return $total / $qty;
    }
    return $total;
}

function invoiceResolveLineTotal(array $mission): float {
    $candidates = [
        $mission['montant_mission'] ?? null,
        $mission['amount_ht'] ?? null,
        $mission['montant'] ?? null,
        $mission['total_ht'] ?? null,
    ];
    foreach ($candidates as $value) {
        if ($value === null) {
            continue;
        }
        $parsed = invoiceNormalizeDecimal($value, -1);
        if ($parsed > 0) {
            return $parsed;
        }
    }
    return 0.0;
}

function invoiceResolveTvaRate(array $mission): float {
    $candidates = [
        $mission['produit_tva_tx'] ?? null,
        $mission['tva_rate'] ?? null,
        $mission['tva'] ?? null,
    ];
    foreach ($candidates as $value) {
        if ($value === null) {
            continue;
        }
        $parsed = invoiceNormalizeDecimal($value, -1);
        if ($parsed >= 0) {
            return $parsed;
        }
    }
    return 0.0;
}

function invoiceMissionRequester(array $mission): string {
    $firstNames = [
        $mission['prenom_demandeur'] ?? null,
        $mission['contactdemandeur_firstname'] ?? null,
        $mission['demandeur_firstname'] ?? null,
    ];
    $lastNames = [
        $mission['nom_demandeur'] ?? null,
        $mission['contactdemandeur_lastname'] ?? null,
        $mission['demandeur_lastname'] ?? null,
    ];
    $first = invoiceFirstNonEmpty($firstNames);
    $last = invoiceFirstNonEmpty($lastNames);
    if ($first && $last) {
        return ucfirst(strtolower($first)) . ' ' . strtoupper($last);
    }
    $combined = [
        $mission['demandeur'] ?? null,
        $mission['contactdemandeur_name'] ?? null,
    ];
    return invoiceFirstNonEmpty($combined) ?? ($first ?: ($last ?: ''));
}

function invoiceFirstNonEmpty(array $values): ?string {
    foreach ($values as $value) {
        if ($value === null) {
            continue;
        }
        $text = trim((string) $value);
        if ($text !== '') {
            return $text;
        }
    }
    return null;
}

function invoiceMissionTimeRange(array $mission): string {
    $start = trim((string) ($mission['heuredebutmission'] ?? $mission['heure_debut'] ?? $mission['start_time'] ?? ''));
    $end = trim((string) ($mission['heurefinmission'] ?? $mission['heure_fin'] ?? $mission['end_time'] ?? ''));
    if ($start === '' && $end === '') {
        return '';
    }
    if ($start !== '' && $end !== '') {
        return $start . ' → ' . $end;
    }
    return $start !== '' ? $start : $end;
}

function invoiceMissionDesignation(array $mission): string {
    $lines = [];
    $label = trim((string) ($mission['produit_label'] ?? ''));
    $ref = trim((string) ($mission['produit_ref'] ?? ''));
    $title = $label !== '' ? $label : ($ref !== '' ? $ref : 'Mission');
    $lines[] = $title;
    $date = invoiceMissionDate($mission);
    $lines[] = 'Date : ' . ($date ? $date->format('d/m/Y') : '-');
    $timeRange = invoiceMissionTimeRange($mission);
    $lines[] = 'Heure : ' . ($timeRange !== '' ? $timeRange : '-');
    $durationMinutes = invoiceExtractDurationMinutes($mission);
    if ($durationMinutes !== null && $durationMinutes > 0) {
        if (fmod($durationMinutes, 60) === 0.0) {
            $lines[] = 'Durée : ' . intval($durationMinutes / 60) . 'h';
        } else {
            $lines[] = 'Durée : ' . intval($durationMinutes) . ' min';
        }
    } else {
        $lines[] = 'Durée : -';
    }
    $requester = invoiceMissionRequester($mission);
    $lines[] = 'Demandeur : ' . ($requester !== '' ? $requester : '-');
    return implode("\n", $lines);
}

function invoiceLineFromMission(array $mission, int $sortOrder = 0): array {
    $unitPrice = invoiceResolveUnitPrice($mission);
    $quantity = invoiceResolveQuantity($mission);
    $total = invoiceResolveLineTotal($mission);
    if ($total <= 0 && $unitPrice > 0 && $quantity > 0) {
        $total = $unitPrice * $quantity;
    }
    if ($unitPrice <= 0 && $quantity > 0 && $total > 0) {
        $unitPrice = $total / $quantity;
    }
    if ($total <= 0 && $unitPrice > 0 && $quantity > 0) {
        $total = $unitPrice * $quantity;
    }
    if ($quantity <= 0) {
        $quantity = 1.0;
    }
    $missionRef = invoiceMissionRef($mission);
    return [
        'mission_ref' => $missionRef,
        'designation' => invoiceMissionDesignation($mission),
        'tva_rate' => invoiceResolveTvaRate($mission),
        'unit_price_ht' => invoiceRoundCurrency(max(0, $unitPrice)),
        'quantity' => invoiceRoundCurrency(max(0.01, $quantity), 3),
        'total_ht' => invoiceRoundCurrency(max(0, $total)),
        'sort_order' => $sortOrder,
        'notes' => null,
    ];
}

function invoiceLineRowToArray(array $row): array {
    return [
        'id' => isset($row['id']) ? (int) $row['id'] : null,
        'invoice_number' => $row['invoice_number'] ?? null,
        'invoice_id' => isset($row['invoice_id']) ? (int) $row['invoice_id'] : null,
        'draft_key' => $row['draft_key'] ?? null,
        'client_name' => $row['client_name'] ?? null,
        'period_month' => $row['period_month'] ?? null,
        'mission_ref' => $row['mission_ref'] ?? null,
        'designation' => $row['designation'] ?? '',
        'tva_rate' => isset($row['tva_rate']) ? (float) $row['tva_rate'] : 0.0,
        'unit_price_ht' => isset($row['unit_price_ht']) ? (float) $row['unit_price_ht'] : 0.0,
        'quantity' => isset($row['quantity']) ? (float) $row['quantity'] : 1.0,
        'total_ht' => isset($row['total_ht']) ? (float) $row['total_ht'] : 0.0,
        'sort_order' => isset($row['sort_order']) ? (int) $row['sort_order'] : 0,
        'notes' => $row['notes'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}
