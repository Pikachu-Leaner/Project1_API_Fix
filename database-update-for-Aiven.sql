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
