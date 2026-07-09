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

    // ── CPU ──────────────────────────────────────────────────────────────────
    const cpuObj = d.cpu ?? {};
    const cpu = Math.round(cpuObj.overall ?? d.cpu ?? 0);
    document.getElementById('cpu-value').textContent = cpu + '%';

    const la = d.loadAvg ?? {};
    document.getElementById('cpu-load').textContent =
        `Load: ${la.oneMin ?? '—'} / ${la.fiveMin ?? '—'} / ${la.fifteenMin ?? '—'}`;
    setProgress('cpu-bar', cpu);

    const temp = d.cpuTempCelsius;
    document.getElementById('cpu-temp').textContent =
        temp > 0 ? `🌡 ${temp.toFixed(1)}°C` : '';

    // CPU model & core bars
    const modelEl = document.getElementById('cpu-model');
    if (modelEl) modelEl.textContent = cpuObj.model ?? '';

    const coresEl = document.getElementById('cpu-cores');
    if (coresEl && Array.isArray(cpuObj.cores) && cpuObj.cores.length > 0) {
      coresEl.innerHTML = cpuObj.cores.map((pct, i) => {
        const cls = pct > 90 ? 'crit' : pct > 75 ? 'warn' : '';
        return `<div class="core-bar-wrap">
          <span class="core-label">C${i}</span>
          <div class="core-track"><div class="core-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="core-pct">${pct}%</span>
        </div>`;
      }).join('');
    }

    // ── Memory ───────────────────────────────────────────────────────────────
    const mem = d.memory ?? {};
    const memPct = mem.percent ?? 0;
    document.getElementById('mem-value').textContent = memPct + '%';
    document.getElementById('mem-detail').textContent =
        `${mem.usedMb ?? '—'} / ${mem.totalMb ?? '—'} MB`;
    setProgress('mem-bar', memPct);

    // Memory breakdown row
    const memBreakEl = document.getElementById('mem-breakdown');
    if (memBreakEl) {
      const bc = mem.buffersCacheMb ?? 0;
      const free = mem.freeMb ?? 0;
      const swapUsed = mem.swapUsedMb ?? 0;
      const swapTotal = mem.swapTotalMb ?? 0;
      memBreakEl.innerHTML =
          `<span>Buf/Cache: ${bc} MB</span><span>Free: ${free} MB</span>` +
          (swapTotal > 0 ? `<span>Swap: ${swapUsed}/${swapTotal} MB</span>` : '');
    }

    // ── Disk ─────────────────────────────────────────────────────────────────
    const disk = d.disk ?? {};
    const diskPct = disk.percent ?? 0;
    document.getElementById('disk-value').textContent = diskPct + '%';
    document.getElementById('disk-detail').textContent =
        `Free: ${formatBytes(disk.freeKb ?? 0)}`;
    setProgress('disk-bar', diskPct);

    // ── Processes ────────────────────────────────────────────────────────────
    const procs = d.processes ?? {};
    const procCountEl = document.getElementById('proc-count');
    if (procCountEl && procs.total) {
      procCountEl.textContent = `⚙ ${procs.running ?? 0} running / ${procs.total} total`;
    }
    const topProcsEl = document.getElementById('top-processes');
    if (topProcsEl && Array.isArray(procs.top)) {
      topProcsEl.innerHTML = procs.top.map(p =>
        `<tr>
          <td>${p.pid}</td>
          <td><span class="proc-name">${p.name}</span></td>
          <td><span class="${p.cpu > 50 ? 'val-warn' : ''}">${p.cpu.toFixed(1)}%</span></td>
          <td>${p.mem.toFixed(1)}%</td>
        </tr>`
      ).join('');
    }

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
      const stateClass = s.active ? 'active-state' : 'inactive-state';
      const httpBadge = s.httpStatus
          ? `<span class="service-tile-port">HTTP ${s.httpStatus}</span>` : '';
      return `
        <div class="service-tile ${stateClass}">
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
      { label: 'SSH Password Auth', value: s.sshPasswordAuthDisabled ? '✓ Disabled (Secure)' : '✗ Enabled (Insecure)', ok: s.sshPasswordAuthDisabled },
      { label: 'SSH Root Login', value: s.sshRootLoginDisabled ? '✓ Disabled (Secure)' : '✗ Enabled (Insecure)', ok: s.sshRootLoginDisabled },
      { label: 'Apache Security Headers', value: s.apacheSecurityHeadersActive ? '✓ Configured' : '✗ Missing', ok: s.apacheSecurityHeadersActive },
      { label: 'Kernel parameters', value: s.kernelHardeningActive ? '✓ Hardened' : '✗ Default', ok: s.kernelHardeningActive },
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
    securityOk = s.ufwActive && s.fail2banActive && s.sshPasswordAuthDisabled && s.sshRootLoginDisabled;
  } catch (e) {
    console.warn('security refresh failed:', e);
    securityOk = false;
  }
}


// ── Security Incidents ────────────────────────────────────────────────────────

async function refreshSecurityIncidents() {
  try {
    const incidents = await fetchJson(`${BASE}/security/incidents`);
    const tbody = document.getElementById('security-incidents-tbody');
    if (!tbody) return;
    if (!incidents.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No security incidents recorded.</td></tr>';
      return;
    }
    tbody.innerHTML = incidents.map(inc => {
      const timeStr = timeAgo(inc.timestamp);
      const flag = getFlagEmoji(inc.countryCode);
      const geo = inc.countryCode === 'LOCAL' ? 'Local Network (LAN)' : `${flag} ${inc.city || ''}, ${inc.country || ''}`;
      
      let typeBadge = '';
      if (inc.incidentType === 'FAIL2BAN_BAN') {
        typeBadge = '<span class="severity-chip high" style="background:hsla(0,85%,55%,0.15);color:var(--warning-glow);font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:4px;border:1px solid hsla(0,85%,55%,0.25);">Banned</span>';
      } else if (inc.incidentType === 'FAIL2BAN_UNBAN') {
        typeBadge = '<span class="severity-chip default" style="background:hsla(145,80%,50%,0.15);color:var(--success-glow);font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:4px;border:1px solid hsla(145,80%,50%,0.25);">Unbanned</span>';
      } else {
        typeBadge = '<span class="severity-chip default" style="font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:4px;background:rgba(255,255,255,0.05);color:var(--text-secondary);border:1px solid var(--card-border);">Failed SSH</span>';
      }

      const actionText = inc.blocked 
        ? '<span style="color:var(--warning-glow);font-weight:700;">Blocked</span>' 
        : '<span style="color:var(--text-secondary);">Logged</span>';

      return `
        <tr>
          <td style="font-size:0.82rem;color:var(--text-secondary);">${timeStr}</td>
          <td>
            <div style="font-weight:600;font-size:0.88rem;color:var(--text-primary);">${inc.ipAddress}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.15rem;">${geo}</div>
          </td>
          <td><code style="font-size:0.8rem;background:rgba(255,255,255,0.03);padding:0.15rem 0.35rem;border-radius:3px;border:1px solid var(--card-border);">${inc.username || '—'}</code></td>
          <td>${typeBadge}</td>
          <td style="font-size:0.85rem;">${actionText}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    console.warn('security incidents refresh failed:', e);
  }
}

// Convert 2-letter ISO code to flag emoji
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode === 'UN' || countryCode === 'LOCAL') return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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

// ── Traffic ───────────────────────────────────────────────────────────────────

const TRAFFIC_COLORS = {
  '2xx': 'hsl(142,70%,55%)',
  '3xx': 'hsl(210,80%,60%)',
  '4xx': 'hsl(38,90%,55%)',
  '5xx': 'hsl(0,75%,55%)',
};
const TRAFFIC_COLORS_ALPHA = {
  '2xx': 'hsla(142,70%,55%,0.15)',
  '3xx': 'hsla(210,80%,60%,0.15)',
  '4xx': 'hsla(38,90%,55%,0.15)',
  '5xx': 'hsla(0,75%,55%,0.15)',
};

let chartStatus = null;
let chartHourly = null;
let chartPaths  = null;

function chartDefaults() {
  return {
    color: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(255,255,255,0.08)',
  };
}

function initCharts() {
  if (chartStatus) return; // already initialised

  const ctxStatus = document.getElementById('chart-status');
  if (!ctxStatus) return;

  Chart.defaults.color = 'rgba(255,255,255,0.55)';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // ── Doughnut: status codes ────────────────────────────────────────────────
  chartStatus = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['2xx', '3xx', '4xx', '5xx'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: Object.values(TRAFFIC_COLORS),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.label}: ${ctx.raw} requests`
      }}},
      animation: { duration: 600 },
    },
  });

  // ── Area chart: hourly requests ───────────────────────────────────────────
  const ctxHourly = document.getElementById('chart-hourly');
  const grad = ctxHourly.getContext('2d').createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0,   'hsla(252,90%,68%,0.35)');
  grad.addColorStop(1,   'hsla(252,90%,68%,0.02)');

  chartHourly = new Chart(ctxHourly, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Requests',
        data: [],
        fill: true,
        backgroundColor: grad,
        borderColor: 'hsl(252,90%,68%)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { maxTicksLimit: 12 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, ticks: { precision: 0 } },
      },
      plugins: { legend: { display: false } },
      animation: { duration: 500 },
    },
  });

  // ── Horizontal bar: top paths ─────────────────────────────────────────────
  const ctxPaths = document.getElementById('chart-paths');
  chartPaths = new Chart(ctxPaths, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Requests',
        data: [],
        backgroundColor: 'hsla(190,80%,55%,0.75)',
        borderColor: 'hsl(190,80%,55%)',
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: false }, ticks: {
          font: { family: "'JetBrains Mono','Courier New',monospace", size: 10 },
          callback: v => v.length > 30 ? v.slice(0, 28) + '…' : v,
        }},
      },
      plugins: { legend: { display: false } },
      animation: { duration: 500 },
    },
  });
}

function statusBadge(code) {
  const cls = code < 300 ? 'badge-ok' : code < 400 ? 'badge-info' : code < 500 ? 'badge-warn' : 'badge-crit';
  return `<span class="status-badge ${cls}">${code}</span>`;
}

function methodBadge(m) {
  const colors = { GET: '#4fc3f7', POST: '#81c784', PUT: '#ffb74d', DELETE: '#e57373', PATCH: '#ce93d8' };
  const c = colors[m] || '#aaa';
  return `<span style="color:${c};font-weight:600;font-size:0.75rem;">${m}</span>`;
}

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fmtRelTime(iso) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

async function refreshTraffic() {
  try {
    const d = await fetchJson(`${BASE}/traffic`);

    if (d.readable === false) {
      document.getElementById('recent-requests-tbody').innerHTML =
        `<tr><td colspan="7" class="empty-state" style="color:hsl(38,90%,60%);">
          ⚠ ${d.error || 'Log not readable'}<br>
          <small style="opacity:0.6;">Run: <code>sudo usermod -aG adm rbpi</code> then restart monitor-service</small>
        </td></tr>`;
      return;
    }

    initCharts();

    // ── KPI cards ─────────────────────────────────────────────────────────────
    document.getElementById('traffic-rpm').textContent = d.requestsPerMinute ?? '0';
    document.getElementById('traffic-total').textContent =
        `${(d.totalSampled ?? 0).toLocaleString()} requests sampled`;
    document.getElementById('traffic-total-count').textContent =
        (d.totalSampled ?? 0).toLocaleString();

    const errRate = d.errorRate ?? 0;
    document.getElementById('traffic-error-rate').textContent = errRate.toFixed(1) + '%';
    const errBar = document.getElementById('traffic-error-bar');
    errBar.style.width = errRate + '%';
    errBar.className = 'progress-fill' + (errRate > 10 ? ' crit' : errRate > 5 ? ' warn' : '');

    // ── Doughnut chart ────────────────────────────────────────────────────────
    const sc = d.statusCounts ?? {};
    const keys = ['2xx', '3xx', '4xx', '5xx'];
    chartStatus.data.datasets[0].data = keys.map(k => sc[k] ?? 0);
    chartStatus.update('none');

    // Legend
    const legendEl = document.getElementById('status-legend');
    legendEl.innerHTML = keys.map(k =>
      `<span style="display:flex;align-items:center;gap:0.3rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${TRAFFIC_COLORS[k]};flex-shrink:0;"></span>
        ${k} <b>${(sc[k] ?? 0).toLocaleString()}</b>
      </span>`
    ).join('');

    // ── Hourly area chart ─────────────────────────────────────────────────────
    const hourly = d.hourlyRequests ?? [];
    chartHourly.data.labels = hourly.map(h => h.hour);
    chartHourly.data.datasets[0].data = hourly.map(h => h.count);
    chartHourly.update('none');

    // ── Top paths bar chart ───────────────────────────────────────────────────
    const paths = d.topPaths ?? [];
    chartPaths.data.labels = paths.map(p => p.path);
    chartPaths.data.datasets[0].data = paths.map(p => p.count);
    chartPaths.update('none');

    // ── Top IPs inline bars ───────────────────────────────────────────────────
    const ips = d.topIps ?? [];
    const maxIpCount = ips[0]?.count ?? 1;
    const ipsEl = document.getElementById('top-ips-list');
    if (ipsEl) {
      ipsEl.innerHTML = ips.map((ip, i) => {
        const pct = Math.round((ip.count / maxIpCount) * 100);
        return `<div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.2rem;">
            <span style="font-family:'JetBrains Mono','Courier New',monospace;">${ip.ip}</span>
            <span style="opacity:0.6;">${ip.count.toLocaleString()} req</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:hsl(${200 - i * 20},75%,55%);border-radius:4px;transition:width 0.6s ease;"></div>
          </div>
        </div>`;
      }).join('');
    }

    // ── Recent requests table ─────────────────────────────────────────────────
    const recent = d.recentRequests ?? [];
    const tbody = document.getElementById('recent-requests-tbody');
    if (tbody) {
      if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No traffic data yet</td></tr>';
      } else {
        tbody.innerHTML = recent.map(r =>
          `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:0.3rem 0.6rem;white-space:nowrap;opacity:0.6;font-size:0.75rem;">${fmtRelTime(r.timestamp)}</td>
            <td style="padding:0.3rem 0.6rem;font-family:'JetBrains Mono','Courier New',monospace;font-size:0.75rem;">${r.ip}</td>
            <td style="padding:0.3rem 0.6rem;">${methodBadge(r.method)}</td>
            <td style="padding:0.3rem 0.6rem;font-family:'JetBrains Mono','Courier New',monospace;font-size:0.75rem;
                max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.path}">${r.path}</td>
            <td style="padding:0.3rem 0.6rem;">${statusBadge(r.status)}</td>
            <td style="padding:0.3rem 0.6rem;opacity:0.6;font-size:0.75rem;">${fmtBytes(r.bytes)}</td>
            <td style="padding:0.3rem 0.6rem;opacity:0.6;font-size:0.75rem;">${r.client}</td>
          </tr>`
        ).join('');
      }
    }

  } catch (e) {
    console.warn('traffic refresh failed:', e);
  }
}

// ── Tab / Sidebar Switching Logic ───────────────────────────────────────────
let activePanel = 'panel-overview';

document.querySelectorAll('.sentinel-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sentinel-menu-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sentinel-tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    activePanel = btn.getAttribute('data-target');

    const targetPanel = document.getElementById(activePanel);
    if (targetPanel) targetPanel.classList.add('active');

    // Immediately load traffic data when tab is first opened
    if (activePanel === 'panel-traffic') refreshTraffic();
  });
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
    dotSecurity.className = 'sidebar-status-dot' + (securityOk ? '' : ' warn');
  }
  const dotAlerts = document.getElementById('dot-alerts');
  if (dotAlerts) {
    dotAlerts.className = 'sidebar-status-dot' + (alertsOk ? '' : ' warn');
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
    refreshSecurityIncidents(),
    refreshRules(),
    refreshHistory(),
  ]);
  // Only poll traffic when that tab is visible (log parsing is expensive)
  if (activePanel === 'panel-traffic') refreshTraffic();
  updateSidebarDots();
  updateTimestamp();
}


// Initial load + periodic refresh
refreshAll();
setInterval(refreshAll, POLL_INTERVAL);

