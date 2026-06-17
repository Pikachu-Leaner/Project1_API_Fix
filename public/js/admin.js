// admin.js - Admin panel with analytics charts

async function renderAdmin() {
    if (!state.user || state.user.role !== 'Admin') return renderLogin('Chỉ Admin được truy cập khu vực này.');
    const [dash, products, users, orders, revenueMonth, topProds] = await Promise.all([
        api('/admin/dashboard'),
        api('/admin/products'),
        api('/admin/users'),
        api('/admin/orders'),
        api('/admin/revenue/month'),
        api('/admin/products/top'),
    ]);

    app.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="fw-bold">Admin Panel</h2>
            <button id="new-product" class="btn btn-warning fw-bold"><i class="fas fa-plus me-1"></i>Thêm sản phẩm</button>
        </div>
        <div class="row g-3 mb-4">
            ${Object.entries(dash.stats).map(([k,v]) => `
            <div class="col-md">
                <div class="bg-white rounded shadow-sm p-3">
                    <div class="text-muted small text-uppercase">${esc(k.replaceAll('_',' '))}</div>
                    <div class="fs-3 fw-bold">${k==='revenue'?money(v):esc(v)}</div>
                </div>
            </div>`).join('')}
        </div>

        <!-- Revenue Chart -->
        <div class="row g-3 mb-4">
            <div class="col-md-8">
                <div class="bg-white rounded shadow-sm p-3">
                    <h6 class="fw-bold text-muted mb-3">Doanh thu theo tháng</h6>
                    <canvas id="revenue-chart" height="120"></canvas>
                </div>
            </div>
            <div class="col-md-4">
                <div class="bg-white rounded shadow-sm p-3">
                    <h6 class="fw-bold text-muted mb-3">Top sản phẩm bán chạy</h6>
                    <canvas id="top-products-chart" height="200"></canvas>
                </div>
            </div>
        </div>

        <ul class="nav nav-tabs" id="admin-tabs" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#admin-products">Products</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#admin-users">Users</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#admin-orders">Orders</button></li>
        </ul>
        <div class="tab-content bg-white rounded-bottom shadow-sm p-3">
            <div class="tab-pane fade show active" id="admin-products">${adminProductsTable(products.products || [])}</div>
            <div class="tab-pane fade" id="admin-users">${adminUsersTable(users.users || [])}</div>
            <div class="tab-pane fade" id="admin-orders">${adminOrdersTable(orders.orders || [])}</div>
        </div>`;

    // Draw revenue line chart (Chart.js)
    if (window.Chart && revenueMonth.revenue_by_month) {
        const rm = revenueMonth.revenue_by_month;
        new Chart(document.getElementById('revenue-chart'), {
            type: 'line',
            data: {
                labels: rm.map(r => r.month),
                datasets: [{
                    label: 'Doanh thu (₫)',
                    data: rm.map(r => r.revenue),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13,110,253,0.1)',
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => (v/1e6).toFixed(0)+'M' } } } }
        });
    }

    // Draw top products bar chart
    if (window.Chart && topProds.top_products) {
        const tp = topProds.top_products.slice(0, 5);
        new Chart(document.getElementById('top-products-chart'), {
            type: 'bar',
            data: {
                labels: tp.map(p => p.name.slice(0, 15)),
                datasets: [{
                    label: 'Đã bán',
                    data: tp.map(p => p.units_sold),
                    backgroundColor: ['#0d6efd','#198754','#ffc107','#dc3545','#6f42c1'],
                }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    }

    $('#new-product').addEventListener('click', () => openProductModal());
    document.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', async () => {
        const data = await api('/admin/products/' + btn.dataset.id);
        openProductModal(data.product);
    }));
    document.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', async () => {
        if (confirm('Xóa sản phẩm này?')) { await api('/admin/products/' + btn.dataset.id, { method: 'DELETE' }); toast('Đã xóa sản phẩm.'); renderAdmin(); }
    }));
    document.querySelectorAll('.toggle-user').forEach(btn => btn.addEventListener('click', async () => {
        await api('/admin/users/' + btn.dataset.id + '/status', { method: 'PATCH' }); toast('Đã cập nhật trạng thái user.'); renderAdmin();
    }));
    document.querySelectorAll('.order-status').forEach(select => select.addEventListener('change', async () => {
        await api('/admin/orders/' + select.dataset.id + '/status', { method: 'PATCH', body: { status: select.value } }); toast('Đã cập nhật trạng thái đơn hàng.'); renderAdmin();
    }));
}

function adminProductsTable(products) {
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Ảnh</th><th>Tên</th><th>Brand</th><th>Giá</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td><img class="admin-table-img" src="${mediaUrl(p.image_url)}"></td><td class="fw-bold">${esc(p.name)}</td><td>${esc(p.brand)}</td><td>${money(p.price)}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary edit-product" data-id="${p.id}">Sửa</button> <button class="btn btn-sm btn-outline-danger delete-product" data-id="${p.id}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`;
}

function adminUsersTable(users) {
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Tên</th><th>Email</th><th>Role</th><th>Status</th><th>Verified</th><th></th></tr></thead><tbody>${users.map(u=>`<tr><td>${u.id}</td><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td><span class="badge bg-${u.role==='Admin'?'danger':'secondary'}">${esc(u.role)}</span></td><td>${u.is_active?'<span class="text-success">Active</span>':'<span class="text-danger">Disabled</span>'}</td><td>${u.is_verified?'✅':'⏳'}</td><td class="text-end">${u.role!=='Admin'?`<button class="btn btn-sm btn-outline-warning toggle-user" data-id="${u.id}">Bật/Tắt</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

function adminOrdersTable(orders) {
    const statuses = ['Pending','Delivering','Completed','Cancelled'];
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>ID</th><th>Khách</th><th>Tổng</th><th>Trạng thái</th><th>Ngày</th></tr></thead><tbody>${orders.map(o=>`<tr><td>#${o.id}</td><td>${esc(o.customer_name)}</td><td>${money(o.total_amount)}</td><td><select class="form-select form-select-sm order-status" data-id="${o.id}">${statuses.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${esc(o.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}

function openProductModal(product = null) {
    const modal = new bootstrap.Modal($('#productModal'));
    $('#productModalTitle').textContent = product ? 'Sửa sản phẩm bằng PUT API' : 'Thêm sản phẩm bằng POST API';
    $('#product-form').innerHTML = `
        <input type="hidden" name="id" value="${product?.id||''}">
        <div class="row g-3">
            <div class="col-md-8"><label class="form-label">Tên</label><input class="form-control" name="name" value="${esc(product?.name||'')}" required></div>
            <div class="col-md-4"><label class="form-label">Brand</label><input class="form-control" name="brand" value="${esc(product?.brand||'')}" required></div>
            <div class="col-md-4"><label class="form-label">Giá</label><input class="form-control" type="number" name="price" value="${product?.price||''}" required></div>
            <div class="col-md-4"><label class="form-label">Giá cũ</label><input class="form-control" type="number" name="old_price" value="${product?.old_price||''}"></div>
            <div class="col-md-4"><label class="form-label">Danh mục</label><select class="form-select" name="category_id"><option value="">Không chọn</option>${state.categories.map(c=>`<option value="${c.id}" ${String(product?.category_id||'')===String(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label">Image URL</label><input class="form-control" name="image_url" value="${esc(product?.image_url||'public/images/Phone-card-image-1.jpg')}"></div>
            <div class="col-md-6"><label class="form-label">Upload image</label><input class="form-control" type="file" name="image_file" accept="image/*"></div>
            <div class="col-md-6"><label class="form-label">Sales count</label><input class="form-control" type="number" name="sales_count" value="${product?.sales_count||0}"></div>
            <div class="col-md-6 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" name="is_featured" ${product?.is_featured?'checked':''}><label class="form-check-label">Nổi bật</label></div></div>
            <div class="col-12"><label class="form-label">Details</label><textarea class="form-control" name="details" rows="4">${esc(product?.details||'')}</textarea></div>
        </div>
        <div class="modal-footer px-0 pb-0"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button><button class="btn btn-primary fw-bold">Lưu</button></div>`;
    $('#product-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        const id   = data.id; delete data.id;
        const file = form.querySelector('[name="image_file"]').files[0];
        delete data.image_file;
        data.is_featured = form.querySelector('[name="is_featured"]').checked;
        if (!data.old_price)  data.old_price   = null;
        if (!data.category_id) data.category_id = null;
        if (file) {
            const fd = new FormData(); fd.append('image', file);
            const upload = await api('/admin/products/upload', { method: 'POST', body: fd, headers: {} });
            data.image_url = upload.image_url;
        }
        if (id) await api('/admin/products/' + id, { method: 'PUT', body: data });
        else    await api('/admin/products', { method: 'POST', body: data });
        toast('Đã lưu sản phẩm.'); modal.hide(); renderAdmin();
    };
    modal.show();
}
