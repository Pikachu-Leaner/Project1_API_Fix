<?php
class Auth {
    public static function user(PDO $conn, bool $required = true): ?array {
        $token = Request::bearerToken();
        if (!$token) {
            if ($required) {
                Response::error('Missing Bearer token.', 401);
            }
            return null;
        }

        try {
            $payload = JWT::decode($token);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 401);
        }

        $stmt = $conn->prepare('SELECT id, full_name, email, phone, address, avatar, role, is_active, is_verified, created_at FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([(int)($payload['sub'] ?? 0)]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('User from token no longer exists.', 401);
        }
        if (!(bool)$user['is_active']) {
            Response::error('This account has been disabled.', 403);
        }
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
}
