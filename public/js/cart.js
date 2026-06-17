// cart.js - Cart and checkout pages

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
                <div class="d-flex justify-content-between align-items-center border-top pt-3">
                    <button id="clear-cart" class="btn btn-outline-danger">Xóa giỏ hàng</button>
                    <div class="text-end">
                        <div class="text-muted">Tổng tiền</div>
                        <div class="fs-3 fw-bold text-danger">${money(cart.total_amount)}</div>
                        <a href="#/checkout" class="btn btn-warning fw-bold px-4">Thanh toán</a>
                    </div>
                </div>`
            : '<div class="text-center py-5 text-muted">Giỏ hàng trống.</div>'}
        </div>`;
    document.querySelectorAll('.qty').forEach(btn => btn.addEventListener('click', async () => {
        await api('/cart/items/' + btn.dataset.id, { method: 'PATCH', body: { action: btn.dataset.action } });
        await refreshCartCount(); renderCart();
    }));
    document.querySelectorAll('.remove-cart').forEach(btn => btn.addEventListener('click', async () => {
        await api('/cart/items/' + btn.dataset.id, { method: 'DELETE' });
        await refreshCartCount(); renderCart();
    }));
    $('#clear-cart')?.addEventListener('click', async () => {
        await api('/cart', { method: 'DELETE' }); await refreshCartCount(); renderCart();
    });
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
                    <div class="row g-3" id="checkout-fields">
                        <div class="col-md-6"><label class="form-label">Họ tên</label><input class="form-control" id="co-name" value="${esc(state.user.full_name||'')}" required></div>
                        <div class="col-md-6"><label class="form-label">Số điện thoại</label><input class="form-control" id="co-phone" value="${esc(state.user.phone||'')}" required></div>
                        <div class="col-12"><label class="form-label">Địa chỉ</label><textarea class="form-control" id="co-address" required>${esc(state.user.address||'')}</textarea></div>
                        <div class="col-12"><label class="form-label">Phương thức thanh toán</label><select class="form-select" id="co-payment"><option value="COD">Thanh toán khi nhận hàng</option><option value="Bank Transfer">Chuyển khoản</option></select></div>
                        <div class="col-12"><label class="form-label">Ghi chú</label><textarea class="form-control" id="co-notes"></textarea></div>
                        <div class="col-12"><button class="btn btn-warning fw-bold btn-lg" id="co-submit">Xác nhận thanh toán</button></div>
                    </div>
                </div>
            </div>
            <div class="col-lg-5"><div class="bg-white p-4 rounded shadow-sm"><h5 class="fw-bold">Đơn hàng</h5>${cart.items.map(i=>`<div class="d-flex justify-content-between border-bottom py-2"><span>${esc(i.product.name)} × ${i.quantity}</span><b>${money(i.line_total)}</b></div>`).join('')}<div class="d-flex justify-content-between fs-4 fw-bold text-danger pt-3"><span>Tổng</span><span>${money(cart.total_amount)}</span></div></div></div>
        </div>`;
    $('#co-submit').addEventListener('click', async () => {
        const body = {
            customer_name: $('#co-name').value,
            phone:         $('#co-phone').value,
            address:       $('#co-address').value,
            payment_method:$('#co-payment').value,
            notes:         $('#co-notes').value,
        };
        try {
            const created = await api('/orders', { method: 'POST', body });
            toast('Đặt hàng thành công.');
            await refreshCartCount();
            navigate('/orders/' + created.order.id);
        } catch (err) { toast(err.message, 'danger'); }
    });
}
