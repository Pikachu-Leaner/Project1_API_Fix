<?php
class AuthApi {
    public function __construct(private PDO $conn) {}

    private function userPayload(array $user): array {
        return [
            'id'          => (int)$user['id'],
            'full_name'   => $user['full_name'],
            'email'       => $user['email'],
            'phone'       => $user['phone'] ?? null,
            'address'     => $user['address'] ?? null,
            'avatar'      => $user['avatar'] ?? 'public/images/default-avatar.png',
            'role'        => $user['role'],
            'is_active'   => (bool)$user['is_active'],
            'is_verified' => (bool)$user['is_verified'],
        ];
    }

    private function passwordPolicy(string $password): ?string {
        if (strlen($password) < 8)          return 'Password must be at least 8 characters.';
        if (!preg_match('/[A-Z]/', $password)) return 'Password must contain at least one uppercase letter.';
        if (!preg_match('/[0-9]/', $password)) return 'Password must contain at least one number.';
        return null;
    }

    public function register(): void {
        $body     = Request::body();
        $name     = trim((string)($body['full_name'] ?? $body['name'] ?? ''));
        $email    = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $password = (string)($body['password'] ?? '');

        $errors = [];
        if ($name === '')                                   $errors['full_name'] = 'Full name is required.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))    $errors['email']     = 'A valid email is required.';
        $pwErr = $this->passwordPolicy($password);
        if ($pwErr)                                         $errors['password']  = $pwErr;
        if ($errors) Response::error('Validation failed.', 422, $errors);

        $exists = $this->conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) Response::error('Email already exists.', 409);

        $otp  = (string)random_int(100000, 999999);
        $stmt = $this->conn->prepare(
            'INSERT INTO users (full_name, email, password, otp_code, role, is_active, is_verified) VALUES (?, ?, ?, ?, "Client", 1, 0)'
        );
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $otp]);

        Response::ok([
            'message'   => 'Registered successfully. Verify the OTP before login.',
            'email'     => $email,
            'debug_otp' => $otp,
        ], 201);
    }

    public function verifyOtp(): void {
        $body  = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $otp   = trim((string)($body['otp'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $otp === '') {
            Response::error('Email and OTP are required.', 422);
        }

        $stmt = $this->conn->prepare('SELECT * FROM users WHERE email = ? AND otp_code = ? LIMIT 1');
        $stmt->execute([$email, $otp]);
        $user = $stmt->fetch();
        if (!$user) Response::error('OTP is not valid.', 400);

        $upd = $this->conn->prepare('UPDATE users SET is_verified = 1, otp_code = NULL WHERE id = ?');
        $upd->execute([(int)$user['id']]);

        // Auto-login: generate access + refresh tokens
        $accessToken  = JWT::encodeAccess((int)$user['id']);
        $refreshToken = JWT::encodeRefresh((int)$user['id']);
        $this->storeRefreshToken((int)$user['id'], $refreshToken);

        Response::ok([
            'message'       => 'Account verified. You are now logged in.',
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type'    => 'Bearer',
            'expires_in'    => 7200,
            'user'          => $this->userPayload($user),
        ]);
    }

    public function login(): void {
        // Rate limiting: max 5 attempts per IP per 10 minutes
        $this->checkRateLimit('login_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 5, 600);

        $body     = Request::body();
        $email    = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $password = (string)($body['password'] ?? '');
        $remember = (bool)($body['remember_me'] ?? false);

        $stmt = $this->conn->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            Response::error('Email or password is incorrect.', 401);
        }
        if (!(bool)$user['is_active'])   Response::error('This account has been disabled.', 403);
        if (!(bool)$user['is_verified']) {
            Response::error('Please verify your OTP before login.', 403, ['needs_verification' => true, 'email' => $email]);
        }

        $accessToken  = JWT::encodeAccess((int)$user['id']);
        $refreshToken = JWT::encodeRefresh((int)$user['id']);
        $this->storeRefreshToken((int)$user['id'], $refreshToken);

        Response::ok([
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type'    => 'Bearer',
            'expires_in'    => 7200,
            'remember_me'   => $remember,
            'user'          => $this->userPayload($user),
        ]);
    }

    public function refresh(): void {
        $body         = Request::body();
        $refreshToken = trim((string)($body['refresh_token'] ?? ''));
        if ($refreshToken === '') Response::error('refresh_token is required.', 422);

        try {
            $payload = JWT::decodeRefresh($refreshToken);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 401);
        }

        // Check token exists in DB (not revoked / still valid)
        $stmt = $this->conn->prepare(
            'SELECT id FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute([(int)$payload['sub'], hash('sha256', $refreshToken)]);
        if (!$stmt->fetch()) Response::error('Refresh token is invalid or expired.', 401);

        // Rotate: revoke old, issue new pair
        $this->revokeRefreshToken($refreshToken);

        $userId       = (int)$payload['sub'];
        $newAccess    = JWT::encodeAccess($userId);
        $newRefresh   = JWT::encodeRefresh($userId);
        $this->storeRefreshToken($userId, $newRefresh);

        Response::ok([
            'access_token'  => $newAccess,
            'refresh_token' => $newRefresh,
            'token_type'    => 'Bearer',
            'expires_in'    => 7200,
        ]);
    }

    public function logout(): void {
        $token = Request::bearerToken();
        if ($token) {
            Auth::revokeToken($this->conn, $token);
        }
        $body = Request::body();
        $rt   = trim((string)($body['refresh_token'] ?? ''));
        if ($rt !== '') $this->revokeRefreshToken($rt);

        Response::ok(['message' => 'Logged out successfully.']);
    }

    public function me(): void {
        $user = Auth::user($this->conn);
        Response::ok(['user' => $this->userPayload($user)]);
    }

    public function forgotPassword(): void {
        $body  = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('A valid email is required.', 422);

        $stmt = $this->conn->prepare('SELECT id FROM users WHERE email = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user) Response::error('Email does not exist or is disabled.', 404);

        $otp = (string)random_int(100000, 999999);
        $upd = $this->conn->prepare('UPDATE users SET otp_code = ? WHERE id = ?');
        $upd->execute([$otp, (int)$user['id']]);

        Response::ok(['message' => 'Password reset OTP created.', 'email' => $email, 'debug_otp' => $otp]);
    }

    public function resetPassword(): void {
        $body     = Request::body();
        $email    = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $otp      = trim((string)($body['otp'] ?? ''));
        $password = (string)($body['new_password'] ?? $body['password'] ?? '');

        $pwErr = $this->passwordPolicy($password);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $otp === '' || $pwErr) {
            Response::error('Valid email, OTP, and a strong password are required.', 422, ['password' => $pwErr]);
        }

        $stmt = $this->conn->prepare('SELECT id FROM users WHERE email = ? AND otp_code = ? LIMIT 1');
        $stmt->execute([$email, $otp]);
        $user = $stmt->fetch();
        if (!$user) Response::error('OTP is not valid.', 400);

        $upd = $this->conn->prepare('UPDATE users SET password = ?, otp_code = NULL WHERE id = ?');
        $upd->execute([password_hash($password, PASSWORD_DEFAULT), (int)$user['id']]);
        Response::ok(['message' => 'Password updated. Please log in again.']);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private function storeRefreshToken(int $userId, string $token): void {
        $stmt = $this->conn->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))'
        );
        $stmt->execute([$userId, hash('sha256', $token)]);
    }

    private function revokeRefreshToken(string $token): void {
        $stmt = $this->conn->prepare('DELETE FROM refresh_tokens WHERE token_hash = ?');
        $stmt->execute([hash('sha256', $token)]);
    }

    private function checkRateLimit(string $key, int $maxAttempts, int $windowSeconds): void {
        $stmt = $this->conn->prepare(
            'SELECT COUNT(*) AS cnt FROM rate_limit_log WHERE key_name = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$key, $windowSeconds]);
        $count = (int)($stmt->fetch()['cnt'] ?? 0);
        if ($count >= $maxAttempts) {
            Response::error('Too many attempts. Please try again later.', 429);
        }
        $ins = $this->conn->prepare('INSERT INTO rate_limit_log (key_name, attempted_at) VALUES (?, NOW())');
        $ins->execute([$key]);
    }
}
