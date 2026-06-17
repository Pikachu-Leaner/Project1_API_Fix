<?php
class JWT {
    private static function secret(): string {
        return getenv('JWT_SECRET') ?: 'CHANGE_THIS_SECRET_IN_RENDER_ENVIRONMENT';
    }

    private static function refreshSecret(): string {
        return getenv('JWT_REFRESH_SECRET') ?: 'CHANGE_THIS_REFRESH_SECRET_IN_RENDER_ENVIRONMENT';
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string|false {
        $padding = 4 - (strlen($data) % 4);
        if ($padding < 4) {
            $data .= str_repeat('=', $padding);
        }
        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    /** Access token: 2 hours, signed with JWT_SECRET */
    public static function encodeAccess(int $userId): string {
        return self::sign(['sub' => $userId, 'type' => 'access'], 7200, self::secret());
    }

    /** Refresh token: 30 days, signed with JWT_REFRESH_SECRET */
    public static function encodeRefresh(int $userId): string {
        return self::sign(['sub' => $userId, 'type' => 'refresh'], 2592000, self::refreshSecret());
    }

    private static function sign(array $payload, int $ttlSeconds, string $secret): string {
        $now = time();
        $payload['iat'] = $now;
        $payload['exp'] = $now + $ttlSeconds;
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $segments = [
            self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES)),
            self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES)),
        ];
        $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
        $segments[] = self::base64UrlEncode($signature);
        return implode('.', $segments);
    }

    /** Decode an access token */
    public static function decode(string $token): array {
        return self::verify($token, self::secret(), 'access');
    }

    /** Decode a refresh token */
    public static function decodeRefresh(string $token): array {
        return self::verify($token, self::refreshSecret(), 'refresh');
    }

    private static function verify(string $token, string $secret, string $expectedType): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Malformed token.');
        }

        [$header64, $payload64, $signature64] = $parts;
        $headerJson   = self::base64UrlDecode($header64);
        $payloadJson  = self::base64UrlDecode($payload64);
        $signature    = self::base64UrlDecode($signature64);

        if ($headerJson === false || $payloadJson === false || $signature === false) {
            throw new RuntimeException('Token could not be decoded.');
        }

        $expected = hash_hmac('sha256', $header64 . '.' . $payload64, $secret, true);
        if (!hash_equals($expected, $signature)) {
            throw new RuntimeException('Invalid token signature.');
        }

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            throw new RuntimeException('Invalid token payload.');
        }
        if (($payload['exp'] ?? 0) < time()) {
            throw new RuntimeException('Token expired.');
        }
        if (($payload['type'] ?? '') !== $expectedType) {
            throw new RuntimeException('Wrong token type.');
        }
        return $payload;
    }

    // Legacy encode (kept for backward compat, uses access-style secret)
    public static function encode(array $payload, int $ttlSeconds = 7200): string {
        return self::sign($payload, $ttlSeconds, self::secret());
    }
}
