/**
 * hutta.in Keycloak login page enhancements:
 * 1. Fixes the password field styling via inline styles (bypasses PatternFly CSS)
 * 2. Enhances the page header with hutta.in branding matching the homepage
 * 3. Injects a "← Back to hutta.in" link below the login card
 */
(function () {
    // ── Theme tokens (mirrors CSS variables) ──────────────────────────────────
    var INPUT_BG      = 'hsla(222, 24%, 10%, 0.85)';
    var BORDER        = 'hsla(222, 20%, 25%, 0.45)';
    var TEXT_PRIMARY  = 'hsl(210, 40%, 98%)';
    var TEXT_MUTED    = 'hsl(210, 10%, 52%)';
    var PRIMARY       = 'hsl(212, 100%, 60%)';
    var PRIMARY_DIM   = 'hsla(212, 100%, 60%, 0.15)';
    var RADIUS        = '8px';
    var INPUT_PADDING = '0.65rem 0.9rem';
    var FONT          = "Inter, system-ui, -apple-system, sans-serif";

    // ── 1. Fix password field inline ──────────────────────────────────────────
    // CSS handles the group container and input styling. This function adds
    // focus-ring behaviour on the group level (CSS :focus-within handles it too,
    // but this JS layer is a belt-and-suspenders override for PatternFly's own
    // bundled stylesheet which loads after ours).
    function fixPasswordField() {
        var input = document.getElementById('password')
                 || document.querySelector('input[type="password"]');
        if (!input) return;

        var inputGroup = input.closest('.pf-c-input-group, .pf-v5-c-input-group');
        if (!inputGroup) return;

        // Strip any PatternFly-injected inline styles that fight our CSS
        input.style.cssText = [
            'background:transparent',
            'border:none',
            'border-radius:0',
            'box-shadow:none',
            'outline:none',
            'flex:1 1 auto',
            'align-self:stretch',
            'width:100%',
            'padding:0.65rem 0.9rem',
            'font-size:0.9rem',
            'color:hsl(210,40%,98%)',
            'font-family:Inter,system-ui,sans-serif',
            'line-height:1.5',
            'box-sizing:border-box',
            'caret-color:hsl(212,100%,60%)',
            '-webkit-appearance:none',
        ].join(';');

        var toggleBtn = inputGroup.querySelector('button');
        if (toggleBtn) {
            toggleBtn.style.cssText = [
                'flex-shrink:0',
                'align-self:stretch',
                'background:transparent',
                'border:none',
                'border-left:1px solid hsla(222,20%,25%,0.45)',
                'border-radius:0',
                'color:hsl(210,10%,52%)',
                'padding:0 0.9rem',
                'cursor:pointer',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'min-width:2.75rem',
                'box-shadow:none',
                'outline:none',
                'transition:color 0.2s ease,background 0.2s ease',
            ].join(';');

            toggleBtn.addEventListener('mouseenter', function () {
                this.style.color = 'hsl(212,100%,60%)';
                this.style.background = 'hsla(212,100%,60%,0.08)';
            });
            toggleBtn.addEventListener('mouseleave', function () {
                this.style.color = 'hsl(210,10%,52%)';
                this.style.background = 'transparent';
            });
        }
    }

    // ── 2. Enhance header branding — matches hutta.in homepage header ─────────
    // The #kc-header banner is now visible via CSS and styled to match the
    // homepage .brand-link (orb via ::before pseudo-element + gradient h2 text).
    // We just ensure the wrapper text is clean — no extra DOM injection needed.
    function enhanceBranding() {
        var wrapper = document.getElementById('kc-header-wrapper');
        if (!wrapper) return;

        // Remove any stale injected brand divs from previous versions
        var old = wrapper.querySelector('.hutta-brand');
        if (old) old.parentNode.removeChild(old);

        // Keycloak renders the realm display name as a plain <h2>.
        // The CSS gradient already styles it — just make sure it reads "hutta.in".
        var h2 = wrapper.querySelector('h2');
        if (h2 && h2.textContent.trim() !== 'hutta.in') {
            h2.textContent = 'hutta.in';
        }
    }

    // ── 3. Inject "← Back to hutta.in" link ──────────────────────────────────
    function injectBackLink() {
        if (document.getElementById('kc-back-to-site')) return;

        var link = document.createElement('div');
        link.id = 'kc-back-to-site';
        link.innerHTML = '<a href="https://hutta.in">&#8592; Back to hutta.in</a>';

        var targets = [
            document.getElementById('kc-form-wrapper'),
            document.querySelector('.card-pf'),
            document.querySelector('form#kc-form-login'),
            document.querySelector('form'),
        ];

        var inserted = false;
        for (var i = 0; i < targets.length; i++) {
            if (targets[i] && targets[i].parentNode) {
                targets[i].parentNode.insertBefore(link, targets[i].nextSibling);
                inserted = true;
                break;
            }
        }
        if (!inserted) document.body.appendChild(link);
    }

    // ── Run all enhancements ──────────────────────────────────────────────────
    function run() {
        fixPasswordField();
        enhanceBranding();
        injectBackLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
