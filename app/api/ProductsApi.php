<?php
class ProductsApi {
    public function __construct(private PDO $conn) {}

    private function sanitizeProduct(array $product): array {
        $product['id'] = (int)$product['id'];
        $product['category_id'] = isset($product['category_id']) ? (int)$product['category_id'] : null;
        $product['price'] = (int)$product['price'];
        $product['old_price'] = isset($product['old_price']) ? (int)$product['old_price'] : null;
        $product['sales_count'] = isset($product['sales_count']) ? (int)$product['sales_count'] : 0;
        $product['is_featured'] = (bool)($product['is_featured'] ?? false);
        return $product;
    }

    private function productQuery(array $filters = []): array {
        $query = 'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
        $conditions = [];
        $params = [];

        if (!empty($filters['brand'])) {
            $conditions[] = 'LOWER(p.brand) = LOWER(:brand)';
            $params[':brand'] = trim((string)$filters['brand']);
        }
        if (!empty($filters['category'])) {
            $conditions[] = 'p.category_id = :category';
            $params[':category'] = (int)$filters['category'];
        }
        if (!empty($filters['search'])) {
            $terms = array_values(array_filter(preg_split('/\s+/u', trim((string)$filters['search']))));
            foreach ($terms as $idx => $term) {
                $nameKey = ':term_name_' . $idx;
                $brandKey = ':term_brand_' . $idx;
                $categoryKey = ':term_category_' . $idx;
                $conditions[] = "(p.name LIKE {$nameKey} OR p.brand LIKE {$brandKey} OR c.name LIKE {$categoryKey})";
                $params[$nameKey] = '%' . $term . '%';
                $params[$brandKey] = '%' . $term . '%';
                $params[$categoryKey] = '%' . $term . '%';
            }
        }

        if ($conditions) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $sort = (string)($filters['sort'] ?? 'noi_bat');
        $query .= match ($sort) {
            'ban_chay' => ' ORDER BY p.sales_count DESC, p.id DESC',
            'moi' => ' ORDER BY p.created_at DESC, p.id DESC',
            'gia_tang' => ' ORDER BY p.price ASC, p.id DESC',
            'gia_giam' => ' ORDER BY p.price DESC, p.id DESC',
            default => ' ORDER BY p.is_featured DESC, p.id DESC',
        };

        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        $products = array_map(fn($p) => $this->sanitizeProduct($p), $stmt->fetchAll());

        if (!empty($filters['search'])) {
            $search = (string)$filters['search'];
            usort($products, function ($a, $b) use ($search) {
                $scoreA = SearchHelper::score($a, $search);
                $scoreB = SearchHelper::score($b, $search);
                if ($scoreA !== $scoreB) return $scoreA <=> $scoreB;
                if ((bool)$a['is_featured'] !== (bool)$b['is_featured']) return $b['is_featured'] <=> $a['is_featured'];
                return $b['sales_count'] <=> $a['sales_count'];
            });
        }

        return $products;
    }

    public function index(): void {
        $products = $this->productQuery([
            'search' => $_GET['search'] ?? $_GET['q'] ?? '',
            'brand' => $_GET['brand'] ?? '',
            'category' => $_GET['category'] ?? '',
            'sort' => $_GET['sort'] ?? 'noi_bat',
        ]);
        Response::ok(['products' => $products, 'count' => count($products)]);
    }

    public function suggest(): void {
        $q = trim((string)($_GET['q'] ?? $_GET['search'] ?? ''));
        if (mb_strlen($q, 'UTF-8') < 1) {
            Response::ok(['suggestions' => [], 'keywords' => []]);
        }

        $products = array_slice($this->productQuery(['search' => $q, 'sort' => 'noi_bat']), 0, 8);
        $suggestions = array_map(function ($p) use ($q) {
            return [
                'id' => (int)$p['id'],
                'name' => $p['name'],
                'brand' => $p['brand'],
                'category_name' => $p['category_name'] ?? '',
                'price' => (int)$p['price'],
                'old_price' => isset($p['old_price']) ? (int)$p['old_price'] : null,
                'image_url' => $p['image_url'],
                'highlighted_name' => SearchHelper::highlight($p['name'], $q),
                'score' => SearchHelper::score($p, $q),
            ];
        }, $products);

        $keywordMap = [];
        foreach ($products as $p) {
            foreach ([$p['brand'] ?? '', $p['category_name'] ?? ''] as $term) {
                $term = trim((string)$term);
                if ($term !== '' && mb_stripos($term, $q, 0, 'UTF-8') !== false) {
                    $keywordMap[mb_strtolower($term, 'UTF-8')] = $term;
                }
            }
            $words = preg_split('/\s+/u', (string)$p['name']);
            foreach ($words as $word) {
                $word = trim($word, " -_()[]{}.,");
                if (mb_strlen($word, 'UTF-8') >= 2 && mb_stripos($word, $q, 0, 'UTF-8') !== false) {
                    $keywordMap[mb_strtolower($word, 'UTF-8')] = $word;
                }
            }
        }
        $keywords = array_slice(array_values($keywordMap), 0, 4);
        $keywords = array_map(fn($term) => [
            'term' => $term,
            'highlighted_term' => SearchHelper::highlight($term, $q),
        ], $keywords);

        Response::ok(['suggestions' => $suggestions, 'keywords' => $keywords]);
    }

    public function show(int $id): void {
        $stmt = $this->conn->prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? LIMIT 1');
        $stmt->execute([$id]);
        $product = $stmt->fetch();
        if (!$product) {
            Response::error('Product not found.', 404);
        }
        $product = $this->sanitizeProduct($product);

        $rel = $this->conn->prepare('SELECT * FROM products WHERE brand = ? AND id != ? ORDER BY is_featured DESC, sales_count DESC LIMIT 4');
        $rel->execute([$product['brand'], $id]);
        $related = array_map(fn($p) => $this->sanitizeProduct($p), $rel->fetchAll());

        Response::ok(['product' => $product, 'related' => $related]);
    }

    private function validateProduct(array $body, bool $partial = false): array {
        $allowed = ['name', 'brand', 'price', 'old_price', 'category_id', 'image_url', 'details', 'sales_count', 'is_featured'];
        $data = array_intersect_key($body, array_flip($allowed));
        $errors = [];

        if (!$partial || array_key_exists('name', $data)) {
            if (trim((string)($data['name'] ?? '')) === '') $errors['name'] = 'Product name is required.';
            $data['name'] = trim((string)($data['name'] ?? ''));
        }
        if (!$partial || array_key_exists('brand', $data)) {
            if (trim((string)($data['brand'] ?? '')) === '') $errors['brand'] = 'Brand is required.';
            $data['brand'] = trim((string)($data['brand'] ?? ''));
        }
        if (!$partial || array_key_exists('price', $data)) {
            if (!is_numeric($data['price'] ?? null) || (int)$data['price'] <= 0) $errors['price'] = 'Price must be greater than 0.';
            $data['price'] = (int)($data['price'] ?? 0);
        }
        if (array_key_exists('old_price', $data)) $data['old_price'] = $data['old_price'] === '' || $data['old_price'] === null ? null : (int)$data['old_price'];
        if (array_key_exists('category_id', $data)) $data['category_id'] = $data['category_id'] === '' || $data['category_id'] === null ? null : (int)$data['category_id'];
        if (array_key_exists('sales_count', $data)) $data['sales_count'] = (int)$data['sales_count'];
        if (array_key_exists('is_featured', $data)) $data['is_featured'] = filter_var($data['is_featured'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        if (array_key_exists('image_url', $data)) $data['image_url'] = trim((string)$data['image_url']);
        if (array_key_exists('details', $data)) $data['details'] = trim((string)$data['details']);

        if ($errors) Response::error('Validation failed.', 422, $errors);
        return $data;
    }

    public function create(): void {
        Auth::admin($this->conn);
        $body = Request::body();
        $data = $this->validateProduct($body, false);
        $data += [
            'category_id' => null,
            'old_price' => null,
            'image_url' => 'public/images/Phone-card-image-1.jpg',
            'details' => null,
            'sales_count' => 0,
            'is_featured' => 0,
        ];

        $stmt = $this->conn->prepare('INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured) VALUES (:name, :category_id, :brand, :price, :old_price, :image_url, :details, :sales_count, :is_featured)');
        $stmt->execute($data);
        $this->show((int)$this->conn->lastInsertId());
    }

    public function replace(int $id): void {
        Auth::admin($this->conn);
        $data = $this->validateProduct(Request::body(), false);
        $data += [
            'category_id' => null,
            'old_price' => null,
            'image_url' => 'public/images/Phone-card-image-1.jpg',
            'details' => null,
            'sales_count' => 0,
            'is_featured' => 0,
            'id' => $id,
        ];

        $stmt = $this->conn->prepare('UPDATE products SET name = :name, category_id = :category_id, brand = :brand, price = :price, old_price = :old_price, image_url = :image_url, details = :details, sales_count = :sales_count, is_featured = :is_featured WHERE id = :id');
        $stmt->execute($data);
        if ($stmt->rowCount() === 0) {
            $check = $this->conn->prepare('SELECT id FROM products WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) Response::error('Product not found.', 404);
        }
        $this->show($id);
    }

    public function patch(int $id): void {
        Auth::admin($this->conn);
        $data = $this->validateProduct(Request::body(), true);
        if (!$data) Response::error('Nothing to update.', 422);

        $assignments = [];
        foreach ($data as $key => $_) {
            $assignments[] = "{$key} = :{$key}";
        }
        $data['id'] = $id;
        $stmt = $this->conn->prepare('UPDATE products SET ' . implode(', ', $assignments) . ' WHERE id = :id');
        $stmt->execute($data);
        if ($stmt->rowCount() === 0) {
            $check = $this->conn->prepare('SELECT id FROM products WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) Response::error('Product not found.', 404);
        }
        $this->show($id);
    }

    public function delete(int $id): void {
        Auth::admin($this->conn);
        $stmt = $this->conn->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) Response::error('Product not found.', 404);
        Response::ok(['message' => 'Product deleted.']);
    }

    public function upload(): void {
        Auth::admin($this->conn);
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Image file is required.', 422);
        }
        $file = $_FILES['image'];
        if ($file['size'] > 3 * 1024 * 1024) {
            Response::error('Image must be smaller than 3MB.', 422);
        }
        $mime = mime_content_type($file['tmp_name']);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/avif' => 'avif'];
        if (!isset($allowed[$mime])) {
            Response::error('Only JPG, PNG, WEBP, and AVIF images are allowed.', 422);
        }

        $dir = APP_ROOT . '/public/images/uploads';
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $filename = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
        $target = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            Response::error('Upload failed.', 500);
        }
        Response::ok(['image_url' => 'public/images/uploads/' . $filename], 201);
    }
}
