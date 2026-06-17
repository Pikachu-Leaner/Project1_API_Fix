<?php
class AdminApi {
    public function __construct(private PDO $conn) {}

    public function dashboard(): void {
        Auth::admin($this->conn);
        $revenue = $this->conn->query("SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE status = 'Completed'")->fetch()['revenue'] ?? 0;
        $counts  = [
            'products'      => (int)$this->conn->query('SELECT COUNT(*) AS c FROM products')->fetch()['c'],
            'users'         => (int)$this->conn->query('SELECT COUNT(*) AS c FROM users')->fetch()['c'],
            'orders'        => (int)$this->conn->query('SELECT COUNT(*) AS c FROM orders')->fetch()['c'],
            'pending_orders'=> (int)$this->conn->query("SELECT COUNT(*) AS c FROM orders WHERE status = 'Pending'")->fetch()['c'],
            'revenue'       => (int)$revenue,
        ];
        $orders = $this->conn->query('SELECT id, customer_name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10')->fetchAll();
        foreach ($orders as &$o) { $o['id'] = (int)$o['id']; $o['total_amount'] = (int)$o['total_amount']; }
        Response::ok(['stats' => $counts, 'latest_orders' => $orders]);
    }

    /** GET /api/admin/revenue/day - Revenue per day for last 30 days */
    public function revenueDay(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            "SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
             FROM orders WHERE status = 'Completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at) ORDER BY date ASC"
        )->fetchAll();
        Response::ok(['revenue_by_day' => $rows]);
    }

    /** GET /api/admin/revenue/month - Revenue per month for last 12 months */
    public function revenueMonth(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            "SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             COALESCE(SUM(CASE WHEN status='Completed' THEN total_amount ELSE 0 END),0) AS revenue,
             COUNT(*) AS orders,
             SUM(status='Completed') AS completed,
             SUM(status='Cancelled') AS cancelled
             FROM orders
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month ASC"
        )->fetchAll();

        // Build a full 12-month map so the chart always shows all months
        $map = [];
        for ($i = 11; $i >= 0; $i--) {
            $key = date('Y-m', strtotime("-{$i} months"));
            $map[$key] = ['month' => $key, 'revenue' => 0, 'orders' => 0, 'completed' => 0, 'cancelled' => 0];
        }
        foreach ($rows as $r) {
            if (isset($map[$r['month']])) {
                $map[$r['month']] = [
                    'month'     => $r['month'],
                    'revenue'   => (int)$r['revenue'],
                    'orders'    => (int)$r['orders'],
                    'completed' => (int)$r['completed'],
                    'cancelled' => (int)$r['cancelled'],
                ];
            }
        }
        Response::ok(['revenue_by_month' => array_values($map)]);
    }

    /** GET /api/admin/revenue/year - Revenue per year */
    public function revenueYear(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            "SELECT YEAR(created_at) AS year, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
             FROM orders WHERE status = 'Completed'
             GROUP BY YEAR(created_at) ORDER BY year ASC"
        )->fetchAll();
        Response::ok(['revenue_by_year' => $rows]);
    }

    /** GET /api/admin/orders/day - Orders per day last 30 days */
    public function ordersDay(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            "SELECT DATE(created_at) AS date, COUNT(*) AS total,
             SUM(status='Pending') AS pending, SUM(status='Completed') AS completed,
             SUM(status='Cancelled') AS cancelled
             FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at) ORDER BY date ASC"
        )->fetchAll();
        Response::ok(['orders_by_day' => $rows]);
    }

    /** GET /api/admin/products/top - Top 10 best-selling products */
    public function topProducts(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            "SELECT p.id, p.name, p.brand, p.price, p.sales_count,
             COALESCE(SUM(od.quantity),0) AS units_sold,
             COALESCE(SUM(od.quantity * od.price),0) AS revenue
             FROM products p
             LEFT JOIN order_details od ON od.product_id = p.id
             LEFT JOIN orders o ON o.id = od.order_id AND o.status = 'Completed'
             GROUP BY p.id ORDER BY units_sold DESC LIMIT 10"
        )->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['units_sold'] = (int)$r['units_sold']; }
        Response::ok(['top_products' => $rows]);
    }

    /** GET /api/admin/users - Return all users (id, name, email, role, status) */
    public function users(): void {
        Auth::admin($this->conn);
        $rows = $this->conn->query(
            'SELECT id, full_name, email, role, is_active, is_verified, created_at FROM users ORDER BY id DESC'
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id']          = (int)$r['id'];
            $r['is_active']   = (bool)$r['is_active'];
            $r['is_verified'] = (bool)$r['is_verified'];
        }
        Response::ok(['users' => $rows]);
    }
}
