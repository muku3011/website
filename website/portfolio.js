// -------------------------------------------------------------
// THEME MANAGER
// -------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Load persisted theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
    }
    localStorage.setItem('theme', theme);
}

// -------------------------------------------------------------
// SCROLL REVEAL FALLBACK (INTERSECTION OBSERVER)
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Only execute JS fallback if browser does not support CSS View Timelines
    const supportsCssViewTimeline = CSS.supports('(animation-timeline: view()) and (animation-range: entry)');
    
    if (!supportsCssViewTimeline) {
        console.log("CSS View Timeline not fully supported. Initializing IntersectionObserver fallback for scroll reveal animations.");
        
        const observerOptions = {
            root: null, // Viewport
            rootMargin: '0px 0px -10% 0px', // Trigger slightly before element is fully in view
            threshold: 0.15 // 15% visibility to trigger
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    // Once visible, stop observing to keep element in active state
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Find all animate target elements
        const animateElements = document.querySelectorAll('.scroll-animate-js');
        animateElements.forEach(el => revealObserver.observe(el));
    } else {
        console.log("CSS View Timeline natively supported. Scroll animations managed via GPU thread.");
    }
});
