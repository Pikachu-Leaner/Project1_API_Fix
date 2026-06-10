# Project1 REST API + JWT Version

This version uses:

- Static frontend: `public/index.html`, `public/js/app.js`, `public/css/style.css`
- PHP REST API: `/api/...`
- JSON request/response
- JWT Bearer token login
- Role protection:
  - `Client` can use client features only
  - `Admin` can access admin routes and user/order/product management
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

## Important: use Laragon, not Five Server

Five Server can serve HTML/CSS/JS, but it cannot correctly run this PHP API project unless PHP is configured separately.

For Laragon, put the folder here:

```txt
C:\laragon\www\Project1_API
```

Your Laragon screenshot shows Apache running on port `8080`, so open:

```txt
http://localhost:8080/
```

Do not open only `public/index.html` for final testing, because the REST API needs `index.php` and Apache rewrite.

## Test whether the API is reachable

Open this first:

```txt
http://localhost:8080/api/health
```

Expected result:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

If this works, Apache + PHP + rewrite are OK.

Then test database:

```txt
http://localhost:8080/api/db-check
```

If `/api/health` works but `/api/db-check` fails, the problem is database config, Aiven SSL, wrong database name, wrong port, or missing tables.

## Local Laragon MySQL setup

1. Start Laragon Apache and MySQL.
2. Open Laragon Database/Adminer/phpMyAdmin.
3. Import `database.sql`.
4. Open:

```txt
http://localhost:8080/
```

Default admin:

```txt
Email: admin@store.com
Password: admin123
```

## Aiven MySQL setup

For Aiven, import this file instead:

```txt
database-for-Aiven.io.sql
```

Use it inside your selected Aiven database, usually `defaultdb`.

Then create a `.env` file in the project root by copying `.env.example`:

```txt
C:\laragon\www\Project1_API\.env
```

Example `.env` for Aiven:

```env
APP_DEBUG=true
JWT_SECRET=change-this-to-a-long-random-secret

DB_HOST=your-aiven-mysql-host.aivencloud.com
DB_PORT=12345
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASS=your-aiven-password
DB_SSL_CA=C:/laragon/www/Project1_API/ca.pem
DB_SSL_VERIFY=true
```

Download the Aiven CA certificate from your Aiven MySQL service page and save it as:

```txt
C:\laragon\www\Project1_API\ca.pem
```

Use forward slashes in `.env` paths:

```env
DB_SSL_CA=C:/laragon/www/Project1_API/ca.pem
```

After editing `.env`, restart Laragon Apache.

## API endpoints

### Public

```http
GET /api/health
GET /api/db-check
GET /api/categories
GET /api/products
GET /api/products?search=iphone
GET /api/products?category=1&sort=gia_thap
GET /api/products/{id}
GET /api/products/suggest?q=iphone
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-otp
POST /api/auth/forgot-password
PATCH /api/auth/reset-password
```

### User JWT required

Add this header:

```http
Authorization: Bearer YOUR_TOKEN
```

```http
GET /api/auth/me
GET /api/users/me
PATCH /api/users/me
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/{productId}
PUT /api/cart/items/{productId}
DELETE /api/cart/items/{productId}
DELETE /api/cart
GET /api/orders
POST /api/orders
GET /api/orders/{id}
```

### Admin JWT required

```http
GET /api/admin/dashboard
GET /api/admin/products
POST /api/admin/products
GET /api/admin/products/{id}
PUT /api/admin/products/{id}
PATCH /api/admin/products/{id}
DELETE /api/admin/products/{id}
POST /api/admin/products/upload
GET /api/admin/categories
POST /api/admin/categories
PUT /api/admin/categories/{id}
PATCH /api/admin/categories/{id}
DELETE /api/admin/categories/{id}
GET /api/admin/users
GET /api/admin/users/{id}
PATCH /api/admin/users/{id}
PATCH /api/admin/users/{id}/status
GET /api/admin/orders
GET /api/admin/orders/{id}
PATCH /api/admin/orders/{id}/status
DELETE /api/admin/orders/{id}
```

## Postman / cURL examples

Health check:

```bash
curl http://localhost:8080/api/health
```

Database check:

```bash
curl http://localhost:8080/api/db-check
```

Get products:

```bash
curl http://localhost:8080/api/products
```

Login:

```bash
curl -X POST http://localhost:8080/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@store.com\",\"password\":\"admin123\"}"
```

Use the returned token:

```bash
curl http://localhost:8080/api/admin/dashboard ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

Create product as admin:

```bash
curl -X POST http://localhost:8080/api/admin/products ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -d "{\"name\":\"Test Phone\",\"brand\":\"TEST\",\"category_id\":1,\"price\":9000000,\"old_price\":10000000,\"image_url\":\"public/images/Phone-card-image-1.jpg\",\"details\":\"Demo product\",\"is_featured\":1}"
```

## Deploy to Render

This project includes a `Dockerfile`.

On Render:

1. Create a new Web Service.
2. Use Docker environment.
3. Add environment variables:

```env
APP_DEBUG=false
JWT_SECRET=your-long-production-secret
DB_HOST=your-aiven-mysql-host.aivencloud.com
DB_PORT=12345
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASS=your-aiven-password
DB_SSL_CA_CONTENT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
DB_SSL_VERIFY=true
```

4. Deploy.
5. Test:

```txt
https://your-render-app.onrender.com/api/health
https://your-render-app.onrender.com/api/db-check
```

## What the browser error means

If Chrome console shows:

```txt
/api/categories 500 Internal Server Error
```

then the frontend did reach the PHP API route. The problem is inside the server, usually:

- wrong `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, or `DB_PASS`
- Aiven requires SSL CA but `DB_SSL_CA` is missing or wrong
- imported the wrong SQL file
- tables are missing from the Aiven database
- using `electronic_store` as `DB_NAME` while Aiven database is actually `defaultdb`

Use `/api/health` first, then `/api/db-check`.
