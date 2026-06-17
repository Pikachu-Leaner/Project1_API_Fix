<?php
class ApiRouter {
    private AuthApi $auth;
    private ProductsApi $products;
    private CategoriesApi $categories;
    private UsersApi $users;
    private CartApi $cart;
    private OrdersApi $orders;
    private AdminApi $admin;

    public function __construct(private PDO $conn) {
        $this->auth       = new AuthApi($conn);
        $this->products   = new ProductsApi($conn);
        $this->categories = new CategoriesApi($conn);
        $this->users      = new UsersApi($conn);
        $this->cart       = new CartApi($conn);
        $this->orders     = new OrdersApi($conn);
        $this->admin      = new AdminApi($conn);
    }

    public function dispatch(array $segments): void {
        $method   = Request::method();
        $resource = $segments[1] ?? '';

        // CORS preflight
        if ($method === 'OPTIONS') { http_response_code(204); exit; }

        // CSRF check for cookie-based requests
        $this->checkCsrf($method);

        try {
            match ($resource) {
                'auth'       => $this->routeAuth($method, $segments),
                'products'   => $this->routeProducts($method, $segments),
                'categories' => $this->routeCategories($method, $segments),
                'users'      => $this->routeUsers($method, $segments),
                'cart'       => $this->routeCart($method, $segments),
                'orders'     => $this->routeOrders($method, $segments, false),
                'admin'      => $this->routeAdmin($method, $segments),
                default      => Response::error('API endpoint not found.', 404),
            };
        } catch (PDOException $e) {
            Response::error('Database error.', 500, ['error' => $e->getMessage()]);
        } catch (Throwable $e) {
            Response::error('Server error.', 500, ['error' => $e->getMessage()]);
        }
    }

    private function checkCsrf(string $method): void {
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;
        // Only enforce when cookie-based auth is used (no Bearer token)
        if (Request::bearerToken()) return;
        $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_COOKIE['csrf_token'] ?? '';
        $expected = $_SESSION['csrf_token'] ?? '';
        if ($expected && !hash_equals($expected, $csrf)) {
            Response::error('CSRF token mismatch.', 403);
        }
    }

    private function routeAuth(string $method, array $s): void {
        $action = $s[2] ?? '';
        match ([$method, $action]) {
            ['POST', 'register']        => $this->auth->register(),
            ['POST', 'login']           => $this->auth->login(),
            ['POST', 'logout']          => $this->auth->logout(),
            ['POST', 'refresh']         => $this->auth->refresh(),
            ['POST', 'verify-otp']      => $this->auth->verifyOtp(),
            ['POST', 'forgot-password'] => $this->auth->forgotPassword(),
            ['PATCH', 'reset-password'],
            ['POST', 'reset-password']  => $this->auth->resetPassword(),
            ['GET', 'me']               => $this->auth->me(),
            default                     => Response::error('Auth endpoint not found.', 404),
        };
    }

    private function routeProducts(string $method, array $s): void {
        $id = isset($s[2]) && ctype_digit((string)$s[2]) ? (int)$s[2] : null;
        if (($s[2] ?? '') === 'suggest' && $method === 'GET') $this->products->suggest();
        if ($method === 'GET' && $id !== null)  $this->products->show($id);
        if ($method === 'GET')                  $this->products->index();
        Response::error('Use /api/admin/products for product write methods.', 405);
    }

    private function routeCategories(string $method, array $s): void {
        if ($method === 'GET') $this->categories->index();
        Response::error('Use /api/admin/categories for category write methods.', 405);
    }

    private function routeUsers(string $method, array $s): void {
        if (($s[2] ?? '') === 'me') {
            match ($method) {
                'GET'   => $this->users->me(),
                'PATCH' => $this->users->updateMe(),
                default => Response::error('Method not allowed.', 405),
            };
        }
        Response::error('Use /api/admin/users for admin user methods.', 405);
    }

    private function routeCart(string $method, array $s): void {
        if ($method === 'GET'    && count($s) === 2) $this->cart->index();
        if ($method === 'DELETE' && count($s) === 2) $this->cart->clear();
        if (($s[2] ?? '') === 'items' && $method === 'POST') $this->cart->addItem();
        if (($s[2] ?? '') === 'items' && isset($s[3]) && ctype_digit((string)$s[3])) {
            $productId = (int)$s[3];
            match ($method) {
                'PATCH', 'PUT' => $this->cart->updateItem($productId),
                'DELETE'       => $this->cart->deleteItem($productId),
                default        => Response::error('Method not allowed.', 405),
            };
        }
        Response::error('Cart endpoint not found.', 404);
    }

    private function routeOrders(string $method, array $s, bool $adminRoute): void {
        $id = isset($s[2]) && ctype_digit((string)$s[2]) ? (int)$s[2] : null;
        if ($method === 'GET'  && $id === null) $this->orders->index($adminRoute);
        if ($method === 'POST' && $id === null) $this->orders->create();
        if ($method === 'GET'  && $id !== null) $this->orders->show($id);
        if ($adminRoute && $method === 'PATCH' && $id !== null && ($s[3] ?? '') === 'status') $this->orders->updateStatus($id);
        if ($adminRoute && $method === 'DELETE' && $id !== null) $this->orders->delete($id);
        Response::error('Order endpoint not found.', 404);
    }

    private function routeAdmin(string $method, array $s): void {
        Auth::admin($this->conn);
        $area = $s[2] ?? '';
        $id   = isset($s[3]) && ctype_digit((string)$s[3]) ? (int)$s[3] : null;

        // Dashboard
        if ($area === 'dashboard' && $method === 'GET') $this->admin->dashboard();

        // Analytics
        if ($area === 'revenue') {
            $period = $s[3] ?? '';
            match ($period) {
                'day'   => $this->admin->revenueDay(),
                'month' => $this->admin->revenueMonth(),
                'year'  => $this->admin->revenueYear(),
                default => Response::error('Revenue period not found.', 404),
            };
        }
        if ($area === 'orders' && ($s[3] ?? '') === 'day') $this->admin->ordersDay();
        if ($area === 'products' && ($s[3] ?? '') === 'top') $this->admin->topProducts();

        // Products CRUD
        if ($area === 'products') {
            if (($s[3] ?? '') === 'upload' && $method === 'POST') $this->products->upload();
            if ($method === 'POST' && $id === null) $this->products->create();
            if ($method === 'GET'  && $id === null) $this->products->index();
            if ($method === 'GET'  && $id !== null) $this->products->show($id);
            if ($method === 'PUT'  && $id !== null) $this->products->replace($id);
            if ($method === 'PATCH'&& $id !== null) $this->products->patch($id);
            if ($method === 'DELETE'&&$id !== null) $this->products->delete($id);
        }

        // Categories CRUD
        if ($area === 'categories') {
            if ($method === 'GET'  && $id === null) $this->categories->index();
            if ($method === 'POST' && $id === null) $this->categories->create();
            if (in_array($method, ['PUT','PATCH']) && $id !== null) $this->categories->update($id);
            if ($method === 'DELETE' && $id !== null) $this->categories->delete($id);
        }

        // Users
        if ($area === 'users') {
            if ($method === 'GET'  && $id === null) $this->admin->users();
            if ($method === 'GET'  && $id !== null) $this->users->show($id);
            if ($method === 'PATCH'&& $id !== null && ($s[4] ?? '') === 'status') $this->users->toggleStatus($id);
            if (in_array($method, ['PATCH','PUT']) && $id !== null) $this->users->update($id);
        }

        // Orders
        if ($area === 'orders') {
            $orderId = isset($s[3]) && ctype_digit((string)$s[3]) ? (int)$s[3] : null;
            $fakeS   = array_merge(['api', 'orders'], array_slice($s, 3));
            $this->routeOrders($method, $fakeS, true);
        }

        Response::error('Admin endpoint not found.', 404);
    }
}
