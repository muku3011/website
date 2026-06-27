// -------------------------------------------------------------
// THEME MANAGER
// -------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Load persisted theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
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

// -------------------------------------------------------------
// CLOCK
// -------------------------------------------------------------
const clockElement = document.getElementById('clock');
function updateClock() {
    if (clockElement) {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString();
    }
}
setInterval(updateClock, 1000);
updateClock();

// -------------------------------------------------------------
// BACKEND CONFIGURATION
// -------------------------------------------------------------
const BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8092' 
    : '';

// -------------------------------------------------------------
// RSP CONSOLE LOGGING
// -------------------------------------------------------------
const rspConsole = document.getElementById('rsp-console');
const clearConsoleBtn = document.getElementById('clear-console-logs');

function addLogLine(text, type = 'info') {
    if (!rspConsole) return;
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    
    // Inline styling for log levels matching existing system colors
    if (type === 'success') {
        line.style.color = 'var(--success-glow)';
    } else if (type === 'error') {
        line.style.color = 'var(--warning-glow)';
    } else if (type === 'info') {
        line.style.color = 'var(--text-secondary)';
    } else if (type === 'code') {
        line.style.color = 'var(--primary-glow)';
        line.style.fontFamily = 'monospace';
        line.style.background = 'rgba(0,0,0,0.15)';
        line.style.padding = '0.2rem 0.4rem';
        line.style.borderRadius = '4px';
        line.style.wordBreak = 'break-all';
        line.style.marginTop = '0.2rem';
        line.style.marginBottom = '0.2rem';
    } else if (type === 'secondary') {
        line.style.color = 'var(--secondary-glow)';
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false });
    line.textContent = `[${timestamp}] ${text}`;
    
    // Animation
    line.style.opacity = '0';
    line.style.transform = 'translateY(5px)';
    line.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    
    rspConsole.appendChild(line);
    
    setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateY(0)';
    }, 15);

    rspConsole.scrollTop = rspConsole.scrollHeight;
}

if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', () => {
        rspConsole.innerHTML = '<div class="log-line info" style="color: var(--text-muted);">Console initialized. Ready for GSMA RSP operations.</div>';
    });
}

// -------------------------------------------------------------
// PROFILE REGISTRY MANAGEMENT
// -------------------------------------------------------------
let currentProfiles = [];

async function fetchProfiles() {
    const stateFilter = document.getElementById('state-filter').value;
    let url = `${BACKEND_BASE}/gsma/rsp/v2/admin/profiles`;
    if (stateFilter !== 'ALL') {
        url += `?state=${stateFilter}`;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        currentProfiles = await response.json();
        renderProfiles();
    } catch (err) {
        console.error("Failed to fetch profiles", err);
        addLogLine(`Failed to fetch profiles: ${err.message}`, "error");
        document.getElementById('profiles-list-body').innerHTML = `
            <tr>
                <td colspan="4" class="table-empty" style="color: var(--warning-glow);">Error connecting to SM-DP+ backend. Ensure server is running on 8092.</td>
            </tr>
        `;
    }
}

function renderProfiles() {
    const listBody = document.getElementById('profiles-list-body');
    const countVal = document.getElementById('profile-count-val');
    const searchInput = document.getElementById('search-input');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (!listBody) return;
    
    const filtered = currentProfiles.filter(p => {
        return !searchVal || 
            p.iccid.toLowerCase().includes(searchVal) || 
            (p.eid && p.eid.toLowerCase().includes(searchVal));
    });

    if (countVal) {
        countVal.textContent = filtered.length;
    }
    
    if (filtered.length === 0) {
        listBody.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">No profiles found.</td>
            </tr>
        `;
        return;
    }

    listBody.innerHTML = filtered.map(profile => {
        const stateClass = profile.state ? profile.state.toLowerCase() : 'available';
        
        let actionButton = '';
        if (profile.state === 'AVAILABLE') {
            actionButton = `<button class="btn btn-action-trigger btn-primary-action" onclick="openOrderModal('${profile.iccid}')">Order</button>`;
        } else if (profile.state === 'ORDERED') {
            actionButton = `<button class="btn btn-action-trigger btn-secondary-action" onclick="triggerRelease('${profile.iccid}')">Release</button>`;
        } else if (profile.state === 'RELEASED') {
            actionButton = `<button class="btn btn-action-trigger btn-success-action" onclick="triggerLpaDownload('${profile.iccid}')">Download (LPA)</button>`;
        } else if (profile.state === 'DOWNLOADED') {
            actionButton = `
                <span style="font-size: 0.85rem; color: var(--success-glow); font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Completed
                </span>`;
        }

        const deleteDisabled = (window.userRole === 'viewer') ? 'disabled' : '';

        return `
            <tr>
                <td class="code-text-mono">${profile.iccid}</td>
                <td class="code-text-mono">${profile.eid || '<span style="color: var(--text-muted);">--</span>'}</td>
                <td><span class="status-pill ${stateClass}">${profile.state}</span></td>
                <td>
                    <div class="btn-actions">
                        ${actionButton}
                        <button class="btn btn-action-trigger btn-delete" onclick="deleteProfile('${profile.iccid}')" ${deleteDisabled}>Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Attach event listeners for search and filters
const searchInput = document.getElementById('search-input');
const stateFilter = document.getElementById('state-filter');

if (searchInput) {
    searchInput.addEventListener('input', renderProfiles);
}
if (stateFilter) {
    stateFilter.addEventListener('change', fetchProfiles);
}

// -------------------------------------------------------------
// PROFILE IMPORT & DROPZONE
// -------------------------------------------------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('profile-file-input');
const overrideIccidInput = document.getElementById('override-iccid');
const btnImport = document.getElementById('btn-import-profile');
let selectedFile = null;

if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            selectedFile = e.dataTransfer.files[0];
            updateDropzoneUI();
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            selectedFile = fileInput.files[0];
            updateDropzoneUI();
        }
    });
}

function updateDropzoneUI() {
    if (selectedFile && dropzone) {
        dropzone.querySelector('.dropzone-text').textContent = `Selected: ${selectedFile.name}`;
        dropzone.querySelector('.dropzone-subtext').textContent = `Size: ${(selectedFile.size / 1024).toFixed(2)} KB`;
    }
}

if (btnImport) {
    btnImport.addEventListener('click', async () => {
        if (!selectedFile) {
            addLogLine("Error: Please select a file to import first", "error");
            return;
        }

        btnImport.disabled = true;
        const originalText = btnImport.innerHTML;
        btnImport.innerHTML = 'Importing...';

        addLogLine(`Uploading profile file: ${selectedFile.name}...`, "info");

        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const overrideIccid = overrideIccidInput.value.trim();
        if (overrideIccid) {
            formData.append('iccid', overrideIccid);
        }

        try {
            const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/admin/importProfile`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}`);
            }

            addLogLine(`Profile imported successfully!`, "success");
            
            // Reset state
            selectedFile = null;
            fileInput.value = '';
            overrideIccidInput.value = '';
            if (dropzone) {
                dropzone.querySelector('.dropzone-text').textContent = 'Drag & drop profile file or click to browse';
                dropzone.querySelector('.dropzone-subtext').textContent = 'Supports .der, .bin, or base64 files';
            }

            fetchProfiles();
        } catch (err) {
            console.error("Import failed", err);
            addLogLine(`Import failed: ${err.message}`, "error");
        } finally {
            btnImport.disabled = false;
            btnImport.innerHTML = originalText;
        }
    });
}

// -------------------------------------------------------------
// PROFILE OPERATIONS IMPLEMENTATION
// -------------------------------------------------------------

// 1. Delete Profile
async function deleteProfile(iccid) {
    if (!confirm(`Are you sure you want to delete profile with ICCID ${iccid}?`)) {
        return;
    }

    addLogLine(`Sending delete request for profile ${iccid}...`, "info");
    
    try {
        const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/admin/profiles/${iccid}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        addLogLine(`Profile ${iccid} deleted successfully.`, "success");
        fetchProfiles();
    } catch (err) {
        console.error("Delete failed", err);
        addLogLine(`Delete failed: ${err.message}`, "error");
    }
}

// 2. Order Profile Modal
const orderDialog = document.getElementById('dialog-order');
const orderForm = document.getElementById('order-form');

function openOrderModal(iccid) {
    if (window.userRole === 'viewer') return;
    document.getElementById('order-iccid').value = iccid;
    if (orderDialog) {
        orderDialog.showModal();
    }
}

if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (orderDialog) {
            orderDialog.close();
        }

        const iccid = document.getElementById('order-iccid').value;
        const eid = document.getElementById('order-eid').value.trim();
        const profileType = document.getElementById('order-profile-type').value.trim();
        const requester = document.getElementById('order-requester').value.trim();
        const callId = document.getElementById('order-callid').value.trim();

        addLogLine(`Submitting downloadOrder to ES2+ interface for ICCID ${iccid}...`, "info");

        const payload = {
            header: {
                functionRequesterIdentifier: requester,
                functionCallIdentifier: callId
            },
            eid: eid,
            iccid: iccid,
            profileType: profileType
        };

        try {
            const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/es2plus/downloadOrder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Protocol': 'gsma/rsp/v3.1.0'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                const reason = (data.header && data.header.functionExecutionStatus) 
                    ? data.header.functionExecutionStatus.statusMessage 
                    : `HTTP ${response.status}`;
                throw new Error(reason);
            }

            addLogLine(`ES2+ downloadOrder Success! Profile has been reserved.`, "success");
            fetchProfiles();
        } catch (err) {
            console.error("Order failed", err);
            addLogLine(`Order failed: ${err.message}`, "error");
        }
    });
}

// 3. Release Profile
async function triggerRelease(iccid) {
    addLogLine(`Submitting releaseProfile to ES2+ interface for ICCID ${iccid}...`, "info");

    const payload = {
        header: {
            functionRequesterIdentifier: "OperatorX",
            functionCallIdentifier: "TX-101"
        },
        iccid: iccid
    };

    try {
        const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/es2plus/releaseProfile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Protocol': 'gsma/rsp/v3.1.0'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            const reason = (data.header && data.header.functionExecutionStatus) 
                ? data.header.functionExecutionStatus.statusMessage 
                : `HTTP ${response.status}`;
            throw new Error(reason);
        }

        addLogLine(`ES2+ releaseProfile Success! Profile released for download.`, "success");
        fetchProfiles();
    } catch (err) {
        console.error("Release failed", err);
        addLogLine(`Release failed: ${err.message}`, "error");
    }
}

// 4. LPA Download Flow (ES9+)
async function triggerLpaDownload(iccid) {
    addLogLine(`Starting client LPA profile provisioning sequence for ICCID ${iccid}...`, "secondary");

    try {
        // Step A: Initiate Authentication
        addLogLine("ES9+ initiateAuthentication: Requesting challenge signature from SM-DP+...", "info");
        const initPayload = {
            euiccChallenge: "11223344556677889900AABBCCDDEEFF",
            smdpAddress: "localhost:8092",
            euiccInfo1: "MOCK_EUICC_INFO_1"
        };

        const initRes = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/es9plus/initiateAuthentication`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Protocol': 'gsma/rsp/v3.1.0'
            },
            body: JSON.stringify(initPayload)
        });

        if (!initRes.ok) {
            throw new Error(`initiateAuthentication failed (HTTP ${initRes.status})`);
        }

        const initData = await initRes.json();
        const txId = initData.transactionId;
        addLogLine(`SM-DP+ Response: Received transactionId: ${txId}`, "success");
        addLogLine(`smdpSignature2 generated: ${initData.smdpSignature2.substring(0, 32)}...`, "code");

        // Step B: Authenticate Client
        addLogLine("ES9+ authenticateClient: Verifying client eUICC security signature...", "info");
        const authPayload = {
            transactionId: txId,
            authenticateServerResponse: "MOCK_EUICC_AUTHENTICATE_RESPONSE_SIGNATURE"
        };

        const authRes = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/es9plus/authenticateClient`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Protocol': 'gsma/rsp/v3.1.0'
            },
            body: JSON.stringify(authPayload)
        });

        if (!authRes.ok) {
            throw new Error(`authenticateClient failed (HTTP ${authRes.status})`);
        }

        const authData = await authRes.json();
        addLogLine(`SM-DP+ Response: Client eUICC authenticated successfully!`, "success");
        addLogLine(`smdpSignature3 generated: ${authData.smdpSignature3.substring(0, 32)}...`, "code");

        // Step C: Get Bound Profile Package (BPP)
        addLogLine("ES9+ getBoundProfilePackage: Retrieving encrypted eSIM BPP payload...", "info");
        const bppPayload = {
            transactionId: txId,
            prepareDownloadResponse: "MOCK_EUICC_PREPARE_DOWNLOAD_RESPONSE"
        };

        const bppRes = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/es9plus/getBoundProfilePackage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Protocol': 'gsma/rsp/v3.1.0'
            },
            body: JSON.stringify(bppPayload)
        });

        if (!bppRes.ok) {
            throw new Error(`getBoundProfilePackage failed (HTTP ${bppRes.status})`);
        }

        const bppData = await bppRes.json();
        addLogLine(`SM-DP+ Response: Bound Profile Package generated!`, "success");
        addLogLine(`Bound Profile Package (Base64): ${bppData.boundProfilePackage.substring(0, 50)}...`, "code");
        
        addLogLine(`LPA Provisioning Complete! Profile state updated to DOWNLOADED.`, "success");
        fetchProfiles();
    } catch (err) {
        console.error("LPA flow failed", err);
        addLogLine(`LPA download failed: ${err.message}`, "error");
    }
}

// Expose functions globally for table event handlers
window.openOrderModal = openOrderModal;
window.triggerRelease = triggerRelease;
window.triggerLpaDownload = triggerLpaDownload;
window.deleteProfile = deleteProfile;

// -------------------------------------------------------------
// ACCESSIBLE MODAL CLOSE LOGIC
// -------------------------------------------------------------
const closeButtons = document.querySelectorAll('.close-dialog-btn');
const dialogs = document.querySelectorAll('dialog');

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const dialogId = btn.getAttribute('data-close') || btn.closest('dialog').id;
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.close();
        }
    });
});

dialogs.forEach(dialog => {
    dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
        if (!isInDialog) {
            dialog.close();
        }
    });
});

// -------------------------------------------------------------
// AUTHORIZATION & LOGOUT HANDLER
// -------------------------------------------------------------
const roleBadge = document.getElementById('role-badge');
const logoutBtn = document.getElementById('logout-btn');

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// Determine auth/role
window.userRole = 'viewer';
let displayName = '';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
            
            // Disable all admin-only buttons & dropzones
            document.querySelectorAll('.btn-delete, .btn-primary-action, .btn-secondary-action, .btn-success-action, #btn-import-profile').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Actions restricted to Administrator';
            });

            if (dropzone) {
                dropzone.style.opacity = '0.4';
                dropzone.style.cursor = 'not-allowed';
                dropzone.title = 'Imports restricted to Administrator';
                // Remove click listener
                const clone = dropzone.cloneNode(true);
                dropzone.parentNode.replaceChild(clone, dropzone);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    enforceRolePermissions();
    fetchProfiles();
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (isLocal) {
            window.location.replace('index.html');
        } else {
            try {
                await fetch('/redirect_uri?logout=https%3A%2F%2Fhutta.in%2F');
            } catch (err) {
                console.warn("Apache logout failed:", err);
            }
            try {
                await fetch('/authelia/api/logout', { method: 'POST' });
            } catch (err) {
                console.warn("Authelia logout failed:", err);
            }
            window.location.replace('https://hutta.in/');
        }
    });
}
