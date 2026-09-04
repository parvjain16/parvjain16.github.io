(() => {
    "use strict";

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mobileQuery = window.matchMedia("(max-width: 768px)");

    const CONFIG = {
        velocityClamp: 1.7,
        velocityFollowPerFrame: 0.22,
        reverseFollowPerFrame: 0.36,
        activeInputDecay: 0.9,
        idleInputDecay: 0.76,
        idleAfterMs: 42,
        overshootLimit: 1.1,
        mobileMotionScale: 0.3,
        magnetic: {
            x: 7.25,
            y: 4.75,
            labelX: 3.4,
            labelY: 2.25,
            spring: 0.05,
            damping: 0.81,
            overshootLimit: 1.08
        },
        targets: [
            { selector: ".container > h1", gain: 6.25, max: 9, spring: 0.052, damping: 0.82 },
            { selector: ".container > .intro", gain: 4.6, max: 7, spring: 0.047, damping: 0.84 },
            { selector: ".featured-project__media", gain: 17, max: 26, spring: 0.042, damping: 0.84, visual: true },
            { selector: ".featured-project__content", gain: 9.2, max: 15, spring: 0.048, damping: 0.84 },
            { selector: ".featured-project__tags", gain: 3, max: 4.5, spring: 0.055, damping: 0.81 },
            { selector: ".featured-project__actions", gain: 5.2, max: 8, spring: 0.055, damping: 0.8 },
            { selector: ".project-card", gain: 10.25, max: 16, spring: 0.047, damping: 0.83, stagger: true }
        ]
    };

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const motionTargets = [];
    const magneticTargets = [];
    const targetByElement = new WeakMap();
    const controller = new AbortController();
    const mediaCleanups = [];

    let observer = null;
    let animationFrameId = 0;
    let previousFrameTime = 0;
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();
    let lastScrollInputTime = 0;
    let inputVelocity = 0;
    let smoothedVelocity = 0;
    let magnetHitTestIsDirty = false;
    let destroyed = false;
    let suspended = false;

    const motionIsEnabled = () => !reducedMotionQuery.matches;
    const magnetismIsEnabled = () =>
        motionIsEnabled() && finePointerQuery.matches && !mobileQuery.matches;

    const addMediaListener = (query, listener) => {
        if (typeof query.addEventListener === "function") {
            query.addEventListener("change", listener);
            mediaCleanups.push(() => query.removeEventListener("change", listener));
        } else {
            query.addListener(listener);
            mediaCleanups.push(() => query.removeListener(listener));
        }
    };

    const restoreMotionTarget = (target, restoreWillChange = true) => {
        target.y = 0;
        target.velocity = 0;
        target.element.style.translate = target.originalTranslate;

        if (target.visualElement) {
            target.visualElement.style.transform = target.originalVisualTransform;
            if (restoreWillChange) {
                target.visualElement.style.willChange = target.originalVisualWillChange;
            }
        }

        if (restoreWillChange) {
            target.element.style.willChange = target.originalWillChange;
        }
    };

    const restoreMagneticTarget = (target, restoreWillChange = true) => {
        target.x = 0;
        target.y = 0;
        target.velocityX = 0;
        target.velocityY = 0;
        target.labelX = 0;
        target.labelY = 0;
        target.labelVelocityX = 0;
        target.labelVelocityY = 0;
        target.targetX = 0;
        target.targetY = 0;
        target.targetLabelX = 0;
        target.targetLabelY = 0;
        target.active = false;
        target.rect = null;
        target.rectIsDirty = true;
        target.element.style.translate = target.originalTranslate;
        target.label.style.transform = target.originalLabelTransform;

        if (restoreWillChange) {
            target.element.style.willChange = target.originalWillChange;
            target.label.style.willChange = target.originalLabelWillChange;
        }
    };

    const resetAllMotion = () => {
        inputVelocity = 0;
        smoothedVelocity = 0;
        lastScrollY = window.scrollY;
        lastScrollTime = performance.now();
        lastScrollInputTime = 0;
        magnetHitTestIsDirty = false;

        motionTargets.forEach((target) => restoreMotionTarget(target));
        magneticTargets.forEach((target) => restoreMagneticTarget(target));
    };

    const cancelAnimation = () => {
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }
        previousFrameTime = 0;
    };

    const requestAnimation = () => {
        if (
            !animationFrameId &&
            !destroyed &&
            !suspended &&
            motionIsEnabled()
        ) {
            animationFrameId = window.requestAnimationFrame(renderFrame);
        }
    };

    const setMotionWillChange = (target) => {
        target.element.style.willChange = "transform";
        if (target.visualElement) {
            target.visualElement.style.willChange = "transform";
        }
    };

    const stepSpring = (position, velocity, target, spring, damping, frameScale) => {
        const nextVelocity =
            (velocity + (target - position) * spring * frameScale) *
            Math.pow(damping, frameScale);

        return {
            position: position + nextVelocity * frameScale,
            velocity: nextVelocity
        };
    };

    const limitSpring = (result, limit) => {
        if (Math.abs(result.position) <= limit) {
            return result;
        }

        result.position = clamp(result.position, -limit, limit);
        result.velocity *= 0.45;
        return result;
    };

    const renderMotionTarget = (target, frameScale) => {
        if (!target.visible) {
            return false;
        }

        const motionScale = mobileQuery.matches ? CONFIG.mobileMotionScale : 1;
        const maxOffset = target.max * motionScale;
        const desiredY = clamp(
            smoothedVelocity * target.gain * motionScale,
            -maxOffset,
            maxOffset
        );
        const next = limitSpring(stepSpring(
            target.y,
            target.velocity,
            desiredY,
            target.spring,
            target.damping,
            frameScale
        ), maxOffset * CONFIG.overshootLimit);

        target.y = next.position;
        target.velocity = next.velocity;

        const isMoving =
            Math.abs(target.y) > 0.015 ||
            Math.abs(target.velocity) > 0.015 ||
            Math.abs(desiredY) > 0.015;

        if (!isMoving) {
            restoreMotionTarget(target);
            return false;
        }

        setMotionWillChange(target);
        target.element.style.translate = `0 ${target.y.toFixed(3)}px`;

        if (target.visualElement && !mobileQuery.matches) {
            const intensity = clamp(target.y / Math.max(target.max, 1), -1, 1);
            const rotation = intensity * 0.38;
            const scale = 1 + Math.abs(intensity) * 0.0045;
            target.visualElement.style.transform =
                `rotate(${rotation.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
        } else if (target.visualElement) {
            target.visualElement.style.transform = target.originalVisualTransform;
        }

        return true;
    };

    const renderMagneticTarget = (target, frameScale) => {
        if (!magnetismIsEnabled()) {
            if (
                target.active ||
                Math.abs(target.x) > 0.01 ||
                Math.abs(target.y) > 0.01 ||
                Math.abs(target.labelX) > 0.01 ||
                Math.abs(target.labelY) > 0.01
            ) {
                restoreMagneticTarget(target);
            }
            return false;
        }

        const outerX = limitSpring(stepSpring(
            target.x,
            target.velocityX,
            target.targetX,
            CONFIG.magnetic.spring,
            CONFIG.magnetic.damping,
            frameScale
        ), CONFIG.magnetic.x * CONFIG.magnetic.overshootLimit);
        const outerY = limitSpring(stepSpring(
            target.y,
            target.velocityY,
            target.targetY,
            CONFIG.magnetic.spring,
            CONFIG.magnetic.damping,
            frameScale
        ), CONFIG.magnetic.y * CONFIG.magnetic.overshootLimit);
        const labelX = limitSpring(stepSpring(
            target.labelX,
            target.labelVelocityX,
            target.targetLabelX,
            CONFIG.magnetic.spring,
            CONFIG.magnetic.damping,
            frameScale
        ), CONFIG.magnetic.labelX * CONFIG.magnetic.overshootLimit);
        const labelY = limitSpring(stepSpring(
            target.labelY,
            target.labelVelocityY,
            target.targetLabelY,
            CONFIG.magnetic.spring,
            CONFIG.magnetic.damping,
            frameScale
        ), CONFIG.magnetic.labelY * CONFIG.magnetic.overshootLimit);

        target.x = outerX.position;
        target.velocityX = outerX.velocity;
        target.y = outerY.position;
        target.velocityY = outerY.velocity;
        target.labelX = labelX.position;
        target.labelVelocityX = labelX.velocity;
        target.labelY = labelY.position;
        target.labelVelocityY = labelY.velocity;

        const hasPresentation =
            target.active ||
            Math.abs(target.x) > 0.01 ||
            Math.abs(target.y) > 0.01 ||
            Math.abs(target.labelX) > 0.01 ||
            Math.abs(target.labelY) > 0.01 ||
            Math.abs(target.targetX) > 0.01 ||
            Math.abs(target.targetY) > 0.01 ||
            Math.abs(target.targetLabelX) > 0.01 ||
            Math.abs(target.targetLabelY) > 0.01;
        const needsAnimation =
            Math.abs(target.targetX - target.x) > 0.01 ||
            Math.abs(target.targetY - target.y) > 0.01 ||
            Math.abs(target.targetLabelX - target.labelX) > 0.01 ||
            Math.abs(target.targetLabelY - target.labelY) > 0.01 ||
            Math.abs(target.velocityX) > 0.01 ||
            Math.abs(target.velocityY) > 0.01 ||
            Math.abs(target.labelVelocityX) > 0.01 ||
            Math.abs(target.labelVelocityY) > 0.01;

        if (!hasPresentation) {
            restoreMagneticTarget(target);
            return false;
        }

        target.element.style.willChange = "transform";
        target.label.style.willChange = "transform";
        target.element.style.translate =
            `${target.x.toFixed(3)}px ${target.y.toFixed(3)}px`;
        target.label.style.transform =
            `translate3d(${target.labelX.toFixed(3)}px, ` +
            `${target.labelY.toFixed(3)}px, 0)`;

        return needsAnimation;
    };

    const updateMagneticTargetFromPointer = (target) => {
        if (!target.rect || target.rectIsDirty) {
            const rect = target.element.getBoundingClientRect();
            target.rect = {
                left: rect.left - target.x,
                top: rect.top - target.y,
                width: rect.width,
                height: rect.height
            };
            target.rectIsDirty = false;
        }

        const centerX = target.rect.left + target.rect.width / 2;
        const centerY = target.rect.top + target.rect.height / 2;
        const normalizedX = clamp(
            (target.pointerX - centerX) / Math.max(target.rect.width / 2, 1),
            -1,
            1
        );
        const normalizedY = clamp(
            (target.pointerY - centerY) / Math.max(target.rect.height / 2, 1),
            -1,
            1
        );

        target.targetX = normalizedX * CONFIG.magnetic.x;
        target.targetY = normalizedY * CONFIG.magnetic.y;
        target.targetLabelX = normalizedX * CONFIG.magnetic.labelX;
        target.targetLabelY = normalizedY * CONFIG.magnetic.labelY;
    };

    const reconcileMagneticHitTests = () => {
        if (!magnetHitTestIsDirty) {
            return;
        }

        magnetHitTestIsDirty = false;
        magneticTargets.forEach((target) => {
            if (!target.active) {
                return;
            }

            const hit = document.elementFromPoint(target.pointerX, target.pointerY);
            if (!hit || !target.element.contains(hit)) {
                target.active = false;
                target.targetX = 0;
                target.targetY = 0;
                target.targetLabelX = 0;
                target.targetLabelY = 0;
                target.rect = null;
                return;
            }

            target.rectIsDirty = true;
            updateMagneticTargetFromPointer(target);
        });
    };

    function renderFrame(time) {
        animationFrameId = 0;

        if (destroyed || suspended || !motionIsEnabled()) {
            previousFrameTime = 0;
            return;
        }

        const deltaMs = previousFrameTime
            ? clamp(time - previousFrameTime, 8, 34)
            : 16.67;
        const frameScale = deltaMs / 16.67;
        previousFrameTime = time;

        const isReversing = inputVelocity * smoothedVelocity < -0.001;
        const followPerFrame = isReversing
            ? CONFIG.reverseFollowPerFrame
            : CONFIG.velocityFollowPerFrame;
        const smoothing = 1 - Math.pow(1 - followPerFrame, frameScale);
        smoothedVelocity += (inputVelocity - smoothedVelocity) * smoothing;
        const inputDecay = time - lastScrollInputTime > CONFIG.idleAfterMs
            ? CONFIG.idleInputDecay
            : CONFIG.activeInputDecay;
        inputVelocity *= Math.pow(inputDecay, frameScale);

        reconcileMagneticHitTests();

        let shouldContinue =
            Math.abs(inputVelocity) > 0.002 ||
            Math.abs(smoothedVelocity) > 0.002;

        motionTargets.forEach((target) => {
            shouldContinue = renderMotionTarget(target, frameScale) || shouldContinue;
        });

        magneticTargets.forEach((target) => {
            shouldContinue = renderMagneticTarget(target, frameScale) || shouldContinue;
        });

        if (shouldContinue) {
            animationFrameId = window.requestAnimationFrame(renderFrame);
        } else {
            previousFrameTime = 0;
            inputVelocity = 0;
            smoothedVelocity = 0;
            motionTargets.forEach((target) => {
                if (target.visible) {
                    restoreMotionTarget(target);
                }
            });
        }
    }

    const onScroll = () => {
        if (!motionIsEnabled() || suspended) {
            return;
        }

        const now = performance.now();
        const currentScrollY = window.scrollY;
        let deltaTime = now - lastScrollTime;

        if (deltaTime > 80 || deltaTime < 1) {
            deltaTime = 16.67;
        }

        inputVelocity = clamp(
            (currentScrollY - lastScrollY) / deltaTime,
            -CONFIG.velocityClamp,
            CONFIG.velocityClamp
        );
        lastScrollY = currentScrollY;
        lastScrollTime = now;
        lastScrollInputTime = now;
        magnetHitTestIsDirty = true;
        requestAnimation();
    };

    const onResize = () => {
        lastScrollY = window.scrollY;
        lastScrollTime = performance.now();
        magneticTargets.forEach((target) => {
            target.rectIsDirty = true;
        });
        requestAnimation();
    };

    const syncPreferences = () => {
        if (!motionIsEnabled()) {
            cancelAnimation();
            resetAllMotion();
            return;
        }

        if (!magnetismIsEnabled()) {
            magneticTargets.forEach((target) => restoreMagneticTarget(target));
        }

        lastScrollY = window.scrollY;
        lastScrollTime = performance.now();
        requestAnimation();
    };

    const createMotionTargets = () => {
        CONFIG.targets.forEach((specification) => {
            document.querySelectorAll(specification.selector).forEach((element, index) => {
                const variation = specification.stagger
                    ? 1 + ((index % 3) - 1) * 0.07
                    : 1;
                const visualElement = specification.visual
                    ? element.querySelector(".featured-project__image")
                    : null;
                const target = {
                    element,
                    visualElement,
                    gain: specification.gain * variation,
                    max: specification.max,
                    spring: specification.spring * variation,
                    damping: clamp(
                        specification.damping + ((index % 2) ? 0.012 : 0),
                        0.72,
                        0.9
                    ),
                    y: 0,
                    velocity: 0,
                    visible: !window.IntersectionObserver,
                    originalTranslate: element.style.translate,
                    originalWillChange: element.style.willChange,
                    originalVisualTransform: visualElement?.style.transform || "",
                    originalVisualWillChange: visualElement?.style.willChange || ""
                };

                motionTargets.push(target);
                targetByElement.set(element, target);
            });
        });
    };

    const createMagneticTargets = () => {
        document.querySelectorAll(".featured-project__button").forEach((element) => {
            const label = element.querySelector("span");
            if (!label) {
                return;
            }

            const target = {
                element,
                label,
                x: 0,
                y: 0,
                velocityX: 0,
                velocityY: 0,
                labelX: 0,
                labelY: 0,
                labelVelocityX: 0,
                labelVelocityY: 0,
                targetX: 0,
                targetY: 0,
                targetLabelX: 0,
                targetLabelY: 0,
                pointerX: 0,
                pointerY: 0,
                active: false,
                rect: null,
                rectIsDirty: true,
                originalTranslate: element.style.translate,
                originalWillChange: element.style.willChange,
                originalLabelTransform: label.style.transform,
                originalLabelWillChange: label.style.willChange
            };

            const onPointerEnter = (event) => {
                if (!magnetismIsEnabled() || event.pointerType === "touch") {
                    return;
                }

                target.active = true;
                target.pointerX = event.clientX;
                target.pointerY = event.clientY;
                target.rectIsDirty = true;
                updateMagneticTargetFromPointer(target);
                requestAnimation();
            };

            const onPointerMove = (event) => {
                if (!target.active || !magnetismIsEnabled()) {
                    return;
                }

                target.pointerX = event.clientX;
                target.pointerY = event.clientY;
                updateMagneticTargetFromPointer(target);
                requestAnimation();
            };

            const release = () => {
                target.active = false;
                target.targetX = 0;
                target.targetY = 0;
                target.targetLabelX = 0;
                target.targetLabelY = 0;
                target.rect = null;
                target.rectIsDirty = true;
                requestAnimation();
            };

            element.addEventListener("pointerenter", onPointerEnter, {
                passive: true,
                signal: controller.signal
            });
            element.addEventListener("pointermove", onPointerMove, {
                passive: true,
                signal: controller.signal
            });
            element.addEventListener("pointerleave", release, {
                passive: true,
                signal: controller.signal
            });
            element.addEventListener("pointercancel", release, {
                passive: true,
                signal: controller.signal
            });

            magneticTargets.push(target);
        });
    };

    const createIntersectionObserver = () => {
        if (!window.IntersectionObserver) {
            return;
        }

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const target = targetByElement.get(entry.target);
                if (!target) {
                    return;
                }

                target.visible = entry.isIntersecting;
                if (!entry.isIntersecting) {
                    restoreMotionTarget(target);
                }
            });
        }, {
            rootMargin: "15% 0px"
        });

        motionTargets.forEach((target) => observer.observe(target.element));
    };

    const suspend = () => {
        suspended = true;
        cancelAnimation();
    };

    const resume = () => {
        suspended = false;
        lastScrollY = window.scrollY;
        lastScrollTime = performance.now();
        requestAnimation();
    };

    const destroy = () => {
        if (destroyed) {
            return;
        }

        destroyed = true;
        cancelAnimation();
        controller.abort();
        observer?.disconnect();
        mediaCleanups.forEach((cleanup) => cleanup());
        resetAllMotion();
    };

    const initialize = () => {
        createMotionTargets();
        createMagneticTargets();
        createIntersectionObserver();

        window.addEventListener("scroll", onScroll, {
            passive: true,
            signal: controller.signal
        });
        window.addEventListener("resize", onResize, {
            passive: true,
            signal: controller.signal
        });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                suspend();
            } else {
                resume();
            }
        }, { signal: controller.signal });
        window.addEventListener("pagehide", (event) => {
            if (event.persisted) {
                suspend();
            } else {
                destroy();
            }
        }, { signal: controller.signal });
        window.addEventListener("pageshow", (event) => {
            if (event.persisted) {
                resume();
            }
        }, { signal: controller.signal });

        addMediaListener(reducedMotionQuery, syncPreferences);
        addMediaListener(finePointerQuery, syncPreferences);
        addMediaListener(mobileQuery, syncPreferences);
        syncPreferences();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true,
            signal: controller.signal
        });
    } else {
        initialize();
    }
})();
