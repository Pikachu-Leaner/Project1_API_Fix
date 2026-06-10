<?php
class AuthApi {
    public function __construct(private PDO $conn) {}

    private function userPayload(array $user): array {
        return [
            'id' => (int)$user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'] ?? null,
            'address' => $user['address'] ?? null,
            'avatar' => $user['avatar'] ?? 'public/images/default-avatar.png',
            'role' => $user['role'],
            'is_active' => (bool)$user['is_active'],
            'is_verified' => (bool)$user['is_verified'],
        ];
    }

    public function register(): void {
        $body = Request::body();
        $name = trim((string)($body['full_name'] ?? $body['name'] ?? ''));
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $password = (string)($body['password'] ?? '');

        $errors = [];
        if ($name === '') $errors['full_name'] = 'Full name is required.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'A valid email is required.';
        if (strlen($password) < 6) $errors['password'] = 'Password must be at least 6 characters.';
        if ($errors) Response::error('Validation failed.', 422, $errors);

        $exists = $this->conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            Response::error('Email already exists.', 409);
        }

        $otp = (string)random_int(100000, 999999);
        $stmt = $this->conn->prepare('INSERT INTO users (full_name, email, password, otp_code, role, is_active, is_verified) VALUES (?, ?, ?, ?, "Client", 1, 0)');
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $otp]);

        Response::ok([
            'message' => 'Registered successfully. Verify the OTP before login.',
            'email' => $email,
            'debug_otp' => $otp,
        ], 201);
    }

    public function verifyOtp(): void {
        $body = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $otp = trim((string)($body['otp'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $otp === '') {
            Response::error('Email and OTP are required.', 422);
        }

        $stmt = $this->conn->prepare('SELECT id FROM users WHERE email = ? AND otp_code = ? LIMIT 1');
        $stmt->execute([$email, $otp]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('OTP is not valid.', 400);
        }

        $upd = $this->conn->prepare('UPDATE users SET is_verified = 1, otp_code = NULL WHERE id = ?');
        $upd->execute([(int)$user['id']]);
        Response::ok(['message' => 'Account verified. You can now log in.']);
    }

    public function login(): void {
        $body = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $password = (string)($body['password'] ?? '');

        $stmt = $this->conn->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            Response::error('Email or password is incorrect.', 401);
        }
        if (!(bool)$user['is_active']) {
            Response::error('This account has been disabled.', 403);
        }
        if (!(bool)$user['is_verified']) {
            Response::error('Please verify your OTP before login.', 403, ['needs_verification' => true, 'email' => $email]);
        }

        $token = JWT::encode([
            'sub' => (int)$user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'name' => $user['full_name'],
        ]);

        Response::ok([
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 604800,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(): void {
        $user = Auth::user($this->conn);
        Response::ok(['user' => $this->userPayload($user)]);
    }

    public function forgotPassword(): void {
        $body = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('A valid email is required.', 422);
        }

        $stmt = $this->conn->prepare('SELECT id FROM users WHERE email = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('Email does not exist or is disabled.', 404);
        }

        $otp = (string)random_int(100000, 999999);
        $upd = $this->conn->prepare('UPDATE users SET otp_code = ? WHERE id = ?');
        $upd->execute([$otp, (int)$user['id']]);

        Response::ok([
            'message' => 'Password reset OTP created.',
            'email' => $email,
            'debug_otp' => $otp,
        ]);
    }

    public function resetPassword(): void {
        $body = Request::body();
        $email = mb_strtolower(trim((string)($body['email'] ?? '')), 'UTF-8');
        $otp = trim((string)($body['otp'] ?? ''));
        $password = (string)($body['new_password'] ?? $body['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $otp === '' || strlen($password) < 6) {
            Response::error('Valid email, OTP, and a password of at least 6 characters are required.', 422);
        }

        $stmt = $this->conn->prepare('SELECT id FROM users WHERE email = ? AND otp_code = ? LIMIT 1');
        $stmt->execute([$email, $otp]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('OTP is not valid.', 400);
        }

        $upd = $this->conn->prepare('UPDATE users SET password = ?, otp_code = NULL WHERE id = ?');
        $upd->execute([password_hash($password, PASSWORD_DEFAULT), (int)$user['id']]);
        Response::ok(['message' => 'Password updated. Please log in again.']);
    }
}
