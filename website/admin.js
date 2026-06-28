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
            alert('Administrative permissions required');
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
            alert(`Failed to create user: ${err.message}`);
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
            alert('Administrative permissions required');
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
            alert(`Failed to update user: ${err.message}`);
        }
    });
}

window.deleteUser = async function(username) {
    if (window.userRole !== 'admin') {
        alert('Administrative permissions required');
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete the user account "${username}"?`)) {
        return;
    }

    addLogLine(`Requesting deletion of user "${username}"...`, "warning");

    try {
        const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/authelia/users/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        addLogLine(`Successfully deleted user "${username}"`, "success");
        await fetchUsers();
    } catch (err) {
        addLogLine(`Deletion failed for "${username}": ${err.message}`, "error");
        alert(`Failed to delete user: ${err.message}`);
    }
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
            document.cookie = "hutta_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax";
            document.cookie = "hutta_groups=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax";
            document.cookie = "hutta_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax";
            window.location.replace('/redirect_uri?logout=https%3A%2F%2Fhutta.in%2Fauthelia%2Flogout%3Frd%3Dhttps%253A%252F%252Fhutta.in%252F');
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
