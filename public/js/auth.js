// auth.js - Token storage, API helper, auth state

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
const isStaticPreview = ['5500','5501','5502','5503'].includes(window.location.port) || window.location.protocol === 'file:';
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
const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' ₫';
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

// ── Token storage ─────────────────────────────────────────────────────────────
const TokenStore = {
    _cookieConsent: null,

    getConsent() {
        if (this._cookieConsent !== null) return this._cookieConsent;
        this._cookieConsent = localStorage.getItem('cookie_consent'); // 'accepted' | 'rejected' | null
        return this._cookieConsent;
    },

    saveConsent(accepted) {
        this._cookieConsent = accepted ? 'accepted' : 'rejected';
        localStorage.setItem('cookie_consent', this._cookieConsent);
    },

    useCookies() { return this.getConsent() === 'accepted'; },

    set(key, value, persistent = false) {
        // Always save to sessionStorage so tokens survive within the tab
        sessionStorage.setItem(key, value);
        // Also save to cookie or localStorage for cross-tab / persistent sessions
        if (persistent) {
            if (this.useCookies()) {
                const days = 30;
                const exp = new Date(Date.now() + days * 864e5).toUTCString();
                document.cookie = `${key}=${encodeURIComponent(value)};expires=${exp};path=/;SameSite=Strict`;
            } else {
                localStorage.setItem(key, value);
            }
        }
        // Mirror to memory for fastest reads
        window._authMem = window._authMem || {};
        window._authMem[key] = value;
    },

    get(key) {
        // 1. Memory (fastest)
        window._authMem = window._authMem || {};
        if (window._authMem[key]) return window._authMem[key];
        // 2. sessionStorage (current tab)
        const ss = sessionStorage.getItem(key);
        if (ss) { window._authMem[key] = ss; return ss; }
        // 3. localStorage (persistent across tabs)
        const ls = localStorage.getItem(key);
        if (ls) { window._authMem[key] = ls; return ls; }
        // 4. Cookie
        const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + key + '=([^;]*)'));
        if (match) { const v = decodeURIComponent(match[1]); window._authMem[key] = v; return v; }
        return null;
    },

    remove(key) {
        window._authMem = window._authMem || {};
        delete window._authMem[key];
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    },
};

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
    get accessToken() { return TokenStore.get('access_token') || ''; },
    get refreshToken() { return TokenStore.get('refresh_token') || ''; },
    get token()       { return this.accessToken; }, // compat alias
    user: JSON.parse(sessionStorage.getItem('api_user') || localStorage.getItem('api_user') || 'null'),
    rememberMe: localStorage.getItem('remember_me') === '1',
    categories: [],
    products: [],
    lastCart: null,
};

function setTokens(accessToken, refreshToken, user, remember = false) {
    state.rememberMe = remember;
    if (remember) localStorage.setItem('remember_me', '1');
    else          localStorage.removeItem('remember_me');

    if (accessToken) {
        TokenStore.set('access_token',  accessToken,  remember);
        TokenStore.set('refresh_token', refreshToken, remember);
    } else {
        TokenStore.remove('access_token');
        TokenStore.remove('refresh_token');
    }
    state.user = user || null;
    if (user) {
        const str = JSON.stringify(user);
        sessionStorage.setItem('api_user', str);          // always in session
        if (remember) localStorage.setItem('api_user', str); // also persist if remember
    } else {
        localStorage.removeItem('api_user');
        sessionStorage.removeItem('api_user');
    }
    if (typeof renderAccountMenu === 'function') renderAccountMenu();
    if (typeof refreshCartCount  === 'function') refreshCartCount();
}

// Legacy compat
function setToken(token, user) { setTokens(token, '', user, state.rememberMe); }

// ── Auto token refresh ────────────────────────────────────────────────────────
let _refreshing = false;
async function refreshAccessToken() {
    const rt = state.refreshToken;
    if (!rt || _refreshing) return false;
    _refreshing = true;
    try {
        const res = await fetch(API_BASE + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: rt }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) { setTokens('', '', null); return false; }
        const d = payload.data || {};
        TokenStore.set('access_token',  d.access_token,  state.rememberMe);
        TokenStore.set('refresh_token', d.refresh_token, state.rememberMe);
        return true;
    } catch { return false; } finally { _refreshing = false; }
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
    const headers = options.headers || {};
    const config  = { ...options, headers };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        if (options.body && typeof options.body !== 'string') config.body = JSON.stringify(options.body);
    }
    if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

    let response = await fetch(API_BASE + path, config);

    // Try silent refresh once on 401
    if (response.status === 401 && state.refreshToken) {
        const ok = await refreshAccessToken();
        if (ok) {
            headers.Authorization = `Bearer ${state.accessToken}`;
            response = await fetch(API_BASE + path, { ...config, headers });
        }
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        const message = payload.message || `HTTP ${response.status}`;
        if (response.status === 401) setTokens('', '', null);
        throw new Error(message);
    }
    return payload.data || {};
}

// ── Auto-logout after 2h without remember me ──────────────────────────────────
(function scheduleAutoLogout() {
    if (state.rememberMe) return;
    if (!state.accessToken) return;
    // Access token is 2h; schedule logout slightly after
    setTimeout(() => {
        if (!state.rememberMe) {
            setTokens('', '', null);
            if (typeof toast === 'function') toast('Session expired. Please log in again.', 'warning');
            if (typeof navigate === 'function') navigate('/login');
        }
    }, 2 * 60 * 60 * 1000);
})();
