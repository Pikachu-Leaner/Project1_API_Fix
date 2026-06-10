<?php
class CategoriesApi {
    public function __construct(private PDO $conn) {}

    public function index(): void {
        $stmt = $this->conn->query('SELECT id, name FROM categories ORDER BY id ASC');
        $categories = array_map(fn($c) => ['id' => (int)$c['id'], 'name' => $c['name']], $stmt->fetchAll());
        Response::ok(['categories' => $categories]);
    }

    public function create(): void {
        Auth::admin($this->conn);
        $name = trim((string)(Request::body()['name'] ?? ''));
        if ($name === '') Response::error('Category name is required.', 422);
        $stmt = $this->conn->prepare('INSERT INTO categories (name) VALUES (?)');
        try {
            $stmt->execute([$name]);
        } catch (PDOException $e) {
            Response::error('Category already exists or is invalid.', 409);
        }
        Response::ok(['id' => (int)$this->conn->lastInsertId(), 'name' => $name], 201);
    }

    public function update(int $id): void {
        Auth::admin($this->conn);
        $name = trim((string)(Request::body()['name'] ?? ''));
        if ($name === '') Response::error('Category name is required.', 422);
        $stmt = $this->conn->prepare('UPDATE categories SET name = ? WHERE id = ?');
        $stmt->execute([$name, $id]);
        if ($stmt->rowCount() === 0) Response::error('Category not found or unchanged.', 404);
        Response::ok(['id' => $id, 'name' => $name]);
    }

    public function delete(int $id): void {
        Auth::admin($this->conn);
        $stmt = $this->conn->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) Response::error('Category not found.', 404);
        Response::ok(['message' => 'Category deleted.']);
    }
}
