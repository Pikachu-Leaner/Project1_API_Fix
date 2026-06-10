CREATE DATABASE IF NOT EXISTS electronic_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE electronic_store;
SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS admin_dashboard_stats;
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
('Samsung Galaxy S24 Ultra 5G', 1, 'SAMSUNG', 31990000, 33990000, 'public/images/Phone-card-image-1.jpg', 'Cấu hình mạnh mẽ với chip Snapdragon 8 Gen 3, màn hình phẳng 6.8 inch, bút S-Pen tích hợp và camera zoom xa sắc nét. Phù hợp cho người cần hiệu năng cao, ghi chú nhanh, chụp ảnh đa tiêu cự và làm việc di động. Máy bán ra nguyên hộp, hỗ trợ kiểm tra ngoại hình, phụ kiện, IMEI và kích hoạt bảo hành điện tử tại thời điểm nhận hàng.', 150, TRUE),
('iPhone 15 Pro Max 256GB', 1, 'iPhone', 34990000, 36990000, 'public/images/Phone-card-image-2.jpg', 'iPhone 15 Pro Max 256GB nổi bật với khung viền Titanium, chip A17 Pro mạnh mẽ, camera tele zoom quang học 5x và cổng USB-C tiện dụng. Đây là lựa chọn phù hợp cho quay chụp, chơi game, sáng tạo nội dung và sử dụng lâu dài trong hệ sinh thái Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu từ máy cũ.', 500, TRUE),
('Xiaomi 14 5G', 1, 'xiaomi', 22990000, 24490000, 'public/images/Phone-card-image-3.jpg', 'Xiaomi 14 5G có thiết kế gọn, hiệu năng cao, cụm camera hợp tác Leica và màn hình hiển thị sắc nét. Sản phẩm phù hợp cho người thích máy Android cao cấp nhưng vẫn muốn kích thước dễ cầm, sạc nhanh và khả năng chụp ảnh linh hoạt. Hỗ trợ bảo hành chính hãng, kiểm tra máy và tư vấn cài đặt ban đầu.', 120, TRUE),
('OPPO Reno11 F 5G', 1, 'OPPO', 8990000, NULL, 'public/images/Phone-card-image-4.jpg', 'OPPO Reno11 F 5G tập trung vào thiết kế mỏng nhẹ, màn hình viền mỏng, camera chân dung đẹp và sạc nhanh SuperVOOC. Máy phù hợp cho học sinh, sinh viên hoặc người dùng cần smartphone thời trang, pin ổn và chụp ảnh mạng xã hội tốt. Hàng chính hãng, hỗ trợ đổi mới 7 ngày nếu lỗi phần cứng từ nhà sản xuất.', 250, FALSE),
('vivo V30 5G', 1, 'vivo', 13990000, 14500000, 'public/images/Phone-card-image-5.jpg', 'vivo V30 5G gây ấn tượng với thiết kế mỏng, camera Aura Light hỗ trợ chụp chân dung và màn hình hiển thị sống động. Máy phù hợp cho nhu cầu selfie, quay video ngắn, giải trí và làm việc hằng ngày. Khi mua hàng được hỗ trợ kiểm tra máy, tư vấn phụ kiện sạc/cáp phù hợp và bảo hành điện tử rõ ràng.', 90, FALSE),
('realme 12 Pro+ 5G', 1, 'realme', 10990000, NULL, 'public/images/Phone-card-image-6.jpg', 'realme 12 Pro+ 5G có thiết kế mặt lưng da sinh học, camera tele tiềm vọng trong tầm giá và hiệu năng ổn cho tác vụ hằng ngày. Sản phẩm phù hợp với người dùng thích thiết kế nổi bật, chụp ảnh chân dung và giải trí đa phương tiện. Hàng mới nguyên hộp, hỗ trợ thanh toán linh hoạt và giao hàng nhanh.', 110, FALSE),
('HONOR Magic6 Pro 5G', 1, 'HONOR', 27990000, 29990000, 'public/images/Phone-card-image-7.jpg', 'HONOR Magic6 Pro 5G sở hữu pin Silicon-Carbon dung lượng cao, màn hình cong cao cấp, hiệu năng mạnh và hệ thống camera đa tiêu cự. Máy hướng tới người dùng cần pin bền, chụp ảnh tốt, màn hình đẹp và trải nghiệm flagship Android. Hỗ trợ kiểm tra ngoại hình, IMEI, phụ kiện theo máy và bảo hành điện tử minh bạch.', 50, TRUE),
('Motorola Edge 50 Pro 5G', 1, 'motorola', 14990000, NULL, 'public/images/Phone-card-image-8.jpg', 'Motorola Edge 50 Pro 5G nổi bật với màn hình pOLED chuẩn màu Pantone, thiết kế mỏng nhẹ, khả năng chống nước IP68 và giao diện Android gần gốc. Máy phù hợp cho người thích trải nghiệm mượt, màu sắc màn hình chính xác và thiết kế khác biệt. Sản phẩm được hỗ trợ bảo hành chính hãng và đổi trả theo chính sách cửa hàng.', 40, FALSE),
('iPhone 13 128GB', 1, 'iPhone', 15990000, 17990000, 'public/images/Phone-card-image-9.jpg', 'iPhone 13 128GB vẫn là lựa chọn dễ dùng với hiệu năng ổn định, camera chất lượng, pin tốt và hỗ trợ iOS lâu dài. Máy phù hợp cho người chuyển sang iPhone lần đầu, học tập, làm việc, chụp ảnh và sử dụng các dịch vụ Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu khi mua hàng.', 800, FALSE),
('Samsung Galaxy A55 5G', 1, 'SAMSUNG', 10490000, NULL, 'public/images/Phone-card-image-10.jpg', 'Samsung Galaxy A55 5G có khung viền kim loại, màn hình Super AMOLED, camera ổn định, bảo mật Knox Vault và pin phù hợp nhu cầu cả ngày. Đây là mẫu máy cân bằng cho học tập, công việc, giải trí và chụp ảnh hằng ngày. Hàng chính hãng, hỗ trợ bảo hành điện tử và tư vấn phụ kiện tương thích.', 300, FALSE);


DROP VIEW IF EXISTS admin_dashboard_stats;
CREATE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pending') AS pending_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'Completed') AS revenue;

-- Admin login: admin@store.com / admin123
INSERT INTO users (full_name, email, password, role, is_active, is_verified)
VALUES ('System Admin', 'admin@store.com', '$2y$12$6gtHhzjvRxR3dmwowMpzlORA.QhIcQn/8Ntd9Wg5Wd2DNf6tOCZGe', 'Admin', 1, 1);
