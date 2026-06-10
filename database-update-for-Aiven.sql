-- Smartphone Store API database update for Aiven MySQL
-- Safe to import with HeidiSQL after you already imported the main schema.
-- It does not drop your existing data.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    avatar VARCHAR(255) DEFAULT 'public/images/default-avatar.png',
    role ENUM('Admin', 'Client') DEFAULT 'Client',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(10),
    remember_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT NULL,
    brand VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    old_price INT DEFAULT NULL,
    image_url VARCHAR(255) NOT NULL,
    details TEXT,
    sales_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_brand (brand),
    INDEX idx_products_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cart_item (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    notes TEXT,
    total_amount INT NOT NULL DEFAULT 0,
    status ENUM('Pending', 'Delivering', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Keep order status and dashboard fields consistent.
ALTER TABLE orders
    MODIFY COLUMN status ENUM('Pending', 'Delivering', 'Completed', 'Cancelled') DEFAULT 'Pending';

-- View used for checking Orders, Pending Orders and Revenue in HeidiSQL/Aiven.
DROP VIEW IF EXISTS admin_dashboard_stats;
CREATE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pending') AS pending_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'Completed') AS revenue;

-- Make sure default categories exist without duplicating them.
INSERT INTO categories (name) VALUES
('Điện thoại'), ('Laptop'), ('Tablet'), ('Phụ kiện'), ('Đồng hồ')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Keep the default admin only if it does not exist yet.
INSERT INTO users (full_name, email, password, role, is_active, is_verified)
SELECT 'System Admin', 'admin@store.com', '$2y$12$6gtHhzjvRxR3dmwowMpzlORA.QhIcQn/8Ntd9Wg5Wd2DNf6tOCZGe', 'Admin', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@store.com');
-- Product seed update for Aiven / HeidiSQL
-- Safe import: this does NOT drop tables and will NOT duplicate products by name.
-- Import this after database-update-for-Aiven.sql if your products table is empty.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT NULL,
    brand VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    old_price INT DEFAULT NULL,
    image_url VARCHAR(255) NOT NULL,
    details TEXT,
    sales_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_brand (brand),
    INDEX idx_products_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Make sure default categories exist.
INSERT INTO categories (name) VALUES
('Điện thoại'), ('Laptop'), ('Tablet'), ('Phụ kiện'), ('Đồng hồ')
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @phone_category_id := (SELECT id FROM categories WHERE name = 'Điện thoại' LIMIT 1);

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Samsung Galaxy S24 Ultra 5G', @phone_category_id, 'SAMSUNG', 31990000, 33990000, 'public/images/Phone-card-image-1.jpg', 'Cấu hình mạnh mẽ với chip Snapdragon 8 Gen 3, màn hình phẳng 6.8 inch và bút S-Pen đa năng.', 150, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Samsung Galaxy S24 Ultra 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'iPhone 15 Pro Max 256GB', @phone_category_id, 'iPhone', 34990000, 36990000, 'public/images/Phone-card-image-2.jpg', 'Siêu phẩm Apple với khung viền Titanium bền bỉ, chip A17 Pro tối tân và hệ thống camera zoom quang học 5x.', 500, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'iPhone 15 Pro Max 256GB');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Xiaomi 14 5G', @phone_category_id, 'xiaomi', 22990000, 24490000, 'public/images/Phone-card-image-3.jpg', 'Thiết kế nhỏ gọn, ống kính Leica cao cấp, hiệu năng đỉnh cao với chip xử lý thế hệ mới.', 120, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Xiaomi 14 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'OPPO Reno11 F 5G', @phone_category_id, 'OPPO', 8990000, NULL, 'public/images/Phone-card-image-4.jpg', 'Chuyên gia chân dung thế hệ mới, màn hình viền siêu mỏng, sạc nhanh SuperVOOC siêu tốc.', 250, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'OPPO Reno11 F 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'vivo V30 5G', @phone_category_id, 'vivo', 13990000, 14500000, 'public/images/Phone-card-image-5.jpg', 'Hệ thống camera vòng sáng Aura độc quyền, thiết kế mỏng nhẹ nghệ thuật đầy cuốn hút.', 90, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'vivo V30 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'realme 12 Pro+ 5G', @phone_category_id, 'realme', 10990000, NULL, 'public/images/Phone-card-image-6.jpg', 'Thiết kế mặt lưng da sinh học sang trọng từ nhà thiết kế đồng hồ xa xỉ, camera tiềm vọng cao cấp.', 110, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'realme 12 Pro+ 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'HONOR Magic6 Pro 5G', @phone_category_id, 'HONOR', 27990000, 29990000, 'public/images/Phone-card-image-7.jpg', 'Đỉnh cao công nghệ pin Silicon-Carbon, màn hình giọt nước cong tràn cạnh chống va đập tuyệt đối.', 50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'HONOR Magic6 Pro 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Motorola Edge 50 Pro 5G', @phone_category_id, 'motorola', 14990000, NULL, 'public/images/Phone-card-image-8.jpg', 'Màn hình pOLED chuẩn màu Pantone đầu tiên trên thế giới, khả năng chống nước IP68.', 40, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Motorola Edge 50 Pro 5G');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'iPhone 13 128GB', @phone_category_id, 'iPhone', 15990000, 17990000, 'public/images/Phone-card-image-9.jpg', 'Dòng sản phẩm quốc dân sở hữu thời lượng pin ấn tượng, hiệu năng mượt mà ổn định lâu dài.', 800, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'iPhone 13 128GB');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Samsung Galaxy A55 5G', @phone_category_id, 'SAMSUNG', 10490000, NULL, 'public/images/Phone-card-image-10.jpg', 'Khung viền kim loại cao cấp, bảo mật Knox Vault cấp độ chip, camera quay phim đêm sắc nét.', 300, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Samsung Galaxy A55 5G');

-- Recreate dashboard stats view after product seed.
DROP VIEW IF EXISTS admin_dashboard_stats;
CREATE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pending') AS pending_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'Completed') AS revenue;

SELECT COUNT(*) AS product_count_after_seed FROM products;
