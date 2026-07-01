// Unified Authentication, Navigation and Idle Session Tracker
(function() {
    // Theme Management
    function setTheme(theme) {
        const body = document.body;
        if (theme === 'dark') {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
        }
        localStorage.setItem('theme', theme);
    }

    // Set theme immediately to prevent visual flash on load
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

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

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const AUTHELIA_BACKEND_BASE = isLocal ? 'http://localhost:8094' : '';

    // Initialize Global Auth Properties
    if (isLocal) {
        window.userNameVal = 'localadmin';
        window.displayNameVal = 'Local Developer';
        window.userEmailVal = 'developer@hutta.local';
        window.userGroups = ['admins', 'users'];
        window.userRole = 'admin';
    } else {
        window.userNameVal = getCookie('hutta_user');
        window.displayNameVal = getCookie('hutta_name') || window.userNameVal;
        window.userEmailVal = getCookie('hutta_email') || 'no-email@hutta.in';
        const groupsRaw = getCookie('hutta_groups') || '';
        window.userGroups = groupsRaw.split(',').map(g => g.trim()).filter(Boolean);
        window.userRole = window.userGroups.includes('admins') ? 'admin' : 'viewer';
    }

    // Dynamic Navigation Tab Visibility Rules
    function initNavigation() {
        const navProfiles = document.getElementById('nav-profiles');
        const navAdmin = document.getElementById('nav-admin');
        const isLoggedIn = !!window.userNameVal;

        if (navProfiles) {
            const hasProfileAccess = isLoggedIn && (window.userGroups.includes('users') || isLocal);
            navProfiles.style.display = hasProfileAccess ? 'inline-block' : 'none';
        }

        if (navAdmin) {
            const hasAdminAccess = isLoggedIn && (window.userGroups.includes('admins') || isLocal);
            navAdmin.style.display = hasAdminAccess ? 'inline-block' : 'none';
        }
    }

    // Dynamic Header Controls Injection
    function initHeaderActions() {
        const container = document.getElementById('auth-header-container');
        if (!container) return;

        const isLoggedIn = !!window.userNameVal;

        if (isLoggedIn) {
            // Render Profile Dropdown
            const initials = (window.displayNameVal || 'U').substring(0, 1).toUpperCase();
            const roleText = window.userRole === 'admin' ? 'Administrator' : 'Viewer';
            const roleBadgeClass = window.userRole === 'admin' ? 'badge-success' : 'badge-secondary';

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
        if (isLocal) {
            // Clear custom mock cookie values
            document.cookie = "hutta_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.replace('index.html');
        } else {
            // Show themed full-screen logout overlay
            const overlay = document.createElement('div');
            overlay.id = 'logout-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
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
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1.5rem;
                        text-align: center;
                    }
                    .logout-spinner-orb {
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--primary-glow, #0070f3), var(--secondary-glow, #ff0070));
                        box-shadow: 0 0 30px var(--primary-glow, #0070f3);
                        animation: logout-pulse 2s infinite ease-in-out, logout-rotate 4s infinite linear;
                    }
                    .logout-spinner-text {
                        color: var(--text-primary, #ffffff);
                        font-size: 1.1rem;
                        font-weight: 500;
                        letter-spacing: 0.5px;
                        margin: 0;
                        font-family: var(--font-heading), system-ui;
                    }
                    @keyframes logout-pulse {
                        0%, 100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 20px var(--primary-glow, #0070f3); }
                        50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 45px var(--secondary-glow, #ff0070); }
                    }
                    @keyframes logout-rotate {
                        100% { transform: rotate(360deg); }
                    }
                </style>
                <div class="logout-spinner-container">
                    <div class="logout-spinner-orb"></div>
                    <p class="logout-spinner-text">Logging out securely...</p>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Trigger transition
            setTimeout(() => { overlay.style.opacity = '1'; }, 50);
            
            // Clear custom application cookies
            const clearCookies = () => {
                const cookieNames = ['hutta_user', 'hutta_groups', 'hutta_auth', 'hutta_name', 'hutta_email'];
                cookieNames.forEach(name => {
                    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax`;
                    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
                });
            };
            clearCookies();

            // Perform logout sequentially via APIs in the background
            const performLogout = async () => {
                try {
                    await fetch('/authelia/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                } catch (e) { console.warn("Authelia API logout failed:", e); }

                try {
                    await fetch('/authelia/logout', { method: 'GET', credentials: 'same-origin' });
                } catch (e) { console.warn("Authelia page logout failed:", e); }

                try {
                    await fetch('/redirect_uri?logout=https%3A%2F%2Fhutta.in%2F', { method: 'GET', credentials: 'same-origin' });
                } catch (e) { console.warn("Apache OIDC logout failed:", e); }

                clearCookies();
                setTimeout(() => {
                    window.location.replace('index.html');
                }, 1000);
            };
            
            performLogout();
        }
    };

    // Activity Session Timer
    let idleTimer = null;
    let currentTimeoutMinutes = 15;

    async function initIdleTimer() {
        if (!window.userNameVal) return;

        // Fetch user timeout from API
        try {
            const response = await fetch(`${AUTHELIA_BACKEND_BASE}/gsma/rsp/v2/authelia/users/${encodeURIComponent(window.userNameVal)}`);
            if (response.ok) {
                const userObj = await response.json();
                if (userObj && userObj.inactivityTimeout) {
                    currentTimeoutMinutes = parseInt(userObj.inactivityTimeout);
                }
            }
        } catch (err) {
            console.warn("Could not retrieve custom inactivity timeout, using default 15m.", err);
        }

        const timeoutMs = currentTimeoutMinutes * 60 * 1000;
        console.log(`Inactivity auto-logout initialized for user: ${window.userNameVal} with duration: ${currentTimeoutMinutes} minutes (${timeoutMs} ms)`);

        function resetIdleTimer() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                console.log(`Idle session timeout of ${currentTimeoutMinutes} minutes reached. Initiating logout.`);
                window.logoutUser();
            }, timeoutMs);
        }

        // Event listeners for user interactions
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, resetIdleTimer, { passive: true });
        });

        // Initialize first timer
        resetIdleTimer();
    }

    function initThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
                setTheme(currentTheme === 'light' ? 'dark' : 'light');
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
