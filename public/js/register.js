// register.js - Registration page

function renderRegister() {
    app.innerHTML = `
        <div class="auth-card bg-white p-4 rounded shadow-sm">
            <h3 class="fw-bold mb-3">Đăng ký</h3>
            <div class="vstack gap-3">
                <input class="form-control" id="reg-name" placeholder="Họ tên" required>
                <input class="form-control" type="email" id="reg-email" placeholder="Email" required>
                <div class="input-group">
                    <input class="form-control" type="password" id="reg-password" placeholder="Mật khẩu (≥8 ký tự, chữ hoa, số)" required>
                    <button class="btn btn-outline-secondary" type="button" id="toggle-reg-pw"><i class="fas fa-eye" id="reg-pw-icon"></i></button>
                </div>
                <div id="pw-strength" class="small text-muted"></div>
                <button class="btn btn-success fw-bold" id="reg-btn">Tạo tài khoản</button>
            </div>
            <div class="mt-2 small text-center"><a href="#/login">Đã có tài khoản? Đăng nhập</a></div>
        </div>`;

    // Show/hide password
    $('#toggle-reg-pw').addEventListener('click', () => {
        const pw = $('#reg-password'); const icon = $('#reg-pw-icon');
        const h = pw.type === 'password';
        pw.type = h ? 'text' : 'password'; icon.className = h ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // Password strength hint
    $('#reg-password').addEventListener('input', () => {
        const pw = $('#reg-password').value;
        const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw)];
        const count = checks.filter(Boolean).length;
        const labels = ['Yếu', 'Trung bình', 'Mạnh'];
        const colors = ['danger', 'warning', 'success'];
        $('#pw-strength').innerHTML = pw ? `<span class="text-${colors[count-1]}">${labels[count-1] || 'Yếu'}</span>` : '';
    });

    $('#reg-btn').addEventListener('click', async () => {
        const full_name = $('#reg-name').value.trim();
        const email     = $('#reg-email').value.trim();
        const password  = $('#reg-password').value;
        if (!full_name || !email || !password) { toast('Vui lòng điền đầy đủ thông tin.', 'warning'); return; }
        try {
            const data = await api('/auth/register', { method: 'POST', body: { full_name, email, password } });
            sessionStorage.setItem('debug_otp', data.debug_otp || '');
            toast(`OTP test: ${data.debug_otp}`, 'info');
            navigate('/verify-otp?email=' + encodeURIComponent(data.email));
        } catch (err) { toast(err.message, 'danger'); }
    });
}
