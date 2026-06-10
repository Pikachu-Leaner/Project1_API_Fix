<?php
class CartApi {
    public function __construct(private PDO $conn) {}

    private function cartForUser(int $userId): array {
        $stmt = $this->conn->prepare('SELECT ci.product_id, ci.quantity, p.*, c.name AS category_name FROM cart_items ci JOIN products p ON p.id = ci.product_id LEFT JOIN categories c ON c.id = p.category_id WHERE ci.user_id = ? ORDER BY ci.updated_at DESC');
        $stmt->execute([$userId]);
        $items = [];
        $total = 0;
        foreach ($stmt->fetchAll() as $row) {
            $quantity = (int)$row['quantity'];
            $lineTotal = (int)$row['price'] * $quantity;
            $items[] = [
                'product_id' => (int)$row['product_id'],
                'quantity' => $quantity,
                'line_total' => $lineTotal,
                'product' => [
                    'id' => (int)$row['id'],
                    'name' => $row['name'],
                    'brand' => $row['brand'],
                    'price' => (int)$row['price'],
                    'old_price' => isset($row['old_price']) ? (int)$row['old_price'] : null,
                    'image_url' => $row['image_url'],
                    'category_name' => $row['category_name'],
                ],
            ];
            $total += $lineTotal;
        }
        return ['items' => $items, 'count' => count($items), 'total_amount' => $total];
    }

    public function index(): void {
        $user = Auth::user($this->conn);
        Response::ok(['cart' => $this->cartForUser((int)$user['id'])]);
    }

    public function addItem(): void {
        $user = Auth::user($this->conn);
        $body = Request::body();
        $productId = (int)($body['product_id'] ?? 0);
        $quantity = max(1, (int)($body['quantity'] ?? 1));
        if ($productId <= 0) Response::error('product_id is required.', 422);

        $check = $this->conn->prepare('SELECT id FROM products WHERE id = ? LIMIT 1');
        $check->execute([$productId]);
        if (!$check->fetch()) Response::error('Product not found.', 404);

        $stmt = $this->conn->prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = CURRENT_TIMESTAMP');
        $stmt->execute([(int)$user['id'], $productId, $quantity]);
        Response::ok(['cart' => $this->cartForUser((int)$user['id'])], 201);
    }

    public function updateItem(int $productId): void {
        $user = Auth::user($this->conn);
        $body = Request::body();
        $action = (string)($body['action'] ?? '');
        if ($action === 'increase' || $action === 'decrease') {
            $delta = $action === 'increase' ? 1 : -1;
            $stmt = $this->conn->prepare('UPDATE cart_items SET quantity = GREATEST(quantity + ?, 0), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?');
            $stmt->execute([$delta, (int)$user['id'], $productId]);
            $del = $this->conn->prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND quantity <= 0');
            $del->execute([(int)$user['id'], $productId]);
        } else {
            $quantity = (int)($body['quantity'] ?? 0);
            if ($quantity <= 0) {
                $stmt = $this->conn->prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?');
                $stmt->execute([(int)$user['id'], $productId]);
            } else {
                $stmt = $this->conn->prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?');
                $stmt->execute([$quantity, (int)$user['id'], $productId]);
            }
        }
        Response::ok(['cart' => $this->cartForUser((int)$user['id'])]);
    }

    public function deleteItem(int $productId): void {
        $user = Auth::user($this->conn);
        $stmt = $this->conn->prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?');
        $stmt->execute([(int)$user['id'], $productId]);
        Response::ok(['cart' => $this->cartForUser((int)$user['id'])]);
    }

    public function clear(): void {
        $user = Auth::user($this->conn);
        $stmt = $this->conn->prepare('DELETE FROM cart_items WHERE user_id = ?');
        $stmt->execute([(int)$user['id']]);
        Response::ok(['cart' => $this->cartForUser((int)$user['id'])]);
    }
}
