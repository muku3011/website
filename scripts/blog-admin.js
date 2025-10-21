 // Blog API Configuration
 const API_BASE_URL = 'https://irku.se:8700/api/blogs';

 // Basic API client: adjust base URL if backend runs elsewhere
    const API = {
      list: () => fetch(`${API_BASE_URL}`+ "/all").then(r => r.json()),
      get: (id) => fetch(`${API_BASE_URL}`+ "/" + id).then(r => r.json()),
      create: (payload) => fetch(`${API_BASE_URL}`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)}).then(r=>r.json()),
      update: (id, payload) => fetch(`${API_BASE_URL}` + "/" + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)}).then(r=>r.json()),
      delete: (id) => fetch(`${API_BASE_URL}` + "/" + id, {method:'DELETE'}).then(r=>r.ok)
    };

    const el = (id) => document.getElementById(id);
    const tbody = el('postsTbody');
    function toPayload() {
      const nowIso = new Date().toISOString();
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

    function fillForm(p) {
      el('postId').value = p.id ?? '';
      el('title').value = p.title ?? '';
      el('slug').value = p.slug ?? '';
      el('author').value = p.author ?? '';
      el('summary').value = p.excerpt ?? '';
      el('content').value = p.content ?? '';
      if (el('status')) el('status').value = p.status ?? 'DRAFT';
    }

    function resetForm() {
      fillForm({id:'', title:'', slug:'', author:'', excerpt:'', content:'', status:'DRAFT'});
    }

    function rowTemplate(p) {
      const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
      return `
        <tr data-id="${p.id}">
          <td>
            <div class="fw-semibold">${p.title}</div>
            <div class="text-muted small">${p.slug}</div>
          </td>
          <td class="d-none d-md-table-cell">${p.author || ''}</td>
          <td>${updated}</td>
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
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
      if (e.target.closest('.delete-btn')) {
        const tr = e.target.closest('tr');
        const id = tr?.getAttribute('data-id');
        if (!id) return;
        if (confirm('Delete this post?')) {
          const ok = await API.delete(id);
          if (ok) await loadList();
          else alert('Failed to delete');
        }
      }
    });

    el('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el('postId').value;
      const payload = toPayload();
      try {
        if (id) {
          await API.update(id, payload);
          // keep form data as-is after update
        } else {
          const created = await API.create(payload);
          // populate returned id but keep other fields intact
          if (created && created.id) {
            el('postId').value = created.id;
          }
        }
        // do NOT reset the form; only refresh the list
        await loadList();
      } catch (err) {
        alert('Save failed');
      }
    });

    // Remove auto-reset on "New" only if you still want clearing when explicitly requested, keep as is:
    el('resetFormBtn').addEventListener('click', resetForm);
    el('newPostBtn').addEventListener('click', resetForm);

    // Init
    loadList();