<?php
/**
 * futurAMI — Helpers d'authentification (multi-entités)
 *
 * Porté depuis AMI-PTF (api/auth_helpers.php) pour donner à futurAMI la même
 * protection que le reste de la famille d'apps AMI. futurAMI cible l'entité
 * Dolibarr 2 (PLANETE TRADUCTION FRANCE) — voir DOLIBARR_ENTITY dans .htaccess.
 *
 * Fournit :
 *   - getConfiguredEntity()      : entity du déploiement (DOLIBARR_ENTITY)
 *   - getAuthSecret()            : secret HS256 pour signer les tokens
 *   - issueAuthToken($user)      : émet un token JWT-like pour un utilisateur authentifié
 *   - verifyAuthToken($token)    : vérifie signature + expiration, renvoie les claims
 *   - require_auth()             : à appeler en tête de chaque endpoint protégé.
 *                                  Envoie 401 + exit si absent / invalide / expiré
 *                                  ou 403 si l'utilisateur n'appartient pas à
 *                                  l'entité configurée. Renvoie ['sub'=>id,
 *                                  'entity'=>N, 'login'=>..., 'exp'=>...].
 *
 * Modèle de token (compatible JWT HS256) :
 *   header  = {"alg":"HS256","typ":"JWT"}
 *   payload = {"sub":<user_rowid>,"login":"...","entity":<int>,"iat":<ts>,"exp":<ts>}
 *   signature = HMAC_SHA256("<base64url(header)>.<base64url(payload)>", AUTH_SECRET)
 */

if (!function_exists('getConfiguredEntity')) {
    function getConfiguredEntity(): int
    {
        $v = getenv('DOLIBARR_ENTITY');
        if (!$v && isset($_SERVER['DOLIBARR_ENTITY'])) {
            $v = $_SERVER['DOLIBARR_ENTITY'];
        }
        $n = (int) ($v ?: 0);
        return $n > 0 ? $n : 2; // fallback PLANETE TRADUCTION FRANCE (futurAMI = entité 2)
    }
}

if (!function_exists('getAuthSecret')) {
    function getAuthSecret(): string
    {
        $s = getenv('AUTH_SECRET');
        if (!$s && isset($_SERVER['AUTH_SECRET'])) {
            $s = $_SERVER['AUTH_SECRET'];
        }
        if (!$s || strlen($s) < 32) {
            // Refus explicite : sans secret configuré, aucune signature n'est possible.
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'auth_secret_missing',
                'message' => "Configuration serveur invalide : AUTH_SECRET manquant ou trop court.",
            ]);
            exit;
        }
        return $s;
    }
}

if (!function_exists('getAuthTokenTtl')) {
    function getAuthTokenTtl(): int
    {
        $v = (int) (getenv('AUTH_TOKEN_TTL') ?: ($_SERVER['AUTH_TOKEN_TTL'] ?? 0));
        return $v > 0 ? $v : 43200; // 12h
    }
}

if (!function_exists('b64url_encode')) {
    function b64url_encode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists('b64url_decode')) {
    function b64url_decode(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad) {
            $data .= str_repeat('=', 4 - $pad);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}

if (!function_exists('issueAuthToken')) {
    /**
     * @param array $user Utilisateur validé (au minimum rowid, login, entity)
     */
    function issueAuthToken(array $user): string
    {
        $now = time();
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $payload = [
            'sub'    => (int) ($user['rowid'] ?? $user['id'] ?? 0),
            'login'  => (string) ($user['login'] ?? ''),
            'entity' => (int) ($user['entity'] ?? getConfiguredEntity()),
            'admin'  => (int) ($user['admin'] ?? 0),
            'iat'    => $now,
            'exp'    => $now + getAuthTokenTtl(),
        ];
        $h = b64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $p = b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $sig = hash_hmac('sha256', "$h.$p", getAuthSecret(), true);
        return "$h.$p." . b64url_encode($sig);
    }
}

if (!function_exists('verifyAuthToken')) {
    /**
     * @return array|null Claims si OK, null si invalide/expiré
     */
    function verifyAuthToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$h, $p, $s] = $parts;
        $expected = b64url_encode(hash_hmac('sha256', "$h.$p", getAuthSecret(), true));
        if (!hash_equals($expected, $s)) {
            return null;
        }
        $payload = json_decode(b64url_decode($p), true);
        if (!is_array($payload)) {
            return null;
        }
        if (!isset($payload['exp']) || (int) $payload['exp'] < time()) {
            return null;
        }
        return $payload;
    }
}

if (!function_exists('extractBearerToken')) {
    function extractBearerToken(): ?string
    {
        // Cherche dans plusieurs sources (Apache/CGI/FastCGI)
        $auth = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if (!$auth && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            foreach ($headers as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) {
                    $auth = $v;
                    break;
                }
            }
        }
        if (!$auth) {
            return null;
        }
        if (stripos($auth, 'Bearer ') === 0) {
            return trim(substr($auth, 7));
        }
        return null;
    }
}

if (!function_exists('require_auth')) {
    /**
     * Garde d'entrée pour tout endpoint protégé.
     * Envoie 401/403 et interrompt le script en cas d'échec.
     *
     * @return array Claims du token (sub, login, entity, iat, exp)
     */
    function require_auth(): array
    {
        // CORS preflight : laisser passer sans exiger le token (le vrai appel qui suit sera vérifié)
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        $token = extractBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error'   => 'missing_token',
                'message' => 'Token d\'authentification manquant (header Authorization: Bearer …)',
            ]);
            exit;
        }
        $claims = verifyAuthToken($token);
        if (!$claims) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error'   => 'invalid_token',
                'message' => 'Token invalide ou expiré',
            ]);
            exit;
        }
        $configuredEntity = getConfiguredEntity();
        // Sémantique Dolibarr : entity=0 && admin=1 = super-admin transversal
        // autorisé à opérer sur n'importe quelle entité configurée.
        $claimEntity  = (int) ($claims['entity'] ?? 0);
        $isSuperAdmin = ($claimEntity === 0 && (int) ($claims['admin'] ?? 0) === 1);
        if (!$isSuperAdmin && $claimEntity !== $configuredEntity) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error'   => 'entity_mismatch',
                'message' => 'Accès refusé : ce compte n\'appartient pas à l\'entité de ce déploiement',
            ]);
            exit;
        }
        return $claims;
    }
}
