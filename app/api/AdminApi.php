<?php
class AdminApi {
    public function __construct(private PDO $conn) {}

    public function dashboard(): void {
        Auth::admin($this->conn);
        $revenue = $this->conn->query("SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE status = 'Completed'")->fetch()['revenue'] ?? 0;
        $counts = [
            'products' => (int)$this->conn->query('SELECT COUNT(*) AS c FROM products')->fetch()['c'],
            'users' => (int)$this->conn->query('SELECT COUNT(*) AS c FROM users')->fetch()['c'],
            'orders' => (int)$this->conn->query('SELECT COUNT(*) AS c FROM orders')->fetch()['c'],
            'pending_orders' => (int)$this->conn->query("SELECT COUNT(*) AS c FROM orders WHERE status = 'Pending'")->fetch()['c'],
            'revenue' => (int)$revenue,
        ];

        $orders = $this->conn->query('SELECT id, customer_name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10')->fetchAll();
        foreach ($orders as &$order) {
            $order['id'] = (int)$order['id'];
            $order['total_amount'] = (int)$order['total_amount'];
        }

        Response::ok(['stats' => $counts, 'latest_orders' => $orders]);
    }
}
