# RBPI Blog — Website

A lightweight front-end and admin UI for the RBPI blog. This repository contains the static website, an admin interface for managing posts, and a contact form — all designed to work with a separate backend API.

---

## Key features
- Admin UI to create, edit, list and delete blog posts
- Contact form with backend submission
- Shared client-side helpers for consistent notifications and DOM utilities
- Guarded submit handlers to prevent duplicate requests
- Minimal, framework-free JavaScript for easy integration

---

## Repository layout
- /index.html, /admin.html — public and admin pages
- /scripts/shared.js — shared helpers (DOM helpers, toasts, fetch wrapper)
- /scripts/blog-admin.js — admin UI logic (post CRUD)
- /scripts/contact.js — contact form logic
- /styles/ — site styles (if present)
- /assets/ — static assets (images, fonts, etc.)

---

## Prerequisites
- A static HTTP server (recommended for local testing; avoid file://)
- Backend API that exposes:
  - Blog admin: {BLOG_ADMIN_BASE}/... (default: https://irku.se:8700/api/blogs)
  - Contact endpoint: {CONTACT_BASE} (default: https://irku.se:8700/contact)
- Modern browser (Chrome/Firefox/Edge) for DevTools debugging

---

## Quick start (local)
1. Open project folder:
   c:\Users\muku3\projects\rbpi-blog\website

2. Serve site locally (example):
   - npx http-server -c-1 . -p 8080
   - or use VS Code Live Server

3. Open:
   - http://localhost:8080 (or the port you chose)

Note: Serve over HTTP(S) — don't open files directly with file:// to avoid origin issues.

---

## Configuration
The frontend reads API endpoints from `window.API_CONFIG`. You can set this in your HTML before loading scripts:

<script>
window.API_CONFIG = {
  BLOG_ADMIN_BASE: "https://your-backend:8700/api/blogs",
  CONTACT_BASE: "https://your-backend:8700/contact"
};
</script>

Default fallbacks (when `window.API_CONFIG` is not provided):
- Blog admin: https://irku.se:8700/api/blogs
- Contact: https://irku.se:8700/contact

Script load order (important):
```html
<script src="/scripts/shared.js"></script>
<script src="/scripts/blog-admin.js"></script>
<script src="/scripts/contact.js"></script>
```

---

## CORS / Backend requirements
Browsers enforce CORS. Ensure your backend returns correct CORS headers (especially for JSON requests):

- Access-Control-Allow-Origin: https://your-site-origin (or `*` where acceptable)
- Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
- Access-Control-Allow-Headers: Content-Type, Authorization
- Respond to OPTIONS preflight with 2xx and appropriate headers

Tip: JSON POST (`Content-Type: application/json`) triggers a preflight OPTIONS request. If the backend does not handle OPTIONS or lacks CORS headers, the browser will block the request. Contact script includes a form-encoded fallback to reduce preflight issues where appropriate.

---

## Troubleshooting
- "No 'Access-Control-Allow-Origin' header is present" — Inspect the OPTIONS response in DevTools → Network. Fix on server.
- Duplicate creates on save — check that `blog-admin.js` is not included multiple times and the form has the guarded submit handler (the script sets a flag on the form to avoid duplicate listeners).
- If you see network failures from contact.js but blog-admin.js works — confirm the backend exposes CORS for the specific contact endpoint path.

Useful curl for preflight testing:
curl -i -X OPTIONS "https://your-backend:8700/contact" -H "Origin: https://your-site" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type"

---

## Development guidance
- Keep shared utilities in `scripts/shared.js` to avoid duplication.
- Use the guarded submit-handler pattern used by admin scripts to prevent duplicate submissions.
- Use DevTools Network tab for request/response headers and preflight diagnostics.

---

## Contributing
- Open issues for bugs or requested features.
- Follow existing code style when updating scripts (no heavy frameworks).
- Add tests or manual verification steps for backend-facing changes (CORS, endpoints).

---

## License & contact
Add your project's license here (MIT, Apache-2.0, etc.).

For support or questions, open an issue or contact the maintainer listed in repository settings.

---
```// filepath: c:\Users\muku3\projects\rbpi-blog\website\README.md
# RBPI Blog — Website

A lightweight front-end and admin UI for the RBPI blog. This repository contains the static website, an admin interface for managing posts, and a contact form — all designed to work with a separate backend API.

---

## Key features
- Admin UI to create, edit, list and delete blog posts
- Contact form with backend submission
- Shared client-side helpers for consistent notifications and DOM utilities
- Guarded submit handlers to prevent duplicate requests
- Minimal, framework-free JavaScript for easy integration

---

## Repository layout
- /index.html, /admin.html — public and admin pages
- /scripts/shared.js — shared helpers (DOM helpers, toasts, fetch wrapper)
- /scripts/blog-admin.js — admin UI logic (post CRUD)
- /scripts/contact.js — contact form logic
- /styles/ — site styles (if present)
- /assets/ — static assets (images, fonts, etc.)

---

## Prerequisites
- A static HTTP server (recommended for local testing; avoid file://)
- Backend API that exposes:
  - Blog admin: {BLOG_ADMIN_BASE}/... (default: https://irku.se:8700/api/blogs)
  - Contact endpoint: {CONTACT_BASE} (default: https://irku.se:8700/contact)
- Modern browser (Chrome/Firefox/Edge) for DevTools debugging

---

## Quick start (local)
1. Open project folder:
   c:\Users\muku3\projects\rbpi-blog\website

2. Serve site locally (example):
   - npx http-server -c-1 . -p 8080
   - or use VS Code Live Server

3. Open:
   - http://localhost:8080 (or the port you chose)

Note: Serve over HTTP(S) — don't open files directly with file:// to avoid origin issues.

---

## Configuration
The frontend reads API endpoints from `window.API_CONFIG`. You can set this in your HTML before loading scripts:

<script>
window.API_CONFIG = {
  BLOG_ADMIN_BASE: "https://your-backend:8700/api/blogs",
  CONTACT_BASE: "https://your-backend:8700/contact"
};
</script>

Default fallbacks (when `window.API_CONFIG` is not provided):
- Blog admin: https://irku.se:8700/api/blogs
- Contact: https://irku.se:8700/contact

Script load order (important):
```html
<script src="/scripts/shared.js"></script>
<script src="/scripts/blog-admin.js"></script>
<script src="/scripts/contact.js"></script>
```

---

## CORS / Backend requirements
Browsers enforce CORS. Ensure your backend returns correct CORS headers (especially for JSON requests):

- Access-Control-Allow-Origin: https://your-site-origin (or `*` where acceptable)
- Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
- Access-Control-Allow-Headers: Content-Type, Authorization
- Respond to OPTIONS preflight with 2xx and appropriate headers

Tip: JSON POST (`Content-Type: application/json`) triggers a preflight OPTIONS request. If the backend does not handle OPTIONS or lacks CORS headers, the browser will block the request. Contact script includes a form-encoded fallback to reduce preflight issues where appropriate.

---

## Troubleshooting
- "No 'Access-Control-Allow-Origin' header is present" — Inspect the OPTIONS response in DevTools → Network. Fix on server.
- Duplicate creates on save — check that `blog-admin.js` is not included multiple times and the form has the guarded submit handler (the script sets a flag on the form to avoid duplicate listeners).
- If you see network failures from contact.js but blog-admin.js works — confirm the backend exposes CORS for the specific contact endpoint path.

Useful curl for preflight testing:
curl -i -X OPTIONS "https://your-backend:8700/contact" -H "Origin: https://your-site" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type"

---

## Development guidance
- Keep shared utilities in `scripts/shared.js` to avoid duplication.
- Use the guarded submit-handler pattern used by admin scripts to prevent duplicate submissions.
- Use DevTools Network tab for request/response headers and preflight diagnostics.

---

## Contributing
- Open issues for bugs or requested features.
- Follow existing code style when updating scripts (no heavy frameworks).
- Add tests or manual verification steps for backend-facing changes (CORS, endpoints).

---

## License & contact
Add your project's license here (MIT, Apache-2.0, etc.).

For support or questions, open an issue or contact the maintainer listed in repository settings.

---