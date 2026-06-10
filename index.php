<?php
declare(strict_types=1);

define('APP_ROOT', __DIR__);

require_once APP_ROOT . '/app/config/database.php';
require_once APP_ROOT . '/app/core/Response.php';
require_once APP_ROOT . '/app/core/Request.php';
require_once APP_ROOT . '/app/core/JWT.php';
require_once APP_ROOT . '/app/core/Auth.php';
require_once APP_ROOT . '/app/core/SearchHelper.php';
require_once APP_ROOT . '/app/api/AuthApi.php';
require_once APP_ROOT . '/app/api/ProductsApi.php';
require_once APP_ROOT . '/app/api/CategoriesApi.php';
require_once APP_ROOT . '/app/api/UsersApi.php';
require_once APP_ROOT . '/app/api/CartApi.php';
require_once APP_ROOT . '/app/api/OrdersApi.php';
require_once APP_ROOT . '/app/api/AdminApi.php';
require_once APP_ROOT . '/app/api/ApiRouter.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override');

$url = $_GET['url'] ?? trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
$url = trim((string)$url, '/');
$segments = $url === '' ? [] : array_values(array_filter(explode('/', $url), fn($s) => $s !== ''));

if (Request::method() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($segments[0] ?? '') === 'api') {
    $endpoint = $segments[1] ?? '';

    // This route does not need database. Use it first to confirm Apache + PHP + rewrite are OK.
    if ($endpoint === 'health') {
        Response::ok([
            'status' => 'ok',
            'php_version' => PHP_VERSION,
            'api_url' => '/api',
            'message' => 'API is reachable. If /api/categories fails, check database settings/schema.',
        ]);
    }

    try {
        $db = new Database();
        $conn = $db->getConnection();

        if ($endpoint === 'db-check') {
            $row = $conn->query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')->fetch();
            $tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            Response::ok([
                'connected' => true,
                'database' => $row['database_name'] ?? null,
                'mysql_version' => $row['mysql_version'] ?? null,
                'required_tables' => ['users', 'categories', 'products', 'cart_items', 'orders', 'order_details'],
                'existing_tables' => $tables,
            ]);
        }

        (new ApiRouter($conn))->dispatch($segments);
    } catch (Throwable $e) {
        $debug = strtolower((string)(getenv('APP_DEBUG') ?: 'true')) !== 'false';
        Response::error('Application boot failed. Check database connection and schema.', 500, $debug ? ['error' => $e->getMessage()] : []);
    }
}

// Frontend is now static HTML + Fetch API. No PHP views are rendered.
$frontend = APP_ROOT . '/public/index.html';
if (is_file($frontend)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($frontend);
    exit;
}

http_response_code(404);
echo 'Frontend not found.';
