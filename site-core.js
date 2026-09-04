(() => {
    "use strict";

    // Storage is optional: privacy settings must not disable the site.
    const toggle = document.getElementById("darkModeToggle");
    const applyTheme = (dark) => {
        document.body.classList.toggle("dark-mode", dark);
        if (toggle) {
            toggle.textContent = dark ? "☀️" : "🌙";
            toggle.setAttribute("aria-pressed", String(dark));
        }
    };
    let savedTheme = null;
    try { savedTheme = localStorage.getItem("darkMode"); } catch (_) { /* Optional preference. */ }
    applyTheme(savedTheme === "enabled");
    toggle?.addEventListener("click", () => {
        const dark = !document.body.classList.contains("dark-mode");
        applyTheme(dark);
        try { localStorage.setItem("darkMode", dark ? "enabled" : "disabled"); } catch (_) { /* Applies for this visit. */ }
    });

    // Keep mouse/pen presses immediate; only a completed finger tap activates.
    window.bindParvCanvasActivation = (element, activate, options = {}) => {
        let tap = null;
        const listenerOptions = { passive: true, ...options };
        const cancel = () => { tap = null; };
        element.addEventListener("pointerdown", (event) => {
            if (event.isPrimary === false || event.button !== 0) { cancel(); return; }
            if (event.pointerType !== "touch") { activate(event); return; }
            tap = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollX: window.scrollX, scrollY: window.scrollY };
        }, listenerOptions);
        element.addEventListener("pointermove", (event) => {
            if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) cancel();
        }, listenerOptions);
        element.addEventListener("pointerup", (event) => {
            const candidate = tap;
            cancel();
            if (!candidate || candidate.id !== event.pointerId) return;
            if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 10) return;
            if (Math.abs(window.scrollY - candidate.scrollY) > 2 || Math.abs(window.scrollX - candidate.scrollX) > 2) return;
            activate(event);
        }, listenerOptions);
        element.addEventListener("pointercancel", cancel, listenerOptions);
        element.addEventListener("pointerleave", cancel, listenerOptions);
        window.addEventListener("blur", cancel, listenerOptions);
    };
})();
