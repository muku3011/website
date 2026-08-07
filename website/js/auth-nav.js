// Unified Keycloak OIDC Authentication, Navigation & Session Manager for Traefik & Kubernetes
(function() {

    // Keycloak OIDC Configuration
    const KEYCLOAK_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : 'https://auth.hutta.in';
    const REALM = 'hutta';
    const CLIENT_ID = 'hutta-portal';

    const AUTH_ENDPOINT = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/auth`;
    const TOKEN_ENDPOINT = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
    const LOGOUT_ENDPOINT = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/logout`;

    // Cookie & Session Storage Utility Functions
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            let val = decodeURIComponent(parts.pop().split(';').shift());
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
            }
            return val;
        }
        return null;
    }

    function setCookie(name, val, maxAgeSecs = 86400) {
        document.cookie = `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAgeSecs}; Secure; SameSite=Lax`;
    }

    function deleteCookie(name) {
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax`;
    }

    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Failed to parse JWT token:', e);
            return null;
        }
    }

    // Helper: Build Keycloak Login URL
    function getLoginUrl(redirectTarget) {
        const redirectUri = redirectTarget || window.location.href;
        return `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+profile+email`;
    }

    // Process Authorization Code Exchange if redirected back from Keycloak
    async function handleOidcCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            try {
                // Strip code from URL immediately so refresh won't reuse spent code
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);

                const bodyParams = new URLSearchParams();
                bodyParams.append('grant_type', 'authorization_code');
                bodyParams.append('client_id', CLIENT_ID);
                bodyParams.append('code', code);
                bodyParams.append('redirect_uri', cleanUrl);

                const res = await fetch(TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: bodyParams
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.id_token || data.access_token) {
                        const claims = parseJwt(data.id_token || data.access_token);
                        if (claims) {
                            const username = claims.preferred_username || claims.sub || 'user';
                            const name = claims.name || claims.given_name || username;
                            const email = claims.email || `${username}@hutta.in`;
                            const roles = claims.realm_access?.roles || ['user'];

                            setCookie('hutta_user', username);
                            setCookie('hutta_name', name);
                            setCookie('hutta_email', email);
                            setCookie('hutta_groups', roles.join(','));
                            sessionStorage.setItem('hutta_access_token', data.access_token);
                            sessionStorage.setItem('hutta_id_token', data.id_token);
                        }
                    }
                } else {
                    console.error('Token exchange failed:', await res.text());
                }
            } catch (e) {
                console.error('OIDC code exchange error:', e);
            }
        }
    }

    // Global Auth State initialization
    window.userNameVal = getCookie('hutta_user');
    window.displayNameVal = getCookie('hutta_name') || window.userNameVal;
    window.userEmailVal = getCookie('hutta_email') || 'no-email@hutta.in';
    const groupsRaw = getCookie('hutta_groups') || '';
    window.userGroups = groupsRaw.split(',').map(g => g.trim()).filter(Boolean);

    if (window.userGroups.includes('admin')) {
        window.userRole = 'admin';
    } else if (window.userGroups.includes('operator') || window.userGroups.includes('operators')) {
        window.userRole = 'operator';
    } else {
        window.userRole = 'viewer';
    }

    // Protected Page Guard Enforcement
    function enforcePageSecurity() {
        const path = window.location.pathname.toLowerCase();
        const isProtectedPage = path.endsWith('/consumer.html') || 
                                path.endsWith('/iot.html') || 
                                path.endsWith('/sentinel.html');

        const isLoggedIn = !!window.userNameVal;

        if (isProtectedPage && !isLoggedIn) {
            console.log(`Protected page ${path} accessed without auth — redirecting to Keycloak...`);
            window.location.href = getLoginUrl();
        }
    }

    // Dynamic Navigation Tab Visibility Rules
    function initNavigation() {
        const navProfiles = document.getElementById('nav-profiles');
        const navSentinel = document.getElementById('nav-sentinel');
        const navIot = document.getElementById('nav-iot');
        const navHsm = document.getElementById('nav-hsm');

        const isLoggedIn = !!window.userNameVal;

        if (navProfiles) {
            navProfiles.style.display = isLoggedIn ? 'inline-block' : 'none';
        }
        if (navSentinel) {
            navSentinel.style.display = isLoggedIn ? 'inline-block' : 'none';
        }
        if (navIot) {
            navIot.style.display = isLoggedIn ? 'inline-block' : 'none';
        }
        if (navHsm) {
            navHsm.style.display = (isLoggedIn && window.userRole === 'admin') ? 'inline-block' : 'none';
        }
    }

    // Dynamic Header Controls Injection
    function initHeaderActions() {
        const container = document.getElementById('auth-header-container');
        if (!container) return;

        const isLoggedIn = !!window.userNameVal;

        if (isLoggedIn) {
            const initials = (window.displayNameVal || 'U').substring(0, 1).toUpperCase();
            const roleText = window.userRole === 'admin' 
                ? 'Administrator' 
                : window.userRole === 'operator' 
                    ? 'Operator' 
                    : 'Viewer';
            const roleBadgeClass = window.userRole === 'admin' 
                ? 'badge-success' 
                : window.userRole === 'operator' 
                    ? 'badge-info' 
                    : 'badge-secondary';

            container.innerHTML = `
                <div class="user-profile-section" id="user-profile-menu">
                    <button class="user-profile-trigger" id="user-profile-trigger" aria-label="User menu" aria-haspopup="true">
                        <div class="user-avatar" id="user-avatar-initials">${initials}</div>
                        <span class="user-display-name" id="user-display-name-label">${escapeHtml(window.displayNameVal)}</span>
                        <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div class="user-profile-dropdown" id="user-profile-dropdown">
                        <div class="user-dropdown-header">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span class="user-signed-in-label">Signed in as</span>
                                <span class="badge ${roleBadgeClass}" id="dropdown-role-badge">${roleText}</span>
                            </div>
                            <div class="user-identity">
                                <span class="user-display-name-header" id="dropdown-display-name">${escapeHtml(window.displayNameVal)}</span>
                                <span class="user-card-username" id="dropdown-username-handle">@${escapeHtml(window.userNameVal)}</span>
                            </div>
                            <span class="user-email-header" id="dropdown-email">${escapeHtml(window.userEmailVal)}</span>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-footer-actions" style="justify-content: flex-end;">
                            <button id="logout-btn" class="btn btn-secondary btn-logout">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const profileMenu = document.getElementById('user-profile-menu');
            const profileTrigger = document.getElementById('user-profile-trigger');
            if (profileTrigger && profileMenu) {
                profileTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    profileMenu.classList.toggle('active');
                });

                document.addEventListener('click', (e) => {
                    if (!profileMenu.contains(e.target)) {
                        profileMenu.classList.remove('active');
                    }
                });
            }

            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', window.logoutUser);
            }
        } else {
            const loginUrl = getLoginUrl();
            container.innerHTML = `
                <a href="${loginUrl}" id="login-btn" class="btn btn-primary" style="margin-right: 0.5rem; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: var(--border-radius-sm); font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    <span>Sign In</span>
                </a>
            `;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Secure Keycloak Logout Flow
    window.logoutUser = function() {
        ['hutta_user', 'hutta_groups', 'hutta_auth', 'hutta_name', 'hutta_email'].forEach(name => {
            deleteCookie(name);
        });
        sessionStorage.removeItem('hutta_access_token');
        sessionStorage.removeItem('hutta_id_token');

        const overlay = document.createElement('div');
        overlay.id = 'logout-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: var(--card-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: var(--font-primary), system-ui, -apple-system, sans-serif;
        `;

        overlay.innerHTML = `
            <style>
                .logout-spinner-container {
                    display: flex; flex-direction: column;
                    align-items: center; gap: 1.5rem; text-align: center;
                }
                .logout-spinner-orb {
                    width: 60px; height: 60px; border-radius: 50%;
                    background: linear-gradient(135deg, var(--primary-glow, #0070f3), var(--secondary-glow, #ff0070));
                    box-shadow: 0 0 30px var(--primary-glow, #0070f3);
                    animation: logout-pulse 2s infinite ease-in-out;
                }
                .logout-spinner-text {
                    color: var(--text-primary, #ffffff); font-size: 1.1rem;
                    font-weight: 500; letter-spacing: 0.5px; margin: 0;
                    font-family: var(--font-heading), system-ui;
                }
                @keyframes logout-pulse {
                    0%, 100% { transform: scale(0.9); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
            </style>
            <div class="logout-spinner-container">
                <div class="logout-spinner-orb"></div>
                <p class="logout-spinner-text">Logging out securely...</p>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => { overlay.style.opacity = '1'; }, 50);

        const homeUrl = 'https://hutta.in/';
        const redirectLogoutUrl = `${LOGOUT_ENDPOINT}?client_id=${CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent(homeUrl)}`;

        setTimeout(() => {
            window.location.replace(redirectLogoutUrl);
        }, 600);
    };

    let idleTimer = null;
    const IDLE_TIMEOUT_MINUTES = 15;

    function initIdleTimer() {
        if (!window.userNameVal) return;

        const timeoutMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
        function resetIdleTimer() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                window.logoutUser();
            }, timeoutMs);
        }

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, resetIdleTimer, { passive: true });
        });

        resetIdleTimer();
    }

    function initThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
                const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.body.classList.remove('light-theme', 'dark-theme');
                document.body.classList.add(nextTheme + '-theme');
                localStorage.setItem('theme', nextTheme);
            });
        }
    }

    // Trigger DOM Initializations
    document.addEventListener('DOMContentLoaded', async () => {
        await handleOidcCallback();

        // Refresh global state after code exchange
        window.userNameVal = getCookie('hutta_user');
        window.displayNameVal = getCookie('hutta_name') || window.userNameVal;
        window.userEmailVal = getCookie('hutta_email') || 'no-email@hutta.in';
        const rawGroups = getCookie('hutta_groups') || '';
        window.userGroups = rawGroups.split(',').map(g => g.trim()).filter(Boolean);

        if (window.userGroups.includes('admin')) {
            window.userRole = 'admin';
        } else if (window.userGroups.includes('operator') || window.userGroups.includes('operators')) {
            window.userRole = 'operator';
        } else {
            window.userRole = 'viewer';
        }

        enforcePageSecurity();
        initThemeToggle();
        initNavigation();
        initHeaderActions();
        initIdleTimer();
    });
})();
