# Smartphone Store REST API + Fetch Frontend

This version removes the PHP-rendered views and uses:

- PHP REST API endpoints under `/api/...`
- JSON request and response bodies
- JWT Bearer authentication
- Role protection: `Client` users cannot access `/api/admin/...`; `Admin` can access admin and user/order data
- Static frontend: `public/index.html` + `public/js/app.js` using `fetch()`
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

## Setup

1. Import `database.sql` locally, or import `database-for-Aiven.io.sql` into Aiven.
2. Set environment variables:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASS`
   - `JWT_SECRET` (use a long random value in production)
3. Run with Apache/PHP or Docker.

Default admin account:

- Email: `admin@store.com`
- Password: `admin123`


## Run with Laragon

1. Copy the whole `Project1_API` folder into `C:\laragon\www\Project1_API`.
2. Start Apache and MySQL in Laragon.
3. Open phpMyAdmin, create/import the database by importing `database.sql`. The local default database name is `electronic_store`, username is `root`, password is empty, host is `127.0.0.1`, port is `3306`.
4. Open: `http://localhost/Project1_API/`

Do not open only `public/index.html` for the main Laragon test. Open the project root so Apache can route `/api/...` to `index.php`.

## Run with Five Server / Live Server

Five Server serves only HTML/CSS/JS. It does not run PHP API files. Use it only for the frontend while Laragon is also running the backend.

Recommended setup:

1. Keep Laragon running at `http://localhost/Project1_API/`.
2. Open `Project1_API/public/index.html` with Five Server.
3. The frontend will call `http://localhost/Project1_API/api` by default.

If your Laragon folder name is different, open the browser console and run:

```js
localStorage.setItem('API_BASE', 'http://localhost/YOUR_FOLDER_NAME/api');
location.reload();
```

To reset it:

```js
localStorage.removeItem('API_BASE');
location.reload();
```

## API endpoints

### Public

- `GET /api/products?search=&category=&brand=&sort=`
- `GET /api/products/{id}`
- `GET /api/products/suggest?q=iphone`
- `GET /api/categories`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `PATCH /api/auth/reset-password`

Use the token returned by login as:

```http
Authorization: Bearer YOUR_TOKEN
```

### User

- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/{productId}`
- `DELETE /api/cart/items/{productId}`
- `DELETE /api/cart`
- `GET /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders`

### Admin only

- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/{id}`
- `PUT /api/admin/products/{id}`
- `PATCH /api/admin/products/{id}`
- `DELETE /api/admin/products/{id}`
- `POST /api/admin/products/upload`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/{id}`
- `DELETE /api/admin/categories/{id}`
- `GET /api/admin/users`
- `GET /api/admin/users/{id}`
- `PATCH /api/admin/users/{id}`
- `PATCH /api/admin/users/{id}/status`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/{id}/status`
- `DELETE /api/admin/orders/{id}`

## Search fix

The frontend search box calls `/api/products/suggest?q=...` while the user types. The API ranks results by:

1. exact product name match
2. product name starts with the query
3. brand starts with the query
4. word-boundary match
5. all query words appearing in the same order
6. general contains match

Suggestions show product image, product name, price, and `<mark>` highlighting on the matched words.
