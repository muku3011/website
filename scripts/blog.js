// Blog API Configuration
const API_BASE_URL = 'https://irku.se:8700/api';

// Blog Management Class
class BlogManager {
    constructor() {
        this.currentPage = 0;
        this.pageSize = 6;
        this.searchTerm = '';
        this.isLoading = false;
    }

    // Initialize blog page
    async init() {
        try {
            await this.loadBlogPosts();
            await this.loadRecentPosts();
            await this.loadCategories();
            await this.loadBlogStats();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing blog:', error);
            this.showError();
        }
    }

    // Load blog posts from API
    async loadBlogPosts(page = 0) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            const response = await fetch(`${API_BASE_URL}/blogs/page?page=${page}&size=${this.pageSize}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.renderBlogPosts(data);
            this.renderPagination(data);
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading blog posts:', error);
            this.showError();
        } finally {
            this.isLoading = false;
        }
    }

    // Load featured posts
    async loadFeaturedPosts() {
        try {
            const response = await fetch(`${API_BASE_URL}/blogs/featured`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const featuredPosts = await response.json();
            this.renderFeaturedPost(featuredPosts[0]);
            
        } catch (error) {
            console.error('Error loading featured posts:', error);
        }
    }

    // Load recent posts for sidebar
    async loadRecentPosts() {
        try {
            const response = await fetch(`${API_BASE_URL}/blogs/recent?limit=5`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const recentPosts = await response.json();
            this.renderRecentPosts(recentPosts);
            
        } catch (error) {
            console.error('Error loading recent posts:', error);
        }
    }

    // Load categories from all blog posts
    async loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/blogs`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const allPosts = await response.json();
            this.renderCategories(allPosts);
            
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Load blog statistics
    async loadBlogStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/blogs/stats`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const stats = await response.json();
            this.renderBlogStats(stats);
            
        } catch (error) {
            console.error('Error loading blog stats:', error);
        }
    }

    // Search blogs
    async searchBlogs(searchTerm, page = 0) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            const response = await fetch(`${API_BASE_URL}/blogs/search?q=${encodeURIComponent(searchTerm)}&page=${page}&size=${this.pageSize}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.renderBlogPosts(data);
            this.renderPagination(data);
            this.hideLoading();
            
        } catch (error) {
            console.error('Error searching blogs:', error);
            this.showError();
        } finally {
            this.isLoading = false;
        }
    }

    // Render blog posts
    renderBlogPosts(data) {
        const blogPostsGrid = document.getElementById('blogPostsGrid');
        const featuredPost = document.getElementById('featuredPost');
        
        if (!data || !data.content || data.content.length === 0) {
            blogPostsGrid.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info text-center">
                        <h5>No blog posts found</h5>
                        <p>Check back later for new content!</p>
                    </div>
                </div>
            `;
            blogPostsGrid.classList.remove('d-none');
            return;
        }

        // Check if we should show featured post (first page, first post is featured)
        if (data.number === 0 && data.content[0]?.isFeatured) {
            this.renderFeaturedPost(data.content[0]);
            data.content = data.content.slice(1); // Remove featured post from grid
        }

        // Render blog posts grid
        const postsHtml = data.content
            .filter(post => post) // Filter out null/undefined posts
            .map(post => this.createBlogPostCard(post))
            .join('');
        blogPostsGrid.innerHTML = postsHtml;
        blogPostsGrid.classList.remove('d-none');
    }

    // Render featured post
    renderFeaturedPost(post) {
        if (!post) return;
        
        const featuredPost = document.getElementById('featuredPost');
        const publishedDate = this.formatDate(post.publishedAt);
        const readTime = this.estimateReadTime(post.content || post.excerpt);
        const title = post.title || 'Untitled';
        const excerpt = post.excerpt || 'No excerpt available.';
        const slug = post.slug || '';
        
        featuredPost.innerHTML = `
            <article class="card featured-post">
                <div class="card-body p-0">
                    <div class="post-image" style="height: 300px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-code" style="font-size: 4rem; color: white; opacity: 0.8;"></i>
                    </div>
                    <div class="p-4">
                        <div class="d-flex align-items-center mb-3">
                            <span class="badge bg-primary me-2">Featured</span>
                            <small class="text-muted">
                                <i class="fas fa-calendar me-1"></i>
                                ${publishedDate}
                            </small>
                        </div>
                        <h2 class="card-title">
                            <a href="blog-detail.html?slug=${slug}" class="text-decoration-none text-dark">${title}</a>
                        </h2>
                        <p class="card-text">${excerpt}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <a href="blog-detail.html?slug=${slug}" class="btn btn-primary">Read More</a>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>
                                ${readTime} min read
                            </small>
                        </div>
                    </div>
                </div>
            </article>
        `;
        featuredPost.classList.remove('d-none');
    }

    // Create blog post card HTML
    createBlogPostCard(post) {
        if (!post) return '';
        
        const publishedDate = this.formatDate(post.publishedAt);
        const readTime = this.estimateReadTime(post.content || post.excerpt);
        const category = this.getCategoryFromTitle(post.title || '');
        const title = post.title || 'Untitled';
        const excerpt = post.excerpt || 'No excerpt available.';
        const slug = post.slug || '';
        
        return `
            <div class="col-md-6 mb-4">
                <article class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <span class="badge ${this.getCategoryBadgeClass(category)} me-2">${category}</span>
                            <small class="text-muted">
                                <i class="fas fa-calendar me-1"></i>
                                ${publishedDate}
                            </small>
                        </div>
                        <h5 class="card-title">
                            <a href="blog-detail.html?slug=${slug}" class="text-decoration-none text-dark">${title}</a>
                        </h5>
                        <p class="card-text">${excerpt}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <a href="blog-detail.html?slug=${slug}" class="btn btn-outline-primary btn-sm">Read More</a>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>
                                ${readTime} min read
                            </small>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }

    // Render recent posts in sidebar
    renderRecentPosts(posts) {
        const recentPosts = document.getElementById('recentPosts');
        
        if (!posts || posts.length === 0) {
            recentPosts.innerHTML = '<p class="text-muted">No recent posts available.</p>';
            return;
        }

        const postsHtml = posts.map(post => {
            const publishedDate = this.formatRelativeDate(post.publishedAt);
            return `
                <a href="blog-detail.html?slug=${post.slug}" class="list-group-item list-group-item-action border-0 px-0">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${post.title}</h6>
                        <small>${publishedDate}</small>
                    </div>
                    <p class="mb-1 small text-muted">${post.excerpt}</p>
                </a>
            `;
        }).join('');

        recentPosts.innerHTML = postsHtml;
    }

    // Render categories based on blog posts
    renderCategories(posts) {
        const categoriesList = document.getElementById('categoriesList');
        
        if (!posts || posts.length === 0) {
            categoriesList.innerHTML = '<p class="text-muted">No categories available.</p>';
            return;
        }

        // Count posts by category
        const categoryCounts = {};
        posts.forEach(post => {
            const category = this.getCategoryFromTitle(post.title);
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        // Create category HTML
        const categoriesHtml = Object.entries(categoryCounts)
            .sort(([,a], [,b]) => b - a) // Sort by count descending
            .map(([category, count]) => {
                const icon = this.getCategoryIcon(category);
                const badgeClass = this.getCategoryBadgeClass(category);
                return `
                    <li class="mb-2">
                        <a href="#" class="text-decoration-none category-link" data-category="${category}">
                            <i class="${icon} me-2"></i>
                            ${category}
                            <span class="badge bg-light text-dark ms-2">${count}</span>
                        </a>
                    </li>
                `;
            }).join('');

        categoriesList.innerHTML = `<ul class="list-unstyled mb-0">${categoriesHtml}</ul>`;
        
        // Add click handlers for category filtering
        this.setupCategoryFilters();
    }

    // Render blog statistics
    renderBlogStats(stats) {
        const blogStats = document.getElementById('blogStats');
        
        if (!stats) {
            blogStats.innerHTML = '<p class="text-muted">Statistics not available.</p>';
            return;
        }

        const statsHtml = `
            <div class="row text-center">
                <div class="col-6 mb-3">
                    <div class="stat-item">
                        <h4 class="text-primary mb-1">${stats.totalBlogs}</h4>
                        <p class="mb-0 small text-muted">Total Posts</p>
                    </div>
                </div>
                <div class="col-6 mb-3">
                    <div class="stat-item">
                        <h4 class="text-success mb-1">${this.formatNumber(stats.totalViews)}</h4>
                        <p class="mb-0 small text-muted">Total Views</p>
                    </div>
                </div>
            </div>
            <div class="text-center">
                <small class="text-muted">
                    <i class="fas fa-calendar me-1"></i>
                    Updated daily
                </small>
            </div>
        `;

        blogStats.innerHTML = statsHtml;
    }

    // Render pagination
    renderPagination(data) {
        const pagination = document.getElementById('pagination');
        
        if (data.totalPages <= 1) {
            pagination.classList.add('d-none');
            return;
        }

        const currentPage = data.number;
        const totalPages = data.totalPages;
        
        let paginationHtml = '<ul class="pagination justify-content-center">';
        
        // Previous button
        if (currentPage > 0) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="blogManager.loadBlogPosts(${currentPage - 1})">Previous</a></li>`;
        } else {
            paginationHtml += '<li class="page-item disabled"><a class="page-link" href="#" tabindex="-1" aria-disabled="true">Previous</a></li>';
        }
        
        // Page numbers
        const startPage = Math.max(0, currentPage - 2);
        const endPage = Math.min(totalPages - 1, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            paginationHtml += `<li class="page-item ${isActive}"><a class="page-link" href="#" onclick="blogManager.loadBlogPosts(${i})">${i + 1}</a></li>`;
        }
        
        // Next button
        if (currentPage < totalPages - 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="blogManager.loadBlogPosts(${currentPage + 1})">Next</a></li>`;
        } else {
            paginationHtml += '<li class="page-item disabled"><a class="page-link" href="#" tabindex="-1" aria-disabled="true">Next</a></li>';
        }
        
        paginationHtml += '</ul>';
        pagination.innerHTML = paginationHtml;
        pagination.classList.remove('d-none');
    }

    // Setup event listeners
    setupEventListeners() {
        // Search functionality
        const searchInput = document.querySelector('input[placeholder="Search posts..."]');
        const searchButton = document.querySelector('button[type="button"]');
        
        if (searchInput && searchButton) {
            searchButton.addEventListener('click', () => {
                const searchTerm = searchInput.value.trim();
                if (searchTerm) {
                    this.searchBlogs(searchTerm);
                } else {
                    this.clearFilters();
                }
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const searchTerm = searchInput.value.trim();
                    if (searchTerm) {
                        this.searchBlogs(searchTerm);
                    } else {
                        this.clearFilters();
                    }
                }
            });
        }
    }

    clearFilters() {
        // Clear search input
        const searchInput = document.querySelector('input[placeholder="Search posts..."]');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Clear active category
        document.querySelectorAll('.category-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Reload all posts
        this.loadBlogPosts();
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
        if (!content || typeof content !== 'string') {
            return 5; // Default read time if content is not available
        }
        const wordsPerMinute = 200;
        const wordCount = content.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerMinute);
    }

    getCategoryFromTitle(title) {
        if (!title || typeof title !== 'string') {
            return 'Technology';
        }
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

    getCategoryIcon(category) {
        const icons = {
            'Java': 'fab fa-java text-primary',
            'Architecture': 'fas fa-sitemap text-success',
            'Cloud': 'fas fa-cloud text-info',
            'UI/UX': 'fas fa-palette text-warning',
            'Leadership': 'fas fa-users-cog text-primary',
            'Technology': 'fas fa-laptop-code text-dark'
        };
        return icons[category] || 'fas fa-tag text-secondary';
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    setupCategoryFilters() {
        const categoryLinks = document.querySelectorAll('.category-link');
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('data-category');
                this.filterByCategory(category);
            });
        });
    }

    async filterByCategory(category) {
        // Search for posts containing category keywords
        const searchTerms = {
            'Java': 'java spring',
            'Architecture': 'architecture enterprise',
            'Cloud': 'cloud microservices',
            'UI/UX': 'ui ux design',
            'Leadership': 'leadership team',
            'Technology': 'technology'
        };
        
        const searchTerm = searchTerms[category] || category.toLowerCase();
        await this.searchBlogs(searchTerm);
        
        // Update active state
        document.querySelectorAll('.category-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('d-none');
        document.getElementById('errorState').classList.add('d-none');
        document.getElementById('blogPostsGrid').classList.add('d-none');
        document.getElementById('featuredPost').classList.add('d-none');
        document.getElementById('pagination').classList.add('d-none');
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('d-none');
    }

    showError() {
        document.getElementById('loadingState').classList.add('d-none');
        document.getElementById('errorState').classList.remove('d-none');
        document.getElementById('blogPostsGrid').classList.add('d-none');
        document.getElementById('featuredPost').classList.add('d-none');
        document.getElementById('pagination').classList.add('d-none');
    }
}

// Global blog manager instance
let blogManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    blogManager = new BlogManager();
    blogManager.init();
});

// Global function for retry button
function loadBlogPosts() {
    if (blogManager) {
        blogManager.loadBlogPosts();
    }
}


// After you render the blog content and show #viewCount somewhere:
(function refreshViewCountAfterIncrement() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) return;
  setTimeout(async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/blogs/slug/${encodeURIComponent(slug)}`);
      if (!res.ok) return;
      const data = await res.json();
      const el = document.getElementById('viewCount');
      if (el && typeof data.viewCount === 'number') {
        el.textContent = data.viewCount.toString();
      }
    } catch(_) {}
  }, 300); // small delay to let increment commit
})();