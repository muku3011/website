(function(){
    const b = document.body;
    
    // 1. Force and lock light theme
    function lockLight() {
        if (b.getAttribute("data-theme") !== "light") {
            b.setAttribute("data-theme", "light");
        }
    }
    lockLight();
    
    const themeObserver = new MutationObserver(lockLight);
    themeObserver.observe(b, { attributes: true });

    // 2. Position the Back button side-by-side with the Sign In button
    function moveBackButton() {
        const s = document.getElementById("sign-in-button");
        const k = document.querySelector(".back-to-hutta-container");
        if (s && k) {
            let w = document.getElementById("button-group-wrapper");
            if (!w) {
                w = document.createElement("div");
                w.id = "button-group-wrapper";
                w.className = "button-group-wrapper";
                // Insert wrapper before the sign-in button
                s.parentNode.insertBefore(w, s);
            }
            if (s.parentNode !== w) w.appendChild(s);
            if (k.parentNode !== w) w.appendChild(k);
        }
    }

    const domObserver = new MutationObserver(moveBackButton);
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
    
    // Run immediately and on DOM content load
    moveBackButton();
    document.addEventListener("DOMContentLoaded", moveBackButton);
})();
