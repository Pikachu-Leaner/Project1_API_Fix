<?php
class JWT {
    private static function secret(): string {
        return getenv('JWT_SECRET') ?: 'CHANGE_THIS_SECRET_IN_RENDER_ENVIRONMENT';
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

    public static function encode(array $payload, int $ttlSeconds = 604800): string {
        $now = time();
        $payload['iat'] = $now;
        $payload['exp'] = $now + $ttlSeconds;

        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $segments = [
            self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES)),
            self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES)),
        ];
        $signature = hash_hmac('sha256', implode('.', $segments), self::secret(), true);
        $segments[] = self::base64UrlEncode($signature);
        return implode('.', $segments);
    }

    public static function decode(string $token): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Malformed token.');
        }

        [$header64, $payload64, $signature64] = $parts;
        $headerJson = self::base64UrlDecode($header64);
        $payloadJson = self::base64UrlDecode($payload64);
        $signature = self::base64UrlDecode($signature64);

        if ($headerJson === false || $payloadJson === false || $signature === false) {
            throw new RuntimeException('Token could not be decoded.');
        }

        $expected = hash_hmac('sha256', $header64 . '.' . $payload64, self::secret(), true);
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
        return $payload;
    }
}
