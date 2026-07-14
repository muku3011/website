// HSM Simulator Management Dashboard Controller
(function () {
    // Session State
    let adminUser = sessionStorage.getItem('hsm_admin_username') || '';
    let adminPin = sessionStorage.getItem('hsm_admin_pin') || '';
    
    let activeSlotId = sessionStorage.getItem('hsm_slot_id') || '';
    let activeSlotLabel = sessionStorage.getItem('hsm_slot_label') || '';
    let activeSlotPin = sessionStorage.getItem('hsm_slot_pin') || '';

    // Views
    const viewAdminLogin = document.getElementById('view-admin-login');
    const viewAdminDashboard = document.getElementById('view-admin-dashboard');
    const viewSlotDashboard = document.getElementById('view-slot-dashboard');

    // Admin Sidebar & Panels
    const adminTabButtons = document.querySelectorAll('#view-admin-dashboard .hsm-menu-item');
    const adminTabPanels = document.querySelectorAll('#view-admin-dashboard .hsm-tab-panel');

    // Slot Sidebar & Panels
    const slotTabButtons = document.querySelectorAll('#view-slot-dashboard .hsm-menu-item');
    const slotTabPanels = document.querySelectorAll('#view-slot-dashboard .hsm-tab-panel');

    // Admin Status Elements
    const adminStatusVal = document.getElementById('admin-status-val');
    const adminModelVal = document.getElementById('admin-model-val');
    const adminSlotsVal = document.getElementById('admin-slots-val');
    const adminSessionsVal = document.getElementById('admin-sessions-val');

    // Slots Listing Elements
    const slotsContainer = document.getElementById('slots-container');
    const btnShowCreateSlotModal = document.getElementById('btn-show-create-slot-modal');
    const createSlotModal = document.getElementById('create-slot-modal');
    const btnCancelCreateSlot = document.getElementById('btn-cancel-create-slot');
    const btnRunCreateSlot = document.getElementById('btn-run-create-slot');
    const newSlotLabel = document.getElementById('new-slot-label');
    const newSlotDesc = document.getElementById('new-slot-desc');
    const newSlotPin = document.getElementById('new-slot-pin');
    const createSlotWebWarning = document.getElementById('create-slot-web-warning');

    // Slot Pin Access Overlay
    const slotPinModal = document.getElementById('slot-pin-modal');
    const slotPinTitle = document.getElementById('slot-pin-title');
    const slotPinInput = document.getElementById('slot-pin-input');
    const slotPinError = document.getElementById('slot-pin-error');
    const btnCancelSlotAccess = document.getElementById('btn-cancel-slot-access');
    const btnSubmitSlotPin = document.getElementById('btn-submit-slot-pin');
    let targetSlotAccessId = null;

    // SO specific modals
    const formatSlotModal = document.getElementById('format-slot-modal');
    const btnRunFormatSlot = document.getElementById('btn-run-format-slot');
    const formatSlotPinInput = document.getElementById('format-slot-pin');
    const resetSlotPinModal = document.getElementById('reset-slot-pin-modal');
    const btnRunResetSlotPin = document.getElementById('btn-run-reset-slot-pin');
    const resetSlotNewPinInput = document.getElementById('reset-slot-new-pin');
    let targetSOActionSlotId = null;

    // Slot Header Elements
    const slotHeaderLabel = document.getElementById('slot-header-label');
    const slotHeaderDesc = document.getElementById('slot-header-desc');
    const slotLblVal = document.getElementById('slot-lbl-val');
    const btnBackToSlots = document.getElementById('btn-back-to-slots');

    // Keys Elements
    const keysTableBody = document.getElementById('keys-table-body');
    const btnShowGenModal = document.getElementById('btn-show-gen-modal');
    const genKeyModal = document.getElementById('gen-key-modal');
    const btnCancelGen = document.getElementById('btn-cancel-gen');
    const btnRunGen = document.getElementById('btn-run-gen');
    const newKeyAlias = document.getElementById('new-key-alias');
    const newKeyAlgo = document.getElementById('new-key-algo');
    const newKeySize = document.getElementById('new-key-size');
    const attrSensitive = document.getElementById('attr-sensitive');
    const attrExtractable = document.getElementById('attr-extractable');
    const attrEncrypt = document.getElementById('attr-encrypt');
    const attrDecrypt = document.getElementById('attr-decrypt');
    const attrSign = document.getElementById('attr-sign');

    // Diagnostics Elements
    const playKeySelect = document.getElementById('play-key-select');
    const playOperation = document.getElementById('play-operation');
    const playIv = document.getElementById('play-iv');
    const btnGenIv = document.getElementById('btn-gen-iv');
    const playInput = document.getElementById('play-input');
    const btnRunPlay = document.getElementById('btn-run-play');
    const cardPlayResult = document.getElementById('card-play-result');
    const playResultBox = document.getElementById('play-result-box');
    const groupIv = document.getElementById('group-iv');

    // Audit logs elements
    const adminAuditTableBody = document.getElementById('admin-audit-table-body');
    const slotAuditTableBody = document.getElementById('slot-audit-table-body');

    // Admin Auth Elements
    const adminUsernameInput = document.getElementById('admin-username-input');
    const adminPinInput = document.getElementById('admin-pin-input');
    const adminLoginError = document.getElementById('admin-login-error');
    const btnAdminLogin = document.getElementById('btn-admin-login');
    const btnAdminLogout = document.getElementById('btn-admin-logout');
    const adminRoleBadge = document.getElementById('admin-role-badge');

    // Change Admin Pin Elements
    const changeAdminUsername = document.getElementById('change-admin-username');
    const changeAdminOldPin = document.getElementById('change-admin-old-pin');
    const changeAdminNewPin = document.getElementById('change-admin-new-pin');
    const btnSubmitChangeAdminPin = document.getElementById('btn-submit-change-admin-pin');

    // Change Slot Pin Elements
    const changeSlotOldPin = document.getElementById('change-slot-old-pin');
    const changeSlotNewPin = document.getElementById('change-slot-new-pin');
    const btnSubmitChangeSlotPin = document.getElementById('btn-submit-change-slot-pin');

    // --------------------------------------------------------------------------
    // API HELPERS
    // --------------------------------------------------------------------------

    async function apiRequest(path, method = 'GET', body = null, headers = {}) {
        const configHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (activeSlotPin) {
            configHeaders['X-HSM-PIN'] = activeSlotPin;
        }
        if (adminPin && adminUser) {
            configHeaders['X-HSM-ADMIN-USER'] = adminUser;
            configHeaders['X-HSM-ADMIN-PIN'] = adminPin;
        }

        const config = {
            method,
            headers: configHeaders
        };
        if (body) {
            config.body = JSON.stringify(body);
        }

        const res = await fetch(path, config);
        if (res.status === 401 && activeSlotPin) {
            // Unauthorized slot access
            sessionStorage.removeItem('hsm_slot_pin');
            activeSlotPin = '';
            showView('admin');
            alert("Slot session expired or incorrect PIN.");
            throw new Error("UNAUTHORIZED_SLOT");
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP error ${res.status}`);
        }
        return res.json();
    }

    // --------------------------------------------------------------------------
    // STATE MACHINE / VIEWS TOGGLE
    // --------------------------------------------------------------------------

    function showView(viewName) {
        viewAdminLogin.style.display = 'none';
        viewAdminDashboard.style.display = 'none';
        viewSlotDashboard.style.display = 'none';

        if (viewName === 'login') {
            viewAdminLogin.style.display = 'flex';
        } else if (viewName === 'admin') {
            viewAdminDashboard.style.display = 'grid';
            adminRoleBadge.innerText = `Logged in as ${adminUser.toUpperCase()}`;

            // Role separation UI toggling
            const btnAuditsTab = Array.from(adminTabButtons).find(b => b.dataset.tab === 'admin-tab-audits');
            if (adminUser === 'admin') {
                if (btnAuditsTab) btnAuditsTab.style.display = 'flex';
                if (btnShowCreateSlotModal) btnShowCreateSlotModal.style.display = 'inline-block';
            } else if (adminUser === 'so') {
                if (btnAuditsTab) btnAuditsTab.style.display = 'none';
                if (btnShowCreateSlotModal) btnShowCreateSlotModal.style.display = 'none';
            }

            loadAdminStatus();
            // Reset to status tab
            triggerTabSwitch(adminTabButtons, adminTabPanels, 'admin-tab-status');
        } else if (viewName === 'slot') {
            viewSlotDashboard.style.display = 'grid';
            slotHeaderLabel.innerText = `Slot: ${activeSlotLabel} (ID: ${activeSlotId})`;
            slotLblVal.innerText = activeSlotLabel;
            // Reset to slot status tab
            triggerTabSwitch(slotTabButtons, slotTabPanels, 'slot-tab-status');
        }
    }

    function triggerTabSwitch(buttons, panels, tabId) {
        buttons.forEach(b => {
            if (b.dataset.tab === tabId) b.classList.add('active');
            else b.classList.remove('active');
        });
        panels.forEach(p => {
            if (p.id === tabId) p.classList.add('active');
            else p.classList.remove('active');
        });

        // Trigger loading
        if (tabId === 'admin-tab-slots') loadSlots();
        else if (tabId === 'admin-tab-audits') loadAdminAudits();
        else if (tabId === 'slot-tab-keys') loadKeys();
        else if (tabId === 'slot-tab-audits') loadSlotAudits();
    }

    // Bind sidebar buttons
    adminTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            triggerTabSwitch(adminTabButtons, adminTabPanels, btn.dataset.tab);
        });
    });

    slotTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            triggerTabSwitch(slotTabButtons, slotTabPanels, btn.dataset.tab);
        });
    });

    // --------------------------------------------------------------------------
    // ADMINISTRATIVE WORKFLOW
    // --------------------------------------------------------------------------

    btnAdminLogin.addEventListener('click', async () => {
        const username = adminUsernameInput.value;
        const pin = adminPinInput.value;

        if (!pin) {
            showAdminLoginError("Please enter PIN");
            return;
        }

        btnAdminLogin.disabled = true;
        btnAdminLogin.innerText = "Authenticating...";
        adminLoginError.style.display = 'none';

        try {
            const res = await apiRequest('/api/hsm/admin/login', 'POST', { username, pin });
            adminUser = res.role;
            adminPin = pin;
            sessionStorage.setItem('hsm_admin_username', adminUser);
            sessionStorage.setItem('hsm_admin_pin', adminPin);
            adminPinInput.value = '';
            showView('admin');
        } catch (e) {
            showAdminLoginError(e.message);
        } finally {
            btnAdminLogin.disabled = false;
            btnAdminLogin.innerText = "Authenticate to Appliance";
        }
    });

    btnAdminLogout.addEventListener('click', () => {
        sessionStorage.removeItem('hsm_admin_username');
        sessionStorage.removeItem('hsm_admin_pin');
        sessionStorage.removeItem('hsm_slot_id');
        sessionStorage.removeItem('hsm_slot_label');
        sessionStorage.removeItem('hsm_slot_pin');
        adminUser = '';
        adminPin = '';
        activeSlotId = '';
        activeSlotLabel = '';
        activeSlotPin = '';
        showView('login');
    });

    function showAdminLoginError(msg) {
        adminLoginError.innerText = msg;
        adminLoginError.style.display = 'block';
    }

    async function loadAdminStatus() {
        try {
            const data = await apiRequest('/api/hsm/status');
            adminSlotsVal.innerText = data.totalSlots;
        } catch (e) {
            console.error("Failed to load status", e);
        }
    }

    async function loadSlots() {
        try {
            const slots = await apiRequest('/api/hsm/slots');
            slotsContainer.innerHTML = '';

            slots.forEach(s => {
                const card = document.createElement('div');
                card.className = 'slot-card';
                
                let actionsHtml = '';
                if (adminUser === 'admin') {
                    actionsHtml = `
                        <button class="btn btn-primary btn-access-slot" data-id="${s.id}" data-label="${escapeHtml(s.label)}" style="flex:1; padding:0.4rem;">Access Slot</button>
                        ${s.id !== 1 ? `<button class="btn btn-secondary btn-delete-slot" data-id="${s.id}" style="padding:0.4rem; border-color:#ff0070; color:#ff0070;">Delete</button>` : ''}
                    `;
                } else if (adminUser === 'so') {
                    actionsHtml = `
                        <button class="btn btn-primary btn-access-slot" data-id="${s.id}" data-label="${escapeHtml(s.label)}" style="flex:1; padding:0.4rem;">Access Slot</button>
                        <button class="btn btn-secondary btn-init-slot" data-id="${s.id}" data-label="${escapeHtml(s.label)}" style="padding:0.4rem; border-color:var(--primary-glow); color:var(--text-primary);">Format</button>
                        <button class="btn btn-secondary btn-reset-user-pin" data-id="${s.id}" data-label="${escapeHtml(s.label)}" style="padding:0.4rem; border-color:#60a5fa; color:#60a5fa;">Reset PIN</button>
                    `;
                }

                card.innerHTML = `
                    <div class="slot-card-header">
                        <div class="slot-card-title">${escapeHtml(s.label)}</div>
                        <div class="slot-card-id">ID: ${s.id}</div>
                    </div>
                    <div class="slot-card-desc">${escapeHtml(s.description || 'No description provided')}</div>
                    <div class="slot-card-actions">
                        ${actionsHtml}
                    </div>
                `;
                slotsContainer.appendChild(card);
            });

            // Bind Actions
            document.querySelectorAll('.btn-access-slot').forEach(btn => {
                btn.addEventListener('click', () => {
                    targetSlotAccessId = btn.dataset.id;
                    slotPinTitle.innerText = `Access Slot: ${btn.dataset.label}`;
                    slotPinModal.showModal();
                    slotPinInput.value = '';
                    slotPinInput.focus();
                    slotPinError.style.display = 'none';
                });
            });

            document.querySelectorAll('.btn-delete-slot').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (confirm("Are you sure you want to permanently delete this slot and ALL keys stored inside it? This cannot be undone.")) {
                        try {
                            await apiRequest(`/api/hsm/slots/${id}`, 'DELETE');
                            loadSlots();
                            loadAdminStatus();
                        } catch (e) {
                            alert(e.message);
                        }
                    }
                });
            });

            document.querySelectorAll('.btn-init-slot').forEach(btn => {
                btn.addEventListener('click', () => {
                    targetSOActionSlotId = btn.dataset.id;
                    document.getElementById('format-slot-title').innerText = `Format Slot: ${btn.dataset.label}`;
                    formatSlotPinInput.value = '';
                    formatSlotModal.showModal();
                });
            });

            document.querySelectorAll('.btn-reset-user-pin').forEach(btn => {
                btn.addEventListener('click', () => {
                    targetSOActionSlotId = btn.dataset.id;
                    document.getElementById('reset-slot-pin-title').innerText = `Reset PIN for: ${btn.dataset.label}`;
                    resetSlotNewPinInput.value = '';
                    resetSlotPinModal.showModal();
                });
            });

        } catch (e) {
            console.error("Failed to load slots", e);
        }
    }

    // Create Slot Modal logic
    btnShowCreateSlotModal.addEventListener('click', () => {
        createSlotModal.showModal();
        newSlotLabel.value = '';
        newSlotDesc.value = '';
        newSlotPin.value = '';
        
        // Check web user login presence
        const isLoggedIn = !!window.userNameVal;
        if (!isLoggedIn) {
            createSlotWebWarning.style.display = 'block';
            btnRunCreateSlot.disabled = true;
        } else {
            createSlotWebWarning.style.display = 'none';
            btnRunCreateSlot.disabled = false;
        }
    });

    btnCancelCreateSlot.addEventListener('click', () => {
        createSlotModal.close();
    });

    btnRunCreateSlot.addEventListener('click', async () => {
        const label = newSlotLabel.value.trim();
        const description = newSlotDesc.value.trim();
        const pin = newSlotPin.value;

        if (!label || !pin) {
            alert("Label and PIN are required");
            return;
        }

        try {
            await apiRequest('/api/hsm/slots', 'POST', { label, description, slotPin: pin });
            createSlotModal.close();
            loadSlots();
            loadAdminStatus();
        } catch (e) {
            alert(e.message);
        }
    });

    // Slot PIN entry submission
    btnSubmitSlotPin.addEventListener('click', submitSlotPin);
    slotPinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitSlotPin();
    });

    btnCancelSlotAccess.addEventListener('click', () => {
        slotPinModal.close();
    });

    async function submitSlotPin() {
        const pin = slotPinInput.value;
        if (!pin) return;

        btnSubmitSlotPin.disabled = true;
        btnSubmitSlotPin.innerText = "Opening...";
        slotPinError.style.display = 'none';

        try {
            const res = await apiRequest('/api/hsm/session', 'POST', { pin });
            
            // Success
            activeSlotId = res.slotId;
            activeSlotLabel = res.slotLabel;
            activeSlotPin = pin;

            sessionStorage.setItem('hsm_slot_id', activeSlotId);
            sessionStorage.setItem('hsm_slot_label', activeSlotLabel);
            sessionStorage.setItem('hsm_slot_pin', activeSlotPin);

            slotPinModal.close();
            showView('slot');
        } catch (e) {
            slotPinError.innerText = e.message;
            slotPinError.style.display = 'block';
        } finally {
            btnSubmitSlotPin.disabled = false;
            btnSubmitSlotPin.innerText = "Open Slot";
        }
    }

    // Change Admin/SO PIN
    btnSubmitChangeAdminPin.addEventListener('click', async () => {
        const username = changeAdminUsername.value;
        const oldPin = changeAdminOldPin.value;
        const newPin = changeAdminNewPin.value;

        if (!oldPin || !newPin) {
            alert("Old and new PIN are required");
            return;
        }

        try {
            await apiRequest('/api/hsm/admin/change-pin', 'POST', { username, oldPin, newPin });
            alert("Administrative PIN changed successfully");
            changeAdminOldPin.value = '';
            changeAdminNewPin.value = '';
            // If logged-in user changed their own PIN, update local cache
            if (username === adminUser) {
                adminPin = newPin;
                sessionStorage.setItem('hsm_admin_pin', newPin);
            }
        } catch (e) {
            alert(e.message);
        }
    });

    // Global Admin Audits
    async function loadAdminAudits() {
        try {
            const logs = await apiRequest('/api/hsm/admin/audit-logs');
            adminAuditTableBody.innerHTML = '';

            if (logs.length === 0) {
                adminAuditTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No audit logs recorded yet.</td>
                    </tr>
                `;
                return;
            }

            logs.forEach(l => {
                const date = new Date(l.timestamp).toLocaleString();
                const statusClass = l.status === 'SUCCESS' ? 'text-success' : 'text-danger';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span style="color:var(--text-muted); font-size:0.8rem;">${date}</span></td>
                    <td><code>${l.slotId || 'Global'}</code></td>
                    <td><strong><code>${escapeHtml(l.operation)}</code></strong></td>
                    <td><code>${escapeHtml(l.keyAlias || 'N/A')}</code></td>
                    <td><span class="${statusClass}" style="font-weight:600; font-size:0.8rem;">${escapeHtml(l.status)}</span></td>
                    <td><span style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(l.details)}</span></td>
                `;
                adminAuditTableBody.appendChild(row);
            });
        } catch (e) {
            console.error("Failed to load admin audits", e);
        }
    }

    // --------------------------------------------------------------------------
    // SLOT WORKFLOW (KEYS & CRYPTO PLAYGROUND)
    // --------------------------------------------------------------------------

    btnBackToSlots.addEventListener('click', () => {
        activeSlotId = '';
        activeSlotLabel = '';
        activeSlotPin = '';
        sessionStorage.removeItem('hsm_slot_id');
        sessionStorage.removeItem('hsm_slot_label');
        sessionStorage.removeItem('hsm_slot_pin');
        showView('admin');
    });

    async function loadKeys() {
        try {
            const keys = await apiRequest('/api/hsm/keys');
            keysTableBody.innerHTML = '';
            playKeySelect.innerHTML = '<option value="">Select a key...</option>';

            if (keys.length === 0) {
                keysTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No keys found in secure token storage.</td>
                    </tr>
                `;
                return;
            }

            keys.forEach(k => {
                let attrs = {};
                try {
                    attrs = JSON.parse(k.attributes);
                } catch (e) {}

                let badgeHtml = '';
                Object.keys(attrs).forEach(key => {
                    if (typeof attrs[key] === 'boolean') {
                        const valClass = attrs[key] ? 'true' : 'false';
                        badgeHtml += `<span class="badge-attr ${valClass}">${key}</span>`;
                    }
                });

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${escapeHtml(k.alias)}</strong></td>
                    <td><code style="font-size:0.8rem;">${escapeHtml(k.objectType)}</code></td>
                    <td><code>${escapeHtml(k.algorithm)}</code></td>
                    <td>${k.keySize ? k.keySize + '-bit' : 'N/A'}</td>
                    <td><div style="max-width:400px; display:flex; flex-wrap:wrap;">${badgeHtml}</div></td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-delete-key" data-alias="${escapeHtml(k.alias)}" style="padding:0.3rem 0.7rem; font-size:0.75rem; border-color:#ff0070; color:#ff0070;">Delete</button>
                    </td>
                `;
                keysTableBody.appendChild(row);

                if (k.objectType !== 'SECRET_KEY' || attrs.CKA_ENCRYPT || attrs.CKA_DECRYPT) {
                    const opt = document.createElement('option');
                    opt.value = k.alias;
                    opt.innerText = `${k.alias} (${k.algorithm} ${k.objectType})`;
                    playKeySelect.appendChild(opt);
                }
            });

            // Bind delete events
            document.querySelectorAll('.btn-delete-key').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const alias = btn.dataset.alias;
                    if (confirm(`Are you absolutely sure you want to permanently delete HSM key: ${alias}?`)) {
                        try {
                            await apiRequest(`/api/hsm/keys/${alias}`, 'DELETE');
                            loadKeys();
                        } catch (err) {
                            alert(`Failed to delete key: ${err.message}`);
                        }
                    }
                });
            });
        } catch (e) {
            console.error("Failed to load keys", e);
        }
    }

    // Modal key generation
    btnShowGenModal.addEventListener('click', () => {
        genKeyModal.showModal();
        newKeyAlias.value = '';
        newKeyAlias.focus();
    });

    btnCancelGen.addEventListener('click', () => {
        genKeyModal.close();
    });

    btnRunGen.addEventListener('click', async () => {
        const alias = newKeyAlias.value.trim();
        const algo = newKeyAlgo.value;
        const size = parseInt(newKeySize.value);

        if (!alias) {
            alert("Please enter a key alias");
            return;
        }

        btnRunGen.disabled = true;
        btnRunGen.innerText = "Generating...";

        try {
            await apiRequest('/api/hsm/keys/generate', 'POST', {
                alias,
                algorithm: algo,
                keySize: size,
                attributes: {
                    CKA_SENSITIVE: attrSensitive.checked,
                    CKA_EXTRACTABLE: attrExtractable.checked,
                    CKA_ENCRYPT: attrEncrypt.checked,
                    CKA_DECRYPT: attrDecrypt.checked,
                    CKA_SIGN: attrSign.checked
                }
            });
            genKeyModal.close();
            loadKeys();
        } catch (e) {
            alert(`Generation failed: ${e.message}`);
        } finally {
            btnRunGen.disabled = false;
            btnRunGen.innerText = "Generate";
        }
    });

    // Operation selection change (hide/show IV)
    playOperation.addEventListener('change', () => {
        if (playOperation.value === 'SIGN') {
            groupIv.style.display = 'none';
        } else {
            groupIv.style.display = 'block';
        }
    });

    // IV Generation Helper
    btnGenIv.addEventListener('click', () => {
        const bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        playIv.value = window.btoa(binary);
    });

    // Run diagnostics execution
    btnRunPlay.addEventListener('click', async () => {
        const alias = playKeySelect.value;
        const op = playOperation.value;
        const input = playInput.value;
        const iv = playIv.value;

        if (!alias) {
            alert("Please select a key");
            return;
        }
        if (!input) {
            alert("Please enter input data");
            return;
        }

        btnRunPlay.disabled = true;
        btnRunPlay.innerText = "Processing...";
        cardPlayResult.style.display = 'none';

        try {
            let dataBase64 = '';
            if (op === 'DECRYPT') {
                dataBase64 = input.trim();
            } else {
                let binary = '';
                const utf8 = new TextEncoder().encode(input);
                utf8.forEach(b => binary += String.fromCharCode(b));
                dataBase64 = window.btoa(binary);
            }

            if (op === 'ENCRYPT' || op === 'DECRYPT') {
                if (!iv) {
                    alert("IV is required for symmetric cipher operations");
                    btnRunPlay.disabled = false;
                    btnRunPlay.innerText = "Execute Operation";
                    return;
                }

                const res = await apiRequest('/api/hsm/crypto/cipher', 'POST', {
                    opmode: op === 'ENCRYPT' ? 1 : 2,
                    alias,
                    iv,
                    tagLength: 128,
                    data: dataBase64
                });

                if (op === 'ENCRYPT') {
                    playResultBox.innerHTML = `
                        <strong>Ciphertext (Base64):</strong><br>${escapeHtml(res.result)}<br><br>
                        <strong>Instructions:</strong> Use this Base64 ciphertext with operation DECRYPT to test round-trip decapsulation.
                    `;
                } else {
                    const rawBytes = Uint8Array.from(window.atob(res.result), c => c.charCodeAt(0));
                    const plaintext = new TextDecoder().decode(rawBytes);
                    playResultBox.innerHTML = `
                        <strong>Decrypted Plaintext:</strong><br>${escapeHtml(plaintext)}
                    `;
                }
            } else if (op === 'SIGN') {
                const res = await apiRequest('/api/hsm/crypto/sign', 'POST', {
                    alias,
                    data: dataBase64
                });

                playResultBox.innerHTML = `
                    <strong>Signature (ECDSA DER Base64):</strong><br>${escapeHtml(res.signature)}
                `;
            }

            cardPlayResult.style.display = 'block';
        } catch (e) {
            alert(`Execution failed: ${e.message}`);
        } finally {
            btnRunPlay.disabled = false;
            btnRunPlay.innerText = "Execute Operation";
        }
    });

    // Load Slot Specific Audits
    async function loadSlotAudits() {
        try {
            const logs = await apiRequest('/api/hsm/audit-logs');
            slotAuditTableBody.innerHTML = '';

            if (logs.length === 0) {
                slotAuditTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No audit logs recorded yet.</td>
                    </tr>
                `;
                return;
            }

            logs.forEach(l => {
                const date = new Date(l.timestamp).toLocaleString();
                const statusClass = l.status === 'SUCCESS' ? 'text-success' : 'text-danger';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span style="color:var(--text-muted); font-size:0.8rem;">${date}</span></td>
                    <td><strong><code>${escapeHtml(l.operation)}</code></strong></td>
                    <td><code>${escapeHtml(l.keyAlias || 'N/A')}</code></td>
                    <td><span class="${statusClass}" style="font-weight:600; font-size:0.8rem;">${escapeHtml(l.status)}</span></td>
                    <td><span style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(l.details)}</span></td>
                `;
                slotAuditTableBody.appendChild(row);
            });
        } catch (e) {
            console.error("Failed to load slot audits", e);
        }
    }

    // Change Slot PIN
    btnSubmitChangeSlotPin.addEventListener('click', async () => {
        const oldPin = changeSlotOldPin.value;
        const newPin = changeSlotNewPin.value;

        if (!oldPin || !newPin) {
            alert("Old and new PIN are required");
            return;
        }

        try {
            await apiRequest(`/api/hsm/slots/${activeSlotId}/change-pin`, 'POST', { oldPin, newPin });
            alert("Slot PIN updated successfully");
            changeSlotOldPin.value = '';
            changeSlotNewPin.value = '';
            activeSlotPin = newPin;
            sessionStorage.setItem('hsm_slot_pin', newPin);
        } catch (e) {
            alert(e.message);
        }
    });

    // SO Format Slot Submission
    btnRunFormatSlot.addEventListener('click', async () => {
        const pin = formatSlotPinInput.value;
        if (!pin || pin.trim().length < 4) {
            alert("New Slot PIN must be at least 4 digits");
            return;
        }

        try {
            await apiRequest(`/api/hsm/slots/${targetSOActionSlotId}/initialize`, 'POST', { slotPin: pin });
            alert("Slot formatted and initialized successfully with new PIN.");
            formatSlotModal.close();
            loadSlots();
        } catch (e) {
            alert(e.message);
        }
    });

    // SO Reset Slot User PIN Submission
    btnRunResetSlotPin.addEventListener('click', async () => {
        const newPin = resetSlotNewPinInput.value;
        if (!newPin || newPin.trim().length < 4) {
            alert("New Slot PIN must be at least 4 digits");
            return;
        }

        try {
            await apiRequest(`/api/hsm/slots/${targetSOActionSlotId}/reset-user-pin`, 'POST', { newPin });
            alert("Slot User PIN reset successfully.");
            resetSlotPinModal.close();
            loadSlots();
        } catch (e) {
            alert(e.message);
        }
    });

    // --------------------------------------------------------------------------
    // UTILITIES
    // --------------------------------------------------------------------------

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // --------------------------------------------------------------------------
    // MAIN INITIALIZATION
    // --------------------------------------------------------------------------

    if (!adminPin || !adminUser) {
        showView('login');
    } else {
        if (activeSlotPin && activeSlotId) {
            showView('slot');
        } else {
            showView('admin');
        }
    }
})();
