// Minimal client-side submission to backend API

const CONTACT_API_URL = 'https://irku.se:8700/contact';

(function() {
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('contactStatus');

  if (!form) {
    console.error('contactForm element not found');
    return;
  }
  if (!statusEl) {
    console.error('contactStatus element not found');
    return;
  }

  function showStatus(message, ok) {
    statusEl.style.display = 'block';
    statusEl.className = ok ? 'alert alert-success' : 'alert alert-danger';
    statusEl.textContent = message;
  }

  // Use the simpler fetch shape (like blog-admin) — let browser choose mode.
  async function postJson(data) {
    console.debug('Contact POST (JSON) start', { origin: location.origin, url: CONTACT_API_URL });
    return fetch(CONTACT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-cache'
    });
  }

  async function postFormEncoded(data) {
    const formBody = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => formBody.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : (v ?? '')));
    console.debug('Contact POST (form) start', { origin: location.origin, url: CONTACT_API_URL });
    return fetch(CONTACT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
      cache: 'no-cache'
    });
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const data = {
      firstName: document.getElementById('firstName')?.value.trim() || '',
      lastName: document.getElementById('lastName')?.value.trim() || '',
      email: document.getElementById('email')?.value.trim() || '',
      subject: document.getElementById('subject')?.value.trim() || '',
      message: document.getElementById('message')?.value.trim() || '',
      newsletter: !!document.getElementById('newsletter')?.checked
    };

    if (!data.firstName || !data.lastName || !data.email || !data.subject || !data.message) {
      showStatus('Please fill all required fields.', false);
      return;
    }

    try {
      // Try JSON POST first (preferred). If it fails due to preflight/CORS, try form-encoded fallback.
      let resp = await postJson(data);

      // If server rejects JSON (CORS preflight or 4xx), attempt form-encoded fallback once.
      if (!resp.ok) {
        // quick heuristic: if preflight blocked you'll often get network error; still attempt fallback
        console.warn('JSON POST failed, attempting form-encoded fallback', { status: resp.status, url: CONTACT_API_URL });
        resp = await postFormEncoded(data);
      }

      // Helpful debug info (inspect network/headers when debugging CORS)
      console.log('Contact POST response', { status: resp.status, headers: Array.from(resp.headers.entries()) });

      if (resp.ok) {
        showStatus('Thanks! Your message has been sent.', true);
        form.reset();
      } else {
        const text = await resp.text().catch(() => '');
        showStatus('Failed to send message. ' + (text || 'Please try again later.'), false);
      }
    } catch (err) {
      // If this is a CORS/preflight failure the browser typically blocks the response and throws
      console.error('Contact submit error', err);
      showStatus('Network or CORS error. Open DevTools network tab to inspect the request/response.', false);
    }
  });
})();
