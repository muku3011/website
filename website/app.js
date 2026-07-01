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

function showConfirm(title, message, onConfirm, onCancel) {
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
    
    let isConfirmed = false;
    const handleClose = () => {
        dialog.removeEventListener('close', handleClose);
        if (!isConfirmed && typeof onCancel === 'function') {
            onCancel();
        }
    };
    dialog.addEventListener('close', handleClose);
    
    const confirmBtn = dialog.querySelector('#confirm-action-btn');
    confirmBtn.addEventListener('click', () => {
        isConfirmed = true;
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
                <td colspan="5" class="table-empty" style="color: var(--warning-glow);">Error connecting to SM-DP+ backend. Ensure server is running on 8092.</td>
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
                <td colspan="5" class="table-empty">No profiles found.</td>
            </tr>
        `;
        return;
    }

    listBody.innerHTML = filtered.map(profile => {
        const stateClass = profile.state ? profile.state.toLowerCase() : 'available';
        const networkBadge = profile.networkType === '5G'
            ? `<span class="badge-5g">5G</span>`
            : `<span class="badge-4g">4G</span>`;
        
        let actionButton = '';
        if (profile.state === 'AVAILABLE') {
            actionButton = `
                <button class="btn btn-action-trigger btn-primary-action" onclick="openOrderModal('${profile.iccid}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Order
                </button>`;
        } else if (profile.state === 'ORDERED') {
            actionButton = `
                <button class="btn btn-action-trigger btn-secondary-action" onclick="triggerRelease('${profile.iccid}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Release
                </button>`;
        } else if (profile.state === 'RELEASED') {
            actionButton = `
                <button class="btn btn-action-trigger btn-success-action" onclick="triggerLpaDownload('${profile.iccid}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download (LPA)
                </button>`;
        } else if (profile.state === 'DOWNLOADED') {
            actionButton = `
                <span style="font-size: 0.85rem; color: var(--success-glow); font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Completed
                </span>`;
        }

        const deleteDisabled = (window.userRole === 'viewer') ? 'disabled' : '';

        return `
            <tr onclick="selectProfileForActivation('${profile.iccid}')" style="cursor: pointer;">
                <td class="code-text-mono">${profile.iccid}</td>
                <td class="col-mobile-hide">${networkBadge}</td>
                <td class="code-text-mono col-mobile-hide">${profile.eid || '<span style="color: var(--text-muted);">--</span>'}</td>
                <td><span class="status-pill ${stateClass}">${profile.state}</span></td>
                <td>
                    <div class="btn-actions">
                        ${actionButton}
                        <button class="btn btn-action-trigger btn-delete" onclick="deleteProfile('${profile.iccid}'); event.stopPropagation();" ${deleteDisabled}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Update activation QR code / info
    updateActivationDetails();
}

window.selectedIccid = null;

window.selectProfileForActivation = function(iccid) {
    window.selectedIccid = iccid;
    updateActivationDetails();
};

function updateLpaSimulatorVisibility(acString, isDownloadable) {
    const acTextarea = document.getElementById('lpa-sim-ac-text');
    const downloadBtn = document.getElementById('lpa-sim-btn-download');
    
    if (acTextarea) {
        acTextarea.value = acString || '';
    }
    
    if (downloadBtn) {
        downloadBtn.disabled = !isDownloadable;
    }
}

window.updateActivationDetails = function() {
    const scenario = document.getElementById('ac-scenario')?.value || 'standard';
    const qrImg = document.getElementById('activation-qr');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const codeText = document.getElementById('activation-code-text');
    
    if (!window.selectedIccid) {
        if (currentProfiles && currentProfiles.length > 0) {
            window.selectedIccid = currentProfiles[0].iccid;
        }
    }
    
    const selectedProfile = currentProfiles.find(p => p.iccid === window.selectedIccid);
    
    if (!selectedProfile) {
        if (qrImg) qrImg.style.display = 'none';
        if (qrPlaceholder) {
            qrPlaceholder.style.display = 'block';
            qrPlaceholder.innerHTML = 'Select a profile to generate QR Code';
        }
        if (codeText) codeText.value = '';
        document.querySelectorAll('.activation-body .form-group').forEach(el => el.style.display = 'none');
        updateLpaSimulatorVisibility('', false);
        return;
    }
    
    // Highlight the row in the table
    document.querySelectorAll('.profiles-table tbody tr').forEach(row => {
        row.classList.remove('selected-row');
        const cell = row.querySelector('td');
        if (cell && cell.textContent.trim() === window.selectedIccid) {
            row.classList.add('selected-row');
        }
    });

    if (selectedProfile.state !== 'RELEASED') {
        // Hide QR code and form inputs, show placeholder explaining current status
        if (qrImg) qrImg.style.display = 'none';
        if (qrPlaceholder) {
            qrPlaceholder.style.display = 'block';
            qrPlaceholder.innerHTML = `
                <div style="text-align: center; padding: 1.5rem 1rem; color: var(--warning-glow);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 0.5rem; opacity: 0.8;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.25rem;">Activation Unavailable</p>
                    <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">Profile is currently <strong>${selectedProfile.state}</strong>.<br>Please place an order and release the profile to enable LPA download.</p>
                </div>
            `;
            const qrContainer = document.getElementById('qr-container');
            if (qrContainer) {
                qrContainer.style.width = '100%';
                qrContainer.style.height = 'auto';
                qrContainer.style.background = 'transparent';
                qrContainer.style.border = 'none';
            }
        }
        if (codeText) codeText.value = '';
        document.querySelectorAll('.activation-body .form-group').forEach(el => el.style.display = 'none');
        updateLpaSimulatorVisibility('', false);
        return;
    }
    
    // Profile is RELEASED: show QR code and form inputs
    const qrContainer = document.getElementById('qr-container');
    if (qrContainer) {
        qrContainer.style.width = '140px';
        qrContainer.style.height = '140px';
        qrContainer.style.background = 'white';
        qrContainer.style.border = '1px solid var(--card-border)';
    }
    document.querySelectorAll('.activation-body .form-group').forEach(el => el.style.display = 'block');

    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'localhost:8092' 
        : 'hutta.in';
        
    let acString = '';
    if (scenario === 'standard') {
        acString = `LPA:1$${host}$${window.selectedIccid}`;
    } else if (scenario === 'push') {
        acString = `LPA:1$${host}$`;
    } else if (scenario === 'confirm') {
        acString = `LPA:1$${host}$${window.selectedIccid}$1`;
    }
    
    if (codeText) codeText.value = acString;
    
    if (qrImg && qrPlaceholder) {
        qrPlaceholder.style.display = 'none';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(acString)}`;
        qrImg.style.display = 'block';
    }
    updateLpaSimulatorVisibility(acString, true);
};

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
    showConfirm(
        "Delete Profile",
        `Are you sure you want to permanently delete profile with ICCID ${iccid}?`,
        async () => {
            addLogLine(`Sending delete request for profile ${iccid}...`, "info");
            
            try {
                const response = await fetch(`${BACKEND_BASE}/gsma/rsp/v2/admin/profiles/${iccid}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }

                addLogLine(`Profile ${iccid} deleted successfully.`, "success");
                showToast("Profile deleted successfully.", "success");
                fetchProfiles();
            } catch (err) {
                console.error("Delete failed", err);
                addLogLine(`Delete failed: ${err.message}`, "error");
                showToast(`Delete failed: ${err.message}`, "error");
            }
        }
    );
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
    if (typeof selectProfileForActivation === 'function') {
        selectProfileForActivation(iccid);
    } else if (typeof window.selectProfileForActivation === 'function') {
        window.selectProfileForActivation(iccid);
    }
    
    // Expand the LPA Simulator window
    const minimizedBtn = document.getElementById('lpa-sim-minimized');
    const expandedWindow = document.getElementById('lpa-sim-expanded');
    if (minimizedBtn && expandedWindow) {
        minimizedBtn.style.display = 'none';
        expandedWindow.style.display = 'flex';
        
        // Select the Download tab by default
        const downloadTabBtn = document.querySelector('.lpa-tab-btn[data-tab="lpa-tab-download"]');
        if (downloadTabBtn) {
            downloadTabBtn.click();
        }
        
        // Clear and add log
        const logsArea = document.getElementById('lpa-sim-logs');
        if (logsArea) logsArea.innerHTML = '';
        addLpaLog(`Selected profile ICCID ${iccid} for download simulation.`, 'info');
        addLpaLog('Click "Download Profile" to start the download protocol.', 'process');
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
// -------------------------------------------------------------
// AUTHORIZATION & PERMISSIONS
// -------------------------------------------------------------
function enforceRolePermissions() {
    if (window.userRole !== 'admin') {
        // Disable all admin-only buttons & dropzones
        document.querySelectorAll('.btn-delete, .btn-primary-action, .btn-secondary-action, .btn-success-action, #btn-import-profile').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Actions restricted to Administrator';
        });

        if (typeof dropzone !== 'undefined' && dropzone) {
            dropzone.style.opacity = '0.4';
            dropzone.style.cursor = 'not-allowed';
            dropzone.title = 'Imports restricted to Administrator';
            // Remove click listener
            const clone = dropzone.cloneNode(true);
            dropzone.parentNode.replaceChild(clone, dropzone);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    enforceRolePermissions();
    fetchProfiles();

    const acScenario = document.getElementById('ac-scenario');
    if (acScenario) {
        acScenario.addEventListener('change', window.updateActivationDetails);
    }
    
    const btnCopyAc = document.getElementById('btn-copy-ac');
    if (btnCopyAc) {
        btnCopyAc.addEventListener('click', () => {
            const codeText = document.getElementById('activation-code-text');
            if (codeText && codeText.value) {
                navigator.clipboard.writeText(codeText.value);
                addLogLine(`Copied activation code to clipboard: ${codeText.value}`, "info");
                showToast("Copied!", "Activation code copied to clipboard.", "success");
            }
        });
    }

    // Header scroll threshold effect
    const header = document.querySelector('.app-header');
    if (header) {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    }

    // Command-K / Ctrl-K keyboard shortcut to focus search input
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        }
    });

    // Initialize LPA Simulator floating window controls
    initLpaSimulator();
});

// -------------------------------------------------------------
// LPA SIMULATOR FLOATING WINDOW LOGIC
// -------------------------------------------------------------
const LPA_SIMULATOR_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8093' 
    : '';

function addLpaLog(text, type = 'info') {
    const logsArea = document.getElementById('lpa-sim-logs');
    if (!logsArea) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    logsArea.appendChild(entry);
    logsArea.scrollTop = logsArea.scrollHeight;
}

function updateLpaStatusBadge(status, className) {
    const badge = document.getElementById('lpa-status-badge');
    if (!badge) return;
    badge.textContent = status;
    badge.className = `lpa-status-badge ${className}`;
}

function initLpaSimulator() {
    const minimizedBtn = document.getElementById('lpa-sim-minimized');
    const expandedWindow = document.getElementById('lpa-sim-expanded');
    const minimizeBtn = document.getElementById('lpa-sim-btn-minimize');
    const clearLogsBtn = document.getElementById('lpa-sim-clear-logs');
    const downloadBtn = document.getElementById('lpa-sim-btn-download');

    // Update iPhone time dynamically
    const updateIphoneTime = () => {
        const timeEl = document.querySelector('.iphone-time');
        if (timeEl) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeEl.textContent = `${hours}:${minutes}`;
        }
    };
    updateIphoneTime();
    setInterval(updateIphoneTime, 60000);

    if (minimizedBtn && expandedWindow) {
        minimizedBtn.addEventListener('click', () => {
            minimizedBtn.style.display = 'none';
            expandedWindow.style.display = 'flex';
        });
    }

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.lpa-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.lpa-tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab)?.classList.add('active');
            
            if (targetTab === 'lpa-tab-device') {
                fetchLpaProfiles();
            }
        });
    });

    if (minimizeBtn && minimizedBtn && expandedWindow) {
        minimizeBtn.addEventListener('click', () => {
            expandedWindow.style.display = 'none';
            minimizedBtn.style.display = 'flex';
            
            // Reset position on minimize
            const container = document.getElementById('lpa-sim-container');
            if (container) {
                container.style.left = 'auto';
                container.style.top = 'auto';
                container.style.bottom = '24px';
                container.style.right = '24px';
            }
        });
    }

    // Initialize Draggable behavior
    makeLpaDraggable();

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            const logsArea = document.getElementById('lpa-sim-logs');
            if (logsArea) logsArea.innerHTML = '';
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const acString = document.getElementById('lpa-sim-ac-text')?.value;
            if (!acString) {
                addLpaLog('Error: No activation code available.', 'error');
                return;
            }

            // Start simulation UI sequence
            downloadBtn.disabled = true;
            updateLpaStatusBadge('Downloading', 'downloading');
            
            const logsArea = document.getElementById('lpa-sim-logs');
            if (logsArea) logsArea.innerHTML = ''; // Auto clear logs on start
            
            addLpaLog('LPA Simulator initiated eSIM profile download sequence.', 'info');
            
            // Helper to delay log printing for realistic micro-animations
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            await delay(400);
            addLpaLog(`Parsing activation code: ${acString}`, 'info');
            
            await delay(300);
            const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? 'localhost:8092' 
                : 'hutta.in';
            addLpaLog(`Resolved SM-DP+ Server Address: ${host}`, 'info');
            
            await delay(400);
            addLpaLog('Connecting to SM-DP+ ES9+ endpoint...', 'process');
            
            try {
                // Perform real fetch to LPA Simulator backend
                const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/download`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ activationCode: acString })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    await delay(400);
                    addLpaLog('ES9+ Step 1: initiateAuthentication success.', 'process');
                    addLpaLog(`Transaction ID: ${data.transactionId}`, 'info');
                    
                    await delay(500);
                    addLpaLog('ES9+ Step 2: authenticateClient success (Server signature verified).', 'process');
                    
                    await delay(500);
                    addLpaLog('ES9+ Step 3: getBoundProfilePackage success (BPP downloaded).', 'process');
                    addLpaLog(`Bound Profile Package size: ${data.boundProfilePackageSize} bytes`, 'info');
                    
                    await delay(600);
                    addLpaLog('ES9+ Step 4: Installing profile payload on eUICC client...', 'process');
                    
                    await delay(600);
                    addLpaLog(`[SUCCESS] Profile installed successfully! ICCID: ${data.iccid}`, 'success');
                    updateLpaStatusBadge('Success', 'success');
                    
                    // Add success log to main operations console as well
                    addLogLine(`LPA downloaded & installed profile. ICCID: ${data.iccid}`, "success");
                    
                    // Refresh the main profiles list registry to show updated state
                    if (typeof fetchProfiles === 'function') {
                        fetchProfiles();
                    }
                    fetchLpaProfiles();
                } else {
                    await delay(400);
                    addLpaLog(`[ERROR] Download failed: ${data.message || 'Unknown error'}`, 'error');
                    updateLpaStatusBadge('Failed', 'failed');
                    addLogLine(`LPA download failed: ${data.message || 'Unknown error'}`, "error");
                }
            } catch (err) {
                await delay(400);
                addLpaLog(`[ERROR] Network error connecting to LPA Simulator: ${err.message}`, 'error');
                addLpaLog('Make sure the LPA Simulator service is running on port 8093.', 'info');
                updateLpaStatusBadge('Failed', 'failed');
                addLogLine(`LPA Simulator connection error: ${err.message}`, "error");
            } finally {
                downloadBtn.disabled = false;
            }
        });
    }
}


// -------------------------------------------------------------
// LOCAL DEVICE eSIM CRUD MANAGEMENT
// -------------------------------------------------------------
async function fetchLpaProfiles() {
    const listContainer = document.getElementById('lpa-device-profiles-list');
    if (!listContainer) return;
    
    try {
        const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/profiles`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const profiles = await response.json();
        
        if (profiles.length === 0) {
            listContainer.innerHTML = '<div class="lpa-empty-state">No eSIM profiles installed yet.</div>';
            return;
        }
        
        listContainer.innerHTML = profiles.map(profile => {
            const isEnabled = profile.profileState === 'ENABLED';
            const shortIccid = profile.iccid.length > 8 
                ? profile.iccid.substring(0, 4) + '...' + profile.iccid.substring(profile.iccid.length - 4) 
                : profile.iccid;
                
            return `
                <div class="lpa-profile-item ${isEnabled ? 'enabled' : ''}">
                    <div class="lpa-profile-info">
                        <span class="lpa-profile-nickname" title="${profile.profileNickname}">${profile.profileNickname}</span>
                        <span class="lpa-profile-iccid-smdp" title="ICCID: ${profile.iccid}\nSM-DP+: ${profile.smdpAddress}">
                            ICCID: ${shortIccid}
                        </span>
                    </div>
                    <div class="lpa-profile-status-actions">
                        <label class="lpa-switch" title="${isEnabled ? 'Disable profile' : 'Enable profile'}">
                            <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleLpaProfileState('${profile.iccid}', ${!isEnabled})">
                            <span class="lpa-slider"></span>
                        </label>
                        <button class="btn-profile-action edit" onclick="updateLpaProfileNickname('${profile.iccid}', '${profile.profileNickname.replace(/'/g, "\\'")}')" title="Edit nickname">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                        </button>
                        <button class="btn-profile-action delete" onclick="deleteLpaProfile('${profile.iccid}')" title="Uninstall profile">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Failed to fetch device profiles", err);
        listContainer.innerHTML = `<div class="lpa-empty-state" style="color: var(--warning-glow);">Failed to load profiles: ${err.message}</div>`;
    }
}

async function toggleLpaProfileState(iccid, shouldEnable) {
    if (shouldEnable) {
        try {
            const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/profiles`);
            if (response.ok) {
                const profiles = await response.json();
                const alreadyActive = profiles.find(p => p.profileState === 'ENABLED');
                if (alreadyActive) {
                    showToast("Cannot enable profile. Only one profile can be active at a time.", "error");
                    fetchLpaProfiles(); // Reset checkbox position
                    return;
                }
            }
        } catch (err) {
            console.error("Failed to check profile active states", err);
        }
    }

    const action = shouldEnable ? 'enable' : 'disable';
    const actionText = shouldEnable ? 'activate' : 'deactivate';

    showConfirm(
        `Confirm Profile ${shouldEnable ? 'Activation' : 'Deactivation'}`,
        `Are you sure you want to ${actionText} the eSIM profile with ICCID ${iccid}?`,
        async () => {
            try {
                const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/profiles/${iccid}/${action}`, {
                    method: 'PUT'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                addLogLine(`LPA profile ${iccid} was ${shouldEnable ? 'enabled' : 'disabled'}.`, "success");
                showToast(`LPA profile ${shouldEnable ? 'enabled' : 'disabled'} successfully.`, "success");
                
                // Refresh both lists
                fetchLpaProfiles();
                if (typeof fetchProfiles === 'function') {
                    fetchProfiles();
                }
            } catch (err) {
                console.error(`Failed to ${action} profile`, err);
                showToast(`Failed to ${action} profile: ${err.message}`, "error");
                fetchLpaProfiles(); // reset checkbox state on failure
            }
        },
        () => {
            // Cancel callback: reset checkbox state
            fetchLpaProfiles();
        }
    );
}

async function updateLpaProfileNickname(iccid, currentNickname) {
    showPrompt(
        "Rename eSIM Profile",
        "Enter new nickname for this eSIM profile:",
        currentNickname,
        async (newNickname) => {
            if (newNickname.trim() === '') {
                showToast("Nickname cannot be empty.", "warning");
                return;
            }
            
            try {
                const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/profiles/${iccid}/nickname`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nickname: newNickname.trim() })
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                addLogLine(`LPA profile ${iccid} renamed to "${newNickname.trim()}".`, "info");
                showToast("Profile renamed successfully.", "success");
                fetchLpaProfiles();
            } catch (err) {
                console.error("Failed to update nickname", err);
                showToast(`Failed to update nickname: ${err.message}`, "error");
            }
        }
    );
}

async function deleteLpaProfile(iccid) {
    showConfirm(
        "Uninstall Profile",
        "Are you sure you want to uninstall and delete this eSIM profile from the simulator? This action is irreversible.",
        async () => {
            try {
                const response = await fetch(`${LPA_SIMULATOR_BASE}/lpa/profiles/${iccid}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                addLogLine(`LPA profile ${iccid} uninstalled.`, "info");
                showToast("Profile uninstalled successfully.", "success");
                
                // Refresh both lists
                fetchLpaProfiles();
                if (typeof fetchProfiles === 'function') {
                    fetchProfiles();
                }
            } catch (err) {
                console.error("Failed to delete profile", err);
                showToast(`Failed to delete profile: ${err.message}`, "error");
            }
        }
    );
}

// Expose CRUD actions globally
window.toggleLpaProfileState = toggleLpaProfileState;
window.updateLpaProfileNickname = updateLpaProfileNickname;
window.deleteLpaProfile = deleteLpaProfile;
window.fetchLpaProfiles = fetchLpaProfiles;

function makeLpaDraggable() {
    const header = document.querySelector('.iphone-status-bar'); // Drag handle
    const container = document.getElementById('lpa-sim-container');
    const expandedWindow = document.getElementById('lpa-sim-expanded');
    
    if (!container || !expandedWindow) return;

    // --- DRAGGING LOGIC ---
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    const dragStart = (e) => {
        // Only drag from status bar/header, and don't trigger if clicking dynamic island or buttons
        if (e.target.closest('#lpa-sim-btn-minimize') || e.target.closest('.iphone-island')) return;
        
        isDragging = true;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        
        // Convert fixed right/bottom to top/left if not already done
        const rect = container.getBoundingClientRect();
        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        
        initialLeft = rect.left;
        initialTop = rect.top;

        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd);
        
        if (e.cancelable) e.preventDefault();
    };

    const dragMove = (e) => {
        if (!isDragging) return;
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        // Calculate new positions, keeping it inside viewport boundaries
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;
        
        const maxLeft = window.innerWidth - container.offsetWidth;
        const maxTop = window.innerHeight - container.offsetHeight;
        
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        
        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
        
        if (e.cancelable) e.preventDefault();
    };

    const dragEnd = () => {
        isDragging = false;
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('touchend', dragEnd);
    };

    if (header) {
        header.style.cursor = 'move';
        header.addEventListener('mousedown', dragStart);
        header.addEventListener('touchstart', dragStart, { passive: false });
    }

    // Also support dragging from .lpa-sim-header
    const innerHeader = document.querySelector('.lpa-sim-header');
    if (innerHeader) {
        innerHeader.style.cursor = 'move';
        innerHeader.addEventListener('mousedown', dragStart);
        innerHeader.addEventListener('touchstart', dragStart, { passive: false });
    }

    // --- RESIZING LOGIC ---
    // Add a resize handle element dynamically to the bottom-right corner of the chassis
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'iphone-resize-handle';
    expandedWindow.appendChild(resizeHandle);

    let isResizing = false;
    let startWidth, startHeight;
    let resizeStartX;

    const resizeStart = (e) => {
        isResizing = true;
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        
        resizeStartX = clientX;
        startWidth = expandedWindow.offsetWidth;
        startHeight = expandedWindow.offsetHeight;
        
        // Ensure position remains fixed/absolute relative to left/top
        const rect = container.getBoundingClientRect();
        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;

        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('mouseup', resizeEnd);
        document.addEventListener('touchmove', resizeMove, { passive: false });
        document.addEventListener('touchend', resizeEnd);
        
        if (e.cancelable) e.preventDefault();
    };

    const resizeMove = (e) => {
        if (!isResizing) return;
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - resizeStartX;
        
        // Maintain 1:2 aspect ratio
        let newWidth = startWidth + deltaX;
        
        // Enforce boundaries
        newWidth = Math.max(300, Math.min(newWidth, 600));
        let newHeight = newWidth * 2;
        
        // Check viewport limits
        if (newHeight > window.innerHeight - 20) {
            newHeight = window.innerHeight - 20;
            newWidth = newHeight / 2;
        }

        expandedWindow.style.setProperty('width', `${newWidth}px`, 'important');
        expandedWindow.style.setProperty('height', `${newHeight}px`, 'important');
        
        if (e.cancelable) e.preventDefault();
    };

    const resizeEnd = () => {
        isResizing = false;
        document.removeEventListener('mousemove', resizeMove);
        document.removeEventListener('mouseup', resizeEnd);
        document.removeEventListener('touchmove', resizeMove);
        document.removeEventListener('touchend', resizeEnd);
    };

    resizeHandle.addEventListener('mousedown', resizeStart);
    resizeHandle.addEventListener('touchstart', resizeStart, { passive: false });
}
