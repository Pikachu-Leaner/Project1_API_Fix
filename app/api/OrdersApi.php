<?php
class OrdersApi {
    public function __construct(private PDO $conn) {}

    private function loadOrder(int $id): ?array {
        $stmt = $this->conn->prepare('SELECT o.*, u.email AS user_email FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ? LIMIT 1');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $details = $this->conn->prepare('SELECT od.product_id, od.quantity, od.price, p.name, p.image_url, p.brand FROM order_details od JOIN products p ON p.id = od.product_id WHERE od.order_id = ?');
        $details->execute([$id]);
        $items = [];
        foreach ($details->fetchAll() as $row) {
            $items[] = [
                'product_id' => (int)$row['product_id'],
                'quantity' => (int)$row['quantity'],
                'price' => (int)$row['price'],
                'line_total' => (int)$row['quantity'] * (int)$row['price'],
                'product' => [
                    'name' => $row['name'],
                    'brand' => $row['brand'],
                    'image_url' => $row['image_url'],
                ],
            ];
        }

        return [
            'id' => (int)$order['id'],
            'user_id' => isset($order['user_id']) ? (int)$order['user_id'] : null,
            'user_email' => $order['user_email'] ?? null,
            'customer_name' => $order['customer_name'],
            'phone' => $order['phone'],
            'address' => $order['address'],
            'payment_method' => $order['payment_method'],
            'notes' => $order['notes'],
            'total_amount' => (int)$order['total_amount'],
            'status' => $order['status'],
            'created_at' => $order['created_at'],
            'items' => $items,
        ];
    }

    private function cartItems(int $userId): array {
        $stmt = $this->conn->prepare('SELECT ci.product_id, ci.quantity, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function index(bool $adminRoute = false): void {
        $user = $adminRoute ? Auth::admin($this->conn) : Auth::user($this->conn);
        if ($adminRoute || ($user['role'] ?? '') === 'Admin') {
            $stmt = $this->conn->query('SELECT id FROM orders ORDER BY created_at DESC');
        } else {
            $stmt = $this->conn->prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC');
            $stmt->execute([(int)$user['id']]);
        }
        $orders = array_map(fn($row) => $this->loadOrder((int)$row['id']), $stmt->fetchAll());
        Response::ok(['orders' => $orders]);
    }

    public function show(int $id): void {
        $user = Auth::user($this->conn);
        $order = $this->loadOrder($id);
        if (!$order) Response::error('Order not found.', 404);
        Auth::assertOwnerOrAdmin($user, (int)$order['user_id']);
        Response::ok(['order' => $order]);
    }

    public function create(): void {
        $user = Auth::user($this->conn);
        $body = Request::body();
        $name = trim((string)($body['customer_name'] ?? $user['full_name'] ?? ''));
        $phone = trim((string)($body['phone'] ?? $user['phone'] ?? ''));
        $address = trim((string)($body['address'] ?? $user['address'] ?? ''));
        $paymentMethod = trim((string)($body['payment_method'] ?? 'COD'));
        $notes = trim((string)($body['notes'] ?? ''));

        $errors = [];
        if ($name === '') $errors['customer_name'] = 'Customer name is required.';
        if ($phone === '') $errors['phone'] = 'Phone is required.';
        if ($address === '') $errors['address'] = 'Address is required.';
        if ($errors) Response::error('Validation failed.', 422, $errors);

        $items = $this->cartItems((int)$user['id']);
        if (!$items) Response::error('Cart is empty.', 422);

        $total = 0;
        foreach ($items as $item) {
            $total += (int)$item['price'] * (int)$item['quantity'];
        }

        try {
            $this->conn->beginTransaction();
            $order = $this->conn->prepare('INSERT INTO orders (user_id, customer_name, phone, address, payment_method, notes, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $order->execute([(int)$user['id'], $name, $phone, $address, $paymentMethod, $notes, $total, 'Pending']);
            $orderId = (int)$this->conn->lastInsertId();

            $detail = $this->conn->prepare('INSERT INTO order_details (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
            $sales = $this->conn->prepare('UPDATE products SET sales_count = sales_count + ? WHERE id = ?');
            foreach ($items as $item) {
                $detail->execute([$orderId, (int)$item['product_id'], (int)$item['quantity'], (int)$item['price']]);
                $sales->execute([(int)$item['quantity'], (int)$item['product_id']]);
            }

            $clear = $this->conn->prepare('DELETE FROM cart_items WHERE user_id = ?');
            $clear->execute([(int)$user['id']]);
            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            Response::error('Could not create order.', 500, ['error' => $e->getMessage()]);
        }

        Response::ok(['order' => $this->loadOrder($orderId)], 201);
    }

    public function updateStatus(int $id): void {
        Auth::admin($this->conn);
        $body = Request::body();
        $status = trim((string)($body['status'] ?? ''));
        $allowed = ['Pending', 'Delivering', 'Completed', 'Cancelled'];
        if (!in_array($status, $allowed, true)) {
            Response::error('Invalid status.', 422, ['allowed' => $allowed]);
        }
        $stmt = $this->conn->prepare('UPDATE orders SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
        if ($stmt->rowCount() === 0) {
            $check = $this->conn->prepare('SELECT id FROM orders WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) Response::error('Order not found.', 404);
        }
        Response::ok(['order' => $this->loadOrder($id)]);
    }

    public function delete(int $id): void {
        Auth::admin($this->conn);
        $stmt = $this->conn->prepare('DELETE FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) Response::error('Order not found.', 404);
        Response::ok(['message' => 'Order deleted.']);
    }
}
