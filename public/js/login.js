// login.js - Login and password reset pages

function renderLogin(message = '') {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đăng nhập</h3>
            ${message ? `<div class="alert alert-warning">${esc(message)}</div>` : ''}
            <div class="vstack gap-3">
                <input class="form-control" type="email" id="login-email" placeholder="Email" required>
                <div class="input-group">
                    <input class="form-control" type="password" id="login-password" placeholder="Mật khẩu" required>
                    <button class="btn btn-outline-secondary" type="button" id="toggle-pw">
                        <i class="fas fa-eye" id="pw-icon"></i>
                    </button>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="remember-me">
                    <label class="form-check-label" for="remember-me">Ghi nhớ đăng nhập</label>
                </div>
                <button class="btn btn-primary fw-bold" id="login-btn">Đăng nhập</button>
            </div>
            <div class="d-flex justify-content-between mt-3 small">
                <a href="#/register">Đăng ký</a>
                <a href="#/forgot-password">Quên mật khẩu?</a>
            </div>
        </div>`;

    // Show/hide password
    $('#toggle-pw').addEventListener('click', () => {
        const pw = $('#login-password');
        const icon = $('#pw-icon');
        const isHidden = pw.type === 'password';
        pw.type = isHidden ? 'text' : 'password';
        icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    $('#login-btn').addEventListener('click', async () => {
        const email    = $('#login-email').value.trim();
        const password = $('#login-password').value;
        const remember = $('#remember-me').checked;
        if (!email || !password) { toast('Vui lòng nhập email và mật khẩu.', 'warning'); return; }
        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: { email, password, remember_me: remember },
            });
            setTokens(data.access_token, data.refresh_token, data.user, remember);
            toast('Đăng nhập thành công.');
            navigate(data.user.role === 'Admin' ? '/admin' : '/products');
        } catch (err) {
            if (err.message.includes('needs_verification') || err.message.includes('verify')) {
                toast('Tài khoản chưa xác thực OTP.', 'warning');
                navigate('/verify-otp?email=' + encodeURIComponent(email));
            } else {
                toast(err.message, 'danger');
            }
        }
    });
}

function renderForgotPassword() {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Quên mật khẩu</h3>
            <div class="vstack gap-3">
                <input class="form-control" type="email" id="forgot-email" placeholder="Email" required>
                <button class="btn btn-warning fw-bold" id="forgot-btn">Tạo OTP</button>
            </div>
        </div>`;
    $('#forgot-btn').addEventListener('click', async () => {
        const email = $('#forgot-email').value.trim();
        if (!email) { toast('Vui lòng nhập email.', 'warning'); return; }
        try {
            const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
            sessionStorage.setItem('debug_otp', data.debug_otp || '');
            toast(`OTP test: ${data.debug_otp}`, 'info');
            navigate('/reset-password?email=' + encodeURIComponent(data.email));
        } catch (err) { toast(err.message, 'danger'); }
    });
}

function renderResetPassword() {
    const email = routeInfo().params.get('email') || '';
    const debugOtp = sessionStorage.getItem('debug_otp') || '';
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đặt lại mật khẩu</h3>
            ${debugOtp ? `<div class="mb-3 text-center"><span class="badge bg-info text-dark p-2 px-3 otp-mock-pill" style="cursor:pointer;border-radius:999px;" title="Click để điền">🔑 OTP: <strong>${esc(debugOtp)}</strong> (click)</span></div>` : ''}
            <div class="vstack gap-3">
                <input class="form-control" type="email" id="reset-email" value="${esc(email)}" placeholder="Email" required>
                <div class="d-flex gap-2 justify-content-center" id="otp-inputs">
                    ${[0,1,2,3,4,5].map(i=>`<input type="text" maxlength="1" inputmode="numeric" class="form-control text-center fw-bold fs-4 otp-box" style="width:48px;height:54px;" data-index="${i}">`).join('')}
                </div>
                <div class="input-group">
                    <input class="form-control" type="password" id="reset-pw" placeholder="Mật khẩu mới (≥8 ký tự, chữ hoa, số)" required>
                    <button class="btn btn-outline-secondary" type="button" id="toggle-rpw"><i class="fas fa-eye" id="rpw-icon"></i></button>
                </div>
                <button class="btn btn-primary fw-bold" id="reset-btn">Cập nhật mật khẩu</button>
            </div>
        </div>`;

    if (debugOtp) document.querySelector('.otp-mock-pill')?.addEventListener('click', () => otpAutoFill(debugOtp));
    initOtpBoxes();

    $('#toggle-rpw').addEventListener('click', () => {
        const pw = $('#reset-pw'); const icon = $('#rpw-icon');
        const h = pw.type === 'password';
        pw.type = h ? 'text' : 'password'; icon.className = h ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    $('#reset-btn').addEventListener('click', async () => {
        const email    = $('#reset-email').value.trim();
        const otp      = getOtpValue();
        const password = $('#reset-pw').value;
        if (otp.length !== 6) { toast('Nhập đủ 6 chữ số OTP.', 'warning'); return; }
        try {
            await api('/auth/reset-password', { method: 'PATCH', body: { email, otp, new_password: password } });
            sessionStorage.removeItem('debug_otp');
            toast('Đổi mật khẩu thành công.');
            navigate('/login');
        } catch (err) { toast(err.message, 'danger'); }
    });
}

function initOtpBoxes() {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, i) => {
        box.addEventListener('input', e => {
            const v = e.target.value.replace(/\D/g,'');
            e.target.value = v ? v[0] : '';
            if (v && i < 5) boxes[i+1].focus();
        });
        box.addEventListener('keydown', e => { if (e.key==='Backspace' && !box.value && i>0) boxes[i-1].focus(); });
        box.addEventListener('paste', e => {
            e.preventDefault();
            const p = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
            otpAutoFill(p);
        });
    });
}
