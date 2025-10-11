# Website

A simple static website with a home page, blog listing, blog detail, and contact page. Suitable as a base for a personal site or small publication.

## Project Structure
- `index.html` — Home page
- `blog.html` — Blog listing
- `blog-detail.html` — Single post template
- `contact.html` — Contact page
- `styles/` — Stylesheets
- `scripts/` — JavaScript files
- `images/` — Static assets

## Getting Started
1. Clone the repository:
   - git clone <your-repo-url>
   - cd website
2. Open index.html in your browser.

Optionally, run a local static server for a better experience:
- Python 3: python -m http.server 8080
- Node (http-server): npx http-server -p 8080

Then visit http://localhost:8080.

## Editing Content
- Update page copy directly in the HTML files.
- Add images to the images/ directory and reference them with relative paths.
- Add or modify styles in styles/.
- Add behavior in scripts/.

## Blog Workflow
- Add new posts by duplicating blog-detail.html and updating the content.
- Link new posts from blog.html (or generate links dynamically if you later add a build step).

## Deployment
You can host this as static files:
- GitHub Pages: push to main (or docs) and enable Pages in repo settings.
- Netlify/Vercel: drag-and-drop the folder or connect your repo; publish the project root.

## Conventions
- Use semantic HTML where possible.
- Keep assets optimized (compress images).
- Test pages on mobile and desktop.

## Contributing
1. Create a feature branch.
2. Make your changes with clear commit messages.
3. Open a pull request.

## License
Add your preferred license (e.g., MIT) in a LICENSE file and reference it here.