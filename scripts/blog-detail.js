// Blog Detail API Configuration
const API_BASE_URL = 'http://localhost:8080/api';

// Blog Detail Manager Class
class BlogDetailManager {
    constructor() {
        this.currentPost = null;
    }

    // Initialize blog detail page
    async init() {
        try {
            const slug = this.getSlugFromUrl();
            if (!slug) {
                this.showError();
                return;
            }
            
            await this.loadBlogPost(slug);
            await this.loadRelatedPosts();
        } catch (error) {
            console.error('Error initializing blog detail:', error);
            this.showError();
        }
    }

    // Get slug from URL parameters
    getSlugFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('slug');
    }

    // Load blog post by slug
    async loadBlogPost(slug) {
        this.showLoading();

        try {
            const response = await fetch(`${API_BASE_URL}/blogs/slug/${slug}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const post = await response.json();
            this.currentPost = post;
            this.renderBlogPost(post);
            this.updatePageTitle(post);
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading blog post:', error);
            this.showError();
        }
    }

    // Load related posts
    async loadRelatedPosts() {
        try {
            const response = await fetch(`${API_BASE_URL}/blogs/recent?limit=3`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const posts = await response.json();
            // Filter out current post from related posts
            const relatedPosts = posts.filter(post => post.slug !== this.currentPost?.slug);
            this.renderRelatedPosts(relatedPosts);
            
        } catch (error) {
            console.error('Error loading related posts:', error);
        }
    }

    // Render blog post
    renderBlogPost(post) {
        const blogPost = document.getElementById('blogPost');
        const publishedDate = this.formatDate(post.publishedAt);
        const readTime = this.estimateReadTime(post.content);
        const category = this.getCategoryFromTitle(post.title);
        
        blogPost.innerHTML = `
            <header class="mb-4">
                <div class="d-flex align-items-center mb-3">
                    <span class="badge ${this.getCategoryBadgeClass(category)} me-2">${category}</span>
                    <small class="text-muted me-3">
                        <i class="fas fa-calendar me-1"></i>
                        ${publishedDate}
                    </small>
                    <small class="text-muted me-3">
                        <i class="fas fa-clock me-1"></i>
                        ${readTime} min read
                    </small>
                    <small class="text-muted">
                        <i class="fas fa-eye me-1"></i>
                        ${post.viewCount || 0} views
                    </small>
                </div>
                <h1 class="display-4 fw-bold mb-3">${post.title}</h1>
                <p class="lead text-muted">${post.excerpt}</p>
                <div class="d-flex align-items-center">
                    <div class="author-info d-flex align-items-center">
                        <i class="fas fa-user-circle text-primary me-2" style="font-size: 2rem;"></i>
                        <div>
                            <div class="fw-semibold">${post.author}</div>
                            <small class="text-muted">Enterprise Architect</small>
                        </div>
                    </div>
                </div>
            </header>
            
            <div class="blog-content">
                ${this.formatContent(post.content)}
            </div>
            
            <footer class="mt-5 pt-4 border-top">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="post-meta">
                        <small class="text-muted">
                            Published on ${publishedDate} • ${readTime} min read
                        </small>
                    </div>
                    <div class="post-actions">
                        <button class="btn btn-outline-primary btn-sm me-2" onclick="blogDetailManager.likePost()">
                            <i class="fas fa-heart me-1"></i>Like
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="blogDetailManager.bookmarkPost()">
                            <i class="fas fa-bookmark me-1"></i>Bookmark
                        </button>
                    </div>
                </div>
            </footer>
        `;
        
        blogPost.classList.remove('d-none');
        
        // Highlight code blocks
        if (window.Prism) {
            Prism.highlightAll();
        }
    }

    // Format blog content
    formatContent(content) {
        // Convert markdown-like formatting to HTML
        let formattedContent = content;
        
        // Convert headers
        formattedContent = formattedContent.replace(/^### (.*$)/gim, '<h3 class="mt-4 mb-3">$1</h3>');
        formattedContent = formattedContent.replace(/^## (.*$)/gim, '<h2 class="mt-5 mb-3">$1</h2>');
        formattedContent = formattedContent.replace(/^# (.*$)/gim, '<h1 class="mt-5 mb-4">$1</h1>');
        
        // Convert code blocks
        formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Convert inline code
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code class="bg-light px-2 py-1 rounded">$1</code>');
        
        // Convert bold text
        formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert italic text
        formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert line breaks to paragraphs
        const paragraphs = formattedContent.split('\n\n');
        formattedContent = paragraphs.map(paragraph => {
            paragraph = paragraph.trim();
            if (paragraph && !paragraph.startsWith('<')) {
                return `<p class="mb-3">${paragraph}</p>`;
            }
            return paragraph;
        }).join('\n');
        
        return formattedContent;
    }

    // Render related posts
    renderRelatedPosts(posts) {
        const relatedPosts = document.getElementById('relatedPosts');
        
        if (!posts || posts.length === 0) {
            relatedPosts.innerHTML = '<p class="text-muted">No related posts available.</p>';
            return;
        }

        const postsHtml = posts.map(post => {
            const publishedDate = this.formatRelativeDate(post.publishedAt);
            return `
                <div class="mb-3">
                    <a href="blog-detail.html?slug=${post.slug}" class="text-decoration-none">
                        <h6 class="mb-1">${post.title}</h6>
                        <p class="mb-1 small text-muted">${post.excerpt}</p>
                        <small class="text-muted">${publishedDate}</small>
                    </a>
                </div>
            `;
        }).join('');

        relatedPosts.innerHTML = postsHtml;
    }

    // Update page title and meta
    updatePageTitle(post) {
        document.title = `${post.title} | Mukesh Joshi - Enterprise Architect`;
        
        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', post.excerpt);
        }
    }

    // Like post (placeholder)
    likePost() {
        // This would typically make an API call to like the post
        console.log('Liked post:', this.currentPost?.title);
        // You could implement actual like functionality here
    }

    // Bookmark post (placeholder)
    bookmarkPost() {
        // This would typically make an API call to bookmark the post
        console.log('Bookmarked post:', this.currentPost?.title);
        // You could implement actual bookmark functionality here
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    formatRelativeDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        return `${Math.ceil(diffDays / 30)} months ago`;
    }

    estimateReadTime(content) {
        const wordsPerMinute = 200;
        const wordCount = content.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerMinute);
    }

    getCategoryFromTitle(title) {
        const titleLower = title.toLowerCase();
        if (titleLower.includes('java') || titleLower.includes('spring')) return 'Java';
        if (titleLower.includes('architecture') || titleLower.includes('enterprise')) return 'Architecture';
        if (titleLower.includes('cloud') || titleLower.includes('microservices')) return 'Cloud';
        if (titleLower.includes('ui') || titleLower.includes('ux') || titleLower.includes('design')) return 'UI/UX';
        if (titleLower.includes('leadership') || titleLower.includes('team')) return 'Leadership';
        return 'Technology';
    }

    getCategoryBadgeClass(category) {
        const classes = {
            'Java': 'bg-secondary',
            'Architecture': 'bg-success',
            'Cloud': 'bg-warning',
            'UI/UX': 'bg-info',
            'Leadership': 'bg-primary',
            'Technology': 'bg-dark'
        };
        return classes[category] || 'bg-secondary';
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('d-none');
        document.getElementById('errorState').classList.add('d-none');
        document.getElementById('blogPost').classList.add('d-none');
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('d-none');
    }

    showError() {
        document.getElementById('loadingState').classList.add('d-none');
        document.getElementById('errorState').classList.remove('d-none');
        document.getElementById('blogPost').classList.add('d-none');
    }
}

// Global blog detail manager instance
let blogDetailManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    blogDetailManager = new BlogDetailManager();
    blogDetailManager.init();
});

// Social sharing functions
function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank');
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        // Show a toast notification or alert
        alert('Link copied to clipboard!');
    });
}
