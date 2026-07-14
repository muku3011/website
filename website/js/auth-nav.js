// Unified Authentication, Navigation and Idle Session Tracker
(function() {

    // Utility: Parse cookies
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

    // mod_auth_openidc logout endpoint — clears BOTH the Apache session cookie
    // AND the Keycloak SSO session in one flow. Never call Keycloak directly or
    // the Apache mod_auth_openidc_session cookie will keep the user logged in.
    //
    // The post-logout redirect must EXACTLY match a URI registered in the
    // Keycloak apache-portal client (Clients → apache-portal → Valid post-logout
    // redirect URIs). Apache's <Location /redirect_uri> block expires all
    // hutta_* cookies server-side on this response, so no client-side flag is needed.
    const LOGOUT_URL = 'https://hutta.in/redirect_uri?logout=' + encodeURIComponent('https://hutta.in/');

    // Initialize Global Auth Properties from cookies set by Apache mod_auth_openidc
    window.userNameVal = getCookie('hutta_user');
    window.displayNameVal = getCookie('hutta_name') || window.userNameVal;
    window.userEmailVal = getCookie('hutta_email') || 'no-email@hutta.in';
    const groupsRaw = getCookie('hutta_groups') || '';
    window.userGroups = groupsRaw.split(',').map(g => g.trim()).filter(Boolean);
    
    // Determine userRole from OIDC groups
    if (window.userGroups.includes('admins')) {
        window.userRole = 'admin';
    } else if (window.userGroups.includes('operators')) {
        window.userRole = 'operator';
    } else {
        window.userRole = 'viewer';
    }

    // Dynamic Navigation Tab Visibility Rules
    function initNavigation() {
        const navProfiles = document.getElementById('nav-profiles');
        const navSentinel = document.getElementById('nav-sentinel');
        const isLoggedIn = !!window.userNameVal;

        // Profiles tab: visible to any authenticated user
        if (navProfiles) {
            navProfiles.style.display = isLoggedIn ? 'inline-block' : 'none';
        }
        // Sentinel tab: visible to any authenticated user
        if (navSentinel) {
            navSentinel.style.display = isLoggedIn ? 'inline-block' : 'none';
        }
        
        // HSM tab: visible to admins only
        const navHsm = document.getElementById('nav-hsm');
        if (navHsm) {
            navHsm.style.display = (isLoggedIn && window.userRole === 'admin') ? 'inline-block' : 'none';
        }
        // Admin tab has been removed — user management is done in Keycloak console
    }

    // Dynamic Header Controls Injection
    function initHeaderActions() {
        const container = document.getElementById('auth-header-container');
        if (!container) return;

        const isLoggedIn = !!window.userNameVal;

        if (isLoggedIn) {
            // Render Profile Dropdown
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

            // Dropdown Click Toggle
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

            // Sign Out Listener
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', window.logoutUser);
            }
        } else {
            // Render Sign In Button
            container.innerHTML = `
                <a href="profiles.html" id="login-btn" class="btn btn-primary" style="margin-right: 0.5rem; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: var(--border-radius-sm); font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    <span>Sign In</span>
                </a>
            `;
        }
    }

    // HTML Escaper helper
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Secure Full Logout Flow
    window.logoutUser = function() {
        // Belt-and-suspenders: expire hutta_* cookies client-side using the same
        // attributes Apache used to set them (Secure; SameSite=Lax; Path=/).
        // The authoritative clear happens server-side via Apache's Header directive
        // on the /redirect_uri location (see setup_apache.sh).
        const cookieNames = ['hutta_user', 'hutta_groups', 'hutta_auth', 'hutta_name', 'hutta_email'];
        cookieNames.forEach(name => {
            document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax`;
        });

        // Show themed full-screen logout overlay
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

        // Redirect to mod_auth_openidc logout endpoint.
        // This clears the Apache OIDC session cookie first, then calls Keycloak's
        // end_session_endpoint — ensuring the user must re-enter credentials next time.
        setTimeout(() => {
            window.location.replace(LOGOUT_URL);
        }, 600);
    };

    // Activity Session Timer
    // Keycloak enforces server-side SSO session idle timeout (Realm → Sessions → SSO Session Idle).
    // This client-side timer provides a UI-level safety net for the same duration.
    let idleTimer = null;
    const IDLE_TIMEOUT_MINUTES = 15; // Keep in sync with Keycloak Realm → Sessions → SSO Session Idle

    function initIdleTimer() {
        if (!window.userNameVal) return;

        const timeoutMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
        console.log(`Inactivity timer: ${IDLE_TIMEOUT_MINUTES} min for user: ${window.userNameVal}`);

        function resetIdleTimer() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                console.log(`Idle timeout of ${IDLE_TIMEOUT_MINUTES} min reached — logging out.`);
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
    document.addEventListener('DOMContentLoaded', () => {
        initThemeToggle();
        initNavigation();
        initHeaderActions();
        initIdleTimer();
    });
})();
