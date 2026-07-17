// GSMA SGP.32 eSIM IoT Remote Manager (eIM) Dashboard logic
(function() {
    
    // BACKEND CONFIGURATIONS
    const EIM_BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8096' 
        : '';
        
    const SMDP_BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8092' 
        : '';

    const IPA_BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8097' 
        : '/api/ipa';

    let selectedEid = null;
    let selectedDeviceName = 'No Device Selected';
    let pollInterval = null;

    // DOM Elements
    const deviceEidInput = document.getElementById('device-eid');
    const deviceNameInput = document.getElementById('device-name');
    const btnRegisterDevice = document.getElementById('btn-register-device');
    const devicesList = document.getElementById('devices-list');
    
    const eimOpsPanel = document.getElementById('eim-ops-panel');
    const selectedDeviceLabel = document.getElementById('selected-device-label');
    const selectProfile = document.getElementById('select-profile');
    const selectProfileType = document.getElementById('select-profile-type');
    const btnTriggerDownload = document.getElementById('btn-trigger-download');
    const eimAuditLogs = document.getElementById('eim-audit-logs');
    
    const euiccProfilesList = document.getElementById('euicc-profiles-list');
    const ipaConsole = document.getElementById('ipa-console');
    const btnClearIpaLogs = document.getElementById('clear-ipa-logs');

    // Utility: Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Show message inside console
    function addConsoleLog(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.style.color = type === 'error' ? 'var(--warning-glow)' : type === 'success' ? 'var(--success-glow)' : 'var(--text-secondary)';
        line.innerHTML = `[${new Date().toLocaleTimeString()}] ${escapeHtml(message)}`;
        ipaConsole.appendChild(line);
        ipaConsole.scrollTop = ipaConsole.scrollHeight;
    }

    function updateTimestamp() {
        const el = document.getElementById('last-refreshed');
        if (el) {
            el.textContent = 'Updated ' + new Date().toLocaleTimeString();
        }
    }

    // Fetch and Render IoT Devices
    async function loadDevices() {
        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/devices`);
            if (!response.ok) throw new Error('Failed to fetch devices');
            const devices = await response.json();
            
            if (devices.length === 0) {
                devicesList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No devices registered.</td></tr>`;
                updateTimestamp();
                return;
            }

            devicesList.innerHTML = devices.map(d => `
                <tr class="device-row ${selectedEid === d.eid ? 'selected' : ''}" data-eid="${d.eid}" data-name="${d.deviceName}" style="cursor: pointer; transition: background var(--transition-smooth);">
                    <td style="padding: 0.75rem; font-weight: 500;">${escapeHtml(d.deviceName)}</td>
                    <td style="padding: 0.75rem; font-family: monospace; font-size: 0.8rem;">${escapeHtml(d.eid)}</td>
                    <td style="padding: 0.75rem;"><span class="badge badge-success" style="background: rgba(145, 80%, 50%, 0.1); color: var(--success-glow); padding: 0.2rem 0.6rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600;">${escapeHtml(d.status)}</span></td>
                    <td style="padding: 0.75rem; text-align: center;">
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem; background: rgba(220,53,69,0.1); color: var(--warning-glow); border-color: rgba(220,53,69,0.2);" onclick="event.stopPropagation(); window.deregisterIotDevice('${d.eid}')">Remove</button>
                    </td>
                </tr>
            `).join('');

            // Add Click Handlers
            document.querySelectorAll('.device-row').forEach(row => {
                row.addEventListener('click', () => {
                    selectDevice(row.dataset.eid, row.dataset.name);
                });
            });
            updateTimestamp();
        } catch (e) {
            console.error('Error loading devices', e);
            updateTimestamp();
        }
    }

    // Select Device to Manage
    function selectDevice(eid, name) {
        selectedEid = eid;
        selectedDeviceName = name;
        selectedDeviceLabel.textContent = name;
        eimOpsPanel.style.display = 'block';
        
        // Highlight row
        document.querySelectorAll('.device-row').forEach(row => {
            if (row.dataset.eid === eid) {
                row.style.background = 'rgba(212, 100%, 60%, 0.1)';
            } else {
                row.style.background = 'none';
            }
        });

        // Initialize/reset polling for eUICC status and device logs
        if (pollInterval) clearInterval(pollInterval);
        loadIpaStatus();
        pollInterval = setInterval(loadIpaStatus, 2000);
        
        addConsoleLog(`Connected to IoT Device EID: ${eid}`, 'success');
    }

    // Register IoT Device
    async function registerDevice() {
        const eid = deviceEidInput.value.trim();
        const name = deviceNameInput.value.trim();

        if (!eid || !name) {
            alert('EID and Device Name are required.');
            return;
        }

        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/devices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eid, deviceName: name })
            });

            if (!response.ok) throw new Error('Registration failed');
            
            deviceEidInput.value = '';
            deviceNameInput.value = '';
            
            await loadDevices();
            loadAuditLogs();
        } catch (e) {
            alert('Failed to register device: ' + e.message);
        }
    }

    // Fetch Available Profiles from SM-DP+
    async function loadSmdpProfiles() {
        try {
            const response = await fetch(`${SMDP_BACKEND_BASE}/gsma/rsp/v2/admin/profiles?state=AVAILABLE`);
            if (!response.ok) throw new Error('Failed to fetch SM-DP+ profiles');
            const profiles = await response.json();
            
            if (profiles.length === 0) {
                selectProfile.innerHTML = `<option value="">-- No AVAILABLE profiles in SM-DP+ --</option>`;
                return;
            }

            selectProfile.innerHTML = profiles.map(p => `
                <option value="${p.iccid}">ICCID: ${p.iccid} (${p.networkType} - ${p.mccMnc})</option>
            `).join('');
        } catch (e) {
            selectProfile.innerHTML = `<option value="">-- Failed to load profiles --</option>`;
        }
    }

    // Trigger eSIM Profile Provisioning (ESipa trigger)
    async function triggerProfileDownload() {
        const iccid = selectProfile.value;
        const profileType = selectProfileType.value;

        if (!selectedEid) {
            alert('Please select a device first.');
            return;
        }
        if (!iccid) {
            alert('Please select an eSIM profile to provision.');
            return;
        }

        btnTriggerDownload.disabled = true;
        addConsoleLog(`[eIM] Issuing profile download order for ICCID: ${iccid}...`, 'info');

        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/devices/${selectedEid}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iccid, profileType })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                addConsoleLog(`[eIM] Remote download trigger pushed successfully.`, 'success');
            } else {
                throw new Error(data.message || 'Trigger rejected');
            }
        } catch (e) {
            addConsoleLog(`[eIM] Remote download trigger failed: ${e.message}`, 'error');
        } finally {
            btnTriggerDownload.disabled = false;
            loadAuditLogs();
            loadSmdpProfiles(); // Refresh available profile dropdown
        }
    }

    // Trigger Remote Lifecycle Operation (PSMO)
    async function triggerPsmo(iccid, operation) {
        if (!selectedEid) return;
        
        if (!confirm(`Are you sure you want to remotely ${operation.toLowerCase()} profile ${iccid}?`)) {
            return;
        }

        addConsoleLog(`[eIM] Sending Remote PSMO ${operation} trigger for ICCID: ${iccid}...`, 'info');
        
        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/devices/${selectedEid}/psmo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iccid, operation })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                addConsoleLog(`[eIM] Remote ${operation} executed successfully.`, 'success');
            } else {
                throw new Error(data.message || 'Operation rejected');
            }
        } catch (e) {
            addConsoleLog(`[eIM] Remote ${operation} failed: ${e.message}`, 'error');
        } finally {
            loadAuditLogs();
            loadIpaStatus();
        }
    }

    // Load Audit Logs
    async function loadAuditLogs() {
        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/audit-logs`);
            if (!response.ok) throw new Error('Failed to fetch audit logs');
            const logs = await response.json();
            
            eimAuditLogs.innerHTML = logs.map(l => {
                const badgeColor = l.status === 'SUCCESS' ? 'var(--success-glow)' : 'var(--warning-glow)';
                return `
                    <div style="margin-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.3rem;">
                        <span style="color: var(--text-muted);">${new Date(l.timestamp).toLocaleTimeString()}</span> 
                        <span style="font-weight:600; color:var(--primary-glow);">${l.action}</span> 
                        <span style="color: ${badgeColor}; font-weight:600;">[${l.status}]</span>
                        <div style="padding-left: 0.5rem; color: var(--text-secondary); font-size: 0.7rem;">${escapeHtml(l.details)}</div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            eimAuditLogs.innerHTML = `<div style="color: var(--warning-glow);">Failed to load audit logs.</div>`;
        }
    }

    // Load IPA Simulator Status and Logs (Port 8097)
    async function loadIpaStatus() {
        try {
            const response = await fetch(`${IPA_BACKEND_BASE}/status`);
            if (!response.ok) throw new Error('Failed to query IPA');
            const data = await response.json();

            // 1. Render eUICC profiles
            if (data.profiles.length === 0) {
                euiccProfilesList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No profiles installed.</td></tr>`;
            } else {
                euiccProfilesList.innerHTML = data.profiles.map(p => {
                    const isEnabled = p.profileState === 'ENABLED';
                    const stateColor = isEnabled ? 'var(--success-glow)' : 'var(--text-muted)';
                    const actionBtn = isEnabled 
                        ? `<button class="btn btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" onclick="window.triggerIotPsmo('${p.iccid}', 'DISABLE')">Disable</button>`
                        : `<button class="btn btn-primary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" onclick="window.triggerIotPsmo('${p.iccid}', 'ENABLE')">Enable</button>`;
                    const deleteBtn = `<button class="btn btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem; background: rgba(220,53,69,0.1); color: var(--warning-glow); border-color: rgba(220,53,69,0.2);" onclick="window.triggerIotPsmo('${p.iccid}', 'DELETE')">Delete</button>`;

                    return `
                        <tr>
                            <td style="padding: 0.6rem; font-family: monospace; font-size: 0.75rem;">${escapeHtml(p.iccid)}</td>
                            <td style="padding: 0.6rem; font-size: 0.75rem;">${escapeHtml(p.smdpAddress)}</td>
                            <td style="padding: 0.6rem; font-weight: 600; color: ${stateColor}; font-size: 0.75rem;">${escapeHtml(p.profileState)}</td>
                            <td style="padding: 0.6rem; display: flex; align-items: center;">${actionBtn}${deleteBtn}</td>
                        </tr>
                    `;
                }).join('');
            }

            // 2. Render IPA Logs
            if (data.logs.length > 0) {
                ipaConsole.innerHTML = data.logs.map(logLine => {
                    let style = 'color: var(--text-secondary);';
                    if (logLine.includes('Error') || logLine.includes('failed')) {
                        style = 'color: var(--warning-glow); font-weight: 500;';
                    } else if (logLine.includes('complete') || logLine.includes('successfully')) {
                        style = 'color: var(--success-glow); font-weight: 500;';
                    } else if (logLine.includes('Verifying') || logLine.includes('remote trigger')) {
                        style = 'color: var(--primary-glow);';
                    }
                    return `<div class="log-line" style="${style}">${escapeHtml(logLine)}</div>`;
                }).join('');
                ipaConsole.scrollTop = ipaConsole.scrollHeight;
            }
        } catch (e) {
            euiccProfilesList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--warning-glow); padding: 1.5rem;">IPA simulator offline or unreachable.</td></tr>`;
        }
    }

    // Clear IPA Logs
    async function clearIpaLogs() {
        try {
            await fetch(`${IPA_BACKEND_BASE}/logs/clear`, { method: 'POST' });
            ipaConsole.innerHTML = `<div class="log-line info" style="color: var(--text-muted);">IPA simulator terminal cleared.</div>`;
        } catch (e) {
            console.error('Failed to clear logs', e);
        }
    }

    // Deregister IoT Device
    async function deregisterDevice(eid) {
        if (!confirm(`Are you sure you want to remove device EID: ${eid} from the fleet inventory?`)) {
            return;
        }

        try {
            const response = await fetch(`${EIM_BACKEND_BASE}/api/eim/devices/${eid}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Deregistration failed');

            if (selectedEid === eid) {
                selectedEid = null;
                selectedDeviceName = 'No Device Selected';
                selectedDeviceLabel.textContent = 'No Device';
                eimOpsPanel.style.display = 'none';
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                euiccProfilesList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Select registered IoT device to view eUICC status.</td></tr>';
            }

            await loadDevices();
            loadAuditLogs();
        } catch (e) {
            alert('Failed to remove device: ' + e.message);
        }
    }

    // Expose lifecycle triggers to window object for inline HTML onclick handlers
    window.triggerIotPsmo = function(iccid, operation) {
        triggerPsmo(iccid, operation);
    };

    window.deregisterIotDevice = function(eid) {
        deregisterDevice(eid);
    };

    // Event Listeners
    btnRegisterDevice.addEventListener('click', registerDevice);
    btnTriggerDownload.addEventListener('click', triggerProfileDownload);
    btnClearIpaLogs.addEventListener('click', clearIpaLogs);

    // Initial Load
    loadDevices();
    loadSmdpProfiles();
    loadAuditLogs();

    // Refresh devices and audit logs every 5 seconds
    setInterval(() => {
        loadDevices();
        loadAuditLogs();
    }, 5000);

})();
