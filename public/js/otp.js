// otp.js - OTP input UI with mock display pill and auto-fill

function renderVerifyOtp() {
    const email = routeInfo().params.get('email') || '';
    const debugOtp = sessionStorage.getItem('debug_otp') || '';

    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-2">Xác thực OTP</h3>
            <p class="text-muted small mb-3">Nhập mã 6 chữ số được gửi đến email của bạn.</p>

            ${debugOtp ? `
            <div class="mb-3 text-center">
                <span class="badge bg-info text-dark p-2 px-3 fs-6 otp-mock-pill" style="cursor:pointer; border-radius:999px;" title="Click để điền tự động">
                    🔑 OTP thử nghiệm: <strong id="mock-otp-value">${esc(debugOtp)}</strong>
                    <small class="ms-1">(click để điền)</small>
                </span>
            </div>` : ''}

            <input type="hidden" id="otp-email-field" value="${esc(email)}">
            <div class="d-flex gap-2 justify-content-center mb-3" id="otp-inputs">
                ${[0,1,2,3,4,5].map(i => `<input type="text" maxlength="1" inputmode="numeric" class="form-control text-center fw-bold fs-4 otp-box" style="width:52px;height:58px;" data-index="${i}">`).join('')}
            </div>
            <button id="otp-submit" class="btn btn-primary fw-bold w-100">Xác thực</button>
            <div class="mt-3 text-center small">
                <a href="#/register">Quay lại đăng ký</a>
            </div>
        </div>`;

    // Auto-fill on pill click
    if (debugOtp) {
        document.querySelector('.otp-mock-pill')?.addEventListener('click', () => otpAutoFill(debugOtp));
    }

    // OTP box navigation logic
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, i) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val ? val[0] : '';
            if (val && i < 5) boxes[i + 1].focus();
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        });
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            otpAutoFill(pasted);
        });
    });

    document.getElementById('otp-submit').addEventListener('click', submitOtp);
}

function otpAutoFill(code) {
    const boxes = document.querySelectorAll('.otp-box');
    const digits = String(code).replace(/\D/g, '').slice(0, 6);
    boxes.forEach((box, i) => { box.value = digits[i] || ''; });
    if (boxes[5]) boxes[5].focus();
}

function getOtpValue() {
    return Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join('');
}

async function submitOtp() {
    const otp   = getOtpValue();
    const email = document.getElementById('otp-email-field')?.value || '';
    if (otp.length !== 6) { toast('Vui lòng nhập đủ 6 chữ số.', 'warning'); return; }

    try {
        const data = await api('/auth/verify-otp', { method: 'POST', body: { email, otp } });
        sessionStorage.removeItem('debug_otp');
        // Auto-login after verification
        if (data.access_token) {
            setTokens(data.access_token, data.refresh_token, data.user, false);
            toast('Xác thực thành công. Đang chuyển hướng...');
            navigate('/products');
        } else {
            toast('Xác thực thành công.');
            navigate('/login');
        }
    } catch (err) {
        toast(err.message, 'danger');
    }
}
