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

if (($segments[0] ?? '') === 'api') {
    try {
        $db = new Database();
        $conn = $db->getConnection();
        (new ApiRouter($conn))->dispatch($segments);
    } catch (Throwable $e) {
        Response::error('Application boot failed.', 500, ['error' => $e->getMessage()]);
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
