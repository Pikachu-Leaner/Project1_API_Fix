
function cleanBase(value) { return String(value || '').replace(/\/+$/, ''); }
function detectAppBase() {
    const path = window.location.pathname || '/';
    const noSlash = path.replace(/\/+$/, '') || '/';
    const publicIndex = path.indexOf('/public/');
    if (publicIndex !== -1) return cleanBase(path.slice(0, publicIndex));
    if (noSlash.endsWith('/public')) return cleanBase(noSlash.slice(0, -7));
    const indexPhp = path.indexOf('/index.php');
    if (indexPhp !== -1) return cleanBase(path.slice(0, indexPhp));
    if (/\.[a-z0-9]+$/i.test(noSlash)) {
        const dir = noSlash.slice(0, noSlash.lastIndexOf('/'));
        return cleanBase(dir.endsWith('/public') ? dir.slice(0, -7) : dir);
    }
    return noSlash === '/' ? '' : cleanBase(noSlash);
}
const APP_BASE = cleanBase(window.APP_BASE || detectAppBase());
const isStaticPreview = ['5500', '5501', '5502', '5503'].includes(window.location.port) || window.location.protocol === 'file:';
const publicAsRoot = isStaticPreview && !window.location.pathname.includes('/public/') && !window.location.pathname.replace(/\/+$/, '').endsWith('/public');
const PUBLIC_BASE = cleanBase(window.PUBLIC_BASE || (publicAsRoot ? '' : `${APP_BASE}/public`));
const DEFAULT_API_BASE = isStaticPreview ? 'http://localhost/Project1_API/api' : `${APP_BASE}/api`;
const API_BASE = cleanBase(window.API_BASE || localStorage.getItem('API_BASE') || DEFAULT_API_BASE);
const asset = (path) => `${PUBLIC_BASE}/${String(path || '').replace(/^\/+/, '')}`.replace(/([^:]\/)\/+/, '$1');
const mediaUrl = (url) => {
    const clean = String(url || '').trim();
    if (/^(https?:|data:|blob:)/i.test(clean)) return clean;
    if (clean.startsWith('/public/')) return publicAsRoot ? asset(clean.slice(8)) : `${APP_BASE}${clean}`.replace(/([^:]\/)\/+/, '$1');
    if (clean.startsWith('public/')) return publicAsRoot ? asset(clean.slice(7)) : `${APP_BASE}/${clean}`.replace(/([^:]\/)\/+/, '$1');
    return asset(clean || 'images/Phone-card-image-1.jpg');
};

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' ₫';
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

const state = {
    token: localStorage.getItem('jwt_token') || '',
    user: JSON.parse(localStorage.getItem('api_user') || 'null'),
    categories: [],
    products: [],
    lastCart: null,
};

function setToken(token, user) {
    state.token = token || '';
    state.user = user || null;
    if (token) localStorage.setItem('jwt_token', token); else localStorage.removeItem('jwt_token');
    if (user) localStorage.setItem('api_user', JSON.stringify(user)); else localStorage.removeItem('api_user');
    renderAccountMenu();
    refreshCartCount();
}

async function api(path, options = {}) {
    const headers = options.headers || {};
    const config = { ...options, headers };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        if (options.body && typeof options.body !== 'string') config.body = JSON.stringify(options.body);
    }
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const response = await fetch(API_BASE + path, config);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        const message = payload.message || `HTTP ${response.status}`;
        if (response.status === 401) setToken('', null);
        throw new Error(message);
    }
    return payload.data || {};
}

function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast-like alert alert-${type} shadow`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}

function routeInfo() {
    const raw = window.location.hash.replace(/^#\/?/, '') || 'products';
    const [path, qs = ''] = raw.split('?');
    return { path, params: new URLSearchParams(qs) };
}

function navigate(path) {
    window.location.hash = path;
}

async function loadCategories() {
    const data = await api('/categories');
    state.categories = data.categories || [];
    renderCategoryNav();
}

function renderCategoryNav(activeCategory = '') {
    const nav = $('#category-nav');
    const links = [`<li class="nav-item"><a href="#/products" class="nav-link text-white ${!activeCategory ? 'active bg-primary' : ''}"><i class="fas fa-th-large me-1"></i>Tất cả</a></li>`];
    for (const cat of state.categories) {
        links.push(`<li class="nav-item"><a href="#/products?category=${cat.id}" class="nav-link text-white ${String(activeCategory) === String(cat.id) ? 'active bg-primary' : ''}">${esc(cat.name)}</a></li>`);
    }
    nav.innerHTML = links.join('');
}

function renderAccountMenu() {
    const menu = $('#account-menu');
    const name = $('#account-name');
    if (state.user) {
        name.textContent = state.user.full_name || state.user.email;
        menu.innerHTML = `
            ${state.user.role === 'Admin' ? '<li><a class="dropdown-item fw-bold text-danger" href="#/admin"><i class="fas fa-chart-line me-2"></i>Admin Panel</a></li><li><hr class="dropdown-divider"></li>' : ''}
            <li><a class="dropdown-item" href="#/profile"><i class="fas fa-id-badge me-2 text-primary"></i>Hồ sơ cá nhân</a></li>
            <li><a class="dropdown-item" href="#/orders"><i class="fas fa-box me-2 text-success"></i>Đơn hàng của tôi</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger fw-bold" id="logout-btn"><i class="fas fa-sign-out-alt me-2"></i>Đăng xuất</button></li>
        `;
        $('#logout-btn')?.addEventListener('click', () => { setToken('', null); navigate('/products'); toast('Đã đăng xuất.'); });
    } else {
        name.textContent = 'Tài khoản';
        menu.innerHTML = `
            <li><a class="dropdown-item fw-bold" href="#/login"><i class="fas fa-sign-in-alt me-2 text-primary"></i>Đăng nhập</a></li>
            <li><a class="dropdown-item" href="#/register"><i class="fas fa-user-plus me-2 text-success"></i>Đăng ký mới</a></li>
        `;
    }
}

async function refreshCartCount() {
    const badge = $('#cart-count');
    if (!state.token) {
        badge.classList.add('d-none');
        return;
    }
    try {
        const data = await api('/cart');
        state.lastCart = data.cart;
        const count = (data.cart.items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
    } catch (_) {
        badge.classList.add('d-none');
    }
}

function productCard(product) {
    return `
        <div class="col">
            <div class="card h-100 shadow-sm border-light product-card">
                <a href="#/products/${product.id}" class="text-decoration-none text-dark">
                    <div class="text-center p-3">
                        <img src="${mediaUrl(product.image_url)}" class="card-img-top img-fluid" alt="${esc(product.name)}" onerror="this.src='${asset('images/Phone-card-image-1.jpg')}'">
                    </div>
                </a>
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title fw-bold" title="${esc(product.name)}">${esc(product.name)}</h6>
                    <div class="small text-muted mb-2">${esc(product.brand)} ${product.category_name ? '· ' + esc(product.category_name) : ''}</div>
                    <div class="mt-auto">
                        <div class="product-price">${money(product.price)}</div>
                        ${product.old_price ? `<small class="product-old-price">${money(product.old_price)}</small>` : ''}
                    </div>
                    <div class="d-flex gap-2 pt-3 border-top mt-3">
                        <button class="btn btn-outline-primary btn-sm flex-fill add-cart" data-id="${product.id}"><i class="fas fa-cart-plus"></i></button>
                        <a href="#/products/${product.id}" class="btn btn-outline-secondary btn-sm flex-fill">Chi tiết</a>
                    </div>
                </div>
            </div>
        </div>`;
}

async function renderProducts() {
    const { params } = routeInfo();
    const category = params.get('category') || '';
    const sort = params.get('sort') || 'noi_bat';
    const search = params.get('search') || '';
    $('#search-input').value = search;
    renderCategoryNav(category);

    app.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
    const qs = new URLSearchParams({ sort });
    if (category) qs.set('category', category);
    if (search) qs.set('search', search);
    const data = await api('/products?' + qs.toString());
    state.products = data.products || [];

    app.innerHTML = `
        <div id="mainPromoCarousel" class="carousel slide custom-carousel mb-4 shadow rounded overflow-hidden" data-bs-ride="carousel">
            <div class="carousel-inner">
                ${[1,2,3,4].map((n, idx) => `<div class="carousel-item ${idx === 0 ? 'active' : ''}"><img src="${asset(`images/Carousel-image-${n}.png`)}" class="d-block w-100" alt="Banner ${n}"></div>`).join('')}
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#mainPromoCarousel" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
            <button class="carousel-control-next" type="button" data-bs-target="#mainPromoCarousel" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
        </div>

        <div class="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border gap-3">
            <div>
                <h5 class="text-uppercase fw-bold m-0 text-secondary">Danh mục</h5>
                ${search ? `<small class="text-muted">Kết quả cho: <b>${esc(search)}</b></small>` : ''}
            </div>
            <div class="d-flex align-items-center gap-3">
                <label class="text-muted small text-nowrap">Sắp xếp:</label>
                <select id="sort-select" class="form-select form-select-sm shadow-sm border-secondary" style="min-width: 170px; font-weight: bold;">
                    <option value="noi_bat" ${sort === 'noi_bat' ? 'selected' : ''}>Nổi bật</option>
                    <option value="ban_chay" ${sort === 'ban_chay' ? 'selected' : ''}>Bán chạy</option>
                    <option value="moi" ${sort === 'moi' ? 'selected' : ''}>Mới nhất</option>
                    <option value="gia_tang" ${sort === 'gia_tang' ? 'selected' : ''}>Giá thấp đến cao</option>
                    <option value="gia_giam" ${sort === 'gia_giam' ? 'selected' : ''}>Giá cao đến thấp</option>
                </select>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-md-3">
                <div class="list-group shadow-sm">
                    <a href="#/products${search ? '?search=' + encodeURIComponent(search) : ''}" class="list-group-item list-group-item-action fw-bold ${!category ? 'active' : ''}">Tất cả</a>
                    ${state.categories.map(c => `<a href="#/products?category=${c.id}${search ? '&search=' + encodeURIComponent(search) : ''}" class="list-group-item list-group-item-action fw-bold ${String(category) === String(c.id) ? 'active' : ''}">${esc(c.name)}</a>`).join('')}
                </div>
            </div>
            <div class="col-md-9">
                <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
                    ${state.products.length ? state.products.map(productCard).join('') : '<div class="col-12 text-center py-5 text-muted"><h4><i class="fas fa-search me-2"></i>Không tìm thấy sản phẩm nào phù hợp.</h4></div>'}
                </div>
            </div>
        </div>`;

    $('#sort-select').addEventListener('change', (e) => {
        const next = new URLSearchParams(params);
        next.set('sort', e.target.value);
        navigate('/products?' + next.toString());
    });
    document.querySelectorAll('.add-cart').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.id)));
}

async function renderProductDetail(id) {
    const data = await api('/products/' + id);
    const p = data.product;
    app.innerHTML = `
        <div class="bg-white rounded shadow-sm p-4">
            <a href="#/products" class="text-decoration-none small"><i class="fas fa-arrow-left me-1"></i>Quay lại sản phẩm</a>
            <div class="row mt-3 g-4">
                <div class="col-md-5 text-center"><img src="${mediaUrl(p.image_url)}" class="img-fluid" style="max-height: 420px; object-fit: contain;" alt="${esc(p.name)}"></div>
                <div class="col-md-7">
                    <h2 class="fw-bold">${esc(p.name)}</h2>
                    <div class="text-muted mb-3">${esc(p.brand)} ${p.category_name ? '· ' + esc(p.category_name) : ''}</div>
                    <div class="display-6 text-danger fw-bold mb-1">${money(p.price)}</div>
                    ${p.old_price ? `<div class="text-muted text-decoration-line-through mb-3">${money(p.old_price)}</div>` : ''}
                    <p class="pre-wrap">${esc(p.details || 'Chưa có mô tả chi tiết.')}</p>
                    <div class="d-flex gap-2 mt-4">
                        <button id="detail-add-cart" class="btn btn-primary btn-lg"><i class="fas fa-cart-plus me-2"></i>Thêm vào giỏ</button>
                        <button id="detail-buy-now" class="btn btn-warning btn-lg fw-bold">Mua ngay</button>
                    </div>
                </div>
            </div>
        </div>
        ${data.related?.length ? `<h4 class="mt-5 mb-3 fw-bold">Sản phẩm liên quan</h4><div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-4">${data.related.map(productCard).join('')}</div>` : ''}`;
    $('#detail-add-cart').addEventListener('click', () => addToCart(id));
    $('#detail-buy-now').addEventListener('click', async () => { await addToCart(id, false); navigate('/cart'); });
    document.querySelectorAll('.add-cart').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.id)));
}

async function addToCart(productId, showMessage = true) {
    if (!state.token) {
        toast('Vui lòng đăng nhập để dùng giỏ hàng.', 'warning');
        navigate('/login');
        return;
    }
    await api('/cart/items', { method: 'POST', body: { product_id: Number(productId), quantity: 1 } });
    await refreshCartCount();
    if (showMessage) toast('Đã thêm sản phẩm vào giỏ.');
}

async function renderCart() {
    if (!state.token) return renderLogin('Vui lòng đăng nhập để xem giỏ hàng.');
    const data = await api('/cart');
    const cart = data.cart;
    state.lastCart = cart;
    app.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-4"><i class="fas fa-shopping-cart me-2"></i>Giỏ hàng</h3>
            ${cart.items.length ? `
                <div class="table-responsive"><table class="table align-middle">
                    <thead><tr><th>Sản phẩm</th><th class="text-center">Số lượng</th><th class="text-end">Tổng</th><th></th></tr></thead>
                    <tbody>${cart.items.map(item => `<tr>
                        <td><div class="d-flex align-items-center gap-3"><img src="${mediaUrl(item.product.image_url)}" style="width:64px;height:64px;object-fit:contain"><div><div class="fw-bold">${esc(item.product.name)}</div><small class="text-muted">${money(item.product.price)}</small></div></div></td>
                        <td class="text-center"><div class="btn-group"><button class="btn btn-outline-secondary qty" data-action="decrease" data-id="${item.product_id}">-</button><span class="btn btn-light disabled">${item.quantity}</span><button class="btn btn-outline-secondary qty" data-action="increase" data-id="${item.product_id}">+</button></div></td>
                        <td class="text-end fw-bold text-danger">${money(item.line_total)}</td>
                        <td class="text-end"><button class="btn btn-outline-danger remove-cart" data-id="${item.product_id}"><i class="fas fa-trash"></i></button></td>
                    </tr>`).join('')}</tbody>
                </table></div>
                <div class="d-flex justify-content-between align-items-center border-top pt-3"><button id="clear-cart" class="btn btn-outline-danger">Xóa giỏ hàng</button><div class="text-end"><div class="text-muted">Tổng tiền</div><div class="fs-3 fw-bold text-danger">${money(cart.total_amount)}</div><a href="#/checkout" class="btn btn-warning fw-bold px-4">Thanh toán</a></div></div>`
                : '<div class="text-center py-5 text-muted">Giỏ hàng trống.</div>'}
        </div>`;
    document.querySelectorAll('.qty').forEach(btn => btn.addEventListener('click', async () => { await api('/cart/items/' + btn.dataset.id, { method: 'PATCH', body: { action: btn.dataset.action } }); await refreshCartCount(); renderCart(); }));
    document.querySelectorAll('.remove-cart').forEach(btn => btn.addEventListener('click', async () => { await api('/cart/items/' + btn.dataset.id, { method: 'DELETE' }); await refreshCartCount(); renderCart(); }));
    $('#clear-cart')?.addEventListener('click', async () => { await api('/cart', { method: 'DELETE' }); await refreshCartCount(); renderCart(); });
}

async function renderCheckout() {
    if (!state.token) return renderLogin('Vui lòng đăng nhập để thanh toán.');
    const data = await api('/cart');
    const cart = data.cart;
    if (!cart.items.length) return navigate('/cart');
    app.innerHTML = `
        <div class="row g-4">
            <div class="col-lg-7">
                <div class="bg-white p-4 rounded shadow-sm">
                    <h3 class="fw-bold mb-4">Thông tin thanh toán</h3>
                    <form id="checkout-form" class="row g-3">
                        <div class="col-md-6"><label class="form-label">Họ tên</label><input class="form-control" name="customer_name" value="${esc(state.user.full_name || '')}" required></div>
                        <div class="col-md-6"><label class="form-label">Số điện thoại</label><input class="form-control" name="phone" value="${esc(state.user.phone || '')}" required></div>
                        <div class="col-12"><label class="form-label">Địa chỉ</label><textarea class="form-control" name="address" required>${esc(state.user.address || '')}</textarea></div>
                        <div class="col-12"><label class="form-label">Phương thức thanh toán</label><select class="form-select" name="payment_method"><option value="COD">Thanh toán khi nhận hàng</option><option value="Bank Transfer">Chuyển khoản</option></select></div>
                        <div class="col-12"><label class="form-label">Ghi chú</label><textarea class="form-control" name="notes"></textarea></div>
                        <div class="col-12"><button class="btn btn-warning fw-bold btn-lg">Xác nhận thanh toán</button></div>
                    </form>
                </div>
            </div>
            <div class="col-lg-5"><div class="bg-white p-4 rounded shadow-sm"><h5 class="fw-bold">Đơn hàng</h5>${cart.items.map(i => `<div class="d-flex justify-content-between border-bottom py-2"><span>${esc(i.product.name)} × ${i.quantity}</span><b>${money(i.line_total)}</b></div>`).join('')}<div class="d-flex justify-content-between fs-4 fw-bold text-danger pt-3"><span>Tổng</span><span>${money(cart.total_amount)}</span></div></div></div>
        </div>`;
    $('#checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        const created = await api('/orders', { method: 'POST', body });
        toast('Đặt hàng thành công.');
        await refreshCartCount();
        navigate('/orders/' + created.order.id);
    });
}

function renderLogin(message = '') {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đăng nhập</h3>
            ${message ? `<div class="alert alert-warning">${esc(message)}</div>` : ''}
            <form id="login-form" class="vstack gap-3">
                <input class="form-control" type="email" name="email" placeholder="Email" required>
                <input class="form-control" type="password" name="password" placeholder="Mật khẩu" required>
                <button class="btn btn-primary fw-bold">Đăng nhập</button>
            </form>
            <div class="d-flex justify-content-between mt-3 small"><a href="#/register">Đăng ký</a><a href="#/forgot-password">Quên mật khẩu?</a></div>
        </div>`;
    $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        try {
            const data = await api('/auth/login', { method: 'POST', body });
            setToken(data.token, data.user);
            toast('Đăng nhập thành công.');
            navigate(data.user.role === 'Admin' ? '/admin' : '/products');
        } catch (err) {
            toast(err.message, 'danger');
        }
    });
}

function renderRegister() {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đăng ký</h3>
            <form id="register-form" class="vstack gap-3">
                <input class="form-control" name="full_name" placeholder="Họ tên" required>
                <input class="form-control" type="email" name="email" placeholder="Email" required>
                <input class="form-control" type="password" name="password" placeholder="Mật khẩu" minlength="6" required>
                <button class="btn btn-success fw-bold">Tạo tài khoản</button>
            </form>
        </div>`;
    $('#register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        const data = await api('/auth/register', { method: 'POST', body });
        toast(`OTP test: ${data.debug_otp}`, 'info');
        navigate('/verify-otp?email=' + encodeURIComponent(data.email));
    });
}

function renderVerifyOtp() {
    const email = routeInfo().params.get('email') || '';
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Xác thực OTP</h3>
            <form id="otp-form" class="vstack gap-3">
                <input class="form-control" type="email" name="email" value="${esc(email)}" placeholder="Email" required>
                <input class="form-control" name="otp" placeholder="Mã OTP" required>
                <button class="btn btn-primary fw-bold">Xác thực</button>
            </form>
        </div>`;
    $('#otp-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('/auth/verify-otp', { method: 'POST', body: Object.fromEntries(new FormData(e.target).entries()) });
        toast('Xác thực thành công.');
        navigate('/login');
    });
}

function renderForgotPassword() {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Quên mật khẩu</h3>
            <form id="forgot-form" class="vstack gap-3"><input class="form-control" type="email" name="email" placeholder="Email" required><button class="btn btn-warning fw-bold">Tạo OTP</button></form>
        </div>`;
    $('#forgot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = await api('/auth/forgot-password', { method: 'POST', body: Object.fromEntries(new FormData(e.target).entries()) });
        toast(`OTP test: ${data.debug_otp}`, 'info');
        navigate('/reset-password?email=' + encodeURIComponent(data.email));
    });
}

function renderResetPassword() {
    const email = routeInfo().params.get('email') || '';
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đặt lại mật khẩu</h3>
            <form id="reset-form" class="vstack gap-3">
                <input class="form-control" type="email" name="email" value="${esc(email)}" placeholder="Email" required>
                <input class="form-control" name="otp" placeholder="Mã OTP" required>
                <input class="form-control" type="password" name="new_password" placeholder="Mật khẩu mới" minlength="6" required>
                <button class="btn btn-primary fw-bold">Cập nhật mật khẩu</button>
            </form>
        </div>`;
    $('#reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('/auth/reset-password', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target).entries()) });
        toast('Đổi mật khẩu thành công.');
        navigate('/login');
    });
}

async function renderProfile() {
    if (!state.token) return renderLogin('Vui lòng đăng nhập.');
    const data = await api('/users/me');
    state.user = data.user;
    localStorage.setItem('api_user', JSON.stringify(state.user));
    renderAccountMenu();
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Hồ sơ cá nhân</h3>
            <form id="profile-form" class="vstack gap-3">
                <input class="form-control" name="full_name" value="${esc(state.user.full_name)}" placeholder="Họ tên" required>
                <input class="form-control" name="phone" value="${esc(state.user.phone || '')}" placeholder="Số điện thoại">
                <textarea class="form-control" name="address" placeholder="Địa chỉ">${esc(state.user.address || '')}</textarea>
                <input class="form-control" name="avatar" value="${esc(state.user.avatar || '')}" placeholder="Avatar URL">
                <button class="btn btn-primary fw-bold">Lưu bằng PATCH API</button>
            </form>
        </div>`;
    $('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = await api('/users/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target).entries()) });
        state.user = data.user;
        localStorage.setItem('api_user', JSON.stringify(state.user));
        renderAccountMenu();
        toast('Cập nhật hồ sơ thành công.');
    });
}

async function renderOrders(orderId = null) {
    if (!state.token) return renderLogin('Vui lòng đăng nhập để xem đơn hàng.');
    if (orderId) {
        const data = await api('/orders/' + orderId);
        const o = data.order;
        app.innerHTML = orderDetailHtml(o);
        return;
    }
    const data = await api('/orders');
    app.innerHTML = `<div class="bg-white p-4 rounded shadow-sm"><h3 class="fw-bold mb-4">Đơn hàng của tôi</h3>${data.orders.length ? `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Ngày</th><th>Trạng thái</th><th class="text-end">Tổng</th><th></th></tr></thead><tbody>${data.orders.map(o => `<tr><td>#${o.id}</td><td>${esc(o.created_at)}</td><td><span class="badge bg-secondary">${esc(o.status)}</span></td><td class="text-end fw-bold">${money(o.total_amount)}</td><td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/orders/${o.id}">Xem</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="text-muted text-center py-5">Chưa có đơn hàng.</div>'}</div>`;
}

function orderDetailHtml(o) {
    return `<div class="bg-white p-4 rounded shadow-sm"><a href="#/orders" class="small text-decoration-none"><i class="fas fa-arrow-left me-1"></i>Quay lại</a><h3 class="fw-bold mt-3">Đơn hàng #${o.id}</h3><div class="row g-3 my-3"><div class="col-md-6"><b>Khách hàng:</b> ${esc(o.customer_name)}<br><b>Phone:</b> ${esc(o.phone)}<br><b>Địa chỉ:</b> ${esc(o.address)}</div><div class="col-md-6"><b>Trạng thái:</b> <span class="badge bg-secondary">${esc(o.status)}</span><br><b>Thanh toán:</b> ${esc(o.payment_method)}<br><b>Ngày:</b> ${esc(o.created_at)}</div></div><div class="table-responsive"><table class="table"><thead><tr><th>Sản phẩm</th><th class="text-center">SL</th><th class="text-end">Giá</th><th class="text-end">Tổng</th></tr></thead><tbody>${o.items.map(i => `<tr><td>${esc(i.product.name)}</td><td class="text-center">${i.quantity}</td><td class="text-end">${money(i.price)}</td><td class="text-end">${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div><div class="text-end fs-3 fw-bold text-danger">${money(o.total_amount)}</div></div>`;
}

async function renderAdmin() {
    if (!state.user || state.user.role !== 'Admin') return renderLogin('Chỉ Admin được truy cập khu vực này.');
    const [dash, products, users, orders] = await Promise.all([
        api('/admin/dashboard'), api('/admin/products'), api('/admin/users'), api('/admin/orders')
    ]);
    app.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4"><h2 class="fw-bold">Admin Panel</h2><button id="new-product" class="btn btn-warning fw-bold"><i class="fas fa-plus me-1"></i>Thêm sản phẩm</button></div>
        <div class="row g-3 mb-4">
            ${Object.entries(dash.stats).map(([k,v]) => `<div class="col-md"><div class="bg-white rounded shadow-sm p-3"><div class="text-muted small text-uppercase">${esc(k.replaceAll('_',' '))}</div><div class="fs-3 fw-bold">${k === 'revenue' ? money(v) : esc(v)}</div></div></div>`).join('')}
        </div>
        <ul class="nav nav-tabs" id="admin-tabs" role="tablist"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#admin-products">Products</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#admin-users">Users</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#admin-orders">Orders</button></li></ul>
        <div class="tab-content bg-white rounded-bottom shadow-sm p-3">
            <div class="tab-pane fade show active" id="admin-products">${adminProductsTable(products.products || [])}</div>
            <div class="tab-pane fade" id="admin-users">${adminUsersTable(users.users || [])}</div>
            <div class="tab-pane fade" id="admin-orders">${adminOrdersTable(orders.orders || [])}</div>
        </div>`;
    $('#new-product').addEventListener('click', () => openProductModal());
    document.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', async () => { const data = await api('/admin/products/' + btn.dataset.id); openProductModal(data.product); }));
    document.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Xóa sản phẩm này?')) { await api('/admin/products/' + btn.dataset.id, { method: 'DELETE' }); toast('Đã xóa sản phẩm.'); renderAdmin(); } }));
    document.querySelectorAll('.toggle-user').forEach(btn => btn.addEventListener('click', async () => { await api('/admin/users/' + btn.dataset.id + '/status', { method: 'PATCH' }); toast('Đã cập nhật trạng thái user.'); renderAdmin(); }));
    document.querySelectorAll('.order-status').forEach(select => select.addEventListener('change', async () => { await api('/admin/orders/' + select.dataset.id + '/status', { method: 'PATCH', body: { status: select.value } }); toast('Đã cập nhật trạng thái đơn hàng.'); renderAdmin(); }));
}

function adminProductsTable(products) {
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Ảnh</th><th>Tên</th><th>Brand</th><th>Giá</th><th></th></tr></thead><tbody>${products.map(p => `<tr><td><img class="admin-table-img" src="${mediaUrl(p.image_url)}"></td><td class="fw-bold">${esc(p.name)}</td><td>${esc(p.brand)}</td><td>${money(p.price)}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary edit-product" data-id="${p.id}">Sửa</button> <button class="btn btn-sm btn-outline-danger delete-product" data-id="${p.id}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`;
}
function adminUsersTable(users) {
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Tên</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead><tbody>${users.map(u => `<tr><td>${u.id}</td><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.is_active ? 'Yes' : 'No'}</td><td class="text-end">${u.role !== 'Admin' ? `<button class="btn btn-sm btn-outline-warning toggle-user" data-id="${u.id}">Bật/Tắt</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function adminOrdersTable(orders) {
    const statuses = ['Pending', 'Delivering', 'Completed', 'Cancelled'];
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Khách</th><th>Tổng</th><th>Trạng thái</th><th>Ngày</th></tr></thead><tbody>${orders.map(o => `<tr><td>#${o.id}</td><td>${esc(o.customer_name)}</td><td>${money(o.total_amount)}</td><td><select class="form-select form-select-sm order-status" data-id="${o.id}">${statuses.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td>${esc(o.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}

function openProductModal(product = null) {
    const modal = new bootstrap.Modal($('#productModal'));
    $('#productModalTitle').textContent = product ? 'Sửa sản phẩm bằng PUT API' : 'Thêm sản phẩm bằng POST API';
    $('#product-form').innerHTML = `
        <input type="hidden" name="id" value="${product?.id || ''}">
        <div class="row g-3">
            <div class="col-md-8"><label class="form-label">Tên</label><input class="form-control" name="name" value="${esc(product?.name || '')}" required></div>
            <div class="col-md-4"><label class="form-label">Brand</label><input class="form-control" name="brand" value="${esc(product?.brand || '')}" required></div>
            <div class="col-md-4"><label class="form-label">Giá</label><input class="form-control" type="number" name="price" value="${product?.price || ''}" required></div>
            <div class="col-md-4"><label class="form-label">Giá cũ</label><input class="form-control" type="number" name="old_price" value="${product?.old_price || ''}"></div>
            <div class="col-md-4"><label class="form-label">Danh mục</label><select class="form-select" name="category_id"><option value="">Không chọn</option>${state.categories.map(c => `<option value="${c.id}" ${String(product?.category_id || '') === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label">Image URL</label><input class="form-control" name="image_url" value="${esc(product?.image_url || 'public/images/Phone-card-image-1.jpg')}"></div>
            <div class="col-md-6"><label class="form-label">Upload image</label><input class="form-control" type="file" name="image_file" accept="image/*"></div>
            <div class="col-md-6"><label class="form-label">Sales count</label><input class="form-control" type="number" name="sales_count" value="${product?.sales_count || 0}"></div>
            <div class="col-md-6 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" name="is_featured" ${product?.is_featured ? 'checked' : ''}><label class="form-check-label">Nổi bật</label></div></div>
            <div class="col-12"><label class="form-label">Details</label><textarea class="form-control" name="details" rows="4">${esc(product?.details || '')}</textarea></div>
        </div>
        <div class="modal-footer px-0 pb-0"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button><button class="btn btn-primary fw-bold">Lưu</button></div>`;
    $('#product-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        const id = data.id;
        delete data.id;
        const file = form.querySelector('[name="image_file"]').files[0];
        delete data.image_file;
        data.is_featured = form.querySelector('[name="is_featured"]').checked;
        if (!data.old_price) data.old_price = null;
        if (!data.category_id) data.category_id = null;
        if (file) {
            const fd = new FormData();
            fd.append('image', file);
            const upload = await api('/admin/products/upload', { method: 'POST', body: fd, headers: {} });
            data.image_url = upload.image_url;
        }
        if (id) await api('/admin/products/' + id, { method: 'PUT', body: data });
        else await api('/admin/products', { method: 'POST', body: data });
        toast('Đã lưu sản phẩm.');
        modal.hide();
        renderAdmin();
    };
    modal.show();
}

function setupSearch() {
    const input = $('#search-input');
    const box = $('#search-suggestions');
    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (!q) { box.classList.add('d-none'); box.innerHTML = ''; return; }
        timer = setTimeout(async () => {
            try {
                const data = await api('/products/suggest?q=' + encodeURIComponent(q));
                const suggestions = data.suggestions || [];
                if (!suggestions.length) { box.innerHTML = '<div class="p-3 text-muted small">Không có gợi ý phù hợp.</div>'; box.classList.remove('d-none'); return; }
                box.innerHTML = suggestions.map(s => `<button class="suggestion-item" type="button" data-id="${s.id}"><img src="${mediaUrl(s.image_url)}" alt=""><span><span class="fw-bold">${s.highlighted_name}</span><br><small class="text-muted">${esc(s.brand)} · ${money(s.price)}</small></span></button>`).join('');
                box.classList.remove('d-none');
                box.querySelectorAll('.suggestion-item').forEach(btn => btn.addEventListener('click', () => { box.classList.add('d-none'); navigate('/products/' + btn.dataset.id); }));
            } catch (_) { box.classList.add('d-none'); }
        }, 220);
    });
    $('#search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        box.classList.add('d-none');
        navigate('/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrapper')) box.classList.add('d-none'); });
}

async function router() {
    try {
        if (!state.categories.length) await loadCategories();
        renderAccountMenu();
        const { path } = routeInfo();
        const parts = path.split('/').filter(Boolean);
        if (parts[0] === 'products' && parts[1]) return renderProductDetail(parts[1]);
        if (parts[0] === 'products' || path === '') return renderProducts();
        if (parts[0] === 'cart') return renderCart();
        if (parts[0] === 'checkout') return renderCheckout();
        if (parts[0] === 'login') return renderLogin();
        if (parts[0] === 'register') return renderRegister();
        if (parts[0] === 'verify-otp') return renderVerifyOtp();
        if (parts[0] === 'forgot-password') return renderForgotPassword();
        if (parts[0] === 'reset-password') return renderResetPassword();
        if (parts[0] === 'profile') return renderProfile();
        if (parts[0] === 'orders' && parts[1]) return renderOrders(parts[1]);
        if (parts[0] === 'orders') return renderOrders();
        if (parts[0] === 'admin') return renderAdmin();
        navigate('/products');
    } catch (err) {
        app.innerHTML = `<div class="alert alert-danger shadow-sm"><h5 class="fw-bold">Lỗi</h5><p class="mb-0">${esc(err.message)}</p></div>`;
    }
}

setupSearch();
renderAccountMenu();
refreshCartCount();
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
