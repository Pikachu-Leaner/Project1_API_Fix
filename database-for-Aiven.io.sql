-- Smartphone Store latest full safe update for Aiven MySQL / HeidiSQL
-- Includes schema, admin dashboard view, default categories/admin user, and product seed/detail updates.
-- Safe import: does not drop existing tables or product data. Products are inserted only if missing, then updated by name.

SET NAMES utf8mb4;

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

-- Product seed and richer product details update.
SET @phone_category_id := (SELECT id FROM categories WHERE name = 'Điện thoại' LIMIT 1);

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Samsung Galaxy S24 Ultra 5G', @phone_category_id, 'SAMSUNG', 31990000, 33990000, 'public/images/Phone-card-image-1.jpg', 'Cấu hình mạnh mẽ với chip Snapdragon 8 Gen 3, màn hình phẳng 6.8 inch, bút S-Pen tích hợp và camera zoom xa sắc nét. Phù hợp cho người cần hiệu năng cao, ghi chú nhanh, chụp ảnh đa tiêu cự và làm việc di động. Máy bán ra nguyên hộp, hỗ trợ kiểm tra ngoại hình, phụ kiện, IMEI và kích hoạt bảo hành điện tử tại thời điểm nhận hàng.', 150, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Samsung Galaxy S24 Ultra 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'SAMSUNG', price = 31990000, old_price = 33990000, image_url = 'public/images/Phone-card-image-1.jpg', details = 'Cấu hình mạnh mẽ với chip Snapdragon 8 Gen 3, màn hình phẳng 6.8 inch, bút S-Pen tích hợp và camera zoom xa sắc nét. Phù hợp cho người cần hiệu năng cao, ghi chú nhanh, chụp ảnh đa tiêu cự và làm việc di động. Máy bán ra nguyên hộp, hỗ trợ kiểm tra ngoại hình, phụ kiện, IMEI và kích hoạt bảo hành điện tử tại thời điểm nhận hàng.', sales_count = 150, is_featured = TRUE WHERE name = 'Samsung Galaxy S24 Ultra 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'iPhone 15 Pro Max 256GB', @phone_category_id, 'iPhone', 34990000, 36990000, 'public/images/Phone-card-image-2.jpg', 'iPhone 15 Pro Max 256GB nổi bật với khung viền Titanium, chip A17 Pro mạnh mẽ, camera tele zoom quang học 5x và cổng USB-C tiện dụng. Đây là lựa chọn phù hợp cho quay chụp, chơi game, sáng tạo nội dung và sử dụng lâu dài trong hệ sinh thái Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu từ máy cũ.', 500, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'iPhone 15 Pro Max 256GB');

UPDATE products SET category_id = @phone_category_id, brand = 'iPhone', price = 34990000, old_price = 36990000, image_url = 'public/images/Phone-card-image-2.jpg', details = 'iPhone 15 Pro Max 256GB nổi bật với khung viền Titanium, chip A17 Pro mạnh mẽ, camera tele zoom quang học 5x và cổng USB-C tiện dụng. Đây là lựa chọn phù hợp cho quay chụp, chơi game, sáng tạo nội dung và sử dụng lâu dài trong hệ sinh thái Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu từ máy cũ.', sales_count = 500, is_featured = TRUE WHERE name = 'iPhone 15 Pro Max 256GB';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Xiaomi 14 5G', @phone_category_id, 'xiaomi', 22990000, 24490000, 'public/images/Phone-card-image-3.jpg', 'Xiaomi 14 5G có thiết kế gọn, hiệu năng cao, cụm camera hợp tác Leica và màn hình hiển thị sắc nét. Sản phẩm phù hợp cho người thích máy Android cao cấp nhưng vẫn muốn kích thước dễ cầm, sạc nhanh và khả năng chụp ảnh linh hoạt. Hỗ trợ bảo hành chính hãng, kiểm tra máy và tư vấn cài đặt ban đầu.', 120, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Xiaomi 14 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'xiaomi', price = 22990000, old_price = 24490000, image_url = 'public/images/Phone-card-image-3.jpg', details = 'Xiaomi 14 5G có thiết kế gọn, hiệu năng cao, cụm camera hợp tác Leica và màn hình hiển thị sắc nét. Sản phẩm phù hợp cho người thích máy Android cao cấp nhưng vẫn muốn kích thước dễ cầm, sạc nhanh và khả năng chụp ảnh linh hoạt. Hỗ trợ bảo hành chính hãng, kiểm tra máy và tư vấn cài đặt ban đầu.', sales_count = 120, is_featured = TRUE WHERE name = 'Xiaomi 14 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'OPPO Reno11 F 5G', @phone_category_id, 'OPPO', 8990000, NULL, 'public/images/Phone-card-image-4.jpg', 'OPPO Reno11 F 5G tập trung vào thiết kế mỏng nhẹ, màn hình viền mỏng, camera chân dung đẹp và sạc nhanh SuperVOOC. Máy phù hợp cho học sinh, sinh viên hoặc người dùng cần smartphone thời trang, pin ổn và chụp ảnh mạng xã hội tốt. Hàng chính hãng, hỗ trợ đổi mới 7 ngày nếu lỗi phần cứng từ nhà sản xuất.', 250, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'OPPO Reno11 F 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'OPPO', price = 8990000, old_price = NULL, image_url = 'public/images/Phone-card-image-4.jpg', details = 'OPPO Reno11 F 5G tập trung vào thiết kế mỏng nhẹ, màn hình viền mỏng, camera chân dung đẹp và sạc nhanh SuperVOOC. Máy phù hợp cho học sinh, sinh viên hoặc người dùng cần smartphone thời trang, pin ổn và chụp ảnh mạng xã hội tốt. Hàng chính hãng, hỗ trợ đổi mới 7 ngày nếu lỗi phần cứng từ nhà sản xuất.', sales_count = 250, is_featured = FALSE WHERE name = 'OPPO Reno11 F 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'vivo V30 5G', @phone_category_id, 'vivo', 13990000, 14500000, 'public/images/Phone-card-image-5.jpg', 'vivo V30 5G gây ấn tượng với thiết kế mỏng, camera Aura Light hỗ trợ chụp chân dung và màn hình hiển thị sống động. Máy phù hợp cho nhu cầu selfie, quay video ngắn, giải trí và làm việc hằng ngày. Khi mua hàng được hỗ trợ kiểm tra máy, tư vấn phụ kiện sạc/cáp phù hợp và bảo hành điện tử rõ ràng.', 90, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'vivo V30 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'vivo', price = 13990000, old_price = 14500000, image_url = 'public/images/Phone-card-image-5.jpg', details = 'vivo V30 5G gây ấn tượng với thiết kế mỏng, camera Aura Light hỗ trợ chụp chân dung và màn hình hiển thị sống động. Máy phù hợp cho nhu cầu selfie, quay video ngắn, giải trí và làm việc hằng ngày. Khi mua hàng được hỗ trợ kiểm tra máy, tư vấn phụ kiện sạc/cáp phù hợp và bảo hành điện tử rõ ràng.', sales_count = 90, is_featured = FALSE WHERE name = 'vivo V30 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'realme 12 Pro+ 5G', @phone_category_id, 'realme', 10990000, NULL, 'public/images/Phone-card-image-6.jpg', 'realme 12 Pro+ 5G có thiết kế mặt lưng da sinh học, camera tele tiềm vọng trong tầm giá và hiệu năng ổn cho tác vụ hằng ngày. Sản phẩm phù hợp với người dùng thích thiết kế nổi bật, chụp ảnh chân dung và giải trí đa phương tiện. Hàng mới nguyên hộp, hỗ trợ thanh toán linh hoạt và giao hàng nhanh.', 110, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'realme 12 Pro+ 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'realme', price = 10990000, old_price = NULL, image_url = 'public/images/Phone-card-image-6.jpg', details = 'realme 12 Pro+ 5G có thiết kế mặt lưng da sinh học, camera tele tiềm vọng trong tầm giá và hiệu năng ổn cho tác vụ hằng ngày. Sản phẩm phù hợp với người dùng thích thiết kế nổi bật, chụp ảnh chân dung và giải trí đa phương tiện. Hàng mới nguyên hộp, hỗ trợ thanh toán linh hoạt và giao hàng nhanh.', sales_count = 110, is_featured = FALSE WHERE name = 'realme 12 Pro+ 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'HONOR Magic6 Pro 5G', @phone_category_id, 'HONOR', 27990000, 29990000, 'public/images/Phone-card-image-7.jpg', 'HONOR Magic6 Pro 5G sở hữu pin Silicon-Carbon dung lượng cao, màn hình cong cao cấp, hiệu năng mạnh và hệ thống camera đa tiêu cự. Máy hướng tới người dùng cần pin bền, chụp ảnh tốt, màn hình đẹp và trải nghiệm flagship Android. Hỗ trợ kiểm tra ngoại hình, IMEI, phụ kiện theo máy và bảo hành điện tử minh bạch.', 50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'HONOR Magic6 Pro 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'HONOR', price = 27990000, old_price = 29990000, image_url = 'public/images/Phone-card-image-7.jpg', details = 'HONOR Magic6 Pro 5G sở hữu pin Silicon-Carbon dung lượng cao, màn hình cong cao cấp, hiệu năng mạnh và hệ thống camera đa tiêu cự. Máy hướng tới người dùng cần pin bền, chụp ảnh tốt, màn hình đẹp và trải nghiệm flagship Android. Hỗ trợ kiểm tra ngoại hình, IMEI, phụ kiện theo máy và bảo hành điện tử minh bạch.', sales_count = 50, is_featured = TRUE WHERE name = 'HONOR Magic6 Pro 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Motorola Edge 50 Pro 5G', @phone_category_id, 'motorola', 14990000, NULL, 'public/images/Phone-card-image-8.jpg', 'Motorola Edge 50 Pro 5G nổi bật với màn hình pOLED chuẩn màu Pantone, thiết kế mỏng nhẹ, khả năng chống nước IP68 và giao diện Android gần gốc. Máy phù hợp cho người thích trải nghiệm mượt, màu sắc màn hình chính xác và thiết kế khác biệt. Sản phẩm được hỗ trợ bảo hành chính hãng và đổi trả theo chính sách cửa hàng.', 40, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Motorola Edge 50 Pro 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'motorola', price = 14990000, old_price = NULL, image_url = 'public/images/Phone-card-image-8.jpg', details = 'Motorola Edge 50 Pro 5G nổi bật với màn hình pOLED chuẩn màu Pantone, thiết kế mỏng nhẹ, khả năng chống nước IP68 và giao diện Android gần gốc. Máy phù hợp cho người thích trải nghiệm mượt, màu sắc màn hình chính xác và thiết kế khác biệt. Sản phẩm được hỗ trợ bảo hành chính hãng và đổi trả theo chính sách cửa hàng.', sales_count = 40, is_featured = FALSE WHERE name = 'Motorola Edge 50 Pro 5G';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'iPhone 13 128GB', @phone_category_id, 'iPhone', 15990000, 17990000, 'public/images/Phone-card-image-9.jpg', 'iPhone 13 128GB vẫn là lựa chọn dễ dùng với hiệu năng ổn định, camera chất lượng, pin tốt và hỗ trợ iOS lâu dài. Máy phù hợp cho người chuyển sang iPhone lần đầu, học tập, làm việc, chụp ảnh và sử dụng các dịch vụ Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu khi mua hàng.', 800, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'iPhone 13 128GB');

UPDATE products SET category_id = @phone_category_id, brand = 'iPhone', price = 15990000, old_price = 17990000, image_url = 'public/images/Phone-card-image-9.jpg', details = 'iPhone 13 128GB vẫn là lựa chọn dễ dùng với hiệu năng ổn định, camera chất lượng, pin tốt và hỗ trợ iOS lâu dài. Máy phù hợp cho người chuyển sang iPhone lần đầu, học tập, làm việc, chụp ảnh và sử dụng các dịch vụ Apple. Hỗ trợ kiểm tra máy, kích hoạt bảo hành điện tử và chuyển dữ liệu khi mua hàng.', sales_count = 800, is_featured = FALSE WHERE name = 'iPhone 13 128GB';

INSERT INTO products (name, category_id, brand, price, old_price, image_url, details, sales_count, is_featured)
SELECT 'Samsung Galaxy A55 5G', @phone_category_id, 'SAMSUNG', 10490000, NULL, 'public/images/Phone-card-image-10.jpg', 'Samsung Galaxy A55 5G có khung viền kim loại, màn hình Super AMOLED, camera ổn định, bảo mật Knox Vault và pin phù hợp nhu cầu cả ngày. Đây là mẫu máy cân bằng cho học tập, công việc, giải trí và chụp ảnh hằng ngày. Hàng chính hãng, hỗ trợ bảo hành điện tử và tư vấn phụ kiện tương thích.', 300, FALSE
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Samsung Galaxy A55 5G');

UPDATE products SET category_id = @phone_category_id, brand = 'SAMSUNG', price = 10490000, old_price = NULL, image_url = 'public/images/Phone-card-image-10.jpg', details = 'Samsung Galaxy A55 5G có khung viền kim loại, màn hình Super AMOLED, camera ổn định, bảo mật Knox Vault và pin phù hợp nhu cầu cả ngày. Đây là mẫu máy cân bằng cho học tập, công việc, giải trí và chụp ảnh hằng ngày. Hàng chính hãng, hỗ trợ bảo hành điện tử và tư vấn phụ kiện tương thích.', sales_count = 300, is_featured = FALSE WHERE name = 'Samsung Galaxy A55 5G';

-- Refresh dashboard stats view after product updates.
DROP VIEW IF EXISTS admin_dashboard_stats;
CREATE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'Pending') AS pending_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'Completed') AS revenue;

SELECT COUNT(*) AS product_count_after_update FROM products;
