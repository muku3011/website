// Minimal client-side submission to backend API

// Change this to your backend URL if different (e.g., https://api.yourdomain.com)
const CONTACT_API_URL = 'https://irku.se:8700/contact';

(function() {
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('contactStatus');

  function showStatus(message, ok) {
    statusEl.style.display = 'block';
    statusEl.className = ok ? 'alert alert-success' : 'alert alert-danger';
    statusEl.textContent = message;
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const data = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      message: document.getElementById('message').value.trim(),
      newsletter: document.getElementById('newsletter').checked
    };

    if (!data.firstName || !data.lastName || !data.email || !data.subject || !data.message) {
      showStatus('Please fill all required fields.', false);
      return;
    }

    try {
      const resp = await fetch(CONTACT_API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      if (resp.ok) {
        showStatus('Thanks! Your message has been sent.', true);
        form.reset();
      } else {
        const text = await resp.text();
        showStatus('Failed to send message. ' + (text || 'Please try again later.'), false);
      }
    } catch (err) {
      showStatus('Network error. Please try again later.', false);
      console.error(err);
    }
  });
})();
