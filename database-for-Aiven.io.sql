SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_details;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
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

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
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
    INDEX idx_products_category (category_id),
    FULLTEXT KEY ft_products_name_brand_details (name, brand, details),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cart_item (user_id, product_id),
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    notes TEXT,
    total_amount INT NOT NULL,
    status ENUM('Pending', 'Delivering', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL,
    CONSTRAINT fk_details_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_details_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (name) VALUES
('Điện thoại'), ('Laptop'), ('Tablet'), ('Phụ kiện'), ('Đồng hồ');

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured) VALUES
('Samsung Galaxy S24 Ultra 5G', 1, 'SAMSUNG', 31990000, 33990000, 'public/images/Phone-card-image-1.jpg', 'Cấu hình mạnh mẽ với chip Snapdragon 8 Gen 3, màn hình phẳng 6.8 inch và bút S-Pen đa năng.', 150, TRUE),
('iPhone 15 Pro Max 256GB', 1, 'iPhone', 34990000, 36990000, 'public/images/Phone-card-image-2.jpg', 'Siêu phẩm Apple với khung viền Titanium bền bỉ, chip A17 Pro tối tân và hệ thống camera zoom quang học 5x.', 500, TRUE),
('Xiaomi 14 5G', 1, 'xiaomi', 22990000, 24490000, 'public/images/Phone-card-image-3.jpg', 'Thiết kế nhỏ gọn, ống kính Leica cao cấp, hiệu năng đỉnh cao với chip xử lý thế hệ mới.', 120, TRUE),
('OPPO Reno11 F 5G', 1, 'OPPO', 8990000, NULL, 'public/images/Phone-card-image-4.jpg', 'Chuyên gia chân dung thế hệ mới, màn hình viền siêu mỏng, sạc nhanh SuperVOOC siêu tốc.', 250, FALSE),
('vivo V30 5G', 1, 'vivo', 13990000, 14500000, 'public/images/Phone-card-image-5.jpg', 'Hệ thống camera vòng sáng Aura độc quyền, thiết kế mỏng nhẹ nghệ thuật đầy cuốn hút.', 90, FALSE),
('realme 12 Pro+ 5G', 1, 'realme', 10990000, NULL, 'public/images/Phone-card-image-6.jpg', 'Thiết kế mặt lưng da sinh học sang trọng từ nhà thiết kế đồng hồ xa xỉ, camera tiềm vọng cao cấp.', 110, FALSE),
('HONOR Magic6 Pro 5G', 1, 'HONOR', 27990000, 29990000, 'public/images/Phone-card-image-7.jpg', 'Đỉnh cao công nghệ pin Silicon-Carbon, màn hình giọt nước cong tràn cạnh chống va đập tuyệt đối.', 50, TRUE),
('Motorola Edge 50 Pro 5G', 1, 'motorola', 14990000, NULL, 'public/images/Phone-card-image-8.jpg', 'Màn hình pOLED chuẩn màu Pantone đầu tiên trên thế giới, khả năng chống nước IP68.', 40, FALSE),
('iPhone 13 128GB', 1, 'iPhone', 15990000, 17990000, 'public/images/Phone-card-image-9.jpg', 'Dòng sản phẩm quốc dân sở hữu thời lượng pin ấn tượng, hiệu năng mượt mà ổn định lâu dài.', 800, FALSE),
('Samsung Galaxy A55 5G', 1, 'SAMSUNG', 10490000, NULL, 'public/images/Phone-card-image-10.jpg', 'Khung viền kim loại cao cấp, bảo mật Knox Vault cấp độ chip, camera quay phim đêm sắc nét.', 300, FALSE);

-- Admin login: admin@store.com / admin123
INSERT INTO users (full_name, email, password, role, is_active, is_verified)
VALUES ('System Admin', 'admin@store.com', '$2y$12$6gtHhzjvRxR3dmwowMpzlORA.QhIcQn/8Ntd9Wg5Wd2DNf6tOCZGe', 'Admin', 1, 1);
