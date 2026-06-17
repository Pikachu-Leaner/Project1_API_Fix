// app.js - Main router and shared UI (refactored)
// Logic split into: auth.js, login.js, register.js, otp.js, products.js, cart.js, admin.js

const app = document.querySelector('#app');

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
    const nav = document.querySelector('#category-nav');
    if (!nav) return;
    const links = [`<li class="nav-item"><a href="#/products" class="nav-link text-white ${!activeCategory?'active bg-primary':''}"><i class="fas fa-th-large me-1"></i>Tất cả</a></li>`];
    for (const cat of state.categories) {
        links.push(`<li class="nav-item"><a href="#/products?category=${cat.id}" class="nav-link text-white ${String(activeCategory)===String(cat.id)?'active bg-primary':''}">${esc(cat.name)}</a></li>`);
    }
    nav.innerHTML = links.join('');
}

function renderAccountMenu() {
    const menu = document.querySelector('#account-menu');
    const name = document.querySelector('#account-name');
    if (!menu || !name) return;
    if (state.user) {
        name.textContent = state.user.full_name || state.user.email;
        menu.innerHTML = `
            ${state.user.role==='Admin' ? '<li><a class="dropdown-item fw-bold text-danger" href="#/admin"><i class="fas fa-chart-line me-2"></i>Admin Panel</a></li><li><hr class="dropdown-divider"></li>' : ''}
            <li><a class="dropdown-item" href="#/profile"><i class="fas fa-id-badge me-2 text-primary"></i>Hồ sơ cá nhân</a></li>
            <li><a class="dropdown-item" href="#/orders"><i class="fas fa-box me-2 text-success"></i>Đơn hàng của tôi</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger fw-bold" id="logout-btn"><i class="fas fa-sign-out-alt me-2"></i>Đăng xuất</button></li>
        `;
        document.querySelector('#logout-btn')?.addEventListener('click', async () => {
            try { await api('/auth/logout', { method: 'POST', body: { refresh_token: state.refreshToken } }); } catch {}
            setTokens('', '', null);
            navigate('/products');
            toast('Đã đăng xuất.');
        });
    } else {
        name.textContent = 'Tài khoản';
        menu.innerHTML = `
            <li><a class="dropdown-item fw-bold" href="#/login"><i class="fas fa-sign-in-alt me-2 text-primary"></i>Đăng nhập</a></li>
            <li><a class="dropdown-item" href="#/register"><i class="fas fa-user-plus me-2 text-success"></i>Đăng ký mới</a></li>
        `;
    }
}

async function refreshCartCount() {
    const badge = document.querySelector('#cart-count');
    if (!badge) return;
    if (!state.token) { badge.classList.add('d-none'); return; }
    try {
        const data = await api('/cart');
        state.lastCart = data.cart;
        const count = (data.cart.items||[]).reduce((sum,i)=>sum+Number(i.quantity),0);
        badge.textContent = count;
        badge.classList.toggle('d-none', count===0);
    } catch { badge.classList.add('d-none'); }
}

async function renderProfile() {
    if (!state.token) return renderLogin('Vui lòng đăng nhập.');
    const data = await api('/users/me');
    state.user = data.user;
    sessionStorage.setItem('api_user', JSON.stringify(state.user));
    renderAccountMenu();

    const avatarSrc = state.user.avatar && state.user.avatar !== 'public/images/default-avatar.png'
        ? mediaUrl(state.user.avatar)
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.full_name)}&background=0d6efd&color=fff&size=200`;

    app.innerHTML = `
        <div class="bg-white rounded shadow-sm p-4">
            <h3 class="fw-bold mb-4"><i class="fas fa-id-badge me-2 text-primary"></i>Hồ sơ cá nhân</h3>
            <div class="row g-4 align-items-start">
                <!-- LEFT: Avatar -->
                <div class="col-md-4 text-center">
                    <div class="position-relative d-inline-block">
                        <img id="pr-avatar-img" src="${esc(avatarSrc)}" alt="Avatar"
                            style="width:180px;height:180px;object-fit:cover;border-radius:50%;border:4px solid #dee2e6;box-shadow:0 2px 12px rgba(0,0,0,0.12);">
                        <button id="pr-avatar-btn" title="Thay đổi ảnh đại diện"
                            style="position:absolute;bottom:8px;right:8px;width:36px;height:36px;border-radius:50%;border:none;background:#0d6efd;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
                            <i class="fas fa-pen" style="font-size:14px;"></i>
                        </button>
                        <input type="file" id="pr-avatar-file" accept="image/*" style="display:none;">
                    </div>
                    <div class="mt-3 text-muted small">Nhấp vào biểu tượng bút để thay đổi ảnh</div>
                </div>
                <!-- RIGHT: Info -->
                <div class="col-md-8">
                    <div class="d-flex justify-content-end mb-3">
                        <button id="pr-adjust-btn" class="btn btn-outline-secondary">
                            <i class="fas fa-cog me-1"></i>Chỉnh sửa hồ sơ
                        </button>
                    </div>
                    <div id="pr-view-mode">
                        <div class="row g-3">
                            <div class="col-sm-6">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Họ tên</div>
                                <div class="fw-bold fs-5">${esc(state.user.full_name)}</div>
                            </div>
                            <div class="col-sm-6">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Email</div>
                                <div>${esc(state.user.email)}</div>
                            </div>
                            <div class="col-sm-6">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Số điện thoại</div>
                                <div>${esc(state.user.phone || 'Chưa cập nhật')}</div>
                            </div>
                            <div class="col-sm-6">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Giới tính</div>
                                <div>${esc(state.user.gender || 'Chưa cập nhật')}</div>
                            </div>
                            <div class="col-sm-6">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Tuổi</div>
                                <div>${esc(state.user.age ? String(state.user.age) : 'Chưa cập nhật')}</div>
                            </div>
                            <div class="col-12">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Mô tả</div>
                                <div>${esc(state.user.description || 'Chưa cập nhật')}</div>
                            </div>
                            <div class="col-12">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Địa chỉ</div>
                                <div>${esc(state.user.address || 'Chưa cập nhật')}</div>
                            </div>
                        </div>
                    </div>
                    <div id="pr-edit-mode" style="display:none;">
                        <div class="row g-3">
                            <div class="col-sm-6">
                                <label class="form-label fw-bold small text-uppercase text-muted">Họ tên <span class="text-danger">*</span></label>
                                <input class="form-control" id="pr-name" value="${esc(state.user.full_name)}" placeholder="Họ tên" required>
                            </div>
                            <div class="col-sm-6">
                                <label class="form-label fw-bold small text-uppercase text-muted">Số điện thoại</label>
                                <input class="form-control" id="pr-phone" value="${esc(state.user.phone||'')}" placeholder="Số điện thoại">
                            </div>
                            <div class="col-sm-6">
                                <label class="form-label fw-bold small text-uppercase text-muted">Giới tính</label>
                                <select class="form-select" id="pr-gender">
                                    <option value="" ${!state.user.gender?'selected':''}>Chưa chọn</option>
                                    <option value="Nam" ${state.user.gender==='Nam'?'selected':''}>Nam</option>
                                    <option value="Nữ" ${state.user.gender==='Nữ'?'selected':''}>Nữ</option>
                                    <option value="Khác" ${state.user.gender==='Khác'?'selected':''}>Khác</option>
                                </select>
                            </div>
                            <div class="col-sm-6">
                                <label class="form-label fw-bold small text-uppercase text-muted">Tuổi</label>
                                <input class="form-control" id="pr-age" type="number" min="1" max="120" value="${esc(state.user.age ? String(state.user.age) : '')}" placeholder="Tuổi">
                            </div>
                            <div class="col-12">
                                <label class="form-label fw-bold small text-uppercase text-muted">Mô tả</label>
                                <textarea class="form-control" id="pr-description" rows="2" placeholder="Mô tả bản thân...">${esc(state.user.description||'')}</textarea>
                            </div>
                            <div class="col-12">
                                <label class="form-label fw-bold small text-uppercase text-muted">Địa chỉ</label>
                                <textarea class="form-control" id="pr-addr" rows="2" placeholder="Địa chỉ">${esc(state.user.address||'')}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Avatar pen button → trigger file input
    $('#pr-avatar-btn').addEventListener('click', () => $('#pr-avatar-file').click());

    // File selected → show preview + confirm dialog
    $('#pr-avatar-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const newSrc = ev.target.result;
            const confirmed = confirm('Bạn có muốn đổi sang ảnh đại diện mới này không?\n\nNhấn OK để xác nhận, Cancel để giữ ảnh cũ.');
            if (!confirmed) { e.target.value = ''; return; }
            // Show new preview immediately
            $('#pr-avatar-img').src = newSrc;
            // Upload via admin product upload endpoint (reuse same file upload infra)
            try {
                const fd = new FormData(); fd.append('image', file);
                const upload = await api('/admin/products/upload', { method: 'POST', body: fd, headers: {} });
                const d = await api('/users/me', { method: 'PATCH', body: { avatar: upload.image_url } });
                state.user = d.user;
                sessionStorage.setItem('api_user', JSON.stringify(state.user));
                renderAccountMenu();
                toast('Ảnh đại diện đã được cập nhật.');
            } catch (err) {
                toast('Không thể tải ảnh lên: ' + err.message, 'danger');
                // Revert preview
                $('#pr-avatar-img').src = avatarSrc;
            }
        };
        reader.readAsDataURL(file);
    });

    // Gear button → toggle edit/view mode
    let isEditing = false;
    $('#pr-adjust-btn').addEventListener('click', async () => {
        if (!isEditing) {
            // Switch to edit mode
            isEditing = true;
            $('#pr-view-mode').style.display = 'none';
            $('#pr-edit-mode').style.display = '';
            $('#pr-adjust-btn').innerHTML = '<i class="fas fa-save me-1"></i>Lưu thay đổi';
            $('#pr-adjust-btn').className = 'btn btn-primary';
        } else {
            // Save and switch back to view mode
            const name = $('#pr-name').value.trim();
            if (!name) { toast('Họ tên không được để trống.', 'danger'); return; }
            const body = {
                full_name:   name,
                phone:       $('#pr-phone').value,
                address:     $('#pr-addr').value,
                gender:      $('#pr-gender').value,
                age:         $('#pr-age').value ? Number($('#pr-age').value) : null,
                description: $('#pr-description').value,
            };
            try {
                const d = await api('/users/me', { method: 'PATCH', body });
                state.user = d.user;
                sessionStorage.setItem('api_user', JSON.stringify(state.user));
                renderAccountMenu();
                toast('Cập nhật hồ sơ thành công.');
                renderProfile(); // re-render to reflect new values
            } catch (err) { toast(err.message, 'danger'); }
        }
    });
}

async function renderOrders(orderId = null) {
    if (!state.token) return renderLogin('Vui lòng đăng nhập để xem đơn hàng.');
    if (orderId) {
        const data = await api('/orders/' + orderId);
        app.innerHTML = orderDetailHtml(data.order);
        return;
    }
    const data = await api('/orders');
    app.innerHTML = `<div class="bg-white p-4 rounded shadow-sm"><h3 class="fw-bold mb-4">Đơn hàng của tôi</h3>${data.orders.length ? `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Ngày</th><th>Trạng thái</th><th class="text-end">Tổng</th><th></th></tr></thead><tbody>${data.orders.map(o=>`<tr><td>#${o.id}</td><td>${esc(o.created_at)}</td><td><span class="badge bg-secondary">${esc(o.status)}</span></td><td class="text-end fw-bold">${money(o.total_amount)}</td><td class="text-end"><a class="btn btn-sm btn-outline-primary" href="#/orders/${o.id}">Xem</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="text-muted text-center py-5">Chưa có đơn hàng.</div>'}</div>`;
}

function orderDetailHtml(o) {
    return `<div class="bg-white p-4 rounded shadow-sm"><a href="#/orders" class="small text-decoration-none"><i class="fas fa-arrow-left me-1"></i>Quay lại</a><h3 class="fw-bold mt-3">Đơn hàng #${o.id}</h3><div class="row g-3 my-3"><div class="col-md-6"><b>Khách hàng:</b> ${esc(o.customer_name)}<br><b>Phone:</b> ${esc(o.phone)}<br><b>Địa chỉ:</b> ${esc(o.address)}</div><div class="col-md-6"><b>Trạng thái:</b> <span class="badge bg-secondary">${esc(o.status)}</span><br><b>Thanh toán:</b> ${esc(o.payment_method)}<br><b>Ngày:</b> ${esc(o.created_at)}</div></div><div class="table-responsive"><table class="table"><thead><tr><th>Sản phẩm</th><th class="text-center">SL</th><th class="text-end">Giá</th><th class="text-end">Tổng</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${esc(i.product.name)}</td><td class="text-center">${i.quantity}</td><td class="text-end">${money(i.price)}</td><td class="text-end">${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div><div class="text-end fs-3 fw-bold text-danger">${money(o.total_amount)}</div></div>`;
}

function setupSearch() {
    const input = document.querySelector('#search-input');
    const box   = document.querySelector('#search-suggestions');
    if (!input || !box) return;
    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (!q) { box.classList.add('d-none'); box.innerHTML=''; return; }
        timer = setTimeout(async () => {
            try {
                const data = await api('/products/suggest?q=' + encodeURIComponent(q));
                const suggestions = data.suggestions || [];
                if (!suggestions.length) { box.innerHTML='<div class="p-3 text-muted small">Không có gợi ý.</div>'; box.classList.remove('d-none'); return; }
                box.innerHTML = suggestions.map(s=>`<button class="suggestion-item" type="button" data-id="${s.id}"><img src="${mediaUrl(s.image_url)}" alt=""><span><span class="fw-bold">${s.highlighted_name}</span><br><small class="text-muted">${esc(s.brand)} · ${money(s.price)}</small></span></button>`).join('');
                box.classList.remove('d-none');
                box.querySelectorAll('.suggestion-item').forEach(btn => btn.addEventListener('click', () => { box.classList.add('d-none'); navigate('/products/' + btn.dataset.id); }));
            } catch { box.classList.add('d-none'); }
        }, 220);
    });
    document.querySelector('#search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        box.classList.add('d-none');
        navigate('/products' + (q ? '?search='+encodeURIComponent(q) : ''));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrapper')) box.classList.add('d-none'); });
}

// ── Cookie Consent Banner ──────────────────────────────────────────────────────
function showCookieBanner() {
    if (TokenStore.getConsent()) return; // already decided
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
        <div class="card shadow p-3" style="min-width:280px;max-width:340px;">
            <div class="fw-bold mb-1"><i class="fas fa-cookie-bite me-1 text-warning"></i>Sử dụng Cookie</div>
            <p class="small text-muted mb-3">Chúng tôi sử dụng cookie để lưu trữ phiên đăng nhập. Bạn có muốn cho phép không?</p>
            <div class="d-flex gap-2">
                <button class="btn btn-primary btn-sm flex-fill" id="cookie-accept">Chấp nhận tất cả</button>
                <button class="btn btn-outline-secondary btn-sm flex-fill" id="cookie-reject">Từ chối</button>
            </div>
        </div>`;
    banner.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;';
    document.body.appendChild(banner);

    document.querySelector('#cookie-accept').addEventListener('click', () => {
        TokenStore.saveConsent(true);
        banner.remove();
        toast('Cookie đã được chấp nhận.', 'info');
    });
    document.querySelector('#cookie-reject').addEventListener('click', () => {
        TokenStore.saveConsent(false);
        banner.remove();
    });
}

async function router() {
    try {
        if (!state.categories.length) await loadCategories();
        renderAccountMenu();
        const { path } = routeInfo();
        const parts = path.split('/').filter(Boolean);
        if (parts[0]==='products' && parts[1]) return renderProductDetail(parts[1]);
        if (parts[0]==='products' || path==='')  return renderProducts();
        if (parts[0]==='cart')           return renderCart();
        if (parts[0]==='checkout')       return renderCheckout();
        if (parts[0]==='login')          return renderLogin();
        if (parts[0]==='register')       return renderRegister();
        if (parts[0]==='verify-otp')     return renderVerifyOtp();
        if (parts[0]==='forgot-password')return renderForgotPassword();
        if (parts[0]==='reset-password') return renderResetPassword();
        if (parts[0]==='profile')        return renderProfile();
        if (parts[0]==='orders' && parts[1]) return renderOrders(parts[1]);
        if (parts[0]==='orders')         return renderOrders();
        if (parts[0]==='admin')          return renderAdmin();
        navigate('/products');
    } catch (err) {
        app.innerHTML = `<div class="alert alert-danger shadow-sm"><h5 class="fw-bold">Lỗi</h5><p class="mb-0">${esc(err.message)}</p></div>`;
    }
}

setupSearch();
renderAccountMenu();
refreshCartCount();
showCookieBanner();
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
