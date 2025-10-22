// Blog API Configuration
const API_BASE_URL = 'https://irku.se:8700/api/blogs';

// Basic API client: adjust base URL if backend runs elsewhere
const API = {
  list: () => fetch(`${API_BASE_URL}` + "/all").then(r => r.json()),
  get: (id) => fetch(`${API_BASE_URL}` + "/" + id).then(r => r.json()),
  create: (payload) => fetch(`${API_BASE_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  update: (id, payload) => fetch(`${API_BASE_URL}` + "/" + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  delete: (id) => fetch(`${API_BASE_URL}` + "/" + id, { method: 'DELETE' }).then(r => r.ok)
};

const el = (id) => document.getElementById(id);
const tbody = el('postsTbody');
function toPayload() {
  return {
    id: 0,
    title: el('title').value.trim(),
    content: el('content').value,
    excerpt: el('summary').value.trim(),
    author: el('author').value.trim() || 'Mukesh Joshi',
    featuredImageUrl: el('featuredImageUrl') ? el('featuredImageUrl').value.trim() : '',
    slug: el('slug').value.trim(),
    status: (el('status')?.value || 'DRAFT'),
    isFeatured: true,
  };
}

// Track previous status to confirm on save
let __prevStatus = null;

// Sync baseline when loading a post
function fillForm(p) {
  el('postId').value = p.id ?? '';
  el('title').value = p.title ?? '';
  el('slug').value = p.slug ?? '';
  el('author').value = p.author ?? '';
  el('summary').value = p.excerpt ?? '';
  el('content').value = p.content ?? '';
  if (el('status')) {
    el('status').value = p.status ?? 'DRAFT';
    __prevStatus = el('status').value;
  }
}

// Themed confirm dialog reused for save
function confirmStatusChange(from, to) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,0.45);
      display: grid; place-items: center;
    `;
    const card = document.createElement('div');
    card.style.cssText = `
      width: 92%; max-width: 460px; border-radius: 14px; overflow: hidden;
      background: #ffffff; color: #2c3e50; box-shadow: 0 25px 70px rgba(0,0,0,0.25);
    `;
    card.innerHTML = `
      <div style="padding:16px 18px; font-weight:700; border-bottom:1px solid #eef2f5;">
        Change Status
      </div>
      <div style="padding:16px 18px;">
        Are you sure you want to change status from
        <span class="badge bg-secondary ms-1 me-1">${from}</span>
        to
        <span class="badge ${to === 'PUBLISHED' ? 'bg-success' : 'bg-secondary'} ms-1">${to}</span>?
      </div>
      <div style="padding:12px 18px; background:#fafafa; border-top:1px solid #eef2f5; display:flex; gap:10px; justify-content:flex-end;">
        <button id="st-cancel" class="btn btn-light">Cancel</button>
        <button id="st-ok" class="btn ${to === 'PUBLISHED' ? 'btn-success' : 'btn-primary'}">Confirm</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = (val) => { overlay.remove(); resolve(val); };
    card.querySelector('#st-cancel').addEventListener('click', () => cleanup(false));
    card.querySelector('#st-ok').addEventListener('click', () => cleanup(true));
  });
}

// Save handler: single request on create, no duplicate submission
// Guard: ensure only ONE submit handler exists
(function ensureSingleSubmitHandler() {
  const form = document.getElementById('postForm');
  if (!form) return;
  if (form.__saveHandlerAttached) return;

  form.__saveHandlerAttached = true;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // prevent accidental double-submit clicks
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn?.dataset.busy === '1') return;
    if (submitBtn) submitBtn.dataset.busy = '1';

    const id = el('postId').value;
    const payload = toPayload();

    const current = (payload.status || 'DRAFT').toUpperCase();
    const previous = (typeof __prevStatus === 'string' ? __prevStatus : (el('status')?.value || 'DRAFT')).toUpperCase();

    const involvesDraftPublished =
      (previous === 'DRAFT' && current === 'PUBLISHED') ||
      (previous === 'PUBLISHED' && current === 'DRAFT');

    try {
      if (involvesDraftPublished) {
        const ok = await confirmStatusChange(previous, current);
        if (!ok) {
          showPopup('Status change cancelled', 'info');
          return;
        }
      }

      if (id) {
        await API.update(id, payload);
        showPopup('Post updated successfully', 'success');
      } else {
        // Single POST only
        const created = await API.create(payload);
        if (created && created.id) el('postId').value = created.id;
        showPopup('Post created successfully', 'success');
      }

      __prevStatus = current;
      await loadList();
    } catch (err) {
      showPopup('Save failed', 'error');
    } finally {
      if (submitBtn) delete submitBtn.dataset.busy;
    }
  });
})();

function resetForm() {
  fillForm({ id: '', title: '', slug: '', author: '', excerpt: '', content: '', status: 'DRAFT' });
}

function rowTemplate(p) {
  const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
  const status = (p.status || 'DRAFT').toUpperCase();
  const statusBadgeClass = status === 'PUBLISHED' ? 'bg-success' : status === 'ARCHIVED' ? 'bg-dark' : 'bg-secondary';
  return `
        <tr data-id="${p.id}">
          <td>
            <div class="fw-semibold">${p.title}</div>
            <div class="text-muted small">${p.slug}</div>
          </td>
          <td class="d-none d-md-table-cell">${p.author || ''}</td>
          <td>${updated}</td>
          <td class="d-none d-md-table-cell"><span class="badge ${statusBadgeClass}">${status}</span></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2 edit-btn"><i class="fa-solid fa-pen-to-square me-1"></i>Edit</button>
            <button class="btn btn-sm btn-outline-danger delete-btn"><i class="fa-regular fa-trash-can me-1"></i>Delete</button>
          </td>
        </tr>
      `;
}

function renderList(list) {
  tbody.innerHTML = list.map(rowTemplate).join('');
}

async function loadList() {
  const all = await API.list();
  window.__ALL_POSTS__ = Array.isArray(all) ? all : [];
  applySearch();
}

function applySearch() {
  const q = el('searchInput').value.trim().toLowerCase();
  const filtered = (window.__ALL_POSTS__ || []).filter(p => {
    return [p.title, p.author, p.slug].join(' ').toLowerCase().includes(q);
  });
  renderList(filtered);
}

// Events
document.addEventListener('click', async (e) => {
  if (e.target.closest('.edit-btn')) {
    const tr = e.target.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;
    const data = await API.get(id);
    fillForm(data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showPopup('Loaded post for editing', 'info');
  }
  if (e.target.closest('.delete-btn')) {
    const tr = e.target.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    // Themed confirm dialog (lightweight)
    const confirmHolder = document.createElement('div');
    confirmHolder.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: grid; place-items: center; z-index: 1100;
    `;
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #fff; color: #2c3e50; border-radius: 12px; width: 90%; max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden;
    `;
    dialog.innerHTML = `
      <div style="padding: 16px 18px; border-bottom: 1px solid #eee; font-weight: 700;">Delete Post</div>
      <div style="padding: 16px 18px;">Are you sure you want to delete this post?</div>
      <div style="padding: 12px 18px; display:flex; gap:10px; justify-content: flex-end; background:#fafafa; border-top:1px solid #eee;">
        <button id="dlg-cancel" class="btn btn-light">Cancel</button>
        <button id="dlg-ok" class="btn btn-danger">Delete</button>
      </div>
    `;
    confirmHolder.appendChild(dialog);
    document.body.appendChild(confirmHolder);

    const cleanup = () => confirmHolder.remove();
    dialog.querySelector('#dlg-cancel').addEventListener('click', cleanup);
    dialog.querySelector('#dlg-ok').addEventListener('click', async () => {
      cleanup();
      const ok = await API.delete(id);
      if (ok) {
        await loadList();
        showPopup('Post deleted', 'success');
      } else {
        showPopup('Failed to delete', 'error');
      }
    });
  }
});

// duplicate submit handler removed — single guarded handler above is used

// Remove auto-reset on "New" only if you still want clearing when explicitly requested, keep as is:
el('resetFormBtn').addEventListener('click', resetForm);
el('newPostBtn').addEventListener('click', resetForm);

// Init
loadList();

// Helpers: themed popup (toast) notifications
function showPopup(message, type = 'info') {
  let holder = document.getElementById('admin-toast-holder');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'admin-toast-holder';
    holder.style.position = 'fixed';
    holder.style.top = '20px';
    holder.style.right = '20px';
    holder.style.zIndex = '1080';
    document.body.appendChild(holder);
  }

  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  toast.innerHTML = `
    <div class="admin-toast-body">
      <i class="me-2 ${type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-times-circle' : type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle'}"></i>
      <span>${message}</span>
      <button class="admin-toast-close" aria-label="Close">&times;</button>
    </div>
  `;

  // Inline styles to match site theme without extra CSS files
  toast.style.cssText = `
    min-width: 260px;
    max-width: 420px;
    margin-bottom: 12px;
    color: #fff;
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.2);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    animation: adminToastIn .25s ease-out both;
    border: 1px solid rgba(255,255,255,0.12);
  `;
  const bgMap = {
    success: 'linear-gradient(135deg, #2ecc71, #27ae60)',
    error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
    warning: 'linear-gradient(135deg, #f39c12, #d68910)',
    info: 'linear-gradient(135deg, #3498db, #2980b9)',
  };
  toast.style.background = bgMap[type] || bgMap.info;

  const body = toast.querySelector('.admin-toast-body');
  body.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const closeBtn = toast.querySelector('.admin-toast-close');
  closeBtn.style.cssText = `
    margin-left: 10px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.9);
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
  `;

  // Keyframes (only once)
  if (!document.getElementById('admin-toast-anim')) {
    const style = document.createElement('style');
    style.id = 'admin-toast-anim';
    style.textContent = `
      @keyframes adminToastIn { from {opacity:0; transform: translateY(-6px)} to {opacity:1; transform: translateY(0)} }
      @keyframes adminToastOut { to {opacity:0; transform: translateY(-6px)} }
    `;
    document.head.appendChild(style);
  }

  closeBtn.addEventListener('click', () => {
    toast.style.animation = 'adminToastOut .2s ease-in forwards';
    setTimeout(() => toast.remove(), 180);
  });

  holder.appendChild(toast);
  setTimeout(() => {
    if (!toast.isConnected) return;
    toast.style.animation = 'adminToastOut .2s ease-in forwards';
    setTimeout(() => toast.remove(), 180);
  }, 3500);
}

// Replace window.alert usages with themed popups