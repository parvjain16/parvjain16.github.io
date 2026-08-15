/* ============================================================================
   Premium interaction layer
     · custom trailing cursor (white circle, mix-blend-mode: difference)
     · velocity stretch, hover morphing, magnetic centring
     · Lenis inertial wheel scrolling

   One global system: a single pointermove listener with event delegation and a
   single requestAnimationFrame loop driving both the cursor and Lenis.
   Nothing here changes layout, content or typography.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- CONFIG -- */
  var CONFIG = {
    cursor: {
      size: 36,           // resting diameter, px
      follow: 0.13,       // positional interpolation, per 60Hz frame
      magnet: 0.18,       // 18% pointer offset / 82% pull to element centre
      exitDelay: 130,     // ms held before collapsing, so adjacent links glide
      // velocity stretch
      stretchMax: 1.28,   // along the direction of travel
      squashMin: 0.90,    // across it
      stretchAt: 45,      // px per 60Hz frame that counts as "fast"
      stretchAttack: 0.5, // deforms quickly…
      stretchEase: 0.22,  // …and eases back to a perfect circle over ≈200ms
      // hover shapes
      navPadX: 24, navPadY: 14,
      mailPadX: 28, mailPadY: 16,
      btnPadX: 6, btnPadY: 6,
      moonSize: 46,
      socialSize: 50
    },
    scroll: {
      /* Measured settle-to-rest: 0.085 → ~1280ms, which reads as "underwater".
         0.17 lands a hard scroll at ~630ms and a small one at ~515ms, i.e. the
         450–650ms feel that was actually asked for. Lower this toward 0.085 for
         a longer, floatier tail; raise it toward 0.21 for a tighter stop. */
      lerp: 0.17,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      syncTouch: false    // native scrolling on touch
    }
  };

  /* What the cursor reacts to. First match wins.
     `hold` names a container the pointer can cross without the shape
     collapsing, so adjacent links glide into one another. */
  var TARGETS = [
    { sel: '.nav-container a', shape: 'navPill', magnet: true, cls: 'pj-neutral', hold: '.nav-container' },
    { sel: '.dark-toggle', shape: 'moon', magnet: true, cls: 'pj-hot', hold: '.nav-container' },
    { sel: '.social-icons a', shape: 'social', magnet: true, cls: 'pj-hot', hold: '.social-icons' },
    { sel: '.email a', shape: 'mailPill', magnet: true },
    { sel: '.pitch-links a', shape: 'button', magnet: true, cls: 'pj-darken' },
    { sel: '.achievement > a', shape: 'mailPill', magnet: true },
    { sel: '.hero-image img', shape: 'muted' }
  ];
  var SELECTOR = TARGETS.map(function (t) { return t.sel; }).join(',');

  var FRAME = 1000 / 60;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------ helpers -- */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** Frame-rate independent interpolation: `lambda` is the per-60Hz-frame rate. */
  function damp(current, target, lambda, dt) {
    var k = 1 - Math.pow(1 - lambda, dt / FRAME);
    return current + (target - current) * k;
  }

  /** Same, taking the shortest way around the circle. */
  function dampAngle(current, target, lambda, dt) {
    var diff = ((target - current + 540) % 360) - 180;
    return current + diff * (1 - Math.pow(1 - lambda, dt / FRAME));
  }

  /* ======================================================= SMOOTH SCROLL == */
  var lenis = null;

  function initScroll() {
    if (reduced || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      smoothWheel: CONFIG.scroll.smoothWheel,
      lerp: CONFIG.scroll.lerp,
      wheelMultiplier: CONFIG.scroll.wheelMultiplier,
      syncTouch: CONFIG.scroll.syncTouch
    });
    lenis.on('scroll', function () { stale = true; rehit = true; });
  }

  /* ============================================================== CURSOR == */
  var root = null, inner = null;
  var mouseX = 0, mouseY = 0;         // real pointer
  var curX = 0, curY = 0;             // animated cursor
  var lastX = 0, lastY = 0;           // pointer position on the previous frame
  var sx = 1, sy = 1, ang = 0;        // current deformation
  var seen = false;
  var active = null, activeCfg = null, rect = null, stale = false, rehit = false;
  var exitTimer = null;

  function measure() {
    if (!active) return;
    var r = active.getBoundingClientRect();
    rect = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    stale = false;
  }

  /** Resolve the inner element's box for the current target. */
  function shapeOf(kind) {
    var c = CONFIG.cursor;
    switch (kind) {
      case 'navPill':
        return { w: rect.w + c.navPadX, h: rect.h + c.navPadY, r: 999 };
      case 'mailPill':
        return { w: rect.w + c.mailPadX, h: rect.h + c.mailPadY, r: 999 };
      case 'button':
        var br = parseFloat(getComputedStyle(active).borderTopLeftRadius) || 6;
        return { w: rect.w + c.btnPadX, h: rect.h + c.btnPadY, r: br + 2 };
      case 'moon':
        return { w: c.moonSize, h: c.moonSize, r: 999 };
      case 'social':
        return { w: c.socialSize, h: c.socialSize, r: 999 };
      default:
        return { w: c.size, h: c.size, r: 999 };
    }
  }

  function applyShape() {
    var s = active ? shapeOf(activeCfg.shape) : {
      w: CONFIG.cursor.size, h: CONFIG.cursor.size, r: 999
    };
    inner.style.width = s.w + 'px';
    inner.style.height = s.h + 'px';
    inner.style.borderRadius = s.r + 'px';
  }

  function enter(el, cfg) {
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    if (active === el) return;
    if (active && activeCfg && activeCfg.cls) active.classList.remove(activeCfg.cls);
    active = el;
    activeCfg = cfg;
    root.classList.remove('is-leaving');
    root.classList.toggle('is-muted', cfg.shape === 'muted');
    if (cfg.cls) el.classList.add(cfg.cls);
    measure();
    applyShape();
  }

  function clearActive() {
    if (active && activeCfg && activeCfg.cls) active.classList.remove(activeCfg.cls);
    active = null;
    activeCfg = null;
    rect = null;
    root.classList.remove('is-muted');
    root.classList.add('is-leaving');
    applyShape();
  }

  /** Leaving is held briefly so moving between adjacent links glides. */
  function leave(immediate) {
    if (!active) return;
    if (immediate) {
      if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
      clearActive();
      return;
    }
    if (exitTimer) return;
    exitTimer = setTimeout(function () {
      exitTimer = null;
      clearActive();
    }, CONFIG.cursor.exitDelay);
  }

  /** Decide what the cursor should be doing given the element under the pointer. */
  function resolve(el) {
    var hit = el && el.closest ? el.closest(SELECTOR) : null;
    if (hit) {
      for (var i = 0; i < TARGETS.length; i++) {
        if (hit.matches(TARGETS[i].sel)) { enter(hit, TARGETS[i]); return; }
      }
    }
    /* Still inside the active target's hold zone — keep the current shape so
       moving between adjacent links glides instead of collapsing. */
    if (active && activeCfg.hold && el && el.closest && el.closest(activeCfg.hold)) return;
    leave(false);
  }

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!seen) {                     // hidden until the pointer first appears
      seen = true;
      curX = mouseX; curY = mouseY;
      lastX = mouseX; lastY = mouseY;
      root.classList.add('is-visible');
    }

    resolve(e.target);
  }

  function frame(dt) {
    if (!seen) return;

    /* Scrolling moves content under a stationary pointer, so re-hit-test:
       the pointer may have left the target, or landed on a new one. */
    if (rehit) {
      rehit = false;
      resolve(document.elementFromPoint(mouseX, mouseY));
    }

    if (active) {
      if (stale) measure();
      if (!rect || !document.contains(active)) { leave(true); }
    }

    /* desired point — magnetically biased toward the target's centre */
    var dx = mouseX, dy = mouseY;
    if (active && activeCfg.magnet && rect) {
      dx = rect.x + (mouseX - rect.x) * CONFIG.cursor.magnet;
      dy = rect.y + (mouseY - rect.y) * CONFIG.cursor.magnet;
    }

    curX = damp(curX, dx, CONFIG.cursor.follow, dt);
    curY = damp(curY, dy, CONFIG.cursor.follow, dt);

    /* velocity stretch, from real mouse movement, normalised to a 60Hz frame */
    var vx = (mouseX - lastX) * (FRAME / dt);
    var vy = (mouseY - lastY) * (FRAME / dt);
    lastX = mouseX; lastY = mouseY;

    var c = CONFIG.cursor;
    /* Rotation always eases back to 0. It is invisible on a circle, but a pill
       is not rotationally symmetric — leftover tilt reads as a wonky blob. */
    var tSX = 1, tSY = 1, tAng = 0;

    if (!active) {                    // shape morphs own the inner while hovering
      var speed = Math.sqrt(vx * vx + vy * vy);
      var t = clamp(speed / c.stretchAt, 0, 1);
      if (t > 0.02) tAng = Math.atan2(vy, vx) * 180 / Math.PI;
      tSX = 1 + (c.stretchMax - 1) * t;
      tSY = 1 - (1 - c.squashMin) * t;
    }

    /* Deform fast, recover slowly — otherwise a quick flick only nudges the
       scale a fraction of the way before the velocity spike has passed. */
    sx = damp(sx, tSX, Math.abs(tSX - 1) > Math.abs(sx - 1) ? c.stretchAttack : c.stretchEase, dt);
    sy = damp(sy, tSY, Math.abs(tSY - 1) > Math.abs(sy - 1) ? c.stretchAttack : c.stretchEase, dt);
    ang = dampAngle(ang, tAng, c.stretchAttack, dt);

    root.style.transform = 'translate3d(' + curX + 'px,' + curY + 'px,0)';
    inner.style.transform =
      'translate(-50%,-50%) rotate(' + ang + 'deg) scale(' + sx + ',' + sy + ')';
  }

  function initCursor() {
    if (reduced || !finePointer) return;

    root = document.createElement('div');
    root.className = 'pj-cursor';
    root.setAttribute('aria-hidden', 'true');
    inner = document.createElement('div');
    inner.className = 'pj-cursor__inner';
    root.appendChild(inner);
    document.body.appendChild(root);
    applyShape();

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointerleave', function () {
      leave(true);
      seen = false;
      root.classList.remove('is-visible');
    });

    /* Cached rectangles are invalidated rather than re-read every frame. */
    var invalidate = function () { stale = true; rehit = true; };
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate);
    new MutationObserver(invalidate).observe(document.body, {
      attributes: true, attributeFilter: ['class']
    });
  }

  /* ================================================================ BOOT == */
  function start() {
    initScroll();
    initCursor();

    var prev = 0;
    requestAnimationFrame(function loop(time) {
      if (lenis) lenis.raf(time);
      var dt = prev ? clamp(time - prev, 1, 100) : FRAME;
      prev = time;
      if (root) frame(dt);
      requestAnimationFrame(loop);
    });
  }

  /* Exposed so the constants above can be tried out live in devtools. */
  window.PJ = { config: CONFIG, get lenis() { return lenis; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
