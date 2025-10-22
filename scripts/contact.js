// Minimal client-side submission to backend API
const CONTACT_BASE = 'https://irku.se:8700/api/contact';

const API = {
  contact: (payload) =>
    fetch(`${CONTACT_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
};

const el = (id) => document.getElementById(id);

function showStatus(message, ok = true) {
  const statusEl = el('contactStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.className = ok ? 'alert alert-success' : 'alert alert-danger';
    statusEl.textContent = message;
  }
  // If admin popup exists, use it as well for consistent UX
  if (typeof showPopup === 'function') showPopup(message, ok ? 'success' : 'error');
}

function toPayload() {
  return {
    firstName: el('firstName')?.value.trim() || '',
    lastName: el('lastName')?.value.trim() || '',
    email: el('email')?.value.trim() || '',
    subject: el('subject')?.value.trim() || '',
    message: el('message')?.value.trim() || '',
    newsletter: !!el('newsletter')?.checked
  };
}

// Guard: ensure only ONE submit handler exists (same style as blog-admin)
(function ensureSingleSubmitHandler() {
  const form = el('contactForm');
  if (!form) {
    console.error('contactForm not found');
    return;
  }
  if (form.__saveHandlerAttached) return;
  form.__saveHandlerAttached = true;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn?.dataset.busy === '1') return;
    if (submitBtn) submitBtn.dataset.busy = '1';

    const payload = toPayload();
    // basic validation
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.subject || !payload.message) {
      showStatus('Please fill all required fields.', false);
      if (submitBtn) delete submitBtn.dataset.busy;
      return;
    }

    try {
      console.debug('Submitting contact payload', payload);
      const resp = await API.contact(payload);

      // If server returns JSON body, prefer that message; otherwise use text.
      let bodyText = '';
      try {
        const json = await resp.clone().json().catch(() => null);
        if (json && (json.message || json.error)) bodyText = json.message || json.error;
      } catch (_) { /* ignore */ }
      if (!bodyText) {
        bodyText = await resp.clone().text().catch(() => '');
      }

      if (resp.ok) {
        showStatus(bodyText || 'Thanks! Your message has been sent.', true);
        form.reset();
      } else {
        showStatus(bodyText || 'Failed to send message. Please try again later.', false);
        console.warn('Contact POST failed', { status: resp.status, text: bodyText });
      }
    } catch (err) {
      console.error('Contact submit error', err);
      // This is often a CORS/preflight/network failure
      showStatus('Network error or CORS issue. Open DevTools network tab to inspect.', false);
    } finally {
      if (submitBtn) delete submitBtn.dataset.busy;
    }
  });
})();
