// -------------------------------------------------------------
// TECHNOLOGY BLOG UI CONTROLLER
// -------------------------------------------------------------

const BLOG_BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8094' 
    : '';

let blogPosts = [];
let selectedTag = 'ALL';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    initBlog();
});

function initBlog() {
    // Check logged in state
    updateUserView();
    
    // Fetch initial blog data
    fetchBlogPosts();

    // Attach Event Listeners
    const searchInput = document.getElementById('blog-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterAndRenderPosts();
        });
    }

    const createBtn = document.getElementById('btn-create-post');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            openPostEditor(null);
        });
    }

    // Modal close bindings
    document.querySelectorAll('.close-dialog-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dialogId = btn.getAttribute('data-close');
            const dialog = document.getElementById(dialogId);
            if (dialog) dialog.close();
        });
    });

    // Image preview helper
    const imageInput = document.getElementById('edit-image-file');
    const imagePreview = document.getElementById('image-upload-preview');
    const previewPlaceholder = document.getElementById('image-upload-preview-placeholder');
    if (imageInput && imagePreview) {
        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    if (previewPlaceholder) previewPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.src = '';
                imagePreview.style.display = 'none';
                if (previewPlaceholder) previewPlaceholder.style.display = 'block';
            }
        });
    }

    // Live Preview real-time keyup/input listeners
    const editTitle = document.getElementById('edit-title');
    const editSummary = document.getElementById('edit-summary');
    const editTags = document.getElementById('edit-tags');
    const editContent = document.getElementById('edit-content');
    if (editTitle) editTitle.addEventListener('input', updateLivePreview);
    if (editSummary) editSummary.addEventListener('input', updateLivePreview);
    if (editTags) editTags.addEventListener('input', updateLivePreview);
    if (editContent) editContent.addEventListener('input', updateLivePreview);

    // Inline image uploader binding
    const insertImageBtn = document.getElementById('btn-insert-image');
    const inlineImageFile = document.getElementById('inline-image-file');
    if (insertImageBtn && inlineImageFile) {
        insertImageBtn.addEventListener('click', () => {
            inlineImageFile.click();
        });
        inlineImageFile.addEventListener('change', handleInlineImageUpload);
    }

    // Edit Form Submission buttons
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const savePublishBtn = document.getElementById('btn-save-publish');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleFormSubmit(false);
        });
    }
    if (savePublishBtn) {
        savePublishBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleFormSubmit(true);
        });
    }

    // URL Routing event listeners
    const viewDialog = document.getElementById('dialog-view-post');
    if (viewDialog) {
        viewDialog.addEventListener('close', () => {
            const url = new URL(window.location.href);
            if (url.searchParams.has('post')) {
                url.searchParams.delete('post');
                window.history.pushState({}, '', url.toString());
            }
        });
    }

    window.addEventListener('popstate', handlePopState);
}

// -------------------------------------------------------------
// CORE FETCH & RENDER LOGIC
// -------------------------------------------------------------

async function fetchBlogPosts() {
    const container = document.getElementById('blog-posts-container');
    try {
        const response = await fetch(`${BLOG_BACKEND_BASE}/api/blog/posts`);
        if (!response.ok) {
            throw new Error(`Failed to load posts (HTTP ${response.status})`);
        }
        blogPosts = await response.json();
        
        // Dynamically build tag filters list
        buildTagFilters();

        // Render matching posts
        filterAndRenderPosts();

        // Check initial URL parameters to open a post or filter by tag
        handleInitialUrlParams();
    } catch (err) {
        console.error(err);
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--error-glow);">
                    <p style="font-size: 1.1rem; font-weight: 600;">Error Loading Articles</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.8;">${err.message}</p>
                </div>
            `;
        }
    }
}

function buildTagFilters() {
    const tagFiltersContainer = document.getElementById('blog-tag-filters');
    if (!tagFiltersContainer) return;

    // Collect all tags
    const allTags = new Set();
    blogPosts.forEach(post => {
        if (post.tags) {
            post.tags.split(',').forEach(t => {
                const cleaned = t.trim();
                if (cleaned) allTags.add(cleaned);
            });
        }
    });

    // Reset list and keep "All Posts"
    tagFiltersContainer.innerHTML = `<span class="blog-tag ${selectedTag === 'ALL' ? 'active' : ''}" data-tag="ALL">All Posts</span>`;

    // Append dynamic tags
    Array.from(allTags).sort().forEach(tag => {
        const span = document.createElement('span');
        span.className = `blog-tag ${selectedTag === tag ? 'active' : ''}`;
        span.textContent = tag;
        span.setAttribute('data-tag', tag);
        tagFiltersContainer.appendChild(span);
    });

    // Attach click listeners to tags
    tagFiltersContainer.querySelectorAll('.blog-tag').forEach(tagSpan => {
        tagSpan.addEventListener('click', () => {
            tagFiltersContainer.querySelectorAll('.blog-tag').forEach(t => t.classList.remove('active'));
            tagSpan.classList.add('active');
            selectedTag = tagSpan.getAttribute('data-tag');

            // Update URL search parameters
            const url = new URL(window.location.href);
            if (selectedTag === 'ALL') {
                url.searchParams.delete('tag');
            } else {
                url.searchParams.set('tag', selectedTag);
            }
            window.history.pushState({}, '', url.toString());

            filterAndRenderPosts();
        });
    });
}

function filterAndRenderPosts() {
    const container = document.getElementById('blog-posts-container');
    if (!container) return;

    const filtered = blogPosts.filter(post => {
        // Filter by Tag
        if (selectedTag !== 'ALL') {
            const postTags = post.tags ? post.tags.split(',').map(t => t.trim().toLowerCase()) : [];
            if (!postTags.includes(selectedTag.toLowerCase())) return false;
        }

        // Filter by Search Query
        if (searchQuery) {
            const inTitle = post.title && post.title.toLowerCase().includes(searchQuery);
            const inSummary = post.summary && post.summary.toLowerCase().includes(searchQuery);
            const inContent = post.content && post.content.toLowerCase().includes(searchQuery);
            const inTags = post.tags && post.tags.toLowerCase().includes(searchQuery);
            if (!inTitle && !inSummary && !inContent && !inTags) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
                <p style="font-size: 1.1rem;">No articles found matching the criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    const isLoggedIn = isUserLoggedIn();

    filtered.forEach(post => {
        const card = document.createElement('article');
        card.className = 'widget-card blog-card';

        // Render Image Banner
        let imageHtml = '';
        if (post.imageUrl) {
            const fullImgUrl = post.imageUrl.startsWith('/') ? `${BLOG_BACKEND_BASE}${post.imageUrl}` : post.imageUrl;
            imageHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(post.title)}" class="blog-card-image">`;
        } else {
            imageHtml = `
                <div class="blog-card-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V5A2.5 2.5 0 0 1 6.5 2.5H20M20 2v20"/></svg>
                </div>`;
        }

        // Tags parsing
        let tagsHtml = '';
        if (post.tags) {
            tagsHtml = '<div class="blog-tags-container">' + 
                post.tags.split(',').map(t => `<span class="blog-tag" style="pointer-events:none;">${escapeHtml(t.trim())}</span>`).join('') +
                '</div>';
        }

        // Formatted Date
        const dateStr = new Date(post.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Draft badge
        let draftBadgeHtml = '';
        if (post.published === false || !post.published) {
            draftBadgeHtml = `<span class="blog-tag" style="background: var(--warning-glow); color: black; border: none; font-size: 0.7rem; padding: 0.1rem 0.35rem; font-weight: bold; margin-left: 0.5rem; text-shadow: none;">Draft</span>`;
        }

        // Admin action row
        let adminActionHtml = '';
        if (isLoggedIn) {
            adminActionHtml = `
                <div class="admin-controls-row">
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); loadAndOpenEditor(${post.id})" style="flex:1; justify-content:center;">Edit</button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); triggerDeletePost(${post.id}, '${escapeHtml(post.title)}')" style="flex:1; justify-content:center; color:var(--warning-glow); border-color:rgba(255,0,0,0.15)">Delete</button>
                </div>
            `;
        }

        card.innerHTML = `
            ${imageHtml}
            <div class="blog-card-content">
                <div class="blog-meta">
                    <span style="font-weight:600; color:var(--primary-glow)">${escapeHtml(post.author)}</span>
                    <span>•</span>
                    <span>${dateStr}</span>
                    ${draftBadgeHtml}
                </div>
                <h3 class="blog-title">${escapeHtml(post.title)}</h3>
                <p class="blog-summary">${escapeHtml(post.summary || '')}</p>
                ${tagsHtml}
                <div style="margin-top:auto; display:flex; align-items:center; justify-content:space-between; padding-top:0.5rem;">
                    <span class="read-link">
                        Read Article
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </span>
                </div>
                ${adminActionHtml}
            </div>
        `;

        card.addEventListener('click', (e) => {
            // Prevent trigger if they click edit/delete buttons
            if (e.target.tagName === 'BUTTON') return;
            openPostReader(post);
        });

        container.appendChild(card);
    });
}

// -------------------------------------------------------------
// POST READER MODAL
// -------------------------------------------------------------

function openPostReader(post, pushState = true) {
    const dialog = document.getElementById('dialog-view-post');
    if (!dialog) return;

    document.getElementById('view-post-title-header').textContent = post.title;
    document.getElementById('view-post-author').textContent = post.author;
    document.getElementById('view-post-date').textContent = new Date(post.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const tagsContainer = document.getElementById('view-post-tags');
    tagsContainer.innerHTML = '';
    if (post.tags) {
        post.tags.split(',').forEach(t => {
            const cleaned = t.trim();
            if (cleaned) {
                tagsContainer.innerHTML += `<span class="blog-tag" style="pointer-events:none;">${escapeHtml(cleaned)}</span>`;
            }
        });
    }

    const bannerImg = document.getElementById('view-post-banner');
    if (post.imageUrl) {
        const fullImgUrl = post.imageUrl.startsWith('/') ? `${BLOG_BACKEND_BASE}${post.imageUrl}` : post.imageUrl;
        bannerImg.src = fullImgUrl;
        bannerImg.style.display = 'block';
    } else {
        bannerImg.src = '';
        bannerImg.style.display = 'none';
    }

    // Markdown simple parse
    document.getElementById('view-post-body').innerHTML = convertMarkdownToHtml(post.content);

    if (!dialog.open) {
        dialog.showModal();
    }

    if (pushState) {
        const url = new URL(window.location.href);
        url.searchParams.set('post', post.slug);
        window.history.pushState({ postSlug: post.slug }, '', url.toString());
    }
}

function convertMarkdownToHtml(text) {
    if (!text) return '';
    
    // Split by lines
    const lines = text.split('\n');
    let html = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle Code Blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // Close code block
                const codeText = codeBlockContent.join('\n');
                html.push(`<pre style="background:var(--console-bg); border:1px solid var(--card-border); border-radius:var(--border-radius-sm); padding:1.2rem; overflow-x:auto; font-family:monospace; margin-bottom:1.5rem; color:var(--text-primary); line-height:1.5; font-size:0.9rem;"><code style="color:inherit; background:none; border:none; padding:0; white-space:pre;">${escapeHtml(codeText)}</code></pre>`);
                codeBlockContent = [];
                inCodeBlock = false;
            } else {
                // Open code block
                inCodeBlock = true;
            }
            continue;
        }
        
        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }
        
        // Close list if we hit a non-list line
        if (inList && !line.trim().startsWith('- ')) {
            html.push('</ul>');
            inList = false;
        }
        
        // Handle Headings
        if (line.startsWith('### ')) {
            html.push(`<h4 style="font-family:var(--font-heading); font-size:1.15rem; margin-top:1.5rem; margin-bottom:0.75rem; color:var(--text-secondary);">${parseInlineMarkdown(line.substring(4))}</h4>`);
        } else if (line.startsWith('## ')) {
            html.push(`<h3 style="font-family:var(--font-heading); font-size:1.4rem; margin-top:2rem; margin-bottom:1rem; color:var(--primary-glow);">${parseInlineMarkdown(line.substring(3))}</h3>`);
        } else if (line.startsWith('# ')) {
            html.push(`<h2 style="font-family:var(--font-heading); font-size:1.8rem; margin-top:2.5rem; margin-bottom:1.25rem; color:var(--text-primary);">${parseInlineMarkdown(line.substring(2))}</h2>`);
        }
        // Handle Lists
        else if (line.trim().startsWith('- ')) {
            if (!inList) {
                html.push('<ul style="margin-bottom:1.25rem; padding-left:1.5rem; line-height:1.6;">');
                inList = true;
            }
            html.push(`<li style="margin-bottom:0.5rem; color:var(--text-primary);">${parseInlineMarkdown(line.trim().substring(2))}</li>`);
        }
        // Handle Horizontal Rules
        else if (line.trim() === '---') {
            html.push('<hr style="border:none; border-top:1px solid var(--card-border); margin:2rem 0;">');
        }
        // Handle Paragraphs & Empty Lines
        else {
            const trimmed = line.trim();
            if (trimmed === '') {
                continue;
            }
            
            // Gather contiguous text lines for a paragraph
            let paragraphLines = [line];
            while (i + 1 < lines.length && 
                   !lines[i + 1].trim().startsWith('```') && 
                   !lines[i + 1].trim().startsWith('- ') && 
                   !lines[i + 1].trim().startsWith('#') && 
                   lines[i + 1].trim() !== '---' && 
                   lines[i + 1].trim() !== '') {
                i++;
                paragraphLines.push(lines[i]);
            }
            
            const paragraphText = paragraphLines.join(' ');
            html.push(`<p style="margin-bottom:1.25rem; line-height:1.7; font-size:1.05rem; color:var(--text-primary);">${parseInlineMarkdown(paragraphText)}</p>`);
        }
    }
    
    if (inList) {
        html.push('</ul>');
    }
    
    return html.join('\n');
}

function parseInlineMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);
    
    // Images: ![alt](url)
    escaped = escaped.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:100%; height:auto; display:block; margin:1rem auto; border-radius:var(--border-radius-sm); box-shadow:0 4px 12px rgba(0,0,0,0.15);">');

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code: `code`
    escaped = escaped.replace(/`(.*?)`/g, '<code style="font-family:monospace; background:var(--console-bg); padding:0.15rem 0.35rem; border-radius:4px; font-size:0.9rem; color:var(--secondary-glow); border:1px solid var(--card-border);">$1</code>');
    
    return escaped;
}

// -------------------------------------------------------------
// POST CREATION / EDITING FORM
// -------------------------------------------------------------

function openPostEditor(post) {
    const dialog = document.getElementById('dialog-edit-post');
    if (!dialog) return;

    // Reset Form
    document.getElementById('blog-edit-form').reset();
    document.getElementById('edit-post-id').value = '';
    
    const previewImg = document.getElementById('image-upload-preview');
    const previewPlaceholder = document.getElementById('image-upload-preview-placeholder');
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    if (previewPlaceholder) previewPlaceholder.style.display = 'block';

    // Reset Live Preview banner
    const livePreviewBanner = document.getElementById('preview-post-banner');
    const livePreviewBannerContainer = document.getElementById('preview-post-banner-container');
    if (livePreviewBanner) livePreviewBanner.src = '';
    if (livePreviewBannerContainer) livePreviewBannerContainer.style.display = 'none';

    document.getElementById('edit-dialog-title').textContent = post ? 'Edit Technology Article' : 'Write New Technology Article';

    if (post) {
        document.getElementById('edit-post-id').value = post.id;
        document.getElementById('edit-title').value = post.title;
        document.getElementById('edit-summary').value = post.summary || '';
        document.getElementById('edit-tags').value = post.tags || '';
        document.getElementById('edit-content').value = post.content || '';
        
        if (post.imageUrl) {
            const fullImgUrl = post.imageUrl.startsWith('/') ? `${BLOG_BACKEND_BASE}${post.imageUrl}` : post.imageUrl;
            if (previewImg) {
                previewImg.src = fullImgUrl;
                previewImg.style.display = 'block';
            }
            if (previewPlaceholder) previewPlaceholder.style.display = 'none';
            if (livePreviewBanner) livePreviewBanner.src = fullImgUrl;
            if (livePreviewBannerContainer) livePreviewBannerContainer.style.display = 'block';
        }
    }

    // Trigger initial preview build
    updateLivePreview();

    dialog.showModal();
}

async function loadAndOpenEditor(id) {
    try {
        const response = await fetch(`${BLOG_BACKEND_BASE}/api/blog/posts`);
        if (!response.ok) throw new Error('Failed to query blog data.');
        const posts = await response.json();
        const post = posts.find(p => p.id === id);
        if (post) {
            openPostEditor(post);
        } else {
            showToast('Error loading post: Post not found', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleFormSubmit(published) {
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const savePublishBtn = document.getElementById('btn-save-publish');
    
    if (saveDraftBtn) saveDraftBtn.disabled = true;
    if (savePublishBtn) savePublishBtn.disabled = true;

    const id = document.getElementById('edit-post-id').value;
    const title = document.getElementById('edit-title').value;
    const summary = document.getElementById('edit-summary').value;
    const tags = document.getElementById('edit-tags').value;
    const content = document.getElementById('edit-content').value;
    const fileInput = document.getElementById('edit-image-file');

    let imageUrl = '';
    // If edit mode and preview image is showing and no new file selected, preserve the existing image URL
    if (id) {
        const match = blogPosts.find(p => p.id == id);
        if (match && match.imageUrl) imageUrl = match.imageUrl;
    }

    try {
        // Upload new image if chosen
        if (fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const uploadResp = await fetch(`${BLOG_BACKEND_BASE}/api/blog/images`, {
                method: 'POST',
                body: formData,
                credentials: 'include' // Sends cookies
            });

            if (!uploadResp.ok) {
                const errMsg = await uploadResp.text();
                throw new Error(`Failed to upload image banner. ${errMsg}`);
            }

            const uploadData = await uploadResp.json();
            imageUrl = uploadData.imageUrl; // e.g. /api/blog/images/123
        }

        // Post body payload
        const postPayload = { title, summary, tags, content, imageUrl, published };
        const url = id 
            ? `${BLOG_BACKEND_BASE}/api/blog/posts/${id}` 
            : `${BLOG_BACKEND_BASE}/api/blog/posts`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postPayload),
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Authentication required. Your session may have expired or you may be logged in as a guest. Please sign in via the Sign In button at the top, or log in in another tab to preserve your edits.");
            }
            const errorMsg = await response.text();
            throw new Error(errorMsg || `Server responded with HTTP ${response.status}`);
        }

        showToast(published ? 'Article published successfully!' : 'Article saved as draft successfully!', 'success');
        document.getElementById('dialog-edit-post').close();
        
        // Refresh post list
        fetchBlogPosts();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (saveDraftBtn) saveDraftBtn.disabled = false;
        if (savePublishBtn) savePublishBtn.disabled = false;
    }
}

// -------------------------------------------------------------
// POST DELETION
// -------------------------------------------------------------

function triggerDeletePost(id, title) {
    showConfirm(
        'Delete Article',
        `Are you sure you want to delete the article: "${title}"? This operation cannot be undone.`,
        async () => {
            try {
                const response = await fetch(`${BLOG_BACKEND_BASE}/api/blog/posts/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorMsg = await response.text();
                    throw new Error(errorMsg || `Server responded with HTTP ${response.status}`);
                }

                showToast('Article deleted successfully.', 'success');
                fetchBlogPosts();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    );
}

// -------------------------------------------------------------
// SESSION CONTROL & DOM UTILS
// -------------------------------------------------------------

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        let val = decodeURIComponent(parts.pop().split(';').shift());
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        return val;
    }
    return '';
}

function isUserLoggedIn() {
    // If testing locally on port 8080/8094, let's look for dummy parameter or query
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev_login') === 'true') {
        document.cookie = "hutta_user=Mukesh Joshi; Path=/;";
        return true;
    }
    return !!getCookie('hutta_user');
}

function updateUserView() {
    const createBtn = document.getElementById('btn-create-post');
    if (createBtn) {
        createBtn.style.display = isUserLoggedIn() ? 'inline-flex' : 'none';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// MODAL TOASTS & CONFIRMS (PORTAL SPECIFIC DECOUPLED IMPLEMENTATION)
// -------------------------------------------------------------

function showToast(message, type = 'info', duration = 4000) {
    const openDialog = document.querySelector('dialog[open]');
    const parent = openDialog || document.body;

    let container = parent.querySelector('#toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        parent.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close" aria-label="Close notification">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    container.appendChild(toast);

    const removeTimer = setTimeout(() => {
        dismissToast(toast);
    }, duration);

    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        clearTimeout(removeTimer);
        dismissToast(toast);
    });
}

function dismissToast(toast) {
    toast.classList.add('toast-hide');
    toast.addEventListener('transitionend', () => {
        toast.remove();
    });
}

function showConfirm(title, message, onConfirm) {
    let dialog = document.getElementById('dialog-confirm-action');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'dialog-confirm-action';
        dialog.className = 'modal-dialog';
        document.body.appendChild(dialog);
        
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                dialog.close();
            }
        });
    }
    
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3>${escapeHtml(title)}</h3>
            <button class="btn-icon close-dialog-btn" aria-label="Close dialog" onclick="this.closest('dialog').close()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="dialog-body" style="padding-top:1rem;">
            <p>${escapeHtml(message)}</p>
            <div class="dialog-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary close-dialog-btn" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirm-action-btn">Confirm</button>
            </div>
        </div>
    `;
    
    dialog.querySelector('#confirm-action-btn').addEventListener('click', () => {
        dialog.close();
        if (onConfirm) onConfirm();
    });
    
    dialog.showModal();
}

function handleInitialUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');
    const tag = urlParams.get('tag');

    if (tag) {
        selectedTag = tag;
        updateActiveTagUI(tag);
        filterAndRenderPosts();
    }

    if (postSlug) {
        const matched = blogPosts.find(p => p.slug === postSlug);
        if (matched) {
            openPostReader(matched, false);
        }
    }
}

function updateActiveTagUI(tag) {
    const tagFiltersContainer = document.getElementById('blog-tag-filters');
    if (!tagFiltersContainer) return;
    tagFiltersContainer.querySelectorAll('.blog-tag').forEach(tagSpan => {
        if (tagSpan.getAttribute('data-tag') === tag) {
            tagSpan.classList.add('active');
        } else {
            tagSpan.classList.remove('active');
        }
    });
}

function handlePopState(event) {
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');
    const tag = urlParams.get('tag');

    const dialog = document.getElementById('dialog-view-post');
    if (postSlug) {
        const matched = blogPosts.find(p => p.slug === postSlug);
        if (matched) {
            openPostReader(matched, false);
        }
    } else {
        if (dialog && dialog.open) {
            dialog.close();
        }
    }

    if (tag) {
        selectedTag = tag;
        updateActiveTagUI(tag);
        filterAndRenderPosts();
    } else {
        selectedTag = 'ALL';
        updateActiveTagUI('ALL');
        filterAndRenderPosts();
    }
}

async function handleInlineImageUpload(e) {
    const fileInput = e.target;
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const textarea = document.getElementById('edit-content');
    if (!textarea) return;
    
    // Upload image
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showToast('Uploading image...', 'info');
        const uploadResp = await fetch(`${BLOG_BACKEND_BASE}/api/blog/images`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        if (!uploadResp.ok) {
            if (uploadResp.status === 401) {
                throw new Error("Authentication required to upload images. Please sign in via the Sign In button at the top, or log in in another tab.");
            }
            const errMsg = await uploadResp.text();
            throw new Error(`Upload failed: ${errMsg}`);
        }
        
        const uploadData = await uploadResp.json();
        const imageUrl = uploadData.imageUrl;
        
        // Insert Markdown syntax at cursor position
        const cursor = textarea.selectionStart;
        const text = textarea.value;
        const before = text.substring(0, cursor);
        const after = text.substring(textarea.selectionEnd, text.length);
        const imageMarkdown = `\n![${escapeHtml(file.name)}](${imageUrl})\n`;
        
        textarea.value = before + imageMarkdown + after;
        
        // Put cursor after the inserted text
        textarea.selectionStart = textarea.selectionEnd = cursor + imageMarkdown.length;
        textarea.focus();
        
        showToast('Image inserted successfully!', 'success');
        
        // Reset file input so same file can be selected again
        fileInput.value = '';
        
        // Trigger live preview update
        updateLivePreview();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function updateLivePreview() {
    const title = document.getElementById('edit-title').value;
    const summary = document.getElementById('edit-summary').value;
    const tags = document.getElementById('edit-tags').value;
    const content = document.getElementById('edit-content').value;

    const previewTitle = document.getElementById('preview-post-title');
    const previewSummary = document.getElementById('preview-post-summary');
    const previewTags = document.getElementById('preview-post-tags');
    const previewBody = document.getElementById('preview-post-body');
    const previewAuthor = document.getElementById('preview-post-author');
    const previewDate = document.getElementById('preview-post-date');

    if (previewTitle) previewTitle.textContent = title || 'Untitled Article';
    if (previewSummary) {
        previewSummary.textContent = summary || '';
        previewSummary.style.display = summary ? 'block' : 'none';
    }
    
    // Author & Date
    if (previewAuthor) {
        const huttaName = getCookie('hutta_name');
        const huttaUser = getCookie('hutta_user');
        previewAuthor.textContent = huttaName ? decodeURIComponent(huttaName).replace(/"/g, '') : (huttaUser ? decodeURIComponent(huttaUser).replace(/"/g, '') : 'Mukesh Joshi');
    }
    if (previewDate) {
        previewDate.textContent = new Date().toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Render tags
    if (previewTags) {
        previewTags.innerHTML = '';
        if (tags) {
            tags.split(',').forEach(t => {
                const cleaned = t.trim();
                if (cleaned) {
                    previewTags.innerHTML += `<span class="blog-tag" style="pointer-events:none;">${escapeHtml(cleaned)}</span>`;
                }
            });
        }
    }

    // Render Content
    if (previewBody) {
        previewBody.innerHTML = convertMarkdownToHtml(content);
    }
}

