// Minimal client-side submission to backend API
const CONTACT_BASE = window.API_CONFIG?.CONTACT_BASE || 'https://irku.se:8700/api/contact';

const API = {
  contact: (payload) =>
    fetch(`${CONTACT_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
};

const el = (id) => document.getElementById(id);

// Unified notifications like the rest of the site
function notify(message, ok = true) {
  if (typeof showNotification === 'function') {
    showNotification(message, ok ? 'success' : 'info'); // align with site's notification types
  } else {
    // Fallback to inline status if global notifier isn't available yet
    const statusEl = el('contactStatus');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = ok ? 'alert alert-success' : 'alert alert-danger';
      statusEl.textContent = message;
    }
  }
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
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.subject || !payload.message) {
      notify('Please fill all required fields.', false);
      if (submitBtn) delete submitBtn.dataset.busy;
      return;
    }

    try {
      const resp = await API.contact(payload);

      let bodyText = '';
      try {
        const json = await resp.clone().json().catch(() => null);
        if (json && (json.message || json.error)) bodyText = json.message || json.error;
      } catch (_) {}
      if (!bodyText) {
        bodyText = await resp.clone().text().catch(() => '');
      }

      if (resp.ok) {
        notify(bodyText || 'Thanks! Your message has been sent.', true);
        form.reset();
      } else {
        notify(bodyText || 'Failed to send message. Please try again later.', false);
        console.warn('Contact POST failed', { status: resp.status, text: bodyText });
      }
    } catch (err) {
      console.error('Contact submit error', err);
      notify('Network error or CORS issue. Please try again later.', false);
    } finally {
      if (submitBtn) delete submitBtn.dataset.busy;
    }
  });
})();
