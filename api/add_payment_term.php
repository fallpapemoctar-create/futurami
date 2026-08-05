<?php
/**
 * add_payment_term.php — futurAMI
 *
 * Crée un terme/condition de paiement (référentiel llx_c_payment_term) pour
 * l'entité courante. Chaque entité dispose de son propre référentiel.
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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Aucune donnée reçue']);
    exit;
}

$label = trim((string)($data['label'] ?? ''));
if ($label === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Libellé obligatoire']);
    exit;
}

$code = trim((string)($data['code'] ?? ''));
if ($code === '') {
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', $label));
    if ($code === '') {
        $code = 'COND' . time();
    }
}
$code = substr($code, 0, 16);

$days = isset($data['days']) ? (int)$data['days'] : 0;
$shift = isset($data['shift']) ? (int)$data['shift'] : null;
$labelFacture = trim((string)($data['label_facture'] ?? $label));

try {
    $chk = $pdo->prepare('SELECT 1 FROM llx_c_payment_term WHERE code = :code AND entity = :entity LIMIT 1');
    $chk->execute([':code' => $code, ':entity' => $currentEntity]);
    if ($chk->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Un terme de paiement avec ce code existe déjà']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO llx_c_payment_term (
            entity, code, active, libelle, libelle_facture, nbjour, decalage, sortorder, position
        ) VALUES (
            :entity, :code, 1, :libelle, :libelle_facture, :nbjour, :decalage, 0, 0
        )"
    );
    $stmt->execute([
        ':entity' => $currentEntity,
        ':code' => $code,
        ':libelle' => $label,
        ':libelle_facture' => $labelFacture,
        ':nbjour' => $days,
        ':decalage' => $shift,
    ]);

    $id = (int)$pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Terme de paiement créé',
        'paymentTerm' => [
            'id' => $id,
            'code' => $code,
            'label' => $label,
            'days' => $days,
            'shift' => $shift ?? 0,
            'isDefault' => false,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
