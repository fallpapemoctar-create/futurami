<?php
/**
 * send_invoice_email.php — futurAMI
 *
 * Stub d'envoi d'email pour une facture client.
 * À ce stade, le serveur ne fait que journaliser la demande et renvoyer
 * un accusé. Le branchement à un véritable transport SMTP (PHPMailer,
 * mail(), service externe) sera réalisé une fois les paramètres SMTP
 * configurés côté serveur.
 *
 * Payload JSON attendu :
 * {
 *   "invoice_number": "FAC-202606-001",
 *   "to": ["client@example.com"],
 *   "cc": ["copie@example.com"],
 *   "subject": "Votre facture",
 *   "body": "Bonjour, ...",
 *   "user_id": 3,
 *   "user_name": "Anna FALL"
 * }
 */

require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Payload JSON invalide.']);
}

$invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
$to = $input['to'] ?? [];
$cc = $input['cc'] ?? [];
$subject = trim((string) ($input['subject'] ?? ''));
$body = (string) ($input['body'] ?? '');

if ($invoiceNumber === '') {
    respond(400, ['success' => false, 'error' => 'Numéro de facture obligatoire.']);
}
if (!is_array($to) || empty($to)) {
    respond(400, ['success' => false, 'error' => 'Au moins un destinataire est requis.']);
}

$normalize = static function ($value): array {
    if (!is_array($value)) {
        return [];
    }
    return array_values(array_filter(array_map('trim', $value), static function ($email) {
        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);
    }));
};

$to = $normalize($to);
$cc = $normalize($cc);

if (empty($to)) {
    respond(400, ['success' => false, 'error' => 'Aucun destinataire valide.']);
}

// Journalisation (peut être étendu vers une table dédiée plus tard).
try {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0775, true);
    }
    $entry = [
        'timestamp' => date('c'),
        'invoice_number' => $invoiceNumber,
        'to' => $to,
        'cc' => $cc,
        'subject' => $subject,
        'body_length' => strlen($body),
        'user_id' => isset($input['user_id']) ? (int) $input['user_id'] : null,
        'user_name' => trim((string) ($input['user_name'] ?? '')),
    ];
    @file_put_contents(
        $logDir . '/invoice_emails.log',
        json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL,
        FILE_APPEND
    );
} catch (Throwable $e) {
    // Ne pas bloquer en cas d'échec de log
}

respond(200, [
    'success' => true,
    'invoice_number' => $invoiceNumber,
    'to' => $to,
    'cc' => $cc,
    'message' => "Demande d'envoi enregistrée. Le transport SMTP doit être configuré pour un envoi effectif.",
]);
