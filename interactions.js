(() => {
    "use strict";

    const CONFIG = {
        baseSize: 36,
        baseRadius: "999px",
        followPerFrame: 0.13,
        velocityStretch: 1.28,
        velocitySquash: 0.90,
        velocitySaturationPxPerMs: 1.2,
        velocityStaleAfterMs: 48,
        deformPerFrame: 0.50,
        recoverPerFrame: 0.22,
        navPaddingX: 24,
        navPaddingY: 14,
        emailPaddingX: 28,
        emailPaddingY: 16,
        buttonPaddingX: 6,
        buttonPaddingY: 6,
        moonSize: 46,
        socialSize: 50,
        morphDurationMs: 240,
        collapseDelayMs: 130,
        magnetism: 0.18,
        portraitOpacity: 0,
        lenis: {
            lerp: 0.17,
            wheelMultiplier: 0.9
        }
    };

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    let cursorController = null;
    let canvasStripController = null;
    let liquidNameController = null;
    let networkController = null;
    let topographicController = null;
    let plasmaController = null;
    let galleryController = null;
    let lenis = null;
    let animationFrameId = 0;
    let previousFrameTime = 0;
    let animationFrameCount = 0;
    let animationLoopStarts = 0;
    let animationLoopStops = 0;
    let demandCheckQueued = false;
    const quarantinedControllers = new Map();
    const CURSOR_POSITION_EPSILON = 0.05;
    const CURSOR_SCALE_EPSILON = 0.002;
    const CURSOR_ANGLE_EPSILON = 0.05;

    const frameRateIndependent = (amountPerFrame, deltaMs) =>
        1 - Math.pow(1 - amountPerFrame, deltaMs / 16.67);

    const addMediaListener = (query, listener) => {
        if (typeof query.addEventListener === "function") {
            query.addEventListener("change", listener);
        } else {
            query.addListener(listener);
        }
    };

    const isQuarantined = (label, controller) =>
        quarantinedControllers.get(label)?.controller === controller;

    const clearQuarantine = (label, controller) => {
        if (isQuarantined(label, controller)) quarantinedControllers.delete(label);
    };

    const quarantine = (label, controller, phase, error) => {
        if (!controller || isQuarantined(label, controller)) return;
        quarantinedControllers.set(label, { controller, error });
        console.error(`[interactions] ${label} ${phase} failed; controller quarantined`, error);
    };

    const callSafely = (label, controller, callback) => {
        if (!controller || isQuarantined(label, controller)) return false;
        try {
            callback();
            return true;
        } catch (error) {
            quarantine(label, controller, "render", error);
            return false;
        }
    };

    const needsSafely = (label, controller) => {
        if (
            !controller ||
            isQuarantined(label, controller) ||
            typeof controller.needsAnimation !== "function"
        ) {
            return false;
        }
        try {
            return Boolean(controller.needsAnimation());
        } catch (error) {
            quarantine(label, controller, "animation check", error);
            return false;
        }
    };

    const queueAnimationDemandCheck = () => {
        if (demandCheckQueued) return;
        demandCheckQueued = true;
        const flush = () => {
            demandCheckQueued = false;
            ensureAnimationLoop();
        };
        if (typeof window.queueMicrotask === "function") {
            window.queueMicrotask(flush);
        } else {
            Promise.resolve().then(flush);
        }
    };

    const startLenis = () => {
        if (
            lenis ||
            reducedMotionQuery.matches ||
            typeof window.Lenis !== "function"
        ) {
            return;
        }

        try {
            lenis = new window.Lenis({
                autoRaf: false,
                smoothWheel: true,
                syncTouch: false,
                wheelMultiplier: CONFIG.lenis.wheelMultiplier,
                lerp: CONFIG.lenis.lerp
            });
            const originalScrollTo = lenis.scrollTo.bind(lenis);
            lenis.scrollTo = (...args) => {
                try {
                    return originalScrollTo(...args);
                } finally {
                    queueAnimationDemandCheck();
                }
            };
        } catch (_) {
            // A failed optional smooth-scroll setup must not prevent the
            // cursor/gallery controllers from running.
            lenis = null;
        }
    };

    const stopLenis = () => {
        if (!lenis) {
            return;
        }

        const activeLenis = lenis;
        clearQuarantine("Lenis", activeLenis);
        try {
            activeLenis.destroy();
        } finally {
            lenis = null;
        }
    };

    const needsLenisAnimation = () => {
        if (!lenis || isQuarantined("Lenis", lenis)) return false;
        try {
            const target = Number(lenis.targetScroll) || 0;
            const animated = Number(lenis.animatedScroll) || 0;
            return Boolean(
                lenis.animate?.isRunning ||
                lenis.isScrolling === "smooth" ||
                Math.abs(target - animated) > 0.01
            );
        } catch (error) {
            quarantine("Lenis", lenis, "animation check", error);
            return false;
        }
    };

    const createCursorController = () => {
        const outer = document.createElement("div");
        const inner = document.createElement("div");

        outer.className = "trailing-cursor";
        outer.setAttribute("aria-hidden", "true");
        outer.style.setProperty("--cursor-portrait-opacity", CONFIG.portraitOpacity);
        inner.className = "trailing-cursor__inner";
        inner.style.setProperty("--cursor-morph-duration", `${CONFIG.morphDurationMs}ms`);
        outer.appendChild(inner);
        document.body.appendChild(outer);
        document.documentElement.classList.add("custom-cursor-enabled");

        const pointer = {
            x: 0,
            y: 0,
            previousX: 0,
            previousY: 0,
            previousTime: 0,
            hasMoved: false
        };

        const rendered = {
            x: 0,
            y: 0
        };

        const deformation = {
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            inputIntensity: 0,
            inputAngle: 0,
            lastMovementTime: 0
        };

        let activeTarget = null;
        let rectIsDirty = false;
        let hitTestIsDirty = false;
        let collapseTimer = 0;
        let shapeIsLocked = false;
        let deformationUnlockTimer = 0;
        let heldPresentationElement = null;
        let isDestroyed = false;
        const presentationResetTimers = new Map();

        const themeObserver = new MutationObserver(() => {
            if (activeTarget) {
                rectIsDirty = true;
                queueAnimationDemandCheck();
            }
        });

        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"]
        });

        const clearCollapseTimer = () => {
            if (!collapseTimer) {
                return;
            }

            window.clearTimeout(collapseTimer);
            collapseTimer = 0;
        };

        const clearDeformationUnlockTimer = () => {
            if (!deformationUnlockTimer) {
                return;
            }

            window.clearTimeout(deformationUnlockTimer);
            deformationUnlockTimer = 0;
        };

        const clearPresentationReset = (element) => {
            const timer = presentationResetTimers.get(element);
            if (!timer) {
                return;
            }

            window.clearTimeout(timer);
            presentationResetTimers.delete(element);
        };

        const removeTargetPresentation = (element) => {
            clearPresentationReset(element);
            element.classList.remove("cursor-hover-active");
        };

        const schedulePresentationReset = (element) => {
            clearPresentationReset(element);

            const timer = window.setTimeout(() => {
                presentationResetTimers.delete(element);
                element.classList.remove("cursor-hover-active");
            }, CONFIG.collapseDelayMs + CONFIG.morphDurationMs);

            presentationResetTimers.set(element, timer);
        };

        const clearAllPendingPresentations = () => {
            presentationResetTimers.forEach((timer, element) => {
                window.clearTimeout(timer);
                element.classList.remove("cursor-hover-active");
            });
            presentationResetTimers.clear();
        };

        const writeShape = (width, height, borderRadius) => {
            inner.style.width = `${width}px`;
            inner.style.height = `${height}px`;
            inner.style.borderRadius = borderRadius;
        };

        const resetDeformation = () => {
            deformation.scaleX = 1;
            deformation.scaleY = 1;
            deformation.angle = 0;
            deformation.inputIntensity = 0;
            deformation.inputAngle = 0;
            deformation.lastMovementTime = 0;
            inner.style.transform = "rotate(0deg) scale(1, 1)";
        };

        const writeBaseShape = (unlockImmediately = false) => {
            writeShape(CONFIG.baseSize, CONFIG.baseSize, CONFIG.baseRadius);

            clearDeformationUnlockTimer();

            if (unlockImmediately) {
                shapeIsLocked = false;
                return;
            }

            shapeIsLocked = true;
            resetDeformation();
            deformationUnlockTimer = window.setTimeout(() => {
                deformationUnlockTimer = 0;
                shapeIsLocked = false;
            }, CONFIG.morphDurationMs);
        };

        const scheduleCollapse = () => {
            if (collapseTimer) {
                return;
            }

            collapseTimer = window.setTimeout(() => {
                collapseTimer = 0;
                writeBaseShape();
            }, CONFIG.collapseDelayMs);
        };

        const classify = (node) => {
            if (!(node instanceof Element)) {
                return { target: null, kind: null, holdZone: null };
            }

            const holdZone = node.closest(".nav-container, .social-icons");
            const email = node.closest(".email > a");
            if (email) {
                return { target: email, kind: "email", holdZone };
            }

            const button = node.closest(
                ".pitch-links > a, .featured-project__button, " +
                ".image-gallery-detail__nav:not(:disabled)"
            );
            if (button) {
                return { target: button, kind: "button", holdZone };
            }

            const moon = node.closest("#darkModeToggle");
            if (moon) {
                return { target: moon, kind: "moon", holdZone };
            }

            const navLink = node.closest(".nav-container > a");
            if (navLink) {
                return { target: navLink, kind: "nav", holdZone };
            }

            const socialLink = node.closest(".social-icons > a");
            if (socialLink) {
                return { target: socialLink, kind: "social", holdZone };
            }

            const portrait = node.closest(".hero-image > img");
            if (portrait) {
                return { target: portrait, kind: "portrait", holdZone };
            }

            return { target: null, kind: null, holdZone };
        };

        const applyShapeForTarget = () => {
            if (!activeTarget || !activeTarget.rect) {
                return;
            }

            const { element, kind, rect } = activeTarget;
            clearDeformationUnlockTimer();
            shapeIsLocked = true;
            resetDeformation();

            if (kind === "nav") {
                writeShape(
                    rect.width + CONFIG.navPaddingX,
                    rect.height + CONFIG.navPaddingY,
                    CONFIG.baseRadius
                );
                return;
            }

            if (kind === "email") {
                writeShape(
                    rect.width + CONFIG.emailPaddingX,
                    rect.height + CONFIG.emailPaddingY,
                    CONFIG.baseRadius
                );
                return;
            }

            if (kind === "button") {
                writeShape(
                    rect.width + CONFIG.buttonPaddingX,
                    rect.height + CONFIG.buttonPaddingY,
                    window.getComputedStyle(element).borderRadius || CONFIG.baseRadius
                );
                return;
            }

            if (kind === "moon") {
                writeShape(CONFIG.moonSize, CONFIG.moonSize, CONFIG.baseRadius);
                return;
            }

            if (kind === "social") {
                writeShape(CONFIG.socialSize, CONFIG.socialSize, CONFIG.baseRadius);
                return;
            }

            writeShape(CONFIG.baseSize, CONFIG.baseSize, CONFIG.baseRadius);
        };

        const measureActiveTarget = () => {
            if (!activeTarget) {
                return;
            }

            if (!activeTarget.element.isConnected) {
                deactivateTarget(false);
                return;
            }

            activeTarget.rect = activeTarget.element.getBoundingClientRect();
            rectIsDirty = false;
            applyShapeForTarget();
        };

        const clearTargetPresentation = (immediate = false) => {
            if (!activeTarget) {
                return;
            }

            if (immediate) {
                removeTargetPresentation(activeTarget.element);
            } else {
                schedulePresentationReset(activeTarget.element);
            }
            outer.classList.remove("is-over-portrait");

        };

        function deactivateTarget(keepShape) {
            if (activeTarget) {
                if (keepShape) {
                    clearPresentationReset(activeTarget.element);
                    heldPresentationElement = activeTarget.element;
                    outer.classList.remove("is-over-portrait");
                } else {
                    clearTargetPresentation();
                }
                activeTarget = null;
                rectIsDirty = false;
            }

            if (!keepShape && heldPresentationElement) {
                schedulePresentationReset(heldPresentationElement);
                heldPresentationElement = null;
            }

            if (keepShape) {
                clearCollapseTimer();
            } else {
                scheduleCollapse();
            }
        }

        const activateTarget = (element, kind) => {
            if (
                activeTarget &&
                activeTarget.element === element &&
                activeTarget.kind === kind
            ) {
                return;
            }

            clearCollapseTimer();
            clearTargetPresentation();

            if (heldPresentationElement && heldPresentationElement !== element) {
                schedulePresentationReset(heldPresentationElement);
            }
            heldPresentationElement = null;
            clearPresentationReset(element);

            activeTarget = {
                element,
                kind,
                rect: null,
                magnetic: kind !== "portrait"
            };

            element.classList.add("cursor-hover-active");
            outer.classList.toggle("is-over-portrait", kind === "portrait");

            measureActiveTarget();
        };

        const reconcileTarget = (node) => {
            const match = classify(node);

            if (match.target) {
                activateTarget(match.target, match.kind);
                return;
            }

            deactivateTarget(Boolean(match.holdZone));
        };

        const onPointerMove = (event) => {
            if (event.pointerType === "touch") {
                return;
            }

            const now = performance.now();
            const firstMove = !pointer.hasMoved;

            if (!firstMove) {
                const deltaX = event.clientX - pointer.previousX;
                const deltaY = event.clientY - pointer.previousY;
                const deltaTime = Math.max(now - pointer.previousTime, 1);
                const distance = Math.hypot(deltaX, deltaY);

                if (distance > 0.1) {
                    deformation.inputIntensity = Math.min(
                        distance / deltaTime / CONFIG.velocitySaturationPxPerMs,
                        1
                    );
                    deformation.inputAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    deformation.lastMovementTime = now;
                }
            }

            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.previousX = event.clientX;
            pointer.previousY = event.clientY;
            pointer.previousTime = now;
            pointer.hasMoved = true;

            if (firstMove) {
                rendered.x = pointer.x;
                rendered.y = pointer.y;
                outer.style.transform = `translate3d(${rendered.x}px, ${rendered.y}px, 0)`;
                outer.classList.add("is-visible");
            }

            reconcileTarget(event.target);
        };

        const onScroll = () => {
            if (!pointer.hasMoved) {
                return;
            }

            hitTestIsDirty = true;
            if (activeTarget) {
                rectIsDirty = true;
            }
        };

        const onResize = () => {
            if (!pointer.hasMoved) {
                return;
            }

            hitTestIsDirty = true;
            if (activeTarget) {
                rectIsDirty = true;
            }
        };

        const resetAfterViewportLeave = () => {
            clearCollapseTimer();
            clearDeformationUnlockTimer();
            clearTargetPresentation(true);

            if (heldPresentationElement) {
                removeTargetPresentation(heldPresentationElement);
                heldPresentationElement = null;
            }
            clearAllPendingPresentations();
            activeTarget = null;
            rectIsDirty = false;
            hitTestIsDirty = false;
            writeBaseShape(true);
            outer.classList.remove("is-visible", "is-over-portrait");
            pointer.hasMoved = false;
            pointer.previousTime = 0;
            resetDeformation();
        };

        const onPointerOut = (event) => {
            if (event.relatedTarget === null) {
                resetAfterViewportLeave();
            }
        };

        const normalizeAngleDifference = (difference) =>
            ((difference + 180) % 360 + 360) % 360 - 180;

        const getCursorAim = () => {
            let x = pointer.x;
            let y = pointer.y;
            if (activeTarget?.magnetic && activeTarget.rect) {
                const centerX = activeTarget.rect.left + activeTarget.rect.width / 2;
                const centerY = activeTarget.rect.top + activeTarget.rect.height / 2;
                x = centerX + (pointer.x - centerX) * CONFIG.magnetism;
                y = centerY + (pointer.y - centerY) * CONFIG.magnetism;
            }
            return { x, y };
        };

        const needsAnimation = () => {
            if (!pointer.hasMoved || isDestroyed) return false;
            const aim = getCursorAim();
            const movementIsFresh =
                !shapeIsLocked &&
                deformation.lastMovementTime > 0 &&
                performance.now() - deformation.lastMovementTime <= CONFIG.velocityStaleAfterMs;
            return Boolean(
                hitTestIsDirty ||
                (activeTarget && rectIsDirty) ||
                Math.abs(aim.x - rendered.x) > CURSOR_POSITION_EPSILON ||
                Math.abs(aim.y - rendered.y) > CURSOR_POSITION_EPSILON ||
                movementIsFresh ||
                Math.abs(deformation.scaleX - 1) > CURSOR_SCALE_EPSILON ||
                Math.abs(deformation.scaleY - 1) > CURSOR_SCALE_EPSILON ||
                Math.abs(deformation.angle) > CURSOR_ANGLE_EPSILON
            );
        };

        const renderFrame = (time, deltaMs) => {
            if (!pointer.hasMoved || isDestroyed) {
                return;
            }

            if (hitTestIsDirty) {
                hitTestIsDirty = false;
                reconcileTarget(document.elementFromPoint(pointer.x, pointer.y));
            }

            if (activeTarget && rectIsDirty) {
                measureActiveTarget();
            }

            const aim = getCursorAim();

            const positionAmount = frameRateIndependent(CONFIG.followPerFrame, deltaMs);
            rendered.x += (aim.x - rendered.x) * positionAmount;
            rendered.y += (aim.y - rendered.y) * positionAmount;
            if (Math.abs(aim.x - rendered.x) <= CURSOR_POSITION_EPSILON) rendered.x = aim.x;
            if (Math.abs(aim.y - rendered.y) <= CURSOR_POSITION_EPSILON) rendered.y = aim.y;
            outer.style.transform = `translate3d(${rendered.x}px, ${rendered.y}px, 0)`;

            const movementIsFresh =
                !shapeIsLocked &&
                deformation.lastMovementTime > 0 &&
                time - deformation.lastMovementTime <= CONFIG.velocityStaleAfterMs;
            const targetScaleX = movementIsFresh
                ? 1 + (CONFIG.velocityStretch - 1) * deformation.inputIntensity
                : 1;
            const targetScaleY = movementIsFresh
                ? 1 - (1 - CONFIG.velocitySquash) * deformation.inputIntensity
                : 1;
            const targetAngle = movementIsFresh ? deformation.inputAngle : 0;
            const deformationAmount = frameRateIndependent(
                movementIsFresh ? CONFIG.deformPerFrame : CONFIG.recoverPerFrame,
                deltaMs
            );

            deformation.scaleX +=
                (targetScaleX - deformation.scaleX) * deformationAmount;
            deformation.scaleY +=
                (targetScaleY - deformation.scaleY) * deformationAmount;
            deformation.angle +=
                normalizeAngleDifference(targetAngle - deformation.angle) *
                deformationAmount;

            if (!movementIsFresh && Math.abs(deformation.angle) < 0.05) {
                deformation.angle = 0;
            }
            if (!movementIsFresh) {
                if (Math.abs(deformation.scaleX - 1) <= CURSOR_SCALE_EPSILON) {
                    deformation.scaleX = 1;
                }
                if (Math.abs(deformation.scaleY - 1) <= CURSOR_SCALE_EPSILON) {
                    deformation.scaleY = 1;
                }
            }

            inner.style.transform =
                `rotate(${deformation.angle}deg) ` +
                `scale(${deformation.scaleX}, ${deformation.scaleY})`;
        };

        const destroy = () => {
            isDestroyed = true;
            clearCollapseTimer();
            clearDeformationUnlockTimer();
            clearTargetPresentation(true);

            if (heldPresentationElement) {
                removeTargetPresentation(heldPresentationElement);
                heldPresentationElement = null;
            }
            clearAllPendingPresentations();
            themeObserver.disconnect();
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerout", onPointerOut);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("blur", resetAfterViewportLeave);
            outer.remove();
            document.documentElement.classList.remove("custom-cursor-enabled");
        };

        document.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut, { passive: true });
        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
        window.addEventListener("resize", onResize, { passive: true });
        window.addEventListener("blur", resetAfterViewportLeave);

        return {
            renderFrame,
            needsAnimation,
            destroy
        };
    };

    const stopCursor = () => {
        if (!cursorController) {
            return;
        }

        const activeCursor = cursorController;
        clearQuarantine("cursor", activeCursor);
        try {
            activeCursor.destroy();
        } finally {
            cursorController = null;
        }
    };

    const hasAnimationDemand = () =>
        !document.hidden && (
            needsLenisAnimation() ||
            needsSafely("cursor", cursorController) ||
            needsSafely("canvas strip", canvasStripController) ||
            needsSafely("liquid name", liquidNameController) ||
            needsSafely("node network", networkController) ||
            needsSafely("topography", topographicController) ||
            needsSafely("plasma", plasmaController) ||
            needsSafely("gallery", galleryController)
        );

    const animationLoop = (time) => {
        if (document.hidden) { animationFrameId = 0; previousFrameTime = 0; return; }
        animationFrameCount += 1;
        const deltaMs = previousFrameTime ? time - previousFrameTime : 16.67;
        previousFrameTime = time;

        if (needsLenisAnimation()) callSafely("Lenis", lenis, () => lenis.raf(time));
        if (needsSafely("cursor", cursorController)) callSafely("cursor", cursorController, () => cursorController.renderFrame(time, deltaMs));
        if (needsSafely("canvas strip", canvasStripController)) callSafely("canvas strip", canvasStripController, () => canvasStripController.renderFrame(time, deltaMs));
        if (needsSafely("liquid name", liquidNameController)) callSafely("liquid name", liquidNameController, () => liquidNameController.renderFrame(time, deltaMs));
        if (needsSafely("node network", networkController)) callSafely("node network", networkController, () => networkController.renderFrame(time, deltaMs));
        if (needsSafely("topography", topographicController)) callSafely("topography", topographicController, () => topographicController.renderFrame(time, deltaMs));
        if (needsSafely("plasma", plasmaController)) callSafely("plasma", plasmaController, () => plasmaController.renderFrame(time, deltaMs));
        if (needsSafely("gallery", galleryController)) callSafely("gallery", galleryController, () => galleryController.renderFrame(time, deltaMs));

        if (hasAnimationDemand()) {
            animationFrameId = window.requestAnimationFrame(animationLoop);
        } else {
            animationFrameId = 0;
            previousFrameTime = 0;
            animationLoopStops += 1;
        }
    };

    const ensureAnimationLoop = () => {
        if (!animationFrameId && hasAnimationDemand()) {
            previousFrameTime = 0;
            animationFrameId = window.requestAnimationFrame(animationLoop);
            animationLoopStarts += 1;
        }
    };

    const syncMotionFeatures = () => {
        if (reducedMotionQuery.matches) {
            stopCursor();
            stopLenis();

            if (
                needsSafely("canvas strip", canvasStripController)
                || needsSafely("liquid name", liquidNameController)
                || needsSafely("node network", networkController)
                || needsSafely("topography", topographicController)
                || needsSafely("plasma", plasmaController)
                || needsSafely("gallery", galleryController)
            ) {
                ensureAnimationLoop();
            } else if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
                animationFrameId = 0;
                previousFrameTime = 0;
            }
            return;
        }

        startLenis();

        if (finePointerQuery.matches) {
            if (!cursorController) {
                cursorController = createCursorController();
            }
        } else {
            stopCursor();
        }

        ensureAnimationLoop();
    };

    const initialize = () => {
        canvasStripController = window.parvCanvasStripController || null;
        liquidNameController = window.parvLiquidNameController || null;
        networkController = window.parvNetworkController || null;
        topographicController = window.parvTopographicController || null;
        plasmaController = window.parvPlasmaController || null;
        galleryController = window.parvGalleryController || null;
        window.requestParvAnimationFrame = ensureAnimationLoop;
        window.parvSmoothScroll = {
            stop: () => {
                if (lenis) callSafely("Lenis", lenis, () => lenis.stop());
            },
            start: (restoreY) => {
                const shouldRestore = typeof restoreY === "number" && Number.isFinite(restoreY);
                if (lenis) {
                    callSafely("Lenis", lenis, () => {
                        lenis.start();
                        if (shouldRestore) {
                            lenis.scrollTo(restoreY, { immediate: true, force: true });
                        }
                    });
                }
                // Keep the native scrolling element in sync even if Lenis is
                // unavailable or has just recovered from a stopped state.
                if (shouldRestore && Math.abs(window.scrollY - restoreY) > 0.5) {
                    window.scrollTo(Number(window.scrollX) || 0, restoreY);
                }
                queueAnimationDemandCheck();
            }
        };
        window.parvAnimationState = {
            getState: () => ({
                live: Boolean(animationFrameId),
                frames: animationFrameCount,
                starts: animationLoopStarts,
                stops: animationLoopStops,
                quarantined: Array.from(quarantinedControllers.keys())
            })
        };
        [
            "wheel",
            "touchstart",
            "touchmove",
            "touchend",
            "pointerover",
            "pointermove",
            "pointerdown",
            "pointerup",
            "pointercancel",
            "pointerout"
        ].forEach((type) => {
            document.addEventListener(type, queueAnimationDemandCheck, {
                capture: true,
                passive: true
            });
        });
        document.addEventListener("scroll", queueAnimationDemandCheck, {
            capture: true,
            passive: true
        });
        window.addEventListener("resize", queueAnimationDemandCheck, { passive: true });
        window.addEventListener("pageshow", queueAnimationDemandCheck);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
                animationFrameId = 0;
                previousFrameTime = 0;
                return;
            }
            queueAnimationDemandCheck();
        });
        addMediaListener(reducedMotionQuery, syncMotionFeatures);
        addMediaListener(finePointerQuery, syncMotionFeatures);
        syncMotionFeatures();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
