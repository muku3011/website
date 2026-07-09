/**
 * sentinel.js — Hutta.in Sentinel monitoring page logic
 * Polls /api/sentinel/* every 5 seconds and renders live metrics.
 */

const BASE = '/api/sentinel';
const RULES_URL = '/api/alert-rules';
const HISTORY_URL = '/api/alert-history';
const POLL_INTERVAL = 5000;

// Health state flags for sidebar dots
let systemOk = true;
let servicesOk = true;
let databasesOk = true;
let certificatesOk = true;
let dnsOk = true;
let securityOk = true;
let alertsOk = true;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

function setProgress(barId, pct) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const safe = Math.min(100, Math.max(0, pct));
  bar.style.width = safe + '%';
  bar.className = 'progress-fill' + (safe > 90 ? ' crit' : safe > 75 ? ' warn' : '');
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatBytes(kb) {
  if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB';
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb + ' KB';
}

// ── System Resources ──────────────────────────────────────────────────────────

async function refreshSystem() {
  try {
    const d = await fetchJson(`${BASE}/system`);
    const cpu = Math.round(d.cpu ?? 0);
    document.getElementById('cpu-value').textContent = cpu + '%';
    const la = d.loadAvg ?? {};
    document.getElementById('cpu-load').textContent =
        `Load: ${la.oneMin ?? '—'} / ${la.fiveMin ?? '—'} / ${la.fifteenMin ?? '—'}`;
    setProgress('cpu-bar', cpu);

    const temp = d.cpuTempCelsius;
    document.getElementById('cpu-temp').textContent =
        temp > 0 ? `🌡 Temp: ${temp.toFixed(1)}°C` : 'Temp: N/A';

    const mem = d.memory ?? {};
    const memPct = mem.percent ?? 0;
    document.getElementById('mem-value').textContent = memPct + '%';
    document.getElementById('mem-detail').textContent =
        `${mem.usedMb ?? '—'} MB / ${mem.totalMb ?? '—'} MB`;
    setProgress('mem-bar', memPct);

    const disk = d.disk ?? {};
    const diskPct = disk.percent ?? 0;
    document.getElementById('disk-value').textContent = diskPct + '%';
    document.getElementById('disk-detail').textContent =
        `Free: ${formatBytes(disk.freeKb ?? 0)}`;
    setProgress('disk-bar', diskPct);
    
    systemOk = (cpu < 90 && memPct < 90 && diskPct < 90);
  } catch (e) {
    console.warn('system refresh failed:', e);
    systemOk = false;
  }
}

// ── Services ──────────────────────────────────────────────────────────────────

async function refreshServices() {
  try {
    const services = await fetchJson(`${BASE}/services`);
    const grid = document.getElementById('service-grid');
    grid.innerHTML = services.map(s => {
      const status = s.active ? 'active' : 'inactive';
      const httpBadge = s.httpStatus
          ? `<span class="service-tile-port">HTTP ${s.httpStatus}</span>` : '';
      return `
        <div class="service-tile">
          <div class="service-tile-name">${s.name}</div>
          <div class="service-tile-port">:${s.port}</div>
          <div class="status-pill ${status}">
            <div class="status-dot ${status}"></div>${status}
          </div>
          ${httpBadge}
        </div>`;
    }).join('');
    servicesOk = services.every(s => s.active);
  } catch (e) {
    console.warn('services refresh failed:', e);
    servicesOk = false;
  }
}

// ── Databases ──────────────────────────────────────────────────────────────────

async function refreshDatabases() {
  try {
    const dbs = await fetchJson(`${BASE}/databases`);
    document.getElementById('db-list').innerHTML = dbs.map(db => {
      const ok = db.connected;
      return `
        <div class="data-row">
          <span class="data-label">${db.name}</span>
          <div class="status-pill ${ok ? 'active' : 'inactive'}">
            <div class="status-dot ${ok ? 'active' : 'inactive'}"></div>
            ${ok ? 'Connected' : 'Failed'}
          </div>
        </div>`;
    }).join('');
    databasesOk = dbs.every(db => db.connected);
  } catch (e) {
    console.warn('databases refresh failed:', e);
    databasesOk = false;
  }
}

// ── Certificates ──────────────────────────────────────────────────────────────

async function refreshCertificates() {
  try {
    const certs = await fetchJson(`${BASE}/certificates`);
    document.getElementById('cert-list').innerHTML = certs.map(c => {
      const days = c.daysLeft ?? -1;
      const cls = days < 14 ? 'crit' : days < 30 ? 'warn' : 'ok';
      const cron = c.certbotCronExists
          ? `<span style="color:var(--success-glow);font-size:0.78rem;">✓ certbot cron active</span>`
          : `<span style="color:var(--warning-glow);font-size:0.78rem;">⚠ certbot cron missing</span>`;
      return `
        <div class="data-row" style="flex-direction:column;align-items:flex-start;gap:0.35rem;">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <span class="data-label">${c.domain}</span>
            <span class="cert-badge ${cls}">${days >= 0 ? days + ' days left' : 'Error reading cert'}</span>
          </div>
          ${cron}
        </div>`;
    }).join('');
    certificatesOk = certs.every(c => (c.daysLeft ?? -1) >= 14);
  } catch (e) {
    console.warn('certificates refresh failed:', e);
    certificatesOk = false;
  }
}

// ── DNS ──────────────────────────────────────────────────────────────────────

async function refreshDns() {
  try {
    const d = await fetchJson(`${BASE}/dns`);
    const ddns = d.ddnsCronExists
        ? `<span style="color:var(--success-glow);font-size:0.78rem;">✓ DDNS cron active</span>`
        : `<span style="color:var(--warning-glow);font-size:0.78rem;">⚠ DDNS cron not found</span>`;

    const domainRows = (d.domains ?? []).map(dom => {
      const match = dom.matches;
      return `
        <div class="data-row">
          <span class="data-label">${dom.domain} → <code style="font-size:0.78rem;">${dom.resolvedIp ?? '?'}</code></span>
          <div class="status-pill ${match ? 'active' : 'inactive'}">
            <div class="status-dot ${match ? 'active' : 'inactive'}"></div>
            ${match ? 'Matches' : 'Mismatch'}
          </div>
        </div>`;
    }).join('');

    document.getElementById('dns-list').innerHTML = `
      <div class="data-row">
        <span class="data-label">Public IP</span>
        <span class="data-value" style="font-family:monospace;">${d.publicIp ?? '—'}</span>
      </div>
      ${domainRows}
      <div class="data-row"><span class="data-label">DDNS Status</span>${ddns}</div>`;
    dnsOk = (d.domains ?? []).every(dom => dom.matches);
  } catch (e) {
    console.warn('dns refresh failed:', e);
    dnsOk = false;
  }
}

// ── Security ──────────────────────────────────────────────────────────────────

async function refreshSecurity() {
  try {
    const s = await fetchJson(`${BASE}/security`);
    const rows = [
      { label: 'UFW Firewall', value: s.ufwActive ? '✓ Active' : '✗ Inactive', ok: s.ufwActive },
      { label: 'Fail2ban', value: s.fail2banActive ? '✓ Active' : '✗ Inactive', ok: s.fail2banActive },
      { label: 'Unattended Upgrades', value: s.unattendedUpgradesActive ? '✓ Active' : '✗ Inactive', ok: s.unattendedUpgradesActive },
      { label: 'SSH Failures (24h)', value: s.sshFailures24h ?? 0, ok: (s.sshFailures24h ?? 0) === 0 },
      { label: 'Fail2ban Banned IPs', value: s.fail2banBannedIps ?? 0, ok: true },
      { label: 'Last Auto-Upgrade', value: s.lastAutoUpgrade ?? 'N/A', ok: true },
    ];
    document.getElementById('security-list').innerHTML = rows.map(r => {
      if (r.label === 'Last Auto-Upgrade') {
        return `
          <div class="data-row" style="flex-direction: column; align-items: flex-start; gap: 0.25rem;">
            <span class="data-label">${r.label}</span>
            <span class="data-value" style="color: var(--text-secondary); text-align: left; max-width: 100%; font-size: 0.8rem; word-break: break-all;">${r.value}</span>
          </div>`;
      }
      return `
        <div class="data-row">
          <span class="data-label">${r.label}</span>
          <span class="data-value" style="color:${r.ok ? 'var(--success-glow)' : 'var(--warning-glow)'};">${r.value}</span>
        </div>`;
    }).join('');
    securityOk = s.ufwActive && s.fail2banActive;
  } catch (e) {
    console.warn('security refresh failed:', e);
    securityOk = false;
  }
}

// ── Alert Rules ───────────────────────────────────────────────────────────────

async function refreshRules() {
  try {
    const rules = await fetchJson(RULES_URL);
    const tbody = document.getElementById('rules-tbody');
    if (!rules.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No alert rules configured.</td></tr>';
      return;
    }
    tbody.innerHTML = rules.map(r => `
      <tr>
        <td>${r.component}</td>
        <td><code style="font-size:0.8rem;">${r.metric}</code></td>
        <td><code style="font-size:0.8rem;">${r.operator} ${r.threshold ?? ''}</code></td>
        <td><span class="severity-chip ${r.severity}">${r.severity}</span></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleRule(${r.id}, this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button class="btn-delete" onclick="deleteRule(${r.id})" title="Delete rule">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    console.warn('rules refresh failed:', e);
  }
}

async function toggleRule(id, enabled) {
  try {
    const rules = await fetchJson(RULES_URL);
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    rule.enabled = enabled;
    await fetch(`${RULES_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  } catch (e) {
    console.warn('toggle rule failed:', e);
  }
}

async function deleteRule(id) {
  if (!confirm('Delete this alert rule?')) return;
  try {
    await fetch(`${RULES_URL}/${id}`, { method: 'DELETE' });
    refreshRules();
  } catch (e) {
    console.warn('delete rule failed:', e);
  }
}

// ── Alert History ──────────────────────────────────────────────────────────────

async function refreshHistory() {
  try {
    const data = await fetchJson(`${HISTORY_URL}?size=30`);
    const items = data.content ?? [];
    const container = document.getElementById('alert-history');
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">No alerts have fired. All systems nominal ✓</div>';
      alertsOk = true;
      return;
    }
    container.innerHTML = items.map(e => {
      const resolvedTag = e.resolved
          ? `<span class="resolved-tag">✓ Resolved ${timeAgo(e.resolvedAt)}</span>`
          : '';
      return `
        <div class="history-item">
          <span class="severity-chip ${e.severity}">${e.severity}</span>
          <div class="history-msg">${e.message}</div>
          <span class="history-time">${timeAgo(e.firedAt)}</span>
          ${resolvedTag}
        </div>`;
    }).join('');
    alertsOk = (items.filter(e => !e.resolved).length === 0);
  } catch (e) {
    console.warn('history refresh failed:', e);
    alertsOk = false;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

document.getElementById('new-rule-btn').addEventListener('click', () => {
  document.getElementById('edit-rule-id').value = '';
  document.getElementById('rule-component').value = '';
  document.getElementById('rule-metric').value = 'service_status';
  document.getElementById('rule-operator').value = '!=';
  document.getElementById('rule-threshold').value = '';
  document.getElementById('rule-severity').value = 'default';
  document.getElementById('rule-modal').classList.add('open');
});

document.getElementById('rule-cancel-btn').addEventListener('click', () => {
  document.getElementById('rule-modal').classList.remove('open');
});

document.getElementById('rule-save-btn').addEventListener('click', async () => {
  const id = document.getElementById('edit-rule-id').value;
  const rule = {
    component: document.getElementById('rule-component').value.trim(),
    metric: document.getElementById('rule-metric').value,
    operator: document.getElementById('rule-operator').value,
    threshold: document.getElementById('rule-threshold').value.trim(),
    severity: document.getElementById('rule-severity').value,
    enabled: true
  };
  if (!rule.component || !rule.threshold) {
    alert('Please fill in Component and Threshold.');
    return;
  }
  try {
    if (id) {
      await fetch(`${RULES_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
    } else {
      await fetch(RULES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
    }
    document.getElementById('rule-modal').classList.remove('open');
    refreshRules();
  } catch (e) {
    console.warn('save rule failed:', e);
  }
});

// Close modal on backdrop click
document.getElementById('rule-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ── Main Polling Loop ─────────────────────────────────────────────────────────

function updateTimestamp() {
  document.getElementById('last-refreshed').textContent =
      'Updated ' + new Date().toLocaleTimeString();
}

function updateSidebarDots() {
  const dotOverview = document.getElementById('dot-overview');
  if (dotOverview) {
    const ok = systemOk && servicesOk;
    dotOverview.className = 'sidebar-status-dot' + (ok ? '' : ' warn');
  }

  const dotInfra = document.getElementById('dot-infrastructure');
  if (dotInfra) {
    const ok = databasesOk && certificatesOk && dnsOk;
    dotInfra.className = 'sidebar-status-dot' + (ok ? '' : ' warn');
  }

  const dotSecurity = document.getElementById('dot-security');
  if (dotSecurity) {
    const ok = securityOk;
    dotSecurity.className = 'sidebar-status-dot' + (ok ? '' : ' warn');
  }

  const dotAlerts = document.getElementById('dot-alerts');
  if (dotAlerts) {
    const ok = alertsOk;
    dotAlerts.className = 'sidebar-status-dot' + (ok ? '' : ' warn');
  }
}

async function refreshAll() {
  await Promise.allSettled([
    refreshSystem(),
    refreshServices(),
    refreshDatabases(),
    refreshCertificates(),
    refreshDns(),
    refreshSecurity(),
    refreshRules(),
    refreshHistory(),
  ]);
  updateSidebarDots();
  updateTimestamp();
}

// ── Tab / Sidebar Switching Logic ───────────────────────────────────────────
document.querySelectorAll('.sentinel-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sentinel-menu-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sentinel-tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');

    const targetPanel = document.getElementById(btn.getAttribute('data-target'));
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  });
});

// Initial load + periodic refresh
refreshAll();
setInterval(refreshAll, POLL_INTERVAL);
