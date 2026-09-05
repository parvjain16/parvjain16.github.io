(() => {
    "use strict";

    const section = document.getElementById("imageGallery");
    const stage = section?.querySelector(".image-gallery-sticky");
    const canvas = document.getElementById("imageGalleryCanvas");
    const fallback = stage?.querySelector(".image-gallery-fallback");
    const metaTitle = document.getElementById("imageGalleryTitle");
    const detail = document.getElementById("imageGalleryDetail");
    const detailContent = document.getElementById("imageGalleryDetailContent");
    const detailMedia = document.getElementById("imageGalleryDetailMedia");
    const detailImage = document.getElementById("imageGalleryDetailImage");
    const detailTitle = document.getElementById("imageGalleryDetailTitle");
    const detailDescription = document.getElementById("imageGalleryDetailDescription");
    const detailStatus = document.getElementById("imageGalleryDetailStatus");
    const detailCopy = detail?.querySelector(".image-gallery-detail__copy");
    const detailClose = document.getElementById("imageGalleryDetailClose");
    const detailPrevious = document.getElementById("imageGalleryDetailPrevious");
    const detailNext = document.getElementById("imageGalleryDetailNext");
    const galleryControls = stage?.querySelector(".image-gallery-controls");
    const galleryPrevious = document.getElementById("imageGalleryPrevious");
    const galleryNext = document.getElementById("imageGalleryNext");
    const galleryRippleControl = document.getElementById("imageGalleryRippleControl");
    const galleryRippleStatus = document.getElementById("imageGalleryRippleStatus");
    const debugEnabled = window.location.search.includes("debug");
    const selfTestEnabled = window.location.search.includes("selftest");
    const forceFallback = selfTestEnabled && new URLSearchParams(window.location.search).get("gallery") === "fallback";
    const selfTestExceptions = [];
    const debugLog = (label, data = {}) => {
        if (!debugEnabled) return;
        console.debug(`[gallery-debug] ${label}`, {
            ...data,
            time: performance.now()
        });
    };
    const debugMetaWrite = (element, value, writer) => {
        if (!debugEnabled) return;
        console.debug(`[gallery-debug] ${element.id} write`, {
            value,
            writer,
            time: performance.now(),
            stack: new Error().stack
        });
    };

    if (selfTestEnabled) {
        window.__parvGallerySelfTestExceptions = selfTestExceptions;
        window.addEventListener("error", (event) => {
            selfTestExceptions.push(String(event.error?.message || event.message || "error"));
        });
        window.addEventListener("unhandledrejection", (event) => {
            selfTestExceptions.push(String(event.reason?.message || event.reason || "rejection"));
        });
    }

    if (
        !section ||
        !stage ||
        !canvas ||
        !fallback ||
        !metaTitle ||
        !detail ||
        !detailContent ||
        !detailMedia ||
        !detailImage ||
        !detailTitle ||
        !detailDescription ||
        !detailStatus ||
        !detailCopy ||
        !detailClose ||
        !detailPrevious ||
        !detailNext
    ) {
        return;
    }

    const ITEMS = Object.freeze([
        {
            source: "images/gallery/gallery-11.jpg",
            title: "xAI Team",
            width: 2200,
            height: 1465,
            description: "This photo was with my xAI Team during my Summer Internship in front of the Falcon 9 Rocket at the SpaceX HQ in Hawthorne, during the SpaceX IPO Day!"
        },
        {
            source: "images/gallery/gallery-01.jpg",
            title: "Monterey Car Week",
            width: 1650,
            height: 2200,
            description: "I went to Monterey Car Week and saw a new 2026 Ferrari 849 Testarossa with over 1,000 horsepower, a 2.3-second 0–60 time, and a value of more than $500K."
        },
        {
            source: "images/gallery/gallery-14.jpg",
            title: "Meeting NVIDIA CEO",
            width: 2200,
            height: 1229,
            description: "I met NVIDIA founder and CEO Jensen Huang during NVIDIA GTC Event. His aura was unmatched!"
        },
        {
            source: "images/gallery/gallery-08.jpg",
            title: "Meeting Cognition CEO",
            width: 1650,
            height: 2200,
            description: "I went to an event at Cognition HQ and met the CEO, Scott Wu!"
        },
        {
            source: "images/gallery/gallery-03.jpg",
            title: "Founder of Loom",
            width: 1650,
            height: 2200,
            description: "I went to an entrepreneurship event at Stanford and met Loom founder Vinay Hiremath. I learned how he built, scaled, and sold Loom to Atlassian for $975 million."
        },
        {
            source: "images/gallery/gallery-07.jpg",
            title: "Met Founder of OpenClaw",
            width: 1650,
            height: 2200,
            description: "I went to the ChatGPT Futures Showcase event and met Peter Steinberger, founder of OpenClaw, and talked with him about future token usage for enterprises."
        },
        {
            source: "images/gallery/gallery-05.jpg",
            title: "Met Founder of Twitch",
            width: 2161,
            height: 2200,
            description: "When I was in high school, I went to a Y Combinator summer conference and met Twitch co-founder Emmett Shear. He was Twitch's CEO for 10 years, served as interim CEO of OpenAI for three days, and is now a partner at YC."
        },
        {
            source: "images/gallery/gallery-13.jpg",
            title: "YC Startup School",
            width: 1650,
            height: 2200,
            description: "I attended YC Startup School to learn from founders, meet really cool builders, and my time in SF immersed in the startup community!"
        },
        {
            source: "images/gallery/gallery-04.jpg",
            title: "Shark Fin Cove",
            width: 1650,
            height: 2200,
            description: "A view from Shark Fin Cove along California's coast."
        },
        {
            source: "images/gallery/gallery-17.jpg",
            title: "Tahoe",
            width: 1650,
            height: 2200,
            description: "A winter day in Tahoe looking across the mountains from the slopes."
        },
        {
            source: "images/gallery/gallery-06.jpg",
            title: "Bahamas",
            width: 1650,
            height: 2200,
            description: "A moment from the Bahamas surrounded by clear blue water."
        },
        {
            source: "images/gallery/gallery-02.jpg",
            title: "Banff",
            width: 1650,
            height: 2200,
            description: "A waterfall running through the forests of Banff."
        },
        {
            source: "images/gallery/gallery-09.jpg",
            title: "Yosemite",
            width: 1650,
            height: 2200,
            description: "A view of Yosemite Falls."
        },
        {
            source: "images/gallery/gallery-15.jpg",
            title: "ATV Riding",
            width: 1650,
            height: 2200,
            description: "ATV riding across the dunes on a clear day by the coast."
        },
        {
            source: "images/gallery/gallery-16.jpg",
            title: "Indiana University Football",
            width: 1650,
            height: 2200,
            description: "Taking in my last IU football game from the stands at Memorial Stadium."
        },
        {
            source: "images/gallery/gallery-12.jpg",
            title: "Headshot",
            width: 1650,
            height: 2200,
            description: "A portrait from my personal gallery."
        },
        {
            source: "images/gallery/gallery-10.jpg",
            title: "Don Toliver",
            width: 1014,
            height: 2200,
            description: "A night at a Don Toliver concert."
        }
    ]);
    const fallbackButtons = Array.from(fallback.querySelectorAll("[data-gallery-index]"));
    fallbackButtons.forEach((button) => {
        const item = ITEMS[Number(button.dataset.galleryIndex)];
        if (!item) return;
        const inverseAspect = item.height / Math.max(item.width, 1);
        button.style.setProperty("--gallery-fallback-ratio", `${item.width} / ${item.height}`);
        button.style.setProperty("--gallery-fallback-max-height", `${(72 * inverseAspect).toFixed(4)}vw`);
        button.style.setProperty("--gallery-fallback-mobile-max-height", `${(78 * inverseAspect).toFixed(4)}vw`);
    });
    const HEIGHT_SCALES = [0.92, 1.04, 0.88, 1.00, 0.84, 1.04, 0.82, 0.98, 0.88, 1.06, 0.90, 1.00];
    const GAP_SCALES = [0.88, 1.14, 0.84, 1.04, 0.92, 1.16, 0.86, 1.08, 0.94, 1.10, 0.90, 1.00];
    const VERTICAL_OFFSETS = [-0.012, 0.028, -0.030, 0.018, -0.006, 0.032, -0.020, 0.006, 0.026, -0.028, 0.012, -0.004];
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const root = document.documentElement;
    const abortController = new AbortController();
    const { signal } = abortController;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
    const galleryRippleColors = Object.freeze(["blue", "red", "green", "orange"]);
    const clearPointerFocusReturn = () => {
        canvas.classList.remove("is-pointer-focus-return");
        fallbackButtons.forEach((button) => button.classList.remove("is-pointer-focus-return"));
    };
    const scrollDistanceScale = clamp(
        Number.parseFloat(section.dataset.scrollDistanceScale) || 1.28,
        1,
        2
    );
    let debugGalleryFrameCount = 0;
    let debugRafRunning = false;
    let debugNeedsAnimationState = null;
    let debugLastActiveKey = null;
    const debugRafStart = (mode) => {
        if (!debugEnabled || debugRafRunning) return;
        debugRafRunning = true;
        debugGalleryFrameCount = 0;
        debugLog("RAF start", { mode });
    };
    const debugRafStop = (mode) => {
        if (!debugEnabled || !debugRafRunning) return;
        debugLog("RAF stop", { mode, frames: debugGalleryFrameCount });
        debugRafRunning = false;
    };
    let localAnimationFrameId = 0;
    const wake = () => {
        if (typeof window.requestParvAnimationFrame === "function") {
            window.requestParvAnimationFrame();
            return;
        }
        // Keep the gallery functional if the optional shared coordinator is
        // blocked or fails to initialize.
        if (!localAnimationFrameId) {
            localAnimationFrameId = window.requestAnimationFrame((time) => {
                localAnimationFrameId = 0;
                renderFrame(time, 16.67);
                if (needsAnimation()) wake();
            });
        }
    };
    // Physical clone keys (copy * item count + item) are used only for
    // rendering. Every user-facing value is derived through this one logical
    // index normalizer so metadata and the detail view cannot diverge.
    const normalizeLogicalIndex = (index) => {
        const numericIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
        return modulo(Math.trunc(numericIndex), ITEMS.length);
    };

    let gl = null;
    let program = null;
    let vertexArray = null;
    let vertexBuffer = null;
    let indexBuffer = null;
    let indexCount = 0;
    let uniforms = null;
    let textures = [];
    let resourcesReady = false;
    let loadingPromise = null;
    let loadGeneration = 0;
    let contextLost = false;
    let isDestroyed = false;
    let isIntersecting = true;
    let isNearViewport = true;
    let isDocumentVisible = !document.hidden;
    let isDirty = true;
    let resizeTimer = 0;
    let cssWidth = 1;
    let cssHeight = 1;
    let deviceScale = 1;
    let sectionTop = 0;
    let scrollStart = 0;
    let scrollRange = 1;
    let scrollTravel = 1;
    let cycleWidth = 1;
    let lastFrameTime = 0;
    let activeIndex = 0;
    let visibleCount = 0;
    let detailOpen = false;
    let detailClosing = false;
    let detailIndex = 0;
    let detailSwapToken = 0;
    let detailLifecycleToken = 0;
    let detailTimer = 0;
    let detailFadeTimer = 0;
    let detailTransitionHandler = null;
    let detailCloseFinisher = null;
    let detailCandidateImage = null;
    let detailOrigin = null;
    let returnFocusElement = null;
    let detailPageScrollY = null;
    let detailScrollLocked = false;
    let lastLoadError = null;
    let inlineTexturesPromise = null;
    let loadRetryTimer = 0;
    let loadRetryCount = 0;
    let pendingDetailIndex = 0;
    let fallbackCenters = [];
    let backgroundInertStates = [];
    let renderedFrames = 0;
    let hasRenderedWebGLFrame = false;
    let hasPresentedInitialPhoto = false;
    let wheelCaptureUntil = 0;
    let wheelCaptureX = 0;
    let wheelCaptureY = 0;

    const isWebGLReady = () => resourcesReady && textures.length === ITEMS.length && !contextLost && !reducedMotionQuery.matches;
    const isWebGLPresented = () => isWebGLReady() && stage.classList.contains("is-webgl-ready");
    const syncLayoutMode = (preserveViewport = false) => {
        const previousTop = preserveViewport ? stage.getBoundingClientRect().top : 0;
        const useScrollLayout = !forceFallback
            && !lastLoadError
            && !contextLost
            && !reducedMotionQuery.matches
            && !stage.classList.contains("is-webgl-unavailable");
        section.classList.toggle("is-gallery-scroll-layout", useScrollLayout);
        if (preserveViewport) {
            const nextTop = stage.getBoundingClientRect().top;
            const correction = nextTop - previousTop;
            if (Math.abs(correction) > 1) window.scrollBy(0, correction);
        }
    };
    const syncPresentation = () => {
        const ready = isWebGLReady() && hasRenderedWebGLFrame;
        const focusedElement = document.activeElement;
        const focusWasInFallback = focusedElement instanceof Element && fallback.contains(focusedElement);
        const focusWasOnCanvas = focusedElement === canvas;
        if (selfTestEnabled) section.dataset.galleryReady = String(ready);
        stage.classList.toggle("is-webgl-ready", ready);
        fallback.inert = ready;
        fallback.setAttribute("aria-hidden", String(ready));
        canvas.tabIndex = ready ? 0 : -1;
        canvas.setAttribute("aria-hidden", String(!ready));
        if (galleryControls) galleryControls.hidden = !ready;
        if (!ready) {
            stage.style.removeProperty("--gallery-meta-x");
            stage.style.removeProperty("--gallery-meta-y");
            stage.style.removeProperty("--gallery-meta-width");
        }
        // Loading WebGL or changing the reduced-motion preference swaps which
        // gallery surface is interactive. Never strand keyboard focus inside
        // the surface that just became inert/hidden.
        if (!detailOpen && !detailClosing) {
            if (ready && focusWasInFallback) {
                canvas.focus({ preventScroll: true });
            } else if (!ready && focusWasOnCanvas) {
                fallback.querySelector(`[data-gallery-index="${activeIndex}"]`)
                    ?.focus({ preventScroll: true });
            }
        }
    };
    const setBackgroundInert = (inert) => {
        if (inert) {
            backgroundInertStates = Array.from(document.body.children)
                .filter((element) => element !== detail && !["SCRIPT", "STYLE"].includes(element.tagName))
                .map((element) => [element, element.inert]);
            backgroundInertStates.forEach(([element]) => { element.inert = true; });
        } else {
            backgroundInertStates.forEach(([element, previous]) => { element.inert = previous; });
            backgroundInertStates = [];
        }
    };

    const itemLayout = ITEMS.map(() => ({
        width: 1,
        height: 1,
        center: 0,
        y: 0
    }));
    const visibleInstances = Array.from({ length: ITEMS.length * 3 }, () => ({
        index: 0,
        copy: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        active: 0
    }));
    const movement = {
        scrollTarget: 0,
        manualTarget: 0,
        position: 0,
        velocity: 0,
        momentumVelocity: 0,
        deformation: 0,
        lastScrollTarget: 0,
        lastInputTime: 0
    };
    const pointer = {
        inside: false,
        x: 0,
        y: 0,
        smoothX: 0,
        smoothY: 0,
        strength: 0,
        strengthVelocity: 0,
        down: false,
        dragging: false,
        candidate: false,
        id: -1,
        type: "",
        startX: 0,
        startY: 0,
        startManual: 0,
        lastX: 0,
        lastMoveTime: 0,
        dragVelocity: 0,
        travel: 0
    };

    const vertexSource = `#version 300 es
        precision highp float;

        in vec2 aUv;
        out vec2 vUv;

        uniform vec2 uResolution;
        uniform vec2 uCenter;
        uniform vec2 uSize;
        uniform float uVelocity;
        uniform float uActive;
        uniform float uPosition;
        uniform float uTime;
        uniform float uItemPhase;
        uniform float uMicro;
        uniform vec2 uPointerLocal;
        uniform float uPointerStrength;
        uniform float uMobile;

        void main() {
            vUv = aUv;
            vec2 local = aUv - 0.5;
            float mobileMotion = mix(1.0, 0.52, uMobile);
            float speed = clamp(uVelocity, -1.0, 1.0) * mobileMotion;
            float centerDepth = 1.0 - smoothstep(0.0, 1.0, abs(uPosition));
            float activeScale = 1.0 + uActive * 0.042 + centerDepth * 0.020;
            vec2 pixel = local * uSize * activeScale;
            float minDimension = min(uSize.x, uSize.y);
            float bend = clamp(minDimension * 0.036, 7.0, 22.0);
            float horizontalCurve = sin(aUv.y * 3.14159265);
            float verticalCurve = sin(aUv.x * 3.14159265);
            float edge = (aUv.x - 0.5) * 2.0;

            pixel.x += horizontalCurve * speed * bend;
            pixel.y += verticalCurve * speed * bend * 0.72;
            pixel.y += edge * speed * bend * 0.30;
            pixel.x += local.y * speed * bend * 0.30;

            float phase = uTime * 0.00115 + uItemPhase;
            float microWave = sin(phase) * uMicro;
            pixel.y += microWave * minDimension * 0.020;
            pixel.x += cos(phase * 0.73) * uMicro * minDimension * 0.009;

            float angle = clamp(
                -uPosition * 0.045 + speed * 0.032 + microWave * 0.010,
                -0.080,
                0.080
            );
            float sine = sin(angle);
            float cosine = cos(angle);
            pixel = mat2(cosine, -sine, sine, cosine) * pixel;
            pixel.y += abs(uPosition) * minDimension * 0.035;

            vec2 pointerDelta = aUv - uPointerLocal;
            float pointerInfluence = exp(-dot(pointerDelta, pointerDelta) * 10.0)
                * uPointerStrength;
            vec2 pointerCentered = uPointerLocal - 0.5;
            pixel.y += local.x * pointerCentered.x * minDimension * 0.020 * pointerInfluence;
            pixel.x += local.y * pointerCentered.y * minDimension * 0.012 * pointerInfluence;

            pixel += uCenter;
            vec2 clip = vec2(
                pixel.x / uResolution.x * 2.0 - 1.0,
                1.0 - pixel.y / uResolution.y * 2.0
            );
            gl_Position = vec4(clip, 0.0, 1.0);
        }
    `;

    const fragmentSource = `#version 300 es
        precision highp float;

        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uTexture;
        uniform vec2 uSize;
        uniform float uActive;

        float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
            vec2 q = abs(point) - halfSize + radius;
            return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
        }

        void main() {
            vec4 texel = texture(uTexture, vUv);
            float radius = min(17.0, min(uSize.x, uSize.y) * 0.075);
            float distanceToEdge = roundedBoxSdf(
                (vUv - 0.5) * uSize,
                uSize * 0.5,
                radius
            );
            float alpha = (1.0 - smoothstep(-1.4, 0.6, distanceToEdge)) * texel.a;
            vec3 color = texel.rgb * mix(0.94, 1.035, uActive);
            outColor = vec4(color * alpha, alpha);
        }
    `;

    const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            lastLoadError = new Error(gl.getShaderInfoLog(shader) || "Gallery shader compilation failed");
            console.error("[gallery]", lastLoadError);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const createMesh = () => {
        const columns = 24;
        const rows = 8;
        const vertices = new Float32Array((columns + 1) * (rows + 1) * 2);
        const indices = new Uint16Array(columns * rows * 6);
        let vertexCursor = 0;
        let indexCursor = 0;
        for (let row = 0; row <= rows; row += 1) {
            for (let column = 0; column <= columns; column += 1) {
                vertices[vertexCursor++] = column / columns;
                vertices[vertexCursor++] = row / rows;
            }
        }
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const topLeft = row * (columns + 1) + column;
                const topRight = topLeft + 1;
                const bottomLeft = topLeft + columns + 1;
                const bottomRight = bottomLeft + 1;
                indices[indexCursor++] = topLeft;
                indices[indexCursor++] = bottomLeft;
                indices[indexCursor++] = topRight;
                indices[indexCursor++] = topRight;
                indices[indexCursor++] = bottomLeft;
                indices[indexCursor++] = bottomRight;
            }
        }
        vertexArray = gl.createVertexArray();
        vertexBuffer = gl.createBuffer();
        indexBuffer = gl.createBuffer();
        gl.bindVertexArray(vertexArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        const uvLocation = gl.getAttribLocation(program, "aUv");
        gl.enableVertexAttribArray(uvLocation);
        gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        indexCount = indices.length;
    };

    const initializeResources = () => {
        if (isDestroyed || reducedMotionQuery.matches) return false;
        if (forceFallback) {
            stage.classList.add("is-webgl-unavailable");
            return false;
        }
        gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: true,
            powerPreference: "high-performance"
        });
        if (!gl) {
            stage.classList.add("is-webgl-unavailable");
            return false;
        }
        const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertexShader || !fragmentShader) {
            stage.classList.add("is-webgl-unavailable");
            return false;
        }
        program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            lastLoadError = new Error(gl.getProgramInfoLog(program) || "Gallery shader linking failed");
            console.error("[gallery]", lastLoadError);
            gl.deleteProgram(program);
            program = null;
            stage.classList.add("is-webgl-unavailable");
            return false;
        }
        uniforms = {
            resolution: gl.getUniformLocation(program, "uResolution"),
            center: gl.getUniformLocation(program, "uCenter"),
            size: gl.getUniformLocation(program, "uSize"),
            velocity: gl.getUniformLocation(program, "uVelocity"),
            active: gl.getUniformLocation(program, "uActive"),
            position: gl.getUniformLocation(program, "uPosition"),
            time: gl.getUniformLocation(program, "uTime"),
            itemPhase: gl.getUniformLocation(program, "uItemPhase"),
            micro: gl.getUniformLocation(program, "uMicro"),
            pointerLocal: gl.getUniformLocation(program, "uPointerLocal"),
            pointerStrength: gl.getUniformLocation(program, "uPointerStrength"),
            texture: gl.getUniformLocation(program, "uTexture"),
            mobile: gl.getUniformLocation(program, "uMobile")
        };
        createMesh();
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        debugLog("WebGL path initialized", {
            context: "webgl2",
            dpr: deviceScale
        });
        return true;
    };

    const resolveAssetUrl = (source) => new URL(source, document.baseURI || window.location.href).href;
    const TEXTURE_CACHE_VERSION = "20260903-smooth-1";
    const encodedTextureUrl = (source) => resolveAssetUrl(
        `${source.replace("images/gallery/", "gallery-textures/encoded/")}?v=${TEXTURE_CACHE_VERSION}`
    );
    const runtimeProtocol = () => new URL(document.URL).protocol;
    const defer = (callback) => {
        if (typeof window.queueMicrotask === "function") {
            window.queueMicrotask(callback);
        } else {
            window.setTimeout(callback, 0);
        }
    };

    const ensureInlineTextures = () => {
        if (runtimeProtocol() !== "file:") return Promise.resolve();
        if (window.GALLERY_TEXTURES) return Promise.resolve();
        if (!inlineTexturesPromise) {
            inlineTexturesPromise = new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = resolveAssetUrl("gallery-textures.js");
                script.async = true;
                script.dataset.galleryTextureManifest = "";
                script.onload = () => window.GALLERY_TEXTURES
                    ? resolve()
                    : reject(new Error("Local gallery texture manifest is empty"));
                script.onerror = () => reject(new Error("Unable to load local gallery textures"));
                document.head.appendChild(script);
            });
        }
        return inlineTexturesPromise;
    };

    const releaseInlineTextures = () => {
        if (runtimeProtocol() !== "file:") return;
        window.GALLERY_TEXTURES = null;
        inlineTexturesPromise = null;
        document.querySelectorAll("script[data-gallery-texture-manifest]").forEach((script) => script.remove());
    };

    const loadImage = (source) => new Promise((resolve, reject) => {
        const image = new Image();
        let settled = false;
        const inlineSource = runtimeProtocol() === "file:" ? window.GALLERY_TEXTURES?.[source] : null;
        if (runtimeProtocol() === "file:" && !inlineSource) {
            reject(new Error(`Missing local gallery texture: ${source}`));
            return;
        }
        const imageUrl = inlineSource || encodedTextureUrl(source);
        image.decoding = "async";
        const finish = (error) => {
            if (settled) return;
            settled = true;
            image.removeEventListener("load", onLoad);
            image.removeEventListener("error", onError);
            if (error || !image.naturalWidth) {
                reject(error || new Error(`Image has no decoded pixels: ${source}`));
            } else {
                resolve(image);
            }
        };
        const onLoad = () => finish();
        const onError = () => finish(new Error(`Unable to load ${source}`));
        image.addEventListener("load", onLoad, { once: true });
        image.addEventListener("error", onError, { once: true });
        image.src = imageUrl;
        if (image.complete && image.naturalWidth > 0) {
            defer(() => finish());
        }
    });

    const resizeBitmap = async (image, maxEdge) => {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        if (typeof createImageBitmap === "function") {
            try {
                return await createImageBitmap(image, {
                    resizeWidth: width,
                    resizeHeight: height,
                    resizeQuality: "high"
                });
            } catch (_) {
                // Canvas fallback below.
            }
        }
        const buffer = document.createElement("canvas");
        buffer.width = width;
        buffer.height = height;
        const context = buffer.getContext("2d", { alpha: false });
        context.drawImage(image, 0, 0, width, height);
        return buffer;
    };

    const uploadTexture = async (image) => {
        const texture = gl.createTexture();
        if (!texture) throw new Error("The device could not allocate a gallery texture");
        const maximumTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const preferredEdge = window.innerWidth < 769 ? 768 : 1024;
        let source = null;
        try {
            try {
                source = await resizeBitmap(
                    image,
                    Math.min(maximumTextureSize, preferredEdge)
                );
            } catch (resizeError) {
                debugLog("bitmap resize fallback", { message: String(resizeError) });
                source = image;
            }
            for (let attempt = 0; attempt < 8 && gl.getError() !== gl.NO_ERROR; attempt += 1) { /* Isolate this upload. */ }
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                source
            );
            const errorCode = gl.getError();
            if (errorCode !== gl.NO_ERROR) throw new Error(`Gallery texture upload failed (WebGL ${errorCode})`);
            gl.bindTexture(gl.TEXTURE_2D, null);
            return {
                texture,
                ratio: image.naturalWidth / image.naturalHeight
            };
        } catch (error) {
            gl.deleteTexture(texture);
            throw error;
        } finally {
            source?.close?.();
        }
    };

    const setActiveProject = (index) => {
        const nextIndex = normalizeLogicalIndex(index);
        const nextTitle = ITEMS[nextIndex].title;
        if (
            nextIndex === activeIndex &&
            metaTitle.textContent === nextTitle
        ) {
            return nextIndex;
        }
        canvas.setAttribute("aria-label", `Open ${nextTitle}. Use left and right arrows to browse photos.`);
        const previousIndex = activeIndex;
        const previousTitle = metaTitle.textContent;
        try {
            activeIndex = nextIndex;
            debugMetaWrite(metaTitle, nextTitle, "setActiveProject");
            metaTitle.textContent = nextTitle;
        } catch (error) {
            activeIndex = previousIndex;
            metaTitle.textContent = previousTitle;
            throw error;
        }
        return nextIndex;
    };

    const isGalleryFullyPresented = () => {
        const rect = stage.getBoundingClientRect();
        const visibleHeight = Math.min(window.innerHeight, cssHeight);
        const tolerance = 2;
        return rect.top <= tolerance && rect.bottom >= visibleHeight - tolerance;
    };

    const preloadIfNearby = () => {
        if (forceFallback || resourcesReady || loadingPromise || lastLoadError || reducedMotionQuery.matches || isDestroyed) return;
        const rect = stage.getBoundingClientRect();
        const margin = window.innerHeight * 0.8;
        if (rect.top < window.innerHeight + margin && rect.bottom > -margin) loadTextures();
    };

    const updateScrollTarget = () => {
        if (reducedMotionQuery.matches) return;
        preloadIfNearby();
        const progress = clamp((window.scrollY - scrollStart) / Math.max(scrollRange, 1), 0, 1);
        const nextTarget = progress * scrollTravel;
        const delta = nextTarget - movement.lastScrollTarget;
        movement.scrollTarget = nextTarget;
        movement.lastScrollTarget = nextTarget;
        if (Math.abs(delta) > 0.01) {
            movement.velocity += clamp(delta * 0.72, -180, 180);
            movement.lastInputTime = performance.now();
        }
        // Anchor the first fully presented gallery at SpaceX, even after a
        // large scroll or late texture load. Subsequent visits keep their place.
        if (!hasPresentedInitialPhoto && isWebGLReady() && isGalleryFullyPresented()) {
            hasPresentedInitialPhoto = true;
            centerGalleryOnIndex(0, true, false);
            setActiveProject(0);
        }
        if (Math.abs(delta) > 0.01) {
            isDirty = true;
            wake();
        }
    };

    const updateBounds = () => {
        sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const presentationOffset = Math.max(cssHeight - window.innerHeight, 0);
        scrollStart = sectionTop + presentationOffset;
        scrollRange = Math.max(section.offsetHeight - cssHeight - presentationOffset, 1);
        updateScrollTarget();
    };

    const calculateLayout = (preservePosition = true) => {
        const oldCycle = cycleWidth;
        const isMobile = window.innerWidth < 769;
        const baseHeight = Math.min(
            cssHeight * (isMobile ? 0.50 : 0.58),
            isMobile ? 430 : 590
        );
        const baseGap = clamp(cssWidth * 0.045, isMobile ? 22 : 42, 92);
        let previousCenter = 0;
        let previousWidth = 0;

        for (let index = 0; index < itemLayout.length; index += 1) {
            const ratio = textures[index]?.ratio || ITEMS[index].width / ITEMS[index].height;
            let height = baseHeight * HEIGHT_SCALES[index % HEIGHT_SCALES.length];
            let width = height * ratio;
            const maximumWidth = cssWidth * (isMobile ? 0.76 : 0.52);
            if (width > maximumWidth) {
                width = maximumWidth;
                height = width / ratio;
            }
            itemLayout[index].width = width;
            itemLayout[index].height = height;
            itemLayout[index].y = VERTICAL_OFFSETS[index % VERTICAL_OFFSETS.length] * cssHeight;
            if (index === 0) {
                itemLayout[index].center = 0;
            } else {
                const gap = baseGap * GAP_SCALES[(index - 1) % GAP_SCALES.length];
                itemLayout[index].center =
                    previousCenter + previousWidth * 0.5 + gap + width * 0.5;
            }
            previousCenter = itemLayout[index].center;
            previousWidth = width;
        }

        const first = itemLayout[0];
        const last = itemLayout[itemLayout.length - 1];
        cycleWidth =
            last.center + last.width * 0.5 +
            baseGap * GAP_SCALES[(itemLayout.length - 1) % GAP_SCALES.length] +
            first.width * 0.5;
        // Carry normal vertical scrolling through the clone seam so the
        // gallery visibly continues from the last project back to the first.
        // The sticky section itself remains finite, preserving page exit.
        scrollTravel = Math.max(cycleWidth, 1);

        if (preservePosition && oldCycle > 1) {
            const scale = cycleWidth / oldCycle;
            movement.position *= scale;
            movement.manualTarget *= scale;
            movement.velocity *= scale;
            movement.momentumVelocity *= scale;
        }

        const galleryHeight = cssHeight + Math.max(
            cssHeight * 3.6,
            scrollTravel * scrollDistanceScale
        );
        section.style.setProperty("--gallery-height", `${Math.round(galleryHeight)}px`);
        updateBounds();
        isDirty = true;
        wake();
    };

    const resizeCanvas = () => {
        if (isDestroyed) return;
        const rect = stage.getBoundingClientRect();
        cssWidth = Math.max(1, rect.width);
        cssHeight = Math.max(1, rect.height);
        deviceScale = Math.min(window.devicePixelRatio || 1, window.innerWidth < 769 ? 1.35 : 1.75);
        const nextWidth = Math.max(1, Math.round(cssWidth * deviceScale));
        const nextHeight = Math.max(1, Math.round(cssHeight * deviceScale));
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
            canvas.width = nextWidth;
            canvas.height = nextHeight;
        }
        gl?.viewport(0, 0, canvas.width, canvas.height);
        if (textures.length === ITEMS.length || section.classList.contains("is-gallery-scroll-layout")) {
            calculateLayout(true);
        } else {
            updateBounds();
        }
        if (detailOpen) setDetailMediaSize(detailIndex);
        updateFallbackGutters();
        isDirty = true;
        wake();
    };

    const scheduleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resizeCanvas, 150);
    };

    const showPermanentFallback = (error) => {
        lastLoadError = error instanceof Error ? error : new Error(String(error));
        disposeResources();
        if (selfTestEnabled) section.dataset.galleryLoadState = "fallback";
        console.error("[gallery] WebGL asset pipeline failed", lastLoadError);
        stage.classList.add("is-webgl-unavailable");
        syncLayoutMode(true);
        syncPresentation();
        updateBounds();
        updateFallbackMeta();
    };

    const scheduleGalleryRetry = (error) => {
        if (loadRetryCount >= 1 || isDestroyed || reducedMotionQuery.matches || contextLost) {
            showPermanentFallback(error);
            return false;
        }
        loadRetryCount += 1;
        loadGeneration += 1;
        loadingPromise = null;
        lastLoadError = null;
        if (!window.GALLERY_TEXTURES) inlineTexturesPromise = null;
        disposeResources();
        stage.classList.remove("is-webgl-unavailable");
        if (selfTestEnabled) section.dataset.galleryLoadState = "retrying";
        window.clearTimeout(loadRetryTimer);
        loadRetryTimer = window.setTimeout(() => {
            loadRetryTimer = 0;
            if (!isDestroyed && !reducedMotionQuery.matches && !contextLost) loadTextures();
        }, 180);
        return true;
    };

    const loadTextures = () => {
        if (forceFallback) return null;
        if (loadingPromise || resourcesReady || reducedMotionQuery.matches || isDestroyed || contextLost || lastLoadError) return loadingPromise;
        if (!program) {
            try {
                if (!initializeResources()) {
                    showPermanentFallback(lastLoadError || new Error("WebGL 2 is unavailable for the enhanced gallery."));
                    return null;
                }
            } catch (error) {
                scheduleGalleryRetry(error);
                return null;
            }
        }
        if (selfTestEnabled) section.dataset.galleryLoadState = "loading";
        const generation = loadGeneration;
        const current = () => !isDestroyed && !contextLost && generation === loadGeneration;
        const request = ensureInlineTextures()
            .then(async () => {
                // Bound decoding/upload concurrency to keep mobile memory predictable.
                const results = new Array(ITEMS.length);
                let next = 0;
                let workerFailed = false;
                const worker = async () => {
                    while (next < ITEMS.length && current() && !workerFailed) {
                        const index = next++;
                        try {
                            const image = await loadImage(ITEMS[index].source);
                            if (!current()) return;
                            const value = await uploadTexture(image);
                            results[index] = { status: "fulfilled", value };
                            if (selfTestEnabled) section.dataset.galleryLoadedTextures = String(results.filter((result) => result?.status === "fulfilled").length);
                        } catch (reason) {
                            results[index] = { status: "rejected", reason };
                            workerFailed = true;
                        }
                    }
                };
                await Promise.all(Array.from({ length: 3 }, worker));
                if (!current()) {
                    results.forEach((result) => {
                        if (result?.status === "fulfilled") gl?.deleteTexture(result.value.texture);
                    });
                    return;
                }
                const failed = results.findIndex((result) => result?.status !== "fulfilled");
                if (failed !== -1) {
                    results.forEach((result) => {
                        if (result?.status === "fulfilled") gl.deleteTexture(result.value.texture);
                    });
                    throw new Error(`Gallery texture ${ITEMS[failed].source}: ${results[failed]?.reason?.message || "upload failed"}`);
                }
                textures = results.map((result) => result.value);
                resourcesReady = true;
                loadRetryCount = 0;
                hasRenderedWebGLFrame = false;
                if (selfTestEnabled) section.dataset.galleryLoadState = "ready";
                stage.classList.remove("is-webgl-unavailable");
                syncLayoutMode();
                calculateLayout(false);
                if (!hasPresentedInitialPhoto) centerGalleryOnIndex(0, true, false);
                else centerGalleryOnIndex(activeIndex, true, false);
                isDirty = true;
                wake();
                releaseInlineTextures();
                if (selfTestEnabled) window.setTimeout(() => runSelfTest("ready"), 0);
            })
            .catch((error) => {
                if (!current()) return;
                scheduleGalleryRetry(error);
            })
            .finally(() => {
                if (loadingPromise === request) loadingPromise = null;
            });
        loadingPromise = request;
        return loadingPromise;
    };

    const setPointerPosition = (event) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = clamp(event.clientX - rect.left, 0, rect.width);
        pointer.y = clamp(event.clientY - rect.top, 0, rect.height);
        if (!pointer.inside) {
            pointer.smoothX = pointer.x;
            pointer.smoothY = pointer.y;
        }
        isDirty = true;
        wake();
    };

    const onPointerEnter = (event) => {
        if (detailOpen || !isWebGLReady() || !isIntersecting) return;
        pointer.inside = true;
        setPointerPosition(event);
        if (finePointerQuery.matches && !reducedMotionQuery.matches) {
            root.classList.add("gallery-pointer-active");
        }
    };

    const onPointerDown = (event) => {
        if (event.button !== 0 || event.isPrimary === false || !isWebGLReady() || detailOpen || !isIntersecting) return;
        hasPresentedInitialPhoto = true;
        pointer.inside = true;
        pointer.down = true;
        pointer.candidate = true;
        pointer.dragging = false;
        pointer.id = event.pointerId;
        pointer.type = event.pointerType;
        pointer.startX = event.clientX;
        pointer.startY = event.clientY;
        pointer.startManual = movement.manualTarget;
        pointer.lastX = event.clientX;
        pointer.lastMoveTime = performance.now();
        pointer.dragVelocity = 0;
        pointer.travel = 0;
        movement.momentumVelocity = 0;
        setPointerPosition(event);
    };

    const onPointerMove = (event) => {
        setPointerPosition(event);
        if (!pointer.down || pointer.id !== event.pointerId || detailOpen) return;
        const deltaX = event.clientX - pointer.startX;
        const deltaY = event.clientY - pointer.startY;
        pointer.travel = Math.max(pointer.travel, Math.hypot(deltaX, deltaY));
        if (!pointer.dragging && pointer.candidate) {
            const threshold = pointer.type === "mouse" ? 4 : 9;
            if (Math.abs(deltaY) > Math.abs(deltaX) * 1.18 && Math.abs(deltaY) > threshold) {
                pointer.candidate = false;
                return;
            }
            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.08 && Math.abs(deltaX) > threshold) {
                pointer.dragging = true;
                canvas.setPointerCapture?.(event.pointerId);
            }
        }
        if (!pointer.dragging) return;
        const now = performance.now();
        const deltaTime = clamp(now - pointer.lastMoveTime, 8, 64);
        pointer.dragVelocity += (
            (-(event.clientX - pointer.lastX) / deltaTime * 1000) - pointer.dragVelocity
        ) * 0.34;
        movement.manualTarget = pointer.startManual - deltaX;
        pointer.lastX = event.clientX;
        pointer.lastMoveTime = now;
        isDirty = true;
        wake();
    };

    const hitTestVisible = (x, y) => {
        let best = null;
        let bestActive = -1;
        for (let index = 0; index < visibleCount; index += 1) {
            const item = visibleInstances[index];
            if (
                x >= item.left &&
                x <= item.left + item.width &&
                y >= item.top &&
                y <= item.top + item.height &&
                item.active >= bestActive
            ) {
                best = item;
                bestActive = item.active;
            }
        }
        return best;
    };

    const getFinalDetailMediaRect = () => {
        const contentRect = detailContent.getBoundingClientRect();
        return {
            left: contentRect.left + detailMedia.offsetLeft - detailContent.scrollLeft,
            top: contentRect.top + detailMedia.offsetTop - detailContent.scrollTop,
            width: detailMedia.offsetWidth,
            height: detailMedia.offsetHeight
        };
    };

    const setDetailMediaSize = (index) => {
        const item = ITEMS[normalizeLogicalIndex(index)];
        const ratio = item.width / item.height;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth < 769;
        const isStacked = viewportWidth <= 980;
        const copyWidth = isMobile
            ? viewportWidth - 28
            : isStacked
                ? Math.min(viewportWidth - 116, 760)
                : clamp(viewportWidth * 0.29, 320, 560);
        detail.style.setProperty("--gallery-detail-copy-width", `${Math.max(1, Math.round(copyWidth))}px`);
        void detailCopy.offsetHeight;

        let maximumWidth;
        let maximumHeight;
        if (isStacked) {
            const copyHeight = Math.max(detailCopy.scrollHeight, isMobile ? 108 : 96);
            const verticalPadding = isMobile ? 154 : 116;
            const contentGap = isMobile ? 12 : 22;
            const availableHeight = Math.max(
                160,
                viewportHeight - verticalPadding - contentGap - copyHeight
            );
            maximumWidth = isMobile
                ? viewportWidth - 24
                : Math.min(viewportWidth - 116, viewportWidth * 0.78);
            maximumHeight = Math.min(
                isMobile ? viewportHeight * 0.58 : viewportHeight * 0.68,
                availableHeight
            );
        } else {
            const horizontalPadding = clamp(viewportWidth * 0.16, 136, 264);
            const contentGap = clamp(viewportWidth * 0.05, 38, 88);
            maximumWidth = Math.min(
                Math.max(240, viewportWidth - horizontalPadding - contentGap - copyWidth),
                viewportWidth * 0.56,
                1000
            );
            maximumHeight = Math.min(viewportHeight * 0.84, 900);
        }
        const fittedWidth = Math.max(1, Math.min(maximumWidth, maximumHeight * ratio));
        const fittedHeight = Math.max(1, fittedWidth / ratio);
        detail.style.setProperty("--gallery-detail-width", `${Math.round(fittedWidth)}px`);
        detail.style.setProperty("--gallery-detail-height", `${Math.round(fittedHeight)}px`);
        void detailContent.offsetWidth;
        return getFinalDetailMediaRect();
    };

    const setDetailOrigin = (sourceRect) => {
        const finalRect = getFinalDetailMediaRect();
        const finalWidth = Math.max(finalRect.width, 1);
        const finalHeight = Math.max(finalRect.height, 1);
        const originCenterX = sourceRect.left + sourceRect.width * 0.5;
        const originCenterY = sourceRect.top + sourceRect.height * 0.5;
        detailMedia.style.setProperty(
            "--gallery-origin-x",
            `${originCenterX - (finalRect.left + finalWidth * 0.5)}px`
        );
        detailMedia.style.setProperty(
            "--gallery-origin-y",
            `${originCenterY - (finalRect.top + finalHeight * 0.5)}px`
        );
        detailMedia.style.setProperty(
            "--gallery-origin-scale",
            String(clamp(
                Math.min(sourceRect.width / finalWidth, sourceRect.height / finalHeight),
                0.08,
                1
            ))
        );
    };

    const getVisibleInstanceRect = (index) => {
        const itemIndex = normalizeLogicalIndex(index);
        let best = null;
        for (let instanceIndex = 0; instanceIndex < visibleCount; instanceIndex += 1) {
            const instance = visibleInstances[instanceIndex];
            if (instance.index !== itemIndex || (best && instance.active <= best.active)) continue;
            best = instance;
        }
        if (!best) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            left: rect.left + best.left,
            top: rect.top + best.top,
            width: best.width,
            height: best.height
        };
    };

    const positionActiveMeta = (index) => {
        const itemIndex = normalizeLogicalIndex(index);
        let best = null;
        for (let instanceIndex = 0; instanceIndex < visibleCount; instanceIndex += 1) {
            const instance = visibleInstances[instanceIndex];
            if (instance.index !== itemIndex || (best && instance.active <= best.active)) continue;
            best = instance;
        }
        if (!best) return;
        const x = clamp(best.left + best.width * 0.5, 24, cssWidth - 24);
        const desiredY = best.top + best.height + clamp(cssHeight * 0.027, 16, 26);
        const y = clamp(desiredY, 24, cssHeight - 130);
        stage.style.setProperty("--gallery-meta-x", `${x.toFixed(2)}px`);
        stage.style.setProperty("--gallery-meta-y", `${y.toFixed(2)}px`);
        stage.style.setProperty(
            "--gallery-meta-width",
            `${clamp(best.width * 1.32, 230, 660).toFixed(2)}px`
        );
    };

    const centerGalleryOnIndex = (index, immediate = false, markInput = true) => {
        const itemIndex = normalizeLogicalIndex(index);
        const baseTarget = itemLayout[itemIndex].center;
        const currentTarget = movement.scrollTarget + movement.manualTarget;
        const target = baseTarget + Math.round(
            (currentTarget - baseTarget) / Math.max(cycleWidth, 1)
        ) * cycleWidth;
        movement.manualTarget = target - movement.scrollTarget;
        movement.momentumVelocity = 0;
        if (markInput) {
            hasPresentedInitialPhoto = true;
            movement.lastInputTime = performance.now();
        }
        if (immediate) {
            movement.position = target;
            movement.velocity = 0;
            movement.deformation = 0;
        }
        isDirty = true;
        wake();
        return target;
    };

    const updateFallbackGutters = () => {
        const first = fallbackButtons[0];
        const last = fallbackButtons[fallbackButtons.length - 1];
        if (!first || !last || !fallback.clientWidth) return;
        const start = Math.max(0, (fallback.clientWidth - first.offsetWidth) * 0.5);
        const end = Math.max(0, (fallback.clientWidth - last.offsetWidth) * 0.5);
        fallback.style.setProperty("--gallery-fallback-start-gutter", `${start.toFixed(2)}px`);
        fallback.style.setProperty("--gallery-fallback-end-gutter", `${end.toFixed(2)}px`);
        fallbackCenters = fallbackButtons.map((button) => button.offsetLeft + button.offsetWidth * 0.5);
    };

    const centerFallbackOnIndex = (index, behavior = "auto", markInput = false) => {
        const itemIndex = normalizeLogicalIndex(index);
        const button = fallbackButtons[itemIndex];
        if (!button) return null;
        if (fallbackCenters.length !== fallbackButtons.length) updateFallbackGutters();
        const left = fallbackCenters[itemIndex] - fallback.clientWidth * 0.5;
        if (behavior === "smooth" && !reducedMotionQuery.matches) {
            fallback.scrollTo({ left, behavior: "smooth" });
        } else {
            const previousBehavior = fallback.style.scrollBehavior;
            fallback.style.scrollBehavior = "auto";
            fallback.scrollLeft = left;
            fallback.style.scrollBehavior = previousBehavior;
        }
        setActiveProject(itemIndex);
        if (markInput) hasPresentedInitialPhoto = true;
        return button;
    };

    const getCenteredGalleryRect = (index) => {
        const itemIndex = normalizeLogicalIndex(index);
        const layout = itemLayout[itemIndex];
        if (!resourcesReady || !layout || layout.width <= 1 || layout.height <= 1) return null;
        const rect = canvas.getBoundingClientRect();
        const displayedScale = 1.062;
        const displayedWidth = layout.width * displayedScale;
        const displayedHeight = layout.height * displayedScale;
        return {
            left: rect.left + cssWidth * 0.5 - displayedWidth * 0.5,
            top: rect.top + cssHeight * 0.46 + layout.y - displayedHeight * 0.5,
            width: displayedWidth,
            height: displayedHeight
        };
    };

    const navigateGallery = (direction) => {
        // Navigate from the requested destination, not a still-animating card.
        const target = movement.scrollTarget + movement.manualTarget;
        let nearest = 0;
        let distance = Infinity;
        itemLayout.forEach((item, index) => {
            const offset = modulo(item.center - target + cycleWidth / 2, cycleWidth) - cycleWidth / 2;
            if (Math.abs(offset) < distance) {
                distance = Math.abs(offset);
                nearest = index;
            }
        });
        centerGalleryOnIndex(nearest + direction);
    };

    const updateDetailNavigation = () => {
        detailPrevious.disabled = false;
        detailNext.disabled = false;
        detailPrevious.setAttribute("aria-disabled", "false");
        detailNext.setAttribute("aria-disabled", "false");
    };

    const getDetailPreviewSource = (index) => {
        const itemIndex = normalizeLogicalIndex(index);
        const item = ITEMS[itemIndex];
        const encodedImage = fallbackButtons[itemIndex]?.querySelector("img");
        if (runtimeProtocol() === "file:" && window.GALLERY_TEXTURES?.[item.source]) {
            return window.GALLERY_TEXTURES[item.source];
        }
        return encodedImage?.currentSrc
            || encodedImage?.src
            || encodedTextureUrl(item.source);
    };

    const cancelDetailCandidate = () => {
        window.clearTimeout(detailFadeTimer);
        detailFadeTimer = 0;
        const candidate = detailCandidateImage;
        detailCandidateImage = null;
        if (!candidate) return;
        candidate.onload = null;
        candidate.onerror = null;
        candidate.removeAttribute("src");
    };

    const clearDetailTransitionHandler = () => {
        if (!detailTransitionHandler) return;
        detailMedia.removeEventListener("transitionend", detailTransitionHandler);
        detailMedia.removeEventListener("transitioncancel", detailTransitionHandler);
        detailTransitionHandler = null;
    };

    const lockDetailScroll = () => {
        detailPageScrollY = window.scrollY;
        detailScrollLocked = true;
        // Lock only the root scrolling element. Locking <body> creates a new
        // scroll container and changes the geometry of the sticky gallery.
        root.classList.add("gallery-detail-scroll-lock");
        window.parvSmoothScroll?.stop?.();
    };

    const resumeDetailScroll = () => {
        root.classList.remove("gallery-detail-scroll-lock");
        if (!detailScrollLocked) return;
        const restoreY = Number.isFinite(detailPageScrollY) ? detailPageScrollY : window.scrollY;
        detailScrollLocked = false;
        detailPageScrollY = null;
        if (window.parvSmoothScroll?.start) {
            window.parvSmoothScroll.start(restoreY);
        } else if (Math.abs(window.scrollY - restoreY) > 0.5) {
            window.scrollTo(Number(window.scrollX) || 0, restoreY);
        }
    };

    const commitDetailItem = (index, source, announce = false) => {
        const itemIndex = normalizeLogicalIndex(index);
        const item = ITEMS[itemIndex];
        detailIndex = itemIndex;
        detailImage.width = item.width;
        detailImage.height = item.height;
        debugMetaWrite(detailTitle, item.title, "showDetailItem");
        detailTitle.textContent = item.title;
        detailDescription.textContent = item.description;
        detailImage.alt = item.title;
        detailImage.src = source;
        fallbackButtons.forEach((button) => {
            button.classList.toggle("is-detail-selected", Number(button.dataset.galleryIndex) === itemIndex);
        });
        if (announce) detailStatus.textContent = `${item.title}. ${item.description}`;
        isDirty = true;
        wake();
        updateDetailNavigation();
        detailContent.scrollTop = 0;
        setDetailMediaSize(itemIndex);
    };

    const showDetailItem = (index, animate = true) => {
        const itemIndex = normalizeLogicalIndex(index);
        const item = ITEMS[itemIndex];
        const source = resolveAssetUrl(item.source);
        cancelDetailCandidate();
        const token = ++detailSwapToken;

        if (!animate) {
            commitDetailItem(itemIndex, getDetailPreviewSource(itemIndex));
        }

        detailImage.classList.remove("is-changing");
        detailCopy.classList.remove("is-changing");
        const candidate = new Image();
        detailCandidateImage = candidate;
        candidate.decoding = "async";
        let settled = false;
        const current = () => token === detailSwapToken
            && detailCandidateImage === candidate
            && detailOpen
            && !detailClosing
            && !isDestroyed;
        const ready = async () => {
            if (settled) return;
            settled = true;
            if (!current()) return;
            try {
                await candidate.decode?.();
            } catch (_) {
                // The load event already proved the image is usable. Some
                // browsers reject decode() after satisfying it from cache.
            }
            if (!current()) return;
            detailCandidateImage = null;
            candidate.onload = null;
            candidate.onerror = null;
            if (!animate) {
                if (detailIndex === itemIndex && pendingDetailIndex === itemIndex) {
                    detailImage.src = source;
                }
                return;
            }
            // Keep the current photo and copy visible during network/decode;
            // only run the short fade once the next pixels are ready.
            detailImage.classList.add("is-changing");
            detailCopy.classList.add("is-changing");
            await new Promise((resolve) => {
                detailFadeTimer = window.setTimeout(resolve, reducedMotionQuery.matches ? 0 : 145);
            });
            detailFadeTimer = 0;
            if (token !== detailSwapToken || !detailOpen || detailClosing) return;
            window.requestAnimationFrame(() => {
                if (token !== detailSwapToken || !detailOpen || detailClosing) return;
                commitDetailItem(itemIndex, source, true);
                if (stage.classList.contains("is-webgl-ready")) centerGalleryOnIndex(itemIndex, false, false);
                else centerFallbackOnIndex(itemIndex, "smooth");
                window.requestAnimationFrame(() => {
                    if (token !== detailSwapToken) return;
                    detailImage.classList.remove("is-changing");
                    detailCopy.classList.remove("is-changing");
                });
            });
        };
        candidate.onload = ready;
        candidate.onerror = (error) => {
            if (settled) return;
            settled = true;
            if (detailCandidateImage === candidate) detailCandidateImage = null;
            if (token !== detailSwapToken || !detailOpen || detailClosing) return;
            detailImage.classList.remove("is-changing");
            detailCopy.classList.remove("is-changing");
            console.error("[gallery] detail image failed", { index: itemIndex, source, error });
        };
        candidate.src = source;
        if (candidate.complete && candidate.naturalWidth > 0) defer(ready);
    };

    const navigateDetail = (direction) => {
        if (!detailOpen || detailClosing) return;
        pendingDetailIndex = normalizeLogicalIndex(pendingDetailIndex + direction);
        showDetailItem(pendingDetailIndex, true);
    };

    const openDetail = (index, sourceRect) => {
        if (detailOpen || detailClosing) return;
        const lifecycleToken = ++detailLifecycleToken;
        hasPresentedInitialPhoto = true;
        const itemIndex = normalizeLogicalIndex(index);
        window.clearTimeout(detailTimer);
        detailOpen = true;
        detailClosing = false;
        detailOrigin = {
            left: sourceRect.left,
            top: sourceRect.top,
            width: sourceRect.width,
            height: sourceRect.height
        };
        returnFocusElement = document.activeElement;
        pendingDetailIndex = itemIndex;
        lockDetailScroll();
        detailStatus.textContent = "";
        showDetailItem(itemIndex, false);
        detail.classList.remove("is-fade-closing", "is-closing");
        detail.classList.add("is-visible");
        detail.setAttribute("aria-hidden", "false");
        detail.removeAttribute("inert");
        detailClose.focus({ preventScroll: true });
        setBackgroundInert(true);
        document.body.classList.remove("gallery-detail-closing");
        document.body.classList.add("gallery-detail-open", "gallery-detail-active");
        root.classList.remove("gallery-pointer-active");
        setDetailOrigin(detailOrigin);
        void detail.offsetWidth;
        window.requestAnimationFrame(() => {
            if (!detailOpen || detailClosing || isDestroyed || lifecycleToken !== detailLifecycleToken) return;
            detail.classList.add("is-open");
            if (isWebGLReady()) centerGalleryOnIndex(itemIndex, false, false);
            detailClose.focus({ preventScroll: true });
        });
        isDirty = true;
        wake();
    };

    const closeDetail = (event) => {
        if (!detailOpen || detailClosing) return;
        const suppressReturnFocusRing = event?.type === "click" && Number(event.detail) > 0;
        const hadOpened = detail.classList.contains("is-open");
        detailLifecycleToken += 1;
        detailClosing = true;
        // Restore the strip's opacity while the photo returns, not afterward.
        document.body.classList.add("gallery-detail-closing");
        detailSwapToken += 1;
        cancelDetailCandidate();
        window.clearTimeout(detailTimer);
        clearDetailTransitionHandler();
        detailImage.classList.remove("is-changing");
        detailCopy.classList.remove("is-changing");
        let closeTarget = null;
        if (isWebGLPresented()) {
            centerGalleryOnIndex(detailIndex, true, false);
            closeTarget = getCenteredGalleryRect(detailIndex);
        } else {
            const fallbackItem = centerFallbackOnIndex(detailIndex, "auto");
            if (fallbackItem) {
                const fallbackRect = (fallbackItem.querySelector("img") || fallbackItem).getBoundingClientRect();
                if (fallbackRect.right > 0 && fallbackRect.left < window.innerWidth) {
                    closeTarget = fallbackRect;
                }
            }
        }
        if (!closeTarget) closeTarget = getVisibleInstanceRect(detailIndex) || detailOrigin;
        const preservedGalleryTarget = movement.scrollTarget + movement.manualTarget;
        if (closeTarget) {
            setDetailOrigin(closeTarget);
            detail.classList.remove("is-fade-closing");
        } else {
            detail.classList.add("is-fade-closing");
        }
        detail.classList.add("is-closing");
        detail.classList.remove("is-open");
        // Keep the background locked through the entire closing transition.
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            if (detailCloseFinisher === finish) detailCloseFinisher = null;
            window.clearTimeout(detailTimer);
            clearDetailTransitionHandler();
            detailOpen = false;
            try {
                // Give the selected photo back to WebGL while the modal still
                // covers it, so the return animation never leaves a blank beat.
                isDirty = true;
                if (isWebGLPresented()) renderFrame(performance.now(), 16.67);
            } catch (error) {
                // An optional graphics failure must never leave the modal locked.
                console.error("[gallery] close handoff frame failed", error);
            }
            try {
                fallbackButtons.forEach((button) => button.classList.remove("is-detail-selected"));
                // Make the destination visible and focusable, but keep the
                // native scroll lock until focus has safely returned.
                document.body.classList.remove("gallery-detail-active", "gallery-detail-closing");
                setBackgroundInert(false);
                const returnButton = returnFocusElement?.closest?.("[data-gallery-index]");
                const returnIndex = returnButton ? Number(returnButton.dataset.galleryIndex) : null;
                const originalUsable = returnFocusElement?.isConnected && returnFocusElement !== document.body
                    && returnFocusElement.tabIndex >= 0
                    && !returnFocusElement.closest("[inert], [hidden], [aria-hidden='true']")
                    && (returnIndex === null || returnIndex === detailIndex)
                    && returnFocusElement.getClientRects().length > 0;
                const focusTarget = originalUsable
                    ? returnFocusElement
                    : isWebGLPresented()
                        ? canvas
                        : fallbackButtons[detailIndex];
                clearPointerFocusReturn();
                if (
                    suppressReturnFocusRing
                    && (focusTarget === canvas || fallbackButtons.includes(focusTarget))
                ) {
                    focusTarget.classList.add("is-pointer-focus-return");
                }
                focusTarget?.focus?.({ preventScroll: true });
                detail.classList.remove("is-visible", "is-closing", "is-open", "is-fade-closing");
                detail.setAttribute("aria-hidden", "true");
                detail.setAttribute("inert", "");
                document.body.classList.remove("gallery-detail-open");
                detailImage.removeAttribute("src");
                detailStatus.textContent = "";
                returnFocusElement = null;
                detailOrigin = null;
                detailClosing = false;
                resumeDetailScroll();
                updateScrollTarget();
                movement.manualTarget = preservedGalleryTarget - movement.scrollTarget;
                isDirty = true;
                wake();
            } finally {
                detailOpen = false;
                detailClosing = false;
                detail.classList.remove("is-visible", "is-closing", "is-open", "is-fade-closing");
                detail.setAttribute("aria-hidden", "true");
                detail.setAttribute("inert", "");
                document.body.classList.remove("gallery-detail-open", "gallery-detail-active", "gallery-detail-closing");
                setBackgroundInert(false);
                fallbackButtons.forEach((button) => button.classList.remove("is-detail-selected"));
                detailImage.removeAttribute("src");
                detailImage.classList.remove("is-changing");
                detailCopy.classList.remove("is-changing");
                detailStatus.textContent = "";
                returnFocusElement = null;
                detailOrigin = null;
                resumeDetailScroll();
            }
        };
        detailCloseFinisher = finish;
        if (reducedMotionQuery.matches || !hadOpened) {
            finish();
            return;
        }
        detailTransitionHandler = (event) => {
            if (event.target === detailMedia && event.propertyName === "transform") finish();
        };
        detailMedia.addEventListener("transitionend", detailTransitionHandler);
        detailMedia.addEventListener("transitioncancel", detailTransitionHandler);
        detailTimer = window.setTimeout(finish, 760);
    };

    const finishPointer = (event) => {
        if (pointer.id !== event.pointerId) return;
        const releasedId = pointer.id;
        const wasDragging = pointer.dragging;
        if (wasDragging) {
            movement.momentumVelocity = clamp(pointer.dragVelocity, -950, 950);
            movement.lastInputTime = performance.now();
        } else if (pointer.candidate && pointer.travel < 8) {
            const rect = canvas.getBoundingClientRect();
            const hit = hitTestVisible(event.clientX - rect.left, event.clientY - rect.top);
            if (hit) {
                clearPointerFocusReturn();
                canvas.classList.add("is-pointer-focus-return");
                canvas.focus({ preventScroll: true });
                openDetail(hit.index, {
                    left: rect.left + hit.left,
                    top: rect.top + hit.top,
                    width: hit.width,
                    height: hit.height
                });
            }
        }
        pointer.down = false;
        pointer.dragging = false;
        pointer.candidate = false;
        pointer.id = -1;
        if (canvas.hasPointerCapture?.(releasedId)) {
            canvas.releasePointerCapture(releasedId);
        }
        wake();
    };

    const cancelPointer = (clearMomentum = false) => {
        wheelCaptureUntil = 0;
        const capturedId = pointer.id;
        pointer.down = false;
        pointer.dragging = false;
        pointer.candidate = false;
        pointer.id = -1;
        pointer.dragVelocity = 0;
        if (clearMomentum) movement.momentumVelocity = 0;
        if (capturedId >= 0 && canvas.hasPointerCapture?.(capturedId)) {
            canvas.releasePointerCapture(capturedId);
        }
        isDirty = true;
        wake();
    };

    const onPointerLeave = () => {
        const hasCapture = pointer.id >= 0 && canvas.hasPointerCapture?.(pointer.id);
        if (pointer.down && !hasCapture) cancelPointer(true);
        pointer.inside = false;
        root.classList.remove("gallery-pointer-active");
        isDirty = true;
        wake();
    };

    const onWheel = (event) => {
        if (
            detailOpen ||
            !isWebGLReady() ||
            !isIntersecting ||
            event.ctrlKey || event.metaKey
        ) {
            return;
        }
        const lineScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cssHeight : 1;
        const deltaX = event.deltaX * lineScale;
        const deltaY = event.deltaY * lineScale;
        const isHorizontalGesture = Math.abs(deltaX) > Math.abs(deltaY) * 0.85;
        const rect = canvas.getBoundingClientRect();
        const overPhoto = hitTestVisible(event.clientX - rect.left, event.clientY - rect.top);
        const galleryReached = rect.top <= 2 && rect.bottom > window.innerHeight * 0.5;
        const now = performance.now();
        const continuingGesture = now < wheelCaptureUntil
            && Math.hypot(event.clientX - wheelCaptureX, event.clientY - wheelCaptureY) < 20;
        // Horizontal gestures always loop. A regular wheel loops only over a
        // photo once the gallery is reached; surrounding space scrolls the page.
        if (!isHorizontalGesture && !event.shiftKey && !(galleryReached && (overPhoto || continuingGesture))) return;
        const dominant = isHorizontalGesture ? deltaX : deltaY;
        if (Math.abs(dominant) < 0.5) return;
        event.preventDefault();
        event.stopPropagation();
        hasPresentedInitialPhoto = true;
        // Keep a wheel burst captured as the gaps between cards pass under it.
        wheelCaptureUntil = now + 180;
        wheelCaptureX = event.clientX;
        wheelCaptureY = event.clientY;
        const directAmount = 0.42;
        const previousManualTarget = movement.manualTarget;
        movement.manualTarget += dominant * directAmount;
        if (movement.manualTarget === previousManualTarget) {
            movement.momentumVelocity = 0;
        } else {
            movement.momentumVelocity = clamp(
                movement.momentumVelocity + clamp(dominant * 1.05, -260, 260),
                -760,
                760
            );
            movement.lastInputTime = performance.now();
        }
        debugLog("wheel", {
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode,
            dominant,
            manualTarget: movement.manualTarget,
            momentumVelocity: movement.momentumVelocity,
            position: movement.position
        });
        isDirty = true;
        wake();
    };

    const updateMotion = (deltaMs) => {
        const dt = clamp(deltaMs / 1000, 0.001, 0.034);
        const inputAge = movement.lastInputTime
            ? (performance.now() - movement.lastInputTime) / 1000
            : Infinity;
        if (!pointer.dragging && Math.abs(movement.momentumVelocity) > 0.05) {
            movement.manualTarget += movement.momentumVelocity * dt;
            movement.momentumVelocity *= Math.exp(-(inputAge > 1.05 ? 8.5 : 5.2) * dt);
            if (Math.abs(movement.momentumVelocity) < 0.5) {
                movement.momentumVelocity = 0;
            }
        }
        let target = movement.scrollTarget + movement.manualTarget;
        const acceleration = (target - movement.position) * 32 - movement.velocity * 10.2;
        movement.velocity += acceleration * dt;
        movement.velocity = clamp(movement.velocity, -1650, 1650);
        movement.position += movement.velocity * dt;
        if (cycleWidth > 1 && Math.abs(movement.position) > cycleWidth * 32) {
            const shift = Math.round(movement.position / cycleWidth) * cycleWidth;
            movement.position -= shift;
            movement.manualTarget -= shift;
            pointer.startManual -= shift;
            target -= shift;
        }
        if (!pointer.dragging && inputAge >= 1.5) {
            movement.momentumVelocity = 0;
            if (Math.abs(target - movement.position) > 0.01 || Math.abs(movement.velocity) > 0.01) {
                movement.position = target;
                movement.velocity = 0;
            }
        }
        const normalizedVelocity = clamp(movement.velocity / 1250, -1, 1);
        const deforming = Math.abs(normalizedVelocity) > Math.abs(movement.deformation) ||
            normalizedVelocity * movement.deformation < 0;
        const amount = 1 - Math.pow(1 - (deforming ? 0.30 : 0.10), deltaMs / 16.67);
        movement.deformation += (normalizedVelocity - movement.deformation) * amount;

        const pointerAmount = 1 - Math.pow(1 - 0.22, deltaMs / 16.67);
        pointer.smoothX += (pointer.x - pointer.smoothX) * pointerAmount;
        pointer.smoothY += (pointer.y - pointer.smoothY) * pointerAmount;
        const targetStrength = pointer.inside && finePointerQuery.matches ? 1 : 0;
        pointer.strengthVelocity += (targetStrength - pointer.strength) * 48 * dt;
        pointer.strengthVelocity *= Math.exp(-11 * dt);
        pointer.strength = clamp(pointer.strength + pointer.strengthVelocity * dt, 0, 1);
    };

    const findActiveInstance = (baseCopy) => {
        let activeKey = 0;
        let closestDistance = Infinity;
        for (let copy = baseCopy - 1; copy <= baseCopy + 1; copy += 1) {
            for (let index = 0; index < itemLayout.length; index += 1) {
                const centerX =
                    cssWidth * 0.5 +
                    itemLayout[index].center +
                    copy * cycleWidth -
                    movement.position;
                const distance = Math.abs(centerX - cssWidth * 0.5);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    activeKey = copy * itemLayout.length + index;
                }
            }
        }
        return activeKey;
    };

    const drawInstance = (index, copy) => {
        const layout = itemLayout[index];
        const centerX =
            cssWidth * 0.5 + layout.center + copy * cycleWidth - movement.position;
        if (
            centerX + layout.width * 0.7 < -90 ||
            centerX - layout.width * 0.7 > cssWidth + 90
        ) {
            return;
        }
        const centerY = cssHeight * 0.46 + layout.y;
        const position = (centerX - cssWidth * 0.5) / Math.max(cssWidth * 0.5, 1);
        const centerAmount = clamp(1 - Math.abs(position), 0, 1);
        const active = centerAmount * centerAmount * (3 - 2 * centerAmount);
        const phase = index * 1.61803398875 + copy * 0.37;
        const micro = clamp(
            Math.abs(movement.deformation) * 0.92 +
            Math.abs(movement.velocity) / 1850 * 0.24,
            0,
            1
        );
        const localX = (pointer.smoothX - (centerX - layout.width * 0.5)) / layout.width;
        const localY = (pointer.smoothY - (centerY - layout.height * 0.5)) / layout.height;
        const pointerInside =
            pointer.strength > 0.001 &&
            localX >= 0 &&
            localX <= 1 &&
            localY >= 0 &&
            localY <= 1;

        if (visibleCount < visibleInstances.length) {
            const record = visibleInstances[visibleCount++];
            const displayedScale = 1 + active * 0.042 + centerAmount * 0.020;
            const displayedWidth = layout.width * displayedScale;
            const displayedHeight = layout.height * displayedScale;
            const displayedCenterY = centerY + Math.abs(position) * Math.min(layout.width, layout.height) * 0.035;
            record.index = index;
            record.copy = copy;
            record.left = centerX - displayedWidth * 0.5;
            record.top = displayedCenterY - displayedHeight * 0.5;
            record.width = displayedWidth;
            record.height = displayedHeight;
            record.active = active;
        }

        // The detail layer owns this image until closing finishes. Keep its
        // geometry above for the return animation, but avoid a duplicate below.
        if (detailOpen && index === detailIndex) return;
        gl.uniform2f(uniforms.center, centerX, centerY);
        gl.uniform2f(uniforms.size, layout.width, layout.height);
        gl.uniform1f(uniforms.active, active);
        gl.uniform1f(uniforms.position, position);
        gl.uniform1f(uniforms.time, lastFrameTime);
        gl.uniform1f(uniforms.itemPhase, phase);
        gl.uniform1f(uniforms.micro, micro);
        gl.uniform2f(
            uniforms.pointerLocal,
            clamp(localX, 0, 1),
            clamp(localY, 0, 1)
        );
        gl.uniform1f(
            uniforms.pointerStrength,
            pointerInside ? pointer.strength : 0
        );
        gl.bindTexture(gl.TEXTURE_2D, textures[index].texture);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const renderFrame = (time, deltaMs) => {
        if (!needsAnimation()) return;
        renderedFrames += 1;
        if (
            isDestroyed ||
            reducedMotionQuery.matches ||
            !resourcesReady ||
            textures.length !== ITEMS.length ||
            contextLost ||
            !isIntersecting ||
            !isDocumentVisible
        ) {
            return;
        }
        debugGalleryFrameCount += 1;
        if (debugEnabled && debugGalleryFrameCount === 1) {
            debugLog("RAF first frame", {
                protocol: runtimeProtocol(),
                position: movement.position
            });
        }
        const safeDelta = lastFrameTime
            ? clamp(deltaMs || time - lastFrameTime, 1, 34)
            : 16.67;
        lastFrameTime = time;
        updateMotion(safeDelta);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vertexArray);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniforms.texture, 0);
        gl.uniform2f(uniforms.resolution, cssWidth, cssHeight);
        gl.uniform1f(uniforms.velocity, movement.deformation);
        gl.uniform1f(uniforms.mobile, window.innerWidth < 769 ? 1 : 0);
        visibleCount = 0;

        const baseCopy = Math.round(movement.position / Math.max(cycleWidth, 1));
        const activeKey = findActiveInstance(baseCopy);
        for (let copy = baseCopy - 1; copy <= baseCopy + 1; copy += 1) {
            for (let index = 0; index < itemLayout.length; index += 1) {
                if (copy * itemLayout.length + index !== activeKey) {
                    drawInstance(index, copy);
                }
            }
        }
        const nextActiveIndex = modulo(activeKey, itemLayout.length);
        const activeCopy = (activeKey - nextActiveIndex) / itemLayout.length;
        drawInstance(nextActiveIndex, activeCopy);
        positionActiveMeta(nextActiveIndex);
        if (debugEnabled && activeKey !== debugLastActiveKey) {
            debugLastActiveKey = activeKey;
            debugLog("active selection", {
                activeKey,
                logicalIndex: nextActiveIndex,
                title: ITEMS[nextActiveIndex].title,
                position: movement.position,
                scrollTarget: movement.scrollTarget,
                manualTarget: movement.manualTarget,
                velocity: movement.velocity
            });
        }
        setActiveProject(nextActiveIndex);
        if (selfTestEnabled) {
            section.dataset.galleryRenderedFrames = String(renderedFrames);
            section.dataset.galleryPosition = movement.position.toFixed(3);
            section.dataset.galleryTarget = (
                movement.scrollTarget + movement.manualTarget
            ).toFixed(3);
            section.dataset.galleryVelocity = movement.velocity.toFixed(3);
            section.dataset.galleryMomentum = movement.momentumVelocity.toFixed(3);
            section.dataset.galleryInputEnabled = String(isGalleryFullyPresented());
            section.dataset.galleryDetailIndex = String(detailIndex);
            section.dataset.galleryDetailPhase = detailClosing
                ? "closing"
                : detailOpen
                    ? "open"
                    : "closed";
        }
        gl.bindVertexArray(null);
        isDirty = false;
        if (!hasRenderedWebGLFrame) {
            hasRenderedWebGLFrame = true;
            syncPresentation();
        }
    };

    const needsAnimation = () => {
        let nextState = false;
        if (
            isDestroyed ||
            reducedMotionQuery.matches ||
            contextLost ||
            !isWebGLReady() ||
            !isIntersecting ||
            !isDocumentVisible
        ) {
            nextState = false;
        } else {
            const target = movement.scrollTarget + movement.manualTarget;
            const targetStrength = pointer.inside && finePointerQuery.matches ? 1 : 0;
            nextState = (
                isDirty ||
                pointer.down ||
                Math.abs(target - movement.position) > 0.03 ||
                Math.abs(movement.velocity) > 0.05 ||
                Math.abs(movement.momentumVelocity) > 0.05 ||
                Math.abs(movement.deformation) > 0.001 ||
                Math.abs(pointer.x - pointer.smoothX) > 0.05 ||
                Math.abs(pointer.y - pointer.smoothY) > 0.05 ||
                Math.abs(pointer.strength - targetStrength) > 0.002 ||
                Math.abs(pointer.strengthVelocity) > 0.002
            );
        }
        if (debugEnabled && nextState !== debugNeedsAnimationState) {
            debugNeedsAnimationState = nextState;
            debugLog("gallery animation demand", {
                activeIndex,
                position: movement.position,
                velocity: movement.velocity,
                requested: nextState
            });
            if (nextState) {
                debugRafStart("shared-coordinator");
            } else {
                debugRafStop("gallery idle");
            }
        }
        return nextState;
    };

    const updateFallbackMeta = (event) => {
        if (stage.classList.contains("is-webgl-ready")) return;
        if (fallbackCenters.length !== fallbackButtons.length) updateFallbackGutters();
        const center = fallback.scrollLeft + fallback.clientWidth * 0.5;
        let closestIndex = activeIndex;
        let closestDistance = Infinity;
        fallbackCenters.forEach((buttonCenter, index) => {
            const distance = Math.abs(buttonCenter - center);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        setActiveProject(closestIndex);
        if (event) hasPresentedInitialPhoto = true;
    };

    const disposeResources = () => {
        resourcesReady = false;
        hasRenderedWebGLFrame = false;
        syncPresentation();
        if (gl) textures.forEach((item) => gl.deleteTexture(item.texture));
        textures = [];
        if (!gl) return;
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (indexBuffer) gl.deleteBuffer(indexBuffer);
        if (vertexArray) gl.deleteVertexArray(vertexArray);
        if (program) gl.deleteProgram(program);
        vertexBuffer = null;
        indexBuffer = null;
        vertexArray = null;
        program = null;
        resourcesReady = false;
    };

    const onContextLost = (event) => {
        const selectedIndex = activeIndex;
        event.preventDefault();
        cancelPointer(true);
        loadGeneration += 1;
        loadingPromise = null;
        window.clearTimeout(loadRetryTimer);
        loadRetryTimer = 0;
        contextLost = true;
        resourcesReady = false;
        textures = [];
        hasRenderedWebGLFrame = false;
        syncLayoutMode(true);
        syncPresentation();
        centerFallbackOnIndex(selectedIndex, "auto");
        updateFallbackMeta();
        root.classList.remove("gallery-pointer-active");
    };

    const onContextRestored = () => {
        loadGeneration += 1;
        contextLost = false;
        loadingPromise = null;
        loadRetryCount = 0;
        textures = [];
        hasRenderedWebGLFrame = false;
        program = null;
        lastLoadError = null;
        stage.classList.remove("is-webgl-unavailable");
        syncLayoutMode(true);
        loadTextures();
    };

    const onVisibilityChange = () => {
        isDocumentVisible = !document.hidden;
        if (!isDocumentVisible) {
            cancelPointer(true);
            root.classList.remove("gallery-pointer-active");
        }
        lastFrameTime = 0;
        wake();
    };

    const onReducedMotionChange = () => {
        const selectedIndex = activeIndex;
        cancelPointer(true);
        galleryRippleControl?.classList.remove("is-click-rippling");
        root.classList.remove("gallery-pointer-active");
        if (detailClosing) detailCloseFinisher?.();
        if (reducedMotionQuery.matches) {
            loadGeneration += 1;
            loadingPromise = null;
            loadRetryCount = 0;
            window.clearTimeout(loadRetryTimer);
            loadRetryTimer = 0;
            disposeResources();
            syncLayoutMode(true);
            syncPresentation();
            centerFallbackOnIndex(selectedIndex, "auto");
        } else {
            lastLoadError = null;
            stage.classList.remove("is-webgl-unavailable");
            syncLayoutMode(true);
            syncPresentation();
            centerFallbackOnIndex(selectedIndex, "auto");
            loadTextures();
        }
        updateFallbackMeta();
        isDirty = true;
        updateBounds();
        wake();
    };

    const preloadObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            isNearViewport = Boolean(entries[0]?.isIntersecting);
            if (selfTestEnabled) section.dataset.galleryNearViewport = String(isNearViewport);
            if (isNearViewport && !reducedMotionQuery.matches) {
                loadTextures();
                resizeCanvas();
            }
        }, { rootMargin: "80% 0px 80%", threshold: 0.01 })
        : null;

    const visibilityObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            isIntersecting = Boolean(entries[0]?.isIntersecting);
            if (isIntersecting && !reducedMotionQuery.matches) {
                loadTextures();
                resizeCanvas();
            } else if (!isIntersecting) {
                cancelPointer(true);
                root.classList.remove("gallery-pointer-active");
                lastFrameTime = 0;
            }
            wake();
        }, { threshold: 0.001 })
        : null;

    const resizeObserver = "ResizeObserver" in window
        ? new ResizeObserver(scheduleResize)
        : null;

    const destroy = () => {
        if (isDestroyed) return;
        isDestroyed = true;
        loadGeneration += 1;
        detailSwapToken += 1;
        detailLifecycleToken += 1;
        detailCloseFinisher = null;
        cancelDetailCandidate();
        abortController.abort();
        window.clearTimeout(resizeTimer);
        window.clearTimeout(loadRetryTimer);
        window.clearTimeout(detailTimer);
        if (localAnimationFrameId) {
            window.cancelAnimationFrame(localAnimationFrameId);
            localAnimationFrameId = 0;
        }
        clearDetailTransitionHandler();
        preloadObserver?.disconnect();
        visibilityObserver?.disconnect();
        resizeObserver?.disconnect();
        root.classList.remove("gallery-pointer-active");
        detailOpen = false;
        detailClosing = false;
        detail.classList.remove("is-visible", "is-closing", "is-open", "is-fade-closing");
        detail.setAttribute("aria-hidden", "true");
        detail.setAttribute("inert", "");
        detailImage.removeAttribute("src");
        detailImage.classList.remove("is-changing");
        detailCopy.classList.remove("is-changing");
        detailStatus.textContent = "";
        galleryRippleControl?.classList.remove("is-click-rippling");
        fallbackButtons.forEach((button) => button.classList.remove("is-detail-selected"));
        document.body.classList.remove("gallery-detail-open", "gallery-detail-active", "gallery-detail-closing");
        setBackgroundInert(false);
        resumeDetailScroll();
        if (typeof reducedMotionQuery.removeEventListener === "function") {
            reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
        } else {
            reducedMotionQuery.removeListener(onReducedMotionChange);
        }
        disposeResources();
    };

    canvas.addEventListener("pointerenter", onPointerEnter, { passive: true, signal });
    canvas.addEventListener("pointerdown", onPointerDown, { passive: true, signal });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true, signal });
    canvas.addEventListener("pointerup", finishPointer, { passive: true, signal });
    canvas.addEventListener("pointercancel", () => cancelPointer(true), { passive: true, signal });
    canvas.addEventListener("lostpointercapture", () => cancelPointer(false), { passive: true, signal });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true, signal });
    canvas.addEventListener("wheel", onWheel, { passive: false, signal });
    canvas.addEventListener("webglcontextlost", onContextLost, { signal });
    canvas.addEventListener("webglcontextrestored", onContextRestored, { signal });
    fallback.addEventListener("scroll", updateFallbackMeta, { passive: true, signal });
    fallback.addEventListener("click", (event) => {
        const button = event.target.closest("[data-gallery-index]");
        if (!button) return;
        clearPointerFocusReturn();
        if (Number(event.detail) > 0) button.classList.add("is-pointer-focus-return");
        openDetail(
            Number(button.dataset.galleryIndex),
            (button.querySelector("img") || button).getBoundingClientRect()
        );
    }, { signal });
    galleryPrevious?.addEventListener("click", () => navigateGallery(-1), { signal });
    galleryNext?.addEventListener("click", () => navigateGallery(1), { signal });
    galleryRippleControl?.addEventListener("click", (event) => {
        event.stopPropagation();
        const currentColor = galleryRippleControl.dataset.rippleColor || galleryRippleColors[0];
        const currentIndex = Math.max(0, galleryRippleColors.indexOf(currentColor));
        const nextColor = galleryRippleColors[(currentIndex + 1) % galleryRippleColors.length];
        galleryRippleControl.dataset.rippleColor = nextColor;
        // Give every activation an immediate, one-second sweep in its new color.
        galleryRippleControl.classList.remove("is-click-rippling");
        if (!reducedMotionQuery.matches) {
            void galleryRippleControl.offsetWidth;
            galleryRippleControl.classList.add("is-click-rippling");
        }
        if (galleryRippleStatus) galleryRippleStatus.textContent = `Ripple color changed to ${nextColor}.`;
        if (selfTestEnabled) section.dataset.galleryRippleColor = nextColor;
    }, { signal });
    galleryRippleControl?.addEventListener("animationend", (event) => {
        if (event.animationName === "gallery-hint-click-ripple") {
            galleryRippleControl.classList.remove("is-click-rippling");
        }
    }, { signal });
    stage.addEventListener("keydown", clearPointerFocusReturn, { capture: true, signal });
    stage.addEventListener("focusout", (event) => {
        event.target?.classList?.remove("is-pointer-focus-return");
    }, { signal });
    canvas.addEventListener("keydown", (event) => {
        if (!isWebGLReady() || detailOpen) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            navigateGallery(event.key === "ArrowLeft" ? -1 : 1);
            return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const origin = getVisibleInstanceRect(activeIndex) || getCenteredGalleryRect(activeIndex);
        if (origin) openDetail(activeIndex, origin);
    }, { signal });
    document.addEventListener("focusin", (event) => {
        if (detailOpen && !detail.contains(event.target)) detailClose.focus({ preventScroll: true });
    }, { signal });
    detailClose.addEventListener("click", closeDetail, { signal });
    detailPrevious.addEventListener("click", () => navigateDetail(-1), { signal });
    detailNext.addEventListener("click", () => navigateDetail(1), { signal });
    detail.addEventListener("click", (event) => {
        if (event.target === detailContent || event.target.matches("[data-gallery-close]")) closeDetail(event);
    }, { signal });
    document.addEventListener("keydown", (event) => {
        if (!detailOpen) return;
        if (event.key === "Tab") {
            const controls = [detailClose, detailPrevious, detailNext].filter((element) => !element.disabled);
            const current = controls.indexOf(document.activeElement);
            const next = modulo(current + (event.shiftKey ? -1 : 1), controls.length);
            event.preventDefault();
            controls[next].focus({ preventScroll: true });
        }
        if (event.key === "Escape") { event.preventDefault(); closeDetail(); }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            navigateDetail(-1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            navigateDetail(1);
        }
    }, { signal });
    window.addEventListener("scroll", updateScrollTarget, { passive: true, signal });
    window.addEventListener("resize", scheduleResize, { passive: true, signal });
    window.addEventListener("blur", () => cancelPointer(true), { signal });
    window.addEventListener("load", updateBounds, { once: true, signal });
    window.addEventListener("pagehide", (event) => {
        if (!event.persisted) destroy();
    }, { signal });
    document.addEventListener("visibilitychange", onVisibilityChange, { signal });

    if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", onReducedMotionChange);
    } else {
        reducedMotionQuery.addListener(onReducedMotionChange);
    }

    preloadObserver?.observe(stage);
    visibilityObserver?.observe(stage);
    resizeObserver?.observe(stage);
    syncLayoutMode();
    resizeCanvas();
    updateFallbackMeta();
    debugLog("runtime initialized", {
        protocol: runtimeProtocol(),
        documentUrl: document.URL
    });
    debugLog("fallback path initialized", {
        itemCount: fallback.querySelectorAll("[data-gallery-index]").length,
        visible: !resourcesReady || reducedMotionQuery.matches
    });
    // The HTML gallery works immediately; enhance only as it approaches the viewport.
    syncPresentation();
    if (!preloadObserver && !reducedMotionQuery.matches) loadTextures();
    // Scroll restoration can happen between initial observer measurements.
    window.requestAnimationFrame(preloadIfNearby);
    debugLog("initialization complete", {
        webglInitialized: resourcesReady,
        textureCount: textures.length,
        protocol: runtimeProtocol()
    });

    const getState = () => ({
        isIntersecting,
        resourcesReady,
        textureCount: textures.length,
        renderedFrames,
        position: movement.position,
        target: movement.scrollTarget + movement.manualTarget,
        velocity: movement.velocity,
        dragging: pointer.dragging,
        activeIndex,
        detailOpen,
        detailClosing,
        detailIndex,
        cycleWidth,
        scrollTravel,
        protocol: runtimeProtocol(),
        loadError: lastLoadError?.message || null
    });

    const runSelfTest = (label = "manual") => {
        const state = getState();
        const metadataMatches = metaTitle.textContent === ITEMS[state.activeIndex]?.title;
        const animationState = window.parvAnimationState?.getState?.() || null;
        const checks = {
            protocol: runtimeProtocol(),
            documentUrl: document.URL,
            webgl: isWebGLReady(),
            textures: `${state.textureCount}/${ITEMS.length}`,
            resourcesReady,
            fallbackActive: !stage.classList.contains("is-webgl-ready"),
            items: `${ITEMS.length} (last: ${ITEMS[ITEMS.length - 1].title})`,
            title: metaTitle.textContent,
            activeIndex: state.activeIndex,
            metadataMatches,
            position: state.position,
            target: state.target,
            velocity: state.velocity,
            rafLoopsLive: animationState?.live ? 1 : 0,
            rafFrames: animationState?.frames ?? 0,
            rafStarts: animationState?.starts ?? 0,
            rafStops: animationState?.stops ?? 0,
            lenisActive: Boolean(document.documentElement.classList.contains("lenis")),
            loadError: state.loadError,
            exceptions: selfTestExceptions.slice()
        };
        console.info(`[gallery-selftest:${label}] ${JSON.stringify(checks)}`);
        return checks;
    };

    window.parvGallerySelfTest = runSelfTest;
    if (selfTestEnabled) {
        window.setTimeout(() => runSelfTest("initial"), 0);
    }

    window.parvGalleryController = {
        renderFrame,
        needsAnimation,
        destroy,
        getState,
        runSelfTest
    };
})();
