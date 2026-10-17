/* Physical desk interactions. Fixed weekly market snapshots live in finance-market.js. */
(() => {
    'use strict';
    const desk = document.getElementById('finance-desk');
    if (!desk || desk.dataset.fdDeskReady === 'true') return;
    desk.dataset.fdDeskReady = 'true';
    const stage = desk.querySelector('.fd-stage');
    const composition = desk.querySelector('.fd-composition');
    const can = desk.querySelector('.fd-can');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const lowPower = Boolean(navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));
    let visible = true;
    let pointerFrame = 0;
    let pageActive = true;
    const isStill = () => reduceQuery.matches;
    // Progressive enhancement: keep the original drawn object if an asset fails.
    desk.querySelectorAll('[data-fd-product]').forEach(image => {
        const reveal = () => { if (image.naturalWidth) image.parentElement.classList.add('has-photo'); };
        image.addEventListener('load', reveal, { once: true });
        if (image.complete) reveal();
    });

    const fitScene = () => {
        const navHeight = document.querySelector('nav').getBoundingClientRect().height;
        desk.style.setProperty('--fd-nav-height', `${navHeight}px`);
        if (!mobileQuery.matches) {
            const box = stage.getBoundingClientRect();
            const deskWidth = box.width + 16; // The stage has 8px insets.
            const defaultScale = Math.min(box.width / 1680, box.height / 780);
            // Reserve a real, unscaled 94px hint beside the can. These bounds
            // include the can's hover lean and the scene's maximum perspective.
            const leftBound = 50, canRight = 1584, chargerRight = 1719;
            const hintWidth = 94, hintGap = 8, edgeInset = 8;
            const scale = Math.min(defaultScale,
                (deskWidth - hintWidth - hintGap - edgeInset * 2) / (canRight - leftBound),
                (deskWidth - edgeInset * 2) / (chargerRight - leftBound));
            const centeredLeft = (deskWidth - 1640 * scale) / 2;
            const rightEdge = Math.max(canRight * scale + hintGap + hintWidth, chargerRight * scale);
            const offsetX = Math.min(0, deskWidth - edgeInset - centeredLeft - rightEdge);
            desk.style.setProperty('--fd-scale', String(scale));
            desk.style.setProperty('--fd-scene-offset-x', `${offsetX}px`);
        }
    };
    const resetPerspective = () => {
        if (pointerFrame) cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
        composition.style.setProperty('--fd-tilt-x', '0deg');
        composition.style.setProperty('--fd-tilt-y', '0deg');
    };
    desk.addEventListener('pointermove', event => {
        if (isStill() || mobileQuery.matches || !visible || document.hidden || !pageActive || !finePointer.matches || event.pointerType === 'touch') return;
        if (pointerFrame) cancelAnimationFrame(pointerFrame);
        const box = desk.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - .5) * 2));
        const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - .5) * 2));
        pointerFrame = requestAnimationFrame(() => {
            composition.style.setProperty('--fd-tilt-x', `${(-y * (lowPower ? .3 : .6)).toFixed(3)}deg`);
            composition.style.setProperty('--fd-tilt-y', `${(x * (lowPower ? .4 : .8)).toFixed(3)}deg`);
            pointerFrame = 0;
        });
    }, { passive: true });
    desk.addEventListener('pointerleave', resetPerspective);

    const keyRows = [
        ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', '=', ['Backspace', 1.7], 'Del'],
        [['Tab', 1.5], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.2], 'Home'],
        [['Caps', 1.8], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['Enter', 1.9], 'End'],
        [['Shift', 2.2], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['Shift', 1.7], '↑', 'PgUp'],
        [['Ctrl', 1.2], '⊞', 'Alt', [' ', 6.8], 'Alt', 'Fn', 'Ctrl', '←', '↓', '→']
    ];
    const keyMap = new Map();
    const keyboard = desk.querySelector('.fd-keyboard-keys');
    keyRows.forEach(row => {
        const rowElement = document.createElement('div');
        rowElement.className = 'fd-key-row';
        row.forEach(key => {
            const [label, size] = Array.isArray(key) ? key : [key, 1];
            const element = document.createElement('span');
            element.className = 'fd-key';
            element.dataset.key = label.toUpperCase();
            element.style.setProperty('--key-width', String(size));
            element.textContent = label;
            rowElement.append(element);
            keyMap.set(label.toUpperCase(), element);
        });
        keyboard.append(rowElement);
    });
    const keyTimers = new Map();
    const keyboardBody = desk.querySelector('.fd-keyboard');
    let keyboardPressTimer = 0;
    const resetKeys = () => {
        keyTimers.forEach(clearTimeout);
        keyTimers.clear();
        keyMap.forEach(key => key.classList.remove('is-pressed'));
        clearTimeout(keyboardPressTimer);
        keyboardBody.classList.remove('is-photo-keypress');
    };
    document.addEventListener('keydown', event => {
        if (isStill() || mobileQuery.matches || !visible || document.hidden || !pageActive || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        const aliases = { Escape: 'ESC', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Delete: 'DEL', PageUp: 'PGUP' };
        const key = keyMap.get(aliases[event.key] || event.key.toUpperCase());
        if (!key) return;
        key.classList.add('is-pressed');
        keyboardBody.classList.add('is-photo-keypress');
        clearTimeout(keyboardPressTimer);
        keyboardPressTimer = setTimeout(() => keyboardBody.classList.remove('is-photo-keypress'), 150);
        clearTimeout(keyTimers.get(key));
        keyTimers.set(key, setTimeout(() => { key.classList.remove('is-pressed'); keyTimers.delete(key); }, 160));
    });
    // Both cutouts occupy one fixed, bottom-anchored box. Never remove a loaded
    // drink until its replacement has decoded and is ready for the same frame.
    const drinkImages = {
        redbull: can.querySelector('[data-fd-drink="redbull"]'),
        celsius: can.querySelector('[data-fd-drink="celsius"]')
    };
    const drinkNames = { redbull: 'Red Bull Sugarfree', celsius: 'Celsius Sparkling Orange' };
    const drinkHint = desk.querySelector('.fd-can-hint');
    const drinkStatus = desk.querySelector('#fd-can-status');
    const drinkGlint = can.querySelector('.fd-can-glint');
    let drinkCurrent = 'redbull';
    let drinkWanted = 'redbull';
    let drinkBusy = false;
    let finishDrinkAnimation = null;
    // Dismiss only for this page visit. Reloading the Finance page should make
    // the invitation discoverable again, even after an earlier drink swap.
    let hintDismissed = false;
    let hintSuppressed = false;
    let hintTimer = 0;
    let hintPhaseVisible = true;
    let hintRemaining = 5000;
    let hintDeadline = 0;
    let lastTouch = null;
    let ignoreNativeDoubleClickUntil = 0;
    const drinkDecoded = { redbull: false, celsius: false };
    const drinkActive = () => visible && pageActive && !document.hidden && !mobileQuery.matches;
    const pauseDrinkHint = () => {
        if (hintTimer) {
            clearTimeout(hintTimer);
            hintTimer = 0;
            hintRemaining = Math.max(0, hintDeadline - performance.now());
        }
        drinkHint.hidden = true;
        drinkHint.classList.remove('is-visible');
    };
    const syncDrinkHint = () => {
        if (!drinkActive() || hintDismissed || hintSuppressed || !drinkDecoded[drinkCurrent]) {
            pauseDrinkHint();
            return;
        }
        drinkHint.hidden = false;
        drinkHint.classList.toggle('is-visible', hintPhaseVisible);
        if (hintTimer) return;
        hintDeadline = performance.now() + hintRemaining;
        hintTimer = setTimeout(() => {
            hintTimer = 0;
            hintPhaseVisible = !hintPhaseVisible;
            hintRemaining = 5000;
            syncDrinkHint();
        }, hintRemaining);
    };
    const dismissDrinkHint = () => {
        hintDismissed = true;
        pauseDrinkHint();
    };
    const prepareDrink = (name, image) => new Promise(resolve => {
        let settled = false;
        const complete = async () => {
            if (settled) return;
            settled = true;
            image.removeEventListener('load', complete);
            image.removeEventListener('error', fail);
            let decoded = Boolean(image.naturalWidth);
            if (decoded && typeof image.decode === 'function') {
                try { await image.decode(); } catch (_) { decoded = false; }
            }
            // A known decode failure is not a safe replacement, even if its
            // dimensions arrived successfully. Browsers without decode use load.
            drinkDecoded[name] = decoded && Boolean(image.naturalWidth);
            syncDrinkHint();
            resolve(drinkDecoded[name]);
        };
        const fail = () => {
            if (settled) return;
            settled = true;
            image.removeEventListener('load', complete);
            image.removeEventListener('error', fail);
            resolve(false);
        };
        image.addEventListener('load', complete, { once: true });
        image.addEventListener('error', fail, { once: true });
        if (image.complete) complete();
    });
    const drinkReady = {};
    let desktopAssetsStarted = false;
    const activateDesktopAssets = () => {
        if (mobileQuery.matches || desktopAssetsStarted) return;
        desktopAssetsStarted = true;
        // No src is present in the HTML for desktop-only photographs. Phones
        // never request or decode them; widening the page activates them once.
        desk.querySelectorAll('img[data-fd-src]').forEach(image => {
            image.setAttribute('src', image.dataset.fdSrc);
        });
        Object.entries(drinkImages).forEach(([name, image]) => {
            drinkReady[name] = prepareDrink(name, image);
        });
    };
    const commitDrink = target => {
        Object.entries(drinkImages).forEach(([name, image]) => image.classList.toggle('is-current', name === target));
        drinkCurrent = target;
        can.dataset.drink = target;
        can.setAttribute('aria-label', `${drinkNames[target]}. Switch drink.`);
        drinkStatus.textContent = `Switched to ${drinkNames[target]}.`;
        dismissDrinkHint();
    };
    const animateDrink = target => new Promise(resolve => {
        const outgoing = drinkImages[drinkCurrent];
        const incoming = drinkImages[target];
        if (!drinkActive() || isStill() || !drinkDecoded[drinkCurrent] || typeof incoming.animate !== 'function') {
            commitDrink(target);
            resolve();
            return;
        }
        const animations = [];
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            // Commit classes before releasing animation styles, avoiding a blank frame.
            commitDrink(target);
            animations.forEach(animation => {
                // Also handle partial animation setup failing before Promise.all.
                animation.finished.catch(() => {});
                animation.cancel();
            });
            can.classList.remove('is-swapping');
            finishDrinkAnimation = null;
            resolve();
        };
        finishDrinkAnimation = finish;
        can.classList.add('is-swapping');
        const timing = { duration: lowPower ? 180 : 650, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' };
        const turn = angle => lowPower ? 'none' : `perspective(500px) rotateY(${angle}deg)`;
        try {
            animations.push(outgoing.animate([
                { opacity: 1, transform: turn(0), offset: 0 },
                { opacity: 1, transform: turn(-18), offset: .3 },
                { opacity: .6, transform: turn(-40), offset: .55 },
                { opacity: 0, transform: turn(-65), offset: 1 }
            ], timing));
            animations.push(incoming.animate([
                { opacity: 0, transform: turn(65), offset: 0 },
                { opacity: .6, transform: turn(38), offset: .3 },
                { opacity: 1, transform: turn(13), offset: .65 },
                { opacity: 1, transform: turn(0), offset: 1 }
            ], timing));
            if (!lowPower) animations.push(drinkGlint.animate([
                { opacity: 0, backgroundPosition: '160% 0', offset: 0 },
                { opacity: .38, backgroundPosition: '60% 0', offset: .45 },
                { opacity: 0, backgroundPosition: '-60% 0', offset: 1 }
            ], timing));
            Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
        } catch (_) { finish(); }
    });
    const processDrinkRequest = async () => {
        if (drinkBusy) return;
        drinkBusy = true;
        can.setAttribute('aria-busy', 'true');
        try {
            // New gestures update the desired state; only one transition owns the layers.
            while (drinkWanted !== drinkCurrent) {
                const target = drinkWanted;
                const ready = await drinkReady[target];
                if (target !== drinkWanted) continue;
                if (!ready) {
                    drinkWanted = drinkCurrent;
                    can.dataset.drinkWanted = drinkCurrent;
                    drinkStatus.textContent = 'The other drink could not load. Your current drink is still here.';
                    break;
                }
                await animateDrink(target);
            }
        } finally {
            drinkBusy = false;
            hintSuppressed = false;
            can.setAttribute('aria-busy', 'false');
            syncDrinkHint();
        }
    };
    const requestDrink = () => {
        if (!drinkActive()) return;
        dismissDrinkHint();
        drinkWanted = drinkWanted === 'redbull' ? 'celsius' : 'redbull';
        can.dataset.drinkWanted = drinkWanted;
        hintSuppressed = true;
        syncDrinkHint();
        processDrinkRequest();
    };
    can.addEventListener('dblclick', event => {
        event.preventDefault();
        if (performance.now() >= ignoreNativeDoubleClickUntil) requestDrink();
    });
    can.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) requestDrink();
    });
    can.addEventListener('click', event => {
        // Screen readers can activate a button without a pointer or key event.
        if (event.detail === 0) requestDrink();
    });
    can.addEventListener('pointerup', event => {
        if (event.pointerType !== 'touch') return;
        const now = performance.now();
        if (lastTouch && now - lastTouch.time <= 400 && Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) <= 24) {
            event.preventDefault();
            lastTouch = null;
            ignoreNativeDoubleClickUntil = now + 700;
            requestDrink();
        } else lastTouch = { time: now, x: event.clientX, y: event.clientY };
    });
    can.addEventListener('pointercancel', () => { lastTouch = null; });
    const syncDrinkActivity = () => {
        if (!drinkActive() || isStill()) {
            if (finishDrinkAnimation) finishDrinkAnimation();
            lastTouch = null;
        }
        syncDrinkHint();
    };

    // Historical snapshot charts are owned by finance-market.js.
    const syncActivity = () => {
        const still = isStill();
        desk.classList.toggle('is-still', still);
        activateDesktopAssets();
        if (still || !visible || document.hidden || !pageActive || mobileQuery.matches) {
            resetPerspective();
            resetKeys();
        }
        syncDrinkActivity();
    };
    reduceQuery.addEventListener('change', syncActivity);
    mobileQuery.addEventListener('change', () => { fitScene(); syncActivity(); });
    document.addEventListener('visibilitychange', syncActivity);
    window.addEventListener('pagehide', () => { pageActive = false; syncActivity(); });
    window.addEventListener('pageshow', () => { pageActive = true; syncActivity(); });
    window.addEventListener('resize', fitScene, { passive: true });
    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(fitScene);
        observer.observe(stage);
        observer.observe(document.querySelector('nav'));
    }
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncActivity(); }, { threshold: 0 });
        observer.observe(desk);
    }
    document.fonts?.ready.then(fitScene);
    fitScene();
    syncActivity();
})();
