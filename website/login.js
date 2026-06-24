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
// CREDENTIALS CHECK & AUTH MECHANISM
// -------------------------------------------------------------
const loginForm = document.getElementById('login-form');
const passcodeField = document.getElementById('passcode');
const errorMsg = document.getElementById('error-msg');

// Pre-compiled SHA-256 hashes for admin123 and guest123 passcodes
const ADMIN_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"; // admin123
const VIEWER_HASH = "6b93ccba414ac1d0ae1e77f3fac560c748a6701ed6946735a49d463351518e16"; // guest123

// Helper function to hash passcodes using Web Crypto API
async function hashPasscode(passcode) {
    const encoder = new TextEncoder();
    const data = encoder.encode(passcode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = ""; // Clear errors
        
        const inputPasscode = passcodeField.value;
        if (!inputPasscode) return;
        
        try {
            const hashedInput = await hashPasscode(inputPasscode);
            
            if (hashedInput === ADMIN_HASH) {
                // Success: Admin Role
                sessionStorage.setItem('hutta_auth', 'true');
                sessionStorage.setItem('hutta_role', 'admin');
                proceedRedirect();
            } else if (hashedInput === VIEWER_HASH) {
                // Success: Viewer Role
                sessionStorage.setItem('hutta_auth', 'true');
                sessionStorage.setItem('hutta_role', 'viewer');
                proceedRedirect();
            } else {
                // Fail
                errorMsg.textContent = "Access Denied: Invalid passcode.";
                passcodeField.value = "";
                passcodeField.focus();
            }
        } catch (err) {
            console.error("Hashing error: ", err);
            errorMsg.textContent = "Verification error. Please try again.";
        }
    });
}

function proceedRedirect() {
    // Read the original destination path from query params, or default to dashboard
    const params = new URLSearchParams(window.location.search);
    let destination = params.get('redirect') || 'dashboard.html';
    
    // Safety check to prevent open-redirect vulnerabilities
    // Make sure destination is a relative file or local page, not an external URL
    if (destination.startsWith('http://') || destination.startsWith('https://') || destination.startsWith('//')) {
        destination = 'dashboard.html';
    }
    
    window.location.replace(destination);
}
