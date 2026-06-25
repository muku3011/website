// -------------------------------------------------------------
// THEME MANAGER
// -------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Load persisted theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

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
    const now = new Date();
    clockElement.textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// -------------------------------------------------------------
// METRICS (REAL-TIME STATS)
// -------------------------------------------------------------
const cpuRing = document.getElementById('cpu-ring');
const cpuVal = document.getElementById('cpu-value');
const memRing = document.getElementById('mem-ring');
const memVal = document.getElementById('mem-value');
const tempRing = document.getElementById('temp-ring');
const tempVal = document.getElementById('temp-value');

const RING_CIRCUMFERENCE = 314.159; // 2 * pi * r (r=50)

function setProgress(circle, value) {
    const offset = RING_CIRCUMFERENCE - (value / 100) * RING_CIRCUMFERENCE;
    circle.style.strokeDashoffset = offset;
}

async function updateMetrics() {
    try {
        const response = await fetch('stats.json');
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();

        // Update CPU Ring
        if (data.cpu !== undefined) {
            cpuVal.textContent = data.cpu;
            setProgress(cpuRing, data.cpu);
        }

        // Update Memory Ring
        if (data.memory !== undefined) {
            memVal.textContent = data.memory;
            setProgress(memRing, data.memory);
        }

        // Update Core Temperature (scaling it max 80°C)
        if (data.temp !== undefined) {
            tempVal.textContent = data.temp;
            setProgress(tempRing, (data.temp / 80) * 100);
        }

        // Update MicroSD OS Storage values & progress bar
        if (data.disk_pct !== undefined && data.disk_used_gb !== undefined && data.disk_total_gb !== undefined) {
            const diskValues = document.getElementById('disk-values');
            const diskBar = document.getElementById('disk-bar');
            if (diskValues) {
                diskValues.textContent = `${data.disk_used_gb}GB / ${data.disk_total_gb}GB`;
            }
            if (diskBar) {
                diskBar.style.width = `${data.disk_pct}%`;
            }
        }
    } catch (err) {
        console.warn("Could not retrieve system stats.json. Server metrics will display loading state.", err);
    }
}

// Check every 15 seconds to avoid over-burdening SD card/network
setInterval(updateMetrics, 15000);
updateMetrics(); // Initial load

// -------------------------------------------------------------
// ACCESSIBLE MODAL DIALOGS
// -------------------------------------------------------------
const openButtons = document.querySelectorAll('.open-dialog-btn');
const closeButtons = document.querySelectorAll('.close-dialog-btn');
const dialogs = document.querySelectorAll('dialog');

let dialogTriggerElement = null;

openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const dialogId = btn.getAttribute('data-target');
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialogTriggerElement = btn;
            dialog.showModal();
        }
    });
});

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
    dialog.addEventListener('close', () => {
        if (dialogTriggerElement) {
            dialogTriggerElement.focus();
            dialogTriggerElement = null;
        }
    });

    // Light dismiss: Close modal if clicking outside its bounds
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
// DNS / DDNS REAL-TIME VERIFICATION
// -------------------------------------------------------------
const btnSyncDns = document.getElementById('btn-sync-dns');
const logConsole = document.getElementById('log-console');
const publicIpEl = document.getElementById('public-ip');
const lastDdnsTimeEl = document.getElementById('last-ddns-time');
const clearLogsBtn = document.getElementById('clear-logs');

function addLogLine(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false });
    line.textContent = `[${timestamp}] ${text}`;
    logConsole.appendChild(line);
    logConsole.scrollTop = logConsole.scrollHeight;
}

btnSyncDns.addEventListener('click', async () => {
    // Disable button & indicate active sync
    btnSyncDns.disabled = true;
    btnSyncDns.innerHTML = `
        <svg class="sun-icon spin" style="display:inline-block; width:16px; height:16px; margin:0;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Verifying...
    `;
    
    addLogLine("Initiating active DNS verification...", "info");
    
    try {
        // Step 1: Fetch client public IP
        addLogLine("Querying client public WAN IP...", "info");
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (!ipRes.ok) throw new Error("Failed to query WAN IP");
        const ipData = await ipRes.json();
        const clientIp = ipData.ip;
        addLogLine(`Detected client WAN IP: ${clientIp}`, "info");

        // Step 2: Query actual A record from Google DNS-over-HTTPS (DoH) API
        addLogLine("Resolving hutta.in A record via Google DoH API...", "info");
        const dnsRes = await fetch('https://dns.google/resolve?name=hutta.in&type=A');
        if (!dnsRes.ok) throw new Error("Failed to query Google DoH resolver");
        const dnsData = await dnsRes.json();

        let dnsIp = null;
        if (dnsData.Answer && dnsData.Answer.length > 0) {
            const aRecord = dnsData.Answer.find(ans => ans.type === 1); // Type 1 is 'A' record
            if (aRecord) {
                dnsIp = aRecord.data;
            }
        }

        if (!dnsIp) {
            throw new Error("No A record found for hutta.in");
        }
        
        addLogLine(`Resolved DNS A record: ${dnsIp}`, "info");
        publicIpEl.textContent = dnsIp;

        // Step 3: Compare results
        if (clientIp === dnsIp) {
            addLogLine(`Success: DNS A record matches client public WAN IP: ${dnsIp}`, "success");
        } else {
            addLogLine(`Warning: DNS A record (${dnsIp}) does not match your current WAN IP (${clientIp}).`, "error");
            addLogLine("Note: Dynamic DNS script cron job on Raspberry Pi will synchronize automatically.", "info");
        }
        
        lastDdnsTimeEl.textContent = "Just now";

    } catch (err) {
        addLogLine(`Verification failed: ${err.message}`, "error");
        console.error("Verification failed: ", err);
    } finally {
        resetSyncButton();
    }
});

function resetSyncButton() {
    const isViewer = sessionStorage.getItem('hutta_role') === 'viewer';
    btnSyncDns.disabled = isViewer;
    btnSyncDns.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Verify DNS
    `;
    if (isViewer) {
        btnSyncDns.style.opacity = '0.6';
        btnSyncDns.style.cursor = 'not-allowed';
        btnSyncDns.title = "Actions restricted to Administrator";
    } else {
        btnSyncDns.style.opacity = '';
        btnSyncDns.style.cursor = '';
        btnSyncDns.title = "Verify DNS record status";
    }
}

clearLogsBtn.addEventListener('click', () => {
    logConsole.innerHTML = '<div class="log-line info">Console cleared. Log history empty.</div>';
});

// -------------------------------------------------------------
// CONTROL ROW ALERTS
// -------------------------------------------------------------
const controls = ["ctrl-light", "ctrl-pihole", "ctrl-security", "ctrl-nginx"];
controls.forEach(ctrlId => {
    const el = document.getElementById(ctrlId);
    if (el) {
        el.addEventListener('change', () => {
            const status = el.checked ? "Enabled" : "Disabled";
            const name = el.closest('.control-row').querySelector('span').textContent;
            addLogLine(`${name} switch toggled: ${status}`, "info");
        });
    }
});

// Add extra spinning keyframe to stylesheet programmatically for active sync status
const style = document.createElement('style');
style.textContent = `
    .spin {
        animation: spin-kf 1s linear infinite;
    }
    @keyframes spin-kf {
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

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
let userRole = 'viewer';
let displayName = '';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (isLocal) {
    // Local development mode: default to Admin with full access
    userRole = 'admin';
    displayName = 'Local Dev';
} else {
    // Production OIDC Authelia authentication (using cookies set by Apache)
    const username = getCookie('hutta_user');
    const groups = getCookie('hutta_groups') || '';
    const isAdmin = groups.split(',').includes('admins');
    userRole = isAdmin ? 'admin' : 'viewer';
    displayName = username || 'Viewer';
}

function enforceRolePermissions() {
    if (roleBadge) {
        roleBadge.style.display = 'inline-block';
        if (userRole === 'admin') {
            roleBadge.textContent = `Admin: ${displayName}`;
            roleBadge.style.background = 'hsla(145, 80%, 50%, 0.15)';
            roleBadge.style.color = 'var(--success-glow)';
            roleBadge.style.border = '1px solid hsla(145, 80%, 50%, 0.3)';
        } else {
            roleBadge.textContent = `Viewer: ${displayName}`;
            roleBadge.style.background = 'hsla(14, 90%, 60%, 0.15)';
            roleBadge.style.color = 'var(--warning-glow)';
            roleBadge.style.border = '1px solid hsla(14, 90%, 60%, 0.3)';
            
            // Apply Viewer restrictions: Disable interactive inputs
            document.querySelectorAll('.switch input').forEach(sw => {
                sw.disabled = true;
            });
            
            // Disable configuration forms inside dialogs
            document.querySelectorAll('.dialog-form').forEach(form => {
                form.querySelectorAll('select, button[type="submit"]').forEach(el => {
                    el.disabled = true;
                });
            });
        }
    }
}

// Enforce role right after DOM content is loaded
document.addEventListener('DOMContentLoaded', enforceRolePermissions);

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (isLocal) {
            window.location.replace('index.html');
        } else {
            // 1. Clear Apache mod_auth_openidc session cookie in the background
            try {
                await fetch('/redirect_uri?logout=https%3A%2F%2Fhutta.in%2F');
            } catch (err) {
                console.warn("Apache logout request failed:", err);
            }
            
            // 2. Clear Authelia SSO session cookie in the background (POST method required)
            try {
                await fetch('/authelia/api/logout', { method: 'POST' });
            } catch (err) {
                console.warn("Authelia logout request failed:", err);
            }
            
            // 3. Redirect back to hutta.in home page
            window.location.replace('https://hutta.in/');
        }
    });
}

// Run initial DNS verification on load automatically to replace simulated default data
if (btnSyncDns) {
    btnSyncDns.click();
}


