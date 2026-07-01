
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

    // Scroll progress fallback for Safari / iOS
    const progressIndicator = document.getElementById('scroll-progress');
    const supportsCssScrollTimeline = CSS.supports('(animation-timeline: scroll())');
    
    if (!supportsCssScrollTimeline && progressIndicator) {
        console.log("CSS Scroll Timeline not fully supported. Initializing scroll listener fallback for progress bar.");
        window.addEventListener('scroll', () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
            progressIndicator.style.width = scrolled + '%';
        });
    }

    // Header scroll threshold effect
    const header = document.querySelector('.app-header');
    if (header) {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
    }
});

