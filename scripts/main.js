// Centralized API endpoints
window.API_CONFIG = (function() {
  //const BACKEND_BASE_URL = 'http://localhost:8700';
  const BACKEND_BASE_URL = 'https://irku.se:8700';
  return {
    BACKEND_BASE_URL,
    BLOG_API_BASE: `${BACKEND_BASE_URL}/api`,
    BLOG_ADMIN_BASE: `${BACKEND_BASE_URL}/api/blogs`,
    CONTACT_BASE: `${BACKEND_BASE_URL}/api/contact`
  };
})();

// Professional Portfolio JavaScript
document.addEventListener('DOMContentLoaded', function() {
    
    // Smooth scrolling for anchor links
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
        });
    }

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.skill-item, .card, .section-title');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Blog search functionality
    const blogSearchInput = document.querySelector('input[placeholder="Search posts..."]');
    if (blogSearchInput) {
        blogSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const blogCards = document.querySelectorAll('.card');
            
            blogCards.forEach(card => {
                const cardText = card.textContent.toLowerCase();
                if (cardText.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // Newsletter subscription
    const newsletterForms = document.querySelectorAll('form input[type="email"]');
    newsletterForms.forEach(input => {
        const form = input.closest('form');
        if (form && !form.id) { // Newsletter forms don't have IDs
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const email = input.value;
                if (email) {
                    showNotification('Thank you for subscribing! You\'ll receive updates soon.', 'success');
                    input.value = '';
                }
            });
        }
    });

    // Add subtle hover effect to hero title
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        heroTitle.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        heroTitle.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    }

    // Add hover effects to skill items
    const skillItems = document.querySelectorAll('.skill-item');
    skillItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Add click effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Parallax effect for hero section
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            heroSection.style.transform = `translateY(${rate}px)`;
        });
    }

    // GitHub Repositories Animation
    const repoCards = document.querySelectorAll('.repo-card');
    const repoObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
            }
        });
    }, { threshold: 0.1 });

    repoCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease';
        repoObserver.observe(card);
    });

    // GitHub Activity Information
    function displayGitHubActivity() {
        // Display your GitHub achievements and activity
        const githubStats = {
            repositories: 28,
            stars: 9,
            packages: 1,
            followers: 3,
            following: 9,
            achievements: ['Arctic Code Vault Contributor', 'Pull Shark'],
            location: 'India | Spain | Sweden',
            twitter: '@muku3011'
        };
        
        console.log('GitHub Activity:', githubStats);
        
        // You can add more dynamic content here if needed
        // For example, updating stats in real-time or showing recent activity
    }

    // Load GitHub activity on page load
    displayGitHubActivity();

    // Add loading animation
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });

});

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
            ${message}
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .navbar-scrolled {
        background: rgba(52, 73, 94, 0.98) !important;
        backdrop-filter: blur(10px);
    }
    
    .loaded {
        opacity: 1;
    }
    
    body {
        opacity: 0;
        transition: opacity 0.5s ease-in;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
    }
`;
document.head.appendChild(style);

// Update Projects count from GitHub
(async function updateProjectsCount() {
  try {
    const username = 'muku3011'; // change if needed
    const resp = await fetch(`https://api.github.com/users/${username}`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const el = document.getElementById('projectsCount');
    if (!el) return;

    // public_repos returns public repo count
    const count = typeof data.public_repos === 'number' ? data.public_repos : 0;
    el.textContent = count.toString();
  } catch (e) {
    // silently ignore to avoid breaking UI
  }
})();


// Dynamically compute years of experience since Jan 2012
(function updateYearsExperience() {
  const start = new Date(2012, 0, 1); // Jan = 0
  const now = new Date();

  // Calculate whole years difference, adjusting if current date is before the anniversary
  let years = now.getFullYear() - start.getFullYear();
  const hasHadAnniversaryThisYear =
    now.getMonth() > start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!hasHadAnniversaryThisYear) years--;

  const el = document.getElementById('yearsExperience');
  if (el) el.textContent = `${years}+`;
})();




// Populate Featured Projects with starred repos (public)
(async function loadStarredRepos() {
  const container = document.getElementById('github-repos');
  if (!container) return;

  const username = 'muku3011'; // change if needed
  const endpoint = `https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=12&sort=created`;

  try {
    const res = await fetch(endpoint, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error('Failed to load starred repos');
    const starred = await res.json();

    if (!Array.isArray(starred) || starred.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-light border text-center" role="alert">
            No starred repositories found.
          </div>
        </div>`;
      return;
    }

    // Render cards responsively (1/2/3/4 per row)
    container.innerHTML = starred.map(repo => {
      const name = repo.full_name?.split('/')[1] || repo.name || 'Repository';
      const desc = repo.description ? repo.description : 'No description provided.';
      const lang = repo.language || 'Repo';
      const link = repo.html_url;
      const stars = repo.stargazers_count ?? 0;
      const forks = repo.forks_count ?? 0;
      const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];

      const badgeClass = (() => {
        const l = (lang || '').toLowerCase();
        if (l.includes('java') || l.includes('kotlin')) return 'bg-primary';
        if (l.includes('spring')) return 'bg-success';
        if (l.includes('typescript') || l.includes('javascript')) return 'bg-warning text-dark';
        if (l.includes('python')) return 'bg-info text-dark';
        return 'bg-secondary';
      })();

      const topicsHtml = topics.map(t =>
        `<span class="badge rounded-pill bg-light text-muted border me-1 mb-1">${t}</span>`
      ).join('');

      return `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3 mb-4">
          <div class="card h-100 repo-card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h5 class="card-title mb-0">
                  <i class="fab fa-github me-2"></i>${name}
                </h5>
                <span class="badge ${badgeClass}">${lang}</span>
              </div>
              <p class="card-text">${desc}</p>
              ${topicsHtml ? `<div class="mb-2">${topicsHtml}</div>` : ''}
              <div class="repo-stats d-flex align-items-center flex-wrap gap-3">
                <small class="text-muted">
                  <i class="fas fa-star me-1"></i>${stars}
                </small>
                <small class="text-muted">
                  <i class="fas fa-code-branch me-1"></i>${forks}
                </small>
              </div>
            </div>
            <div class="card-footer bg-transparent">
              <a href="${link}" class="btn btn-outline-primary btn-sm" target="_blank" rel="noopener">View Repository</a>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-light border text-center" role="alert">
          Unable to load starred repositories at the moment. Please try again later.
        </div>
      </div>`;
  }
})();


  (function () {
    const STORAGE_KEY = 'site_cookie_consent_v1';
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    const rejectBtn = document.getElementById('cookie-reject');

    function setConsent(value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, ts: Date.now() }));
      banner?.classList.add('d-none');
      applyConsent(value);
    }

    function getConsent() {
      try {
        const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        return v?.value || null;
      } catch { return null; }
    }

    function applyConsent(value) {
      // Hook for enabling/disabling non‑essential scripts based on consent.
    }

    const existing = getConsent();
    if (existing) {
      banner.classList.add('d-none');
      applyConsent(existing);
    }

    acceptBtn?.addEventListener('click', () => setConsent('accept'));
    rejectBtn?.addEventListener('click', () => setConsent('reject'));
  })();