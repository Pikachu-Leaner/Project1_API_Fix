<?php
class Auth {
    /** Verify access token and return user row. Checks revocation table. */
    public static function user(PDO $conn, bool $required = true): ?array {
        $token = Request::bearerToken();
        if (!$token) {
            if ($required) Response::error('Missing Bearer token.', 401);
            return null;
        }

        try {
            $payload = JWT::decode($token);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 401);
        }

        // Token revocation check
        $rev = $conn->prepare('SELECT id FROM revoked_tokens WHERE token_hash = ? LIMIT 1');
        $rev->execute([hash('sha256', $token)]);
        if ($rev->fetch()) {
            Response::error('Token has been revoked.', 401);
        }

        $stmt = $conn->prepare('SELECT id, full_name, email, phone, address, avatar, role, is_active, is_verified, created_at FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([(int)($payload['sub'] ?? 0)]);
        $user = $stmt->fetch();

        if (!$user) Response::error('User from token no longer exists.', 401);
        if (!(bool)$user['is_active']) Response::error('This account has been disabled.', 403);
        return $user;
    }

    public static function admin(PDO $conn): array {
        $user = self::user($conn, true);
        if (($user['role'] ?? '') !== 'Admin') {
            Response::error('Admin permission required.', 403);
        }
        return $user;
    }

    public static function assertOwnerOrAdmin(array $user, int $ownerId): void {
        if (($user['role'] ?? '') !== 'Admin' && (int)$user['id'] !== $ownerId) {
            Response::error('You are not allowed to access this resource.', 403);
        }
    }

    /** Revoke a token by storing its hash */
    public static function revokeToken(PDO $conn, string $token): void {
        $stmt = $conn->prepare('INSERT IGNORE INTO revoked_tokens (token_hash, revoked_at) VALUES (?, NOW())');
        $stmt->execute([hash('sha256', $token)]);
    }
}
