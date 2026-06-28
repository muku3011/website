// -------------------------------------------------------------
// PREMIUM DIALOG & NOTIFICATION UTILITIES
// -------------------------------------------------------------
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close" aria-label="Close notification">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    container.appendChild(toast);

    const removeTimer = setTimeout(() => {
        dismissToast(toast);
    }, duration);

    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        clearTimeout(removeTimer);
        dismissToast(toast);
    });

    toast.addEventListener('click', () => {
        clearTimeout(removeTimer);
        dismissToast(toast);
    });
}

function dismissToast(toast) {
    toast.classList.add('toast-hide');
    toast.addEventListener('transitionend', () => {
        toast.remove();
    });
}

function showConfirm(title, message, onConfirm) {
    let dialog = document.getElementById('dialog-confirm-action');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'dialog-confirm-action';
        dialog.className = 'modal-dialog';
        document.body.appendChild(dialog);
        
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                dialog.close();
            }
        });
    }
    
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3>${escapeHtml(title)}</h3>
            <button class="btn-icon close-dialog-btn" aria-label="Close dialog" onclick="this.closest('dialog').close()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="dialog-body">
            <p>${escapeHtml(message)}</p>
            <div class="dialog-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary close-dialog-btn" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirm-action-btn">Confirm</button>
            </div>
        </div>
    `;
    
    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
    
    const confirmBtn = dialog.querySelector('#confirm-action-btn');
    confirmBtn.addEventListener('click', () => {
        dialog.close();
        onConfirm();
    });
    
    dialog.showModal();
}

function showPrompt(title, message, defaultValue, onSubmit) {
    let dialog = document.getElementById('dialog-prompt-action');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'dialog-prompt-action';
        dialog.className = 'modal-dialog';
        document.body.appendChild(dialog);
        
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                dialog.close();
            }
        });
    }
    
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3>${escapeHtml(title)}</h3>
            <button class="btn-icon close-dialog-btn" aria-label="Close dialog" onclick="this.closest('dialog').close()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="dialog-body">
            <form id="prompt-action-form" class="dialog-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                <p style="margin-bottom: 0.5rem;">${escapeHtml(message)}</p>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <input type="text" id="prompt-action-input" value="${escapeHtml(defaultValue)}" required class="form-input" style="width: 100%;">
                </div>
                <div class="dialog-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button type="button" class="btn btn-secondary close-dialog-btn" onclick="this.closest('dialog').close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit</button>
                </div>
            </form>
        </div>
    `;
    
    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
    
    const form = dialog.querySelector('#prompt-action-form');
    const input = dialog.querySelector('#prompt-action-input');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        dialog.close();
        onSubmit(input.value);
    });
    
    dialog.showModal();
    input.focus();
    input.select();
}

// -------------------------------------------------------------
// LOCAL / SYSTEM CONFIGURATION & COOKIES
// -------------------------------------------------------------
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_BASE = isLocal ? 'http://localhost:8092' : '';

// Helper to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// -------------------------------------------------------------
// THEME MANAGER
// -------------------------------------------------------------
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
    }
    localStorage.setItem('theme', theme);
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
}
initTheme();

// -------------------------------------------------------------
// ROLE MANAGEMENT
// -------------------------------------------------------------
window.userRole = 'viewer';
let displayName = '';

if (isLocal) {
    window.userRole = 'admin';
    displayName = 'Local Dev';
} else {
    const username = getCookie('hutta_user');
    const groups = getCookie('hutta_groups') || '';
    const isAdmin = groups.split(',').includes('admins');
    window.userRole = isAdmin ? 'admin' : 'viewer';
    displayName = username || 'Viewer';
}

const roleBadge = document.getElementById('role-badge');
function enforceRolePermissions() {
    if (roleBadge) {
        roleBadge.style.display = 'inline-block';
        if (window.userRole === 'admin') {
            roleBadge.textContent = `Admin: ${displayName}`;
            roleBadge.style.background = 'hsla(145, 80%, 50%, 0.15)';
            roleBadge.style.color = 'var(--success-glow)';
            roleBadge.style.border = '1px solid hsla(145, 80%, 50%, 0.3)';
        } else {
            roleBadge.textContent = `Viewer: ${displayName}`;
            roleBadge.style.background = 'hsla(14, 90%, 60%, 0.15)';
            roleBadge.style.color = 'var(--warning-glow)';
            roleBadge.style.border = '1px solid hsla(14, 90%, 60%, 0.3)';
            
            // Restrict admin features
            document.querySelectorAll('#btn-create-user, .btn-delete, .btn-primary-action').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Administrative access required';
            });
            const createForm = document.getElementById('create-user-form');
            if (createForm) {
                createForm.style.opacity = '0.5';
                createForm.querySelectorAll('input').forEach(i => i.disabled = true);
            }
        }
    }
}

// -------------------------------------------------------------
// AUDIT CONSOLE LOGGING
// -------------------------------------------------------------
const auditConsole = document.getElementById('audit-console');
const clearConsoleBtn = document.getElementById('clear-console-logs');

function addLogLine(message, type = 'info') {
    if (!auditConsole) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    
    let color = 'var(--text-secondary)';
    if (type === 'success') color = 'var(--success-glow)';
    if (type === 'warning') color = 'var(--warning-glow)';
    if (type === 'error') color = '#ff5555';
    
    line.style.color = color;
    line.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    line.style.padding = '0.2rem 0';
    
    line.innerHTML = `<span style="color: var(--text-muted); margin-right: 0.5rem;">[${timeStr}]</span> ${message}`;
    auditConsole.appendChild(line);
    auditConsole.scrollTop = auditConsole.scrollHeight;
}

if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', () => {
        if (auditConsole) {
            auditConsole.innerHTML = '<div class="log-line info" style="color: var(--text-muted);">Console cleared. Monitoring account activities.</div>';
        }
    });
}

// -------------------------------------------------------------
// USER API CRUD OPERATIONS
// -------------------------------------------------------------
let currentUsers = [];

async function fetchUsers() {
    try {
        const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/authelia/users`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        currentUsers = await response.json();
        renderUsers();
    } catch (err) {
        console.error("Failed to fetch users", err);
        addLogLine(`Failed to query user directory: ${err.message}`, "error");
        document.getElementById('users-list-body').innerHTML = `
            <tr>
                <td colspan="5" class="table-empty" style="color: var(--warning-glow);">Error connecting to user API. Ensure server is running on 8092.</td>
            </tr>
        `;
    }
}

function renderUsers() {
    const listBody = document.getElementById('users-list-body');
    const countVal = document.getElementById('user-count-val');
    const searchInput = document.getElementById('search-input');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const groupFilter = document.getElementById('group-filter');
    const groupVal = groupFilter ? groupFilter.value : 'ALL';
    
    if (!listBody) return;
    
    const filtered = currentUsers.filter(u => {
        const matchesSearch = !searchVal || 
            u.username.toLowerCase().includes(searchVal) || 
            u.displayname.toLowerCase().includes(searchVal) || 
            u.email.toLowerCase().includes(searchVal);
            
        const matchesGroup = groupVal === 'ALL' || u.groups.includes(groupVal);
        
        return matchesSearch && matchesGroup;
    });

    if (countVal) {
        countVal.textContent = filtered.length;
    }
    
    if (filtered.length === 0) {
        listBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">No accounts found.</td>
            </tr>
        `;
        return;
    }

    listBody.innerHTML = filtered.map(user => {
        const groupPills = user.groups.map(g => {
            const cls = g === 'admins' ? 'success' : 'available';
            return `<span class="status-pill ${cls}" style="font-size:0.75rem; margin-right:0.25rem;">${g}</span>`;
        }).join('');

        const isViewer = window.userRole === 'viewer';
        const actionsDisabled = isViewer ? 'disabled' : '';

        return `
            <tr>
                <td class="code-text-mono" style="font-weight:600;">${user.username}</td>
                <td>${user.displayname}</td>
                <td>${user.email}</td>
                <td><div style="display:flex; flex-wrap:wrap; gap:0.25rem;">${groupPills}</div></td>
                <td>
                    <div class="btn-actions">
                        <button class="btn btn-action-trigger btn-secondary-action" onclick="openEditUserModal('${user.username}', '${user.displayname}', '${user.email}', '${user.groups.join(',')}')" ${actionsDisabled}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                        </button>
                        <button class="btn btn-action-trigger btn-delete" onclick="deleteUser('${user.username}')" ${actionsDisabled}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------
// EVENT HANDLERS: CREATE / EDIT / DELETE
// -------------------------------------------------------------

// Create User Form Submit
const createUserForm = document.getElementById('create-user-form');
if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (window.userRole !== 'admin') {
            showToast('Administrative permissions required', 'error');
            return;
        }

        const username = document.getElementById('create-username').value.trim().toLowerCase();
        const displayname = document.getElementById('create-displayname').value.trim();
        const email = document.getElementById('create-email').value.trim();
        const password = document.getElementById('create-password').value;
        
        const groupElements = document.getElementsByName('create-groups');
        const groups = [];
        groupElements.forEach(el => {
            if (el.checked) groups.push(el.value);
        });

        addLogLine(`Initiating user creation: "${username}"...`, "info");

        try {
            const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/authelia/users?username=${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayname, email, password, groups })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

            addLogLine(`Successfully created user "${username}" (${displayname})`, "success");
            createUserForm.reset();
            
            // Set users checkbox default back
            document.querySelectorAll('input[name="create-groups"]').forEach(el => {
                if (el.value === 'users') el.checked = true;
                if (el.value === 'admins') el.checked = false;
            });

            await fetchUsers();
        } catch (err) {
            addLogLine(`Creation failed for "${username}": ${err.message}`, "error");
            showToast(`Failed to create user: ${err.message}`, 'error');
        }
    });
}

// Global functions for dialog handling and deletion (must be on window object)
window.openEditUserModal = function(username, displayname, email, groupsStr) {
    const dialog = document.getElementById('dialog-edit-user');
    const groups = groupsStr.split(',');
    
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-user-title-name').textContent = username;
    document.getElementById('edit-displayname').value = displayname;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-password').value = ''; // Reset password field
    
    document.getElementById('edit-group-users').checked = groups.includes('users');
    document.getElementById('edit-group-admins').checked = groups.includes('admins');
    
    if (dialog) {
        dialog.showModal();
    }
};

const editUserForm = document.getElementById('edit-user-form');
if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (window.userRole !== 'admin') {
            showToast('Administrative permissions required', 'error');
            return;
        }

        const username = document.getElementById('edit-username').value;
        const displayname = document.getElementById('edit-displayname').value.trim();
        const email = document.getElementById('edit-email').value.trim();
        const password = document.getElementById('edit-password').value;
        
        const groupElements = document.getElementsByName('edit-groups');
        const groups = [];
        groupElements.forEach(el => {
            if (el.checked) groups.push(el.value);
        });

        addLogLine(`Updating properties for "${username}"...`, "info");

        try {
            const bodyPayload = { displayname, email, groups };
            if (password.trim() !== '') {
                bodyPayload.password = password;
            }

            const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/authelia/users/${encodeURIComponent(username)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

            addLogLine(`Successfully updated user "${username}"`, "success");
            
            const dialog = document.getElementById('dialog-edit-user');
            if (dialog) dialog.close();
            
            await fetchUsers();
        } catch (err) {
            addLogLine(`Update failed for "${username}": ${err.message}`, "error");
            showToast(`Failed to update user: ${err.message}`, 'error');
        }
    });
}

window.deleteUser = async function(username) {
    if (window.userRole !== 'admin') {
        showToast('Administrative permissions required', 'error');
        return;
    }

    showConfirm(
        "Delete User Account",
        `Are you sure you want to permanently delete the user account "${username}"?`,
        async () => {
            addLogLine(`Requesting deletion of user "${username}"...`, "warning");

            try {
                const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/authelia/users/${encodeURIComponent(username)}`, {
                    method: 'DELETE'
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

                addLogLine(`Successfully deleted user "${username}"`, "success");
                showToast(`User account "${username}" deleted successfully.`, "success");
                await fetchUsers();
            } catch (err) {
                addLogLine(`Deletion failed for "${username}": ${err.message}`, "error");
                showToast(`Failed to delete user: ${err.message}`, "error");
            }
        }
    );
};

// -------------------------------------------------------------
// FILTERING AND SEARCHING EVENT LISTENERS
// -------------------------------------------------------------
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', renderUsers);
}

const groupFilter = document.getElementById('group-filter');
if (groupFilter) {
    groupFilter.addEventListener('change', renderUsers);
}

// -------------------------------------------------------------
// GENERAL DIALOG CLOSING
// -------------------------------------------------------------
document.querySelectorAll('.close-dialog-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close');
        const dialog = document.getElementById(targetId);
        if (dialog) dialog.close();
    });
});

// Close dialog when clicking on backdrop
document.querySelectorAll('.modal-dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
          && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!isInDialog) {
            dialog.close();
        }
    });
});

// -------------------------------------------------------------
// LOGOUT BUTTON
// -------------------------------------------------------------
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (isLocal) {
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
                background: rgba(10, 10, 12, 0.9);
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
                const cookieNames = ['hutta_user', 'hutta_groups', 'hutta_auth'];
                cookieNames.forEach(name => {
                    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax`;
                    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
                });
            };
            clearCookies();

            // Perform logout in hidden iframe to allow React execution of Authelia SPA
            const logoutUrl = '/redirect_uri?logout=https%3A%2F%2Fhutta.in%2Fauthelia%2Flogout%3Frd%3Dhttps%253A%252F%252Fhutta.in%252F';
            
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            
            let completed = false;
            const finishLogout = () => {
                if (completed) return;
                completed = true;
                clearCookies();
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
                setTimeout(() => {
                    window.location.replace('index.html');
                }, 800); // Small delay to let the animation feel smooth
            };
            
            // Set 5-second hard timeout
            const timeoutId = setTimeout(finishLogout, 5000);
            
            iframe.addEventListener('load', () => {
                try {
                    const currentPath = iframe.contentWindow.location.pathname;
                    // If we navigated away from authelia/logout and back to hutta.in root page
                    if (currentPath === '/' || currentPath === '/index.html') {
                        clearTimeout(timeoutId);
                        finishLogout();
                    }
                } catch (e) {
                    // Cross-origin fallback just in case
                    console.log("Iframe load event cross-origin check:", e);
                }
            });
            
            iframe.src = logoutUrl;
            document.body.appendChild(iframe);
        }
    });
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    enforceRolePermissions();
    fetchUsers();
});
