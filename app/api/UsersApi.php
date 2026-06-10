<?php
class UsersApi {
    public function __construct(private PDO $conn) {}

    private function publicUser(array $u): array {
        return [
            'id' => (int)$u['id'],
            'full_name' => $u['full_name'],
            'email' => $u['email'],
            'phone' => $u['phone'] ?? null,
            'address' => $u['address'] ?? null,
            'avatar' => $u['avatar'] ?? 'public/images/default-avatar.png',
            'role' => $u['role'],
            'is_active' => (bool)$u['is_active'],
            'is_verified' => (bool)$u['is_verified'],
            'created_at' => $u['created_at'] ?? null,
        ];
    }

    public function me(): void {
        $user = Auth::user($this->conn);
        Response::ok(['user' => $this->publicUser($user)]);
    }

    public function updateMe(): void {
        $user = Auth::user($this->conn);
        $body = Request::body();
        $data = [];
        foreach (['full_name', 'phone', 'address', 'avatar'] as $field) {
            if (array_key_exists($field, $body)) {
                $data[$field] = trim((string)$body[$field]);
            }
        }
        if (!$data) Response::error('Nothing to update.', 422);
        if (isset($data['full_name']) && $data['full_name'] === '') Response::error('Full name cannot be blank.', 422);

        $sets = [];
        foreach ($data as $key => $_) $sets[] = "{$key} = :{$key}";
        $data['id'] = (int)$user['id'];
        $stmt = $this->conn->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $stmt->execute($data);
        $this->me();
    }

    public function index(): void {
        Auth::admin($this->conn);
        $stmt = $this->conn->query('SELECT id, full_name, email, phone, address, avatar, role, is_active, is_verified, created_at FROM users ORDER BY id DESC');
        Response::ok(['users' => array_map(fn($u) => $this->publicUser($u), $stmt->fetchAll())]);
    }

    public function show(int $id): void {
        $admin = Auth::admin($this->conn);
        $stmt = $this->conn->prepare('SELECT id, full_name, email, phone, address, avatar, role, is_active, is_verified, created_at FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if (!$user) Response::error('User not found.', 404);
        Response::ok(['user' => $this->publicUser($user)]);
    }

    public function update(int $id): void {
        Auth::admin($this->conn);
        $body = Request::body();
        $data = [];
        foreach (['full_name', 'phone', 'address', 'avatar', 'role', 'is_active', 'is_verified'] as $field) {
            if (array_key_exists($field, $body)) {
                $data[$field] = $body[$field];
            }
        }
        if (!$data) Response::error('Nothing to update.', 422);
        if (isset($data['role']) && !in_array($data['role'], ['Admin', 'Client'], true)) Response::error('Invalid role.', 422);
        foreach (['is_active', 'is_verified'] as $bool) {
            if (array_key_exists($bool, $data)) $data[$bool] = filter_var($data[$bool], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }
        foreach (['full_name', 'phone', 'address', 'avatar'] as $stringField) {
            if (array_key_exists($stringField, $data)) $data[$stringField] = trim((string)$data[$stringField]);
        }

        $sets = [];
        foreach ($data as $key => $_) $sets[] = "{$key} = :{$key}";
        $data['id'] = $id;
        $stmt = $this->conn->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $stmt->execute($data);
        $this->show($id);
    }

    public function toggleStatus(int $id): void {
        $admin = Auth::admin($this->conn);
        if ((int)$admin['id'] === $id) Response::error('Admins cannot disable their own account.', 422);
        $stmt = $this->conn->prepare("UPDATE users SET is_active = IF(is_active = 1, 0, 1) WHERE id = ? AND role != 'Admin'");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) Response::error('User not found, is admin, or unchanged.', 404);
        $this->show($id);
    }
}
