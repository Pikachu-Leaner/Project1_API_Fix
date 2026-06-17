// products.js - Product listing, detail, price sorting

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

function sortProducts(products, sort) {
    const list = [...products];
    if (sort === 'gia_tang')  list.sort((a, b) => a.price - b.price);
    if (sort === 'gia_giam')  list.sort((a, b) => b.price - a.price);
    if (sort === 'moi')       list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort === 'ban_chay')  list.sort((a, b) => b.sales_count - a.sales_count);
    return list;
}

async function renderProducts() {
    const { params } = routeInfo();
    const category = params.get('category') || '';
    const sort     = params.get('sort') || 'noi_bat';
    const search   = params.get('search') || '';
    $('#search-input').value = search;
    renderCategoryNav(category);

    app.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
    const qs = new URLSearchParams({ sort });
    if (category) qs.set('category', category);
    if (search)   qs.set('search', search);
    const data = await api('/products?' + qs.toString());
    state.products = data.products || [];

    const sorted = sortProducts(state.products, sort);

    app.innerHTML = `
        <div id="mainPromoCarousel" class="carousel slide custom-carousel mb-4 shadow rounded overflow-hidden" data-bs-ride="carousel">
            <div class="carousel-inner">
                ${[1,2,3,4].map((n, idx) => `<div class="carousel-item ${idx===0?'active':''}"><img src="${asset(`images/Carousel-image-${n}.png`)}" class="d-block w-100" alt="Banner ${n}"></div>`).join('')}
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
                <select id="sort-select" class="form-select form-select-sm shadow-sm border-secondary" style="min-width: 190px; font-weight: bold;">
                    <option value="noi_bat"  ${sort==='noi_bat'  ?'selected':''}>Nổi bật</option>
                    <option value="ban_chay" ${sort==='ban_chay' ?'selected':''}>Bán chạy</option>
                    <option value="moi"      ${sort==='moi'      ?'selected':''}>Mới nhất</option>
                    <option value="gia_tang" ${sort==='gia_tang' ?'selected':''}>💰 Giá thấp → cao</option>
                    <option value="gia_giam" ${sort==='gia_giam' ?'selected':''}>💰 Giá cao → thấp</option>
                </select>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-md-3">
                <div class="list-group shadow-sm">
                    <a href="#/products${search ? '?search='+encodeURIComponent(search) : ''}" class="list-group-item list-group-item-action fw-bold ${!category?'active':''}">Tất cả</a>
                    ${state.categories.map(c => `<a href="#/products?category=${c.id}${search?'&search='+encodeURIComponent(search):''}" class="list-group-item list-group-item-action fw-bold ${String(category)===String(c.id)?'active':''}">${esc(c.name)}</a>`).join('')}
                </div>
            </div>
            <div class="col-md-9">
                <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4" id="products-grid">
                    ${sorted.length ? sorted.map(productCard).join('') : '<div class="col-12 text-center py-5 text-muted"><h4><i class="fas fa-search me-2"></i>Không tìm thấy sản phẩm nào phù hợp.</h4></div>'}
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
                <div class="col-md-5 text-center"><img src="${mediaUrl(p.image_url)}" class="img-fluid" style="max-height:420px;object-fit:contain;" alt="${esc(p.name)}"></div>
                <div class="col-md-7">
                    <h2 class="fw-bold">${esc(p.name)}</h2>
                    <div class="text-muted mb-3">${esc(p.brand)} ${p.category_name ? '· '+esc(p.category_name) : ''}</div>
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
