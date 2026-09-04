(() => {
    "use strict";

    const canvas = document.getElementById("net-panel");
    const panel = canvas?.closest(".network-panel");
    const context = canvas?.getContext("2d");

    if (!canvas || !panel || !context) {
        return;
    }

    const CONFIG = Object.freeze({
        densityDivisor: 3200,
        minimumNodes: 50,
        maximumNodes: 140,
        anchorRatio: 0.15,
        maximumNeighbors: 3,
        maximumPointerNeighbors: 4,
        minimumNodeSpeed: 0.28,
        maximumNodeSpeed: 0.55,
        desktopLinkDistance: 110,
        mobileLinkDistance: 80,
        pointerLinkScale: 0.85,
        pointerLerpPerFrame: 0.42,
        pointerSpeedLerpPerFrame: 0.30,
        pointerFadeMs: 480,
        repulsionRadius: 100,
        maximumRepulsion: 0.38,
        interactionSpring: 0.024,
        interactionDampingPerFrame: 0.80,
        maximumInteractionOffset: 26,
        severRadius: 50,
        linkSeverFadeMs: 160,
        linkHealMs: 600,
        topologyFadeMs: 180,
        pulseIntervalMs: 2500,
        pulseDurationMs: 800,
        maximumPulses: 2,
        ringDistance: 300,
        ringDurationMs: 700,
        resizeDebounceMs: 150
    });

    const MAX_NODES = CONFIG.maximumNodes;
    const MAX_CANDIDATES = MAX_NODES * CONFIG.maximumNeighbors;
    const PAIR_SLOTS = MAX_NODES * MAX_NODES;
    const root = document.documentElement;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const nodes = [];
    const candidateA = new Int16Array(MAX_CANDIDATES);
    const candidateB = new Int16Array(MAX_CANDIDATES);
    const candidateDistance = new Float32Array(MAX_CANDIDATES);
    const candidateSeen = new Uint8Array(PAIR_SLOTS);
    const selectedPairs = new Uint8Array(PAIR_SLOTS);
    const pairVisibility = new Float32Array(PAIR_SLOTS);
    const pairHeal = new Float32Array(PAIR_SLOTS);
    const degrees = new Uint8Array(MAX_NODES);
    const linkA = new Int16Array(MAX_CANDIDATES);
    const linkB = new Int16Array(MAX_CANDIDATES);
    const gridNext = new Int16Array(MAX_NODES);
    const pointerNeighborIndex = new Int16Array(CONFIG.maximumPointerNeighbors);
    const pointerNeighborDistanceSquared = new Float32Array(
        CONFIG.maximumPointerNeighbors
    );
    const pulses = [
        { active: false, a: 0, b: 0, start: 0 },
        { active: false, a: 0, b: 0, start: 0 }
    ];
    const pointer = {
        inside: false,
        hasPosition: false,
        x: 0,
        y: 0,
        renderedX: 0,
        renderedY: 0,
        lastX: 0,
        lastY: 0,
        lastMoveTime: 0,
        speed: 0,
        alpha: 0
    };
    const ring = {
        active: false,
        x: 0,
        y: 0,
        start: 0,
        previousRadius: 0,
        generation: 0
    };

    let canvasWidth = 0;
    let canvasHeight = 0;
    let deviceScale = 1;
    let linkDistance = CONFIG.desktopLinkDistance;
    let candidateCount = 0;
    let linkCount = 0;
    let anchorCount = 0;
    let resizeTimer = 0;
    let resizeSignature = "";
    let nextPulseTime = 0;
    let isIntersecting = true;
    let documentVisible = !document.hidden;
    let isDirty = true;
    let frameCount = 0;
    let palette = null;
    let gridHeads = new Int16Array(1);
    let gridColumns = 1;
    let gridRows = 1;
    let gridCellSize = CONFIG.desktopLinkDistance;
    let neighborCandidateChecks = 0;
    let pointerLinkCount = 0;

    pairHeal.fill(1);

    const clamp = (value, minimum, maximum) =>
        Math.min(Math.max(value, minimum), maximum);
    const randomBetween = (minimum, maximum) =>
        minimum + Math.random() * (maximum - minimum);
    const frameRateIndependent = (amountPerFrame, deltaMs) =>
        1 - Math.pow(1 - amountPerFrame, deltaMs / 16.67);
    const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);
    const pairKey = (a, b) => {
        const low = a < b ? a : b;
        const high = a < b ? b : a;
        return low * MAX_NODES + high;
    };
    const wakeAnimation = () => {
        isDirty = true;
        window.requestParvAnimationFrame?.();
    };
    const syncPalette = () => {
        const darkMode = document.body.classList.contains("dark-mode");
        palette = darkMode
            ? {
                background: "#121212",
                ink: "#f4f2ef",
                accent: "#90caf9",
                baseAlpha: 0.42,
                moteAlpha: 0.72,
                anchorAlpha: 0.92
            }
            : {
                background: "rgb(220, 223, 226)",
                ink: "#171a1f",
                accent: "#1a73e8",
                baseAlpha: 0.30,
                moteAlpha: 0.62,
                anchorAlpha: 0.82
            };
    };

    const configureTier = (node, isAnchor) => {
        node.isAnchor = isAnchor;
        node.radius = isAnchor ? node.anchorRadius : node.moteRadius;
        const speed = node.speed * (isAnchor ? 0.5 : 1);
        node.baseVx = Math.cos(node.direction) * speed;
        node.baseVy = Math.sin(node.direction) * speed;
        if (!node.initialized) {
            node.vx = node.baseVx;
            node.vy = node.baseVy;
            node.initialized = true;
        }
    };

    const createNode = () => {
        const node = {
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            drawX: 0,
            drawY: 0,
            direction: Math.random() * Math.PI * 2,
            speed: randomBetween(
                CONFIG.minimumNodeSpeed,
                CONFIG.maximumNodeSpeed
            ),
            baseVx: 0,
            baseVy: 0,
            vx: 0,
            vy: 0,
            interactionX: 0,
            interactionY: 0,
            interactionVx: 0,
            interactionVy: 0,
            moteRadius: randomBetween(1, 2),
            anchorRadius: randomBetween(3, 4),
            radius: 1,
            isAnchor: false,
            phase: Math.random() * Math.PI * 2,
            wobbleRate: Math.PI * 2 / randomBetween(1800, 4200),
            wobbleAmplitude: randomBetween(0.7, 1.8),
            edgeAlpha: 1,
            brightness: 0,
            ringGeneration: -1,
            initialized: false
        };
        node.drawX = node.x;
        node.drawY = node.y;
        return node;
    };

    const setNodeCount = (targetCount) => {
        while (nodes.length < targetCount) {
            nodes.push(createNode());
        }
        if (nodes.length > targetCount) {
            nodes.length = targetCount;
        }

        anchorCount = Math.max(1, Math.round(nodes.length * CONFIG.anchorRatio));
        for (let index = 0; index < nodes.length; index += 1) {
            configureTier(nodes[index], index < anchorCount);
        }

        pairVisibility.fill(0);
        pairHeal.fill(1);
        for (let index = 0; index < pulses.length; index += 1) {
            pulses[index].active = false;
        }
    };

    const configureSpatialGrid = () => {
        gridCellSize = linkDistance;
        gridColumns = Math.max(1, Math.ceil(canvasWidth / gridCellSize));
        gridRows = Math.max(1, Math.ceil(canvasHeight / gridCellSize));
        const requiredCells = gridColumns * gridRows;
        if (gridHeads.length !== requiredCells) {
            gridHeads = new Int16Array(requiredCells);
        }
        gridHeads.fill(-1);
        gridNext.fill(-1);
    };

    const rebuildSpatialGrid = () => {
        gridHeads.fill(-1);
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            const column = clamp(
                Math.floor(node.drawX / gridCellSize),
                0,
                gridColumns - 1
            );
            const row = clamp(
                Math.floor(node.drawY / gridCellSize),
                0,
                gridRows - 1
            );
            const cell = row * gridColumns + column;
            gridNext[index] = gridHeads[cell];
            gridHeads[cell] = index;
        }
    };

    const resizeCanvas = (force = false) => {
        const rect = canvas.getBoundingClientRect();
        const nextWidth = Math.max(rect.width, 1);
        const nextHeight = Math.max(rect.height, 1);
        const nextScale = clamp(window.devicePixelRatio || 1, 1, 2);
        const nextSignature = `${nextWidth.toFixed(2)}:${nextHeight.toFixed(2)}:${nextScale}:${mobileQuery.matches}`;
        if (!force && nextSignature === resizeSignature) return;
        resizeSignature = nextSignature;

        if (canvasWidth && canvasHeight) {
            const scaleX = nextWidth / canvasWidth;
            const scaleY = nextHeight / canvasHeight;
            for (let index = 0; index < nodes.length; index += 1) {
                const node = nodes[index];
                node.x *= scaleX;
                node.y *= scaleY;
                node.drawX *= scaleX;
                node.drawY *= scaleY;
            }
            if (pointer.hasPosition) {
                pointer.x *= scaleX;
                pointer.y *= scaleY;
                pointer.renderedX *= scaleX;
                pointer.renderedY *= scaleY;
                pointer.lastX *= scaleX;
                pointer.lastY *= scaleY;
            }
            if (ring.active) {
                ring.x *= scaleX;
                ring.y *= scaleY;
            }
        }

        canvasWidth = nextWidth;
        canvasHeight = nextHeight;
        deviceScale = nextScale;
        canvas.width = Math.max(1, Math.round(canvasWidth * deviceScale));
        canvas.height = Math.max(1, Math.round(canvasHeight * deviceScale));
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        linkDistance = mobileQuery.matches
            ? CONFIG.mobileLinkDistance
            : CONFIG.desktopLinkDistance;
        configureSpatialGrid();

        const targetCount = clamp(
            Math.round(canvasWidth * canvasHeight / CONFIG.densityDivisor),
            CONFIG.minimumNodes,
            CONFIG.maximumNodes
        );
        if (targetCount !== nodes.length) {
            setNodeCount(targetCount);
        }

        canvas.dataset.nodeCount = String(nodes.length);
        canvas.dataset.anchorCount = String(anchorCount);
        canvas.dataset.linkDistance = String(linkDistance);
        canvas.dataset.neighborLookup = "spatial-grid";
        canvas.dataset.gridColumns = String(gridColumns);
        canvas.dataset.gridRows = String(gridRows);
        canvas.dataset.pointerLinkCap = String(CONFIG.maximumPointerNeighbors);
        wakeAnimation();
    };

    const scheduleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resizeCanvas, CONFIG.resizeDebounceMs);
    };

    const updatePointerPosition = (event, initializeRendered = false) => {
        const rect = canvas.getBoundingClientRect();
        const nextX = clamp(event.clientX - rect.left, 0, rect.width);
        const nextY = clamp(event.clientY - rect.top, 0, rect.height);
        const eventTime = event.timeStamp || performance.now();

        if (pointer.hasPosition && pointer.lastMoveTime) {
            const elapsed = Math.max(eventTime - pointer.lastMoveTime, 1);
            const distance = Math.hypot(nextX - pointer.lastX, nextY - pointer.lastY);
            const instantaneousSpeed = distance / elapsed;
            const speedAmount = frameRateIndependent(
                CONFIG.pointerSpeedLerpPerFrame,
                elapsed
            );
            pointer.speed += (instantaneousSpeed - pointer.speed) * speedAmount;
        }

        pointer.x = nextX;
        pointer.y = nextY;
        pointer.lastX = nextX;
        pointer.lastY = nextY;
        pointer.lastMoveTime = eventTime;
        if (!pointer.hasPosition || initializeRendered) {
            pointer.renderedX = nextX;
            pointer.renderedY = nextY;
        }
        pointer.hasPosition = true;
    };

    const enterPointer = (event) => {
        if (reducedMotionQuery.matches || event.pointerType === "touch") {
            return;
        }
        pointer.inside = true;
        pointer.speed = 0;
        pointer.lastMoveTime = 0;
        updatePointerPosition(event, true);
        root.classList.add("network-pointer-active");
        wakeAnimation();
    };

    const movePointer = (event) => {
        if (reducedMotionQuery.matches || event.pointerType === "touch") {
            return;
        }
        pointer.inside = true;
        updatePointerPosition(event);
        root.classList.add("network-pointer-active");
        wakeAnimation();
    };

    const leavePointer = () => {
        pointer.inside = false;
        root.classList.remove("network-pointer-active");
        wakeAnimation();
    };

    const emitRing = (event) => {
        if (reducedMotionQuery.matches || (event.pointerType !== "touch" && event.button > 0)) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        ring.active = true;
        ring.x = clamp(event.clientX - rect.left, 0, rect.width);
        ring.y = clamp(event.clientY - rect.top, 0, rect.height);
        ring.start = performance.now();
        ring.previousRadius = 0;
        ring.generation += 1;
        if (event.pointerType !== "touch") {
            pointer.inside = true;
            updatePointerPosition(event);
            root.classList.add("network-pointer-active");
        }
        wakeAnimation();
    };

    const addCandidate = (a, b, distance) => {
        if (b < 0 || candidateCount >= MAX_CANDIDATES) {
            return;
        }
        const key = pairKey(a, b);
        if (candidateSeen[key]) {
            return;
        }
        candidateSeen[key] = 1;
        candidateA[candidateCount] = a;
        candidateB[candidateCount] = b;
        candidateDistance[candidateCount] = distance;
        candidateCount += 1;
    };

    const buildLinks = (deltaMs) => {
        candidateCount = 0;
        linkCount = 0;
        candidateSeen.fill(0);
        selectedPairs.fill(0);
        degrees.fill(0);
        const maximumDistanceSquared = linkDistance * linkDistance;
        neighborCandidateChecks = 0;
        rebuildSpatialGrid();

        for (let a = 0; a < nodes.length; a += 1) {
            const source = nodes[a];
            let firstIndex = -1;
            let secondIndex = -1;
            let thirdIndex = -1;
            let firstDistance = Infinity;
            let secondDistance = Infinity;
            let thirdDistance = Infinity;

            const minimumColumn = clamp(
                Math.floor((source.drawX - linkDistance) / gridCellSize),
                0,
                gridColumns - 1
            );
            const maximumColumn = clamp(
                Math.floor((source.drawX + linkDistance) / gridCellSize),
                0,
                gridColumns - 1
            );
            const minimumRow = clamp(
                Math.floor((source.drawY - linkDistance) / gridCellSize),
                0,
                gridRows - 1
            );
            const maximumRow = clamp(
                Math.floor((source.drawY + linkDistance) / gridCellSize),
                0,
                gridRows - 1
            );

            for (let row = minimumRow; row <= maximumRow; row += 1) {
                for (
                    let column = minimumColumn;
                    column <= maximumColumn;
                    column += 1
                ) {
                    let b = gridHeads[row * gridColumns + column];
                    while (b >= 0) {
                        if (a !== b) {
                            neighborCandidateChecks += 1;
                            const target = nodes[b];
                            const deltaX = target.drawX - source.drawX;
                            const deltaY = target.drawY - source.drawY;
                            const distanceSquared = deltaX * deltaX
                                + deltaY * deltaY;
                            if (distanceSquared <= maximumDistanceSquared) {
                                if (distanceSquared < firstDistance) {
                                    thirdDistance = secondDistance;
                                    thirdIndex = secondIndex;
                                    secondDistance = firstDistance;
                                    secondIndex = firstIndex;
                                    firstDistance = distanceSquared;
                                    firstIndex = b;
                                } else if (distanceSquared < secondDistance) {
                                    thirdDistance = secondDistance;
                                    thirdIndex = secondIndex;
                                    secondDistance = distanceSquared;
                                    secondIndex = b;
                                } else if (distanceSquared < thirdDistance) {
                                    thirdDistance = distanceSquared;
                                    thirdIndex = b;
                                }
                            }
                        }
                        b = gridNext[b];
                    }
                }
            }

            addCandidate(a, firstIndex, Math.sqrt(firstDistance));
            addCandidate(a, secondIndex, Math.sqrt(secondDistance));
            addCandidate(a, thirdIndex, Math.sqrt(thirdDistance));
        }

        for (let index = 1; index < candidateCount; index += 1) {
            const savedA = candidateA[index];
            const savedB = candidateB[index];
            const savedDistance = candidateDistance[index];
            let cursor = index - 1;
            while (cursor >= 0 && candidateDistance[cursor] > savedDistance) {
                candidateA[cursor + 1] = candidateA[cursor];
                candidateB[cursor + 1] = candidateB[cursor];
                candidateDistance[cursor + 1] = candidateDistance[cursor];
                cursor -= 1;
            }
            candidateA[cursor + 1] = savedA;
            candidateB[cursor + 1] = savedB;
            candidateDistance[cursor + 1] = savedDistance;
        }

        for (let index = 0; index < candidateCount; index += 1) {
            const a = candidateA[index];
            const b = candidateB[index];
            if (
                degrees[a] >= CONFIG.maximumNeighbors
                || degrees[b] >= CONFIG.maximumNeighbors
            ) {
                continue;
            }
            const key = pairKey(a, b);
            selectedPairs[key] = 1;
            degrees[a] += 1;
            degrees[b] += 1;
            linkA[linkCount] = a;
            linkB[linkCount] = b;
            linkCount += 1;
        }

        const topologyAmount = reducedMotionQuery.matches
            ? 1
            : Math.min(deltaMs / CONFIG.topologyFadeMs, 1);
        for (let a = 0; a < nodes.length; a += 1) {
            for (let b = a + 1; b < nodes.length; b += 1) {
                const key = pairKey(a, b);
                const target = selectedPairs[key] ? 1 : 0;
                pairVisibility[key] += (target - pairVisibility[key]) * topologyAmount;
                if (target === 0 && pairVisibility[key] < 0.002) {
                    pairVisibility[key] = 0;
                }
            }
        }
    };

    const updatePointer = (deltaMs) => {
        if (!pointer.hasPosition) {
            return;
        }
        const amount = reducedMotionQuery.matches
            ? 1
            : frameRateIndependent(CONFIG.pointerLerpPerFrame, deltaMs);
        pointer.renderedX += (pointer.x - pointer.renderedX) * amount;
        pointer.renderedY += (pointer.y - pointer.renderedY) * amount;
        if (pointer.inside) {
            pointer.alpha += (1 - pointer.alpha) * Math.min(deltaMs / 120, 1);
        } else {
            pointer.alpha = Math.max(0, pointer.alpha - deltaMs / CONFIG.pointerFadeMs);
        }
        pointer.speed *= Math.pow(0.90, deltaMs / 16.67);
    };

    const applyRing = (time) => {
        if (!ring.active) {
            return;
        }
        const progress = (time - ring.start) / CONFIG.ringDurationMs;
        if (progress >= 1) {
            ring.active = false;
            return;
        }
        const radius = easeOutCubic(progress) * CONFIG.ringDistance;
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            if (node.ringGeneration === ring.generation) {
                continue;
            }
            const deltaX = node.x + node.interactionX - ring.x;
            const deltaY = node.y + node.interactionY - ring.y;
            const distance = Math.hypot(deltaX, deltaY);
            if (distance > radius + 5 || distance < ring.previousRadius - 5) {
                continue;
            }
            const safeDistance = Math.max(distance, 0.001);
            const kick = 1.15 * (1 - progress * 0.35);
            node.interactionVx += deltaX / safeDistance * kick;
            node.interactionVy += deltaY / safeDistance * kick;
            node.brightness = 1;
            node.ringGeneration = ring.generation;
        }
        ring.previousRadius = radius;
    };

    const updateNodes = (time, deltaMs) => {
        const frameScale = Math.min(deltaMs / 16.67, 3);
        const pointerPower = clamp(pointer.speed / 1.2, 0, 1);

        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            if (pointer.inside && pointer.alpha > 0.01) {
                const deltaX = node.x - pointer.renderedX;
                const deltaY = node.y - pointer.renderedY;
                const distance = Math.hypot(deltaX, deltaY);
                if (distance > 0.001 && distance < CONFIG.repulsionRadius) {
                    const falloff = 1 - distance / CONFIG.repulsionRadius;
                    const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
                    const force = CONFIG.maximumRepulsion
                        * smoothFalloff * (0.28 + pointerPower * 0.72)
                        * pointer.alpha * frameScale;
                    node.interactionVx += deltaX / distance * force;
                    node.interactionVy += deltaY / distance * force;
                }
            }

            node.interactionVx -= node.interactionX
                * CONFIG.interactionSpring * frameScale;
            node.interactionVy -= node.interactionY
                * CONFIG.interactionSpring * frameScale;
            const interactionDamping = Math.pow(
                CONFIG.interactionDampingPerFrame,
                frameScale
            );
            node.interactionVx *= interactionDamping;
            node.interactionVy *= interactionDamping;
            node.interactionX += node.interactionVx * frameScale;
            node.interactionY += node.interactionVy * frameScale;

            const interactionDistance = Math.hypot(
                node.interactionX,
                node.interactionY
            );
            if (interactionDistance > CONFIG.maximumInteractionOffset) {
                const interactionScale = CONFIG.maximumInteractionOffset
                    / interactionDistance;
                node.interactionX *= interactionScale;
                node.interactionY *= interactionScale;
                node.interactionVx *= 0.65;
                node.interactionVy *= 0.65;
            }

            const settleAmount = frameRateIndependent(0.035, deltaMs);
            node.vx += (node.baseVx - node.vx) * settleAmount;
            node.vy += (node.baseVy - node.vy) * settleAmount;

            const deviationX = node.vx - node.baseVx;
            const deviationY = node.vy - node.baseVy;
            const deviation = Math.hypot(deviationX, deviationY);
            if (deviation > 1.1) {
                const scale = 1.1 / deviation;
                node.vx = node.baseVx + deviationX * scale;
                node.vy = node.baseVy + deviationY * scale;
            }

            node.x += node.vx * frameScale;
            node.y += node.vy * frameScale;
            if (node.x < 0) {
                node.x += canvasWidth;
            } else if (node.x >= canvasWidth) {
                node.x -= canvasWidth;
            }
            if (node.y < 0) {
                node.y += canvasHeight;
            } else if (node.y >= canvasHeight) {
                node.y -= canvasHeight;
            }

            const edgeDistance = Math.min(
                node.x,
                canvasWidth - node.x,
                node.y,
                canvasHeight - node.y
            );
            const edgeTarget = clamp(edgeDistance / 18, 0, 1);
            const edgeAmount = frameRateIndependent(0.28, deltaMs);
            node.edgeAlpha += (edgeTarget - node.edgeAlpha) * edgeAmount;

            const wobble = Math.sin(time * node.wobbleRate + node.phase)
                * node.wobbleAmplitude;
            const crossWobble = Math.cos(time * node.wobbleRate * 0.83 + node.phase)
                * node.wobbleAmplitude * 0.62;
            node.drawX = node.x + wobble + node.interactionX;
            node.drawY = node.y + crossWobble + node.interactionY;
            node.brightness *= Math.pow(0.88, frameScale);
        }
    };

    const updateLinkHealing = (deltaMs) => {
        const healStep = deltaMs / CONFIG.linkHealMs;
        const severStep = deltaMs / CONFIG.linkSeverFadeMs;
        const severDistanceSquared = CONFIG.severRadius * CONFIG.severRadius;
        for (let a = 0; a < nodes.length; a += 1) {
            for (let b = a + 1; b < nodes.length; b += 1) {
                const key = pairKey(a, b);
                if (pairVisibility[key] <= 0) {
                    pairHeal[key] = Math.min(1, pairHeal[key] + healStep);
                    continue;
                }
                const first = nodes[a];
                const second = nodes[b];
                const midpointX = (first.drawX + second.drawX) * 0.5;
                const midpointY = (first.drawY + second.drawY) * 0.5;
                const deltaX = midpointX - pointer.renderedX;
                const deltaY = midpointY - pointer.renderedY;
                if (
                    pointer.inside
                    && pointer.alpha > 0.01
                    && deltaX * deltaX + deltaY * deltaY < severDistanceSquared
                ) {
                    pairHeal[key] = Math.max(0, pairHeal[key] - severStep);
                } else {
                    pairHeal[key] = Math.min(1, pairHeal[key] + healStep);
                }
            }
        }
    };

    const drawLinks = () => {
        context.lineWidth = 1;
        context.strokeStyle = palette.ink;
        for (let a = 0; a < nodes.length; a += 1) {
            const first = nodes[a];
            for (let b = a + 1; b < nodes.length; b += 1) {
                const key = pairKey(a, b);
                const visibility = pairVisibility[key];
                if (visibility <= 0.002 || pairHeal[key] <= 0.002) {
                    continue;
                }
                const second = nodes[b];
                const deltaX = second.drawX - first.drawX;
                const deltaY = second.drawY - first.drawY;
                const distance = Math.hypot(deltaX, deltaY);
                const proximity = 1 - distance / linkDistance;
                if (proximity <= 0) {
                    continue;
                }
                context.globalAlpha = proximity * palette.baseAlpha
                    * visibility * pairHeal[key]
                    * first.edgeAlpha * second.edgeAlpha;
                context.beginPath();
                context.moveTo(first.drawX, first.drawY);
                context.lineTo(second.drawX, second.drawY);
                context.stroke();
            }
        }
    };

    const drawPointerLinks = () => {
        pointerLinkCount = 0;
        if (!pointer.hasPosition || pointer.alpha <= 0.002) {
            return;
        }
        const radius = linkDistance * CONFIG.pointerLinkScale;
        const radiusSquared = radius * radius;
        pointerNeighborIndex.fill(-1);
        pointerNeighborDistanceSquared.fill(Infinity);

        const minimumColumn = clamp(
            Math.floor((pointer.renderedX - radius) / gridCellSize),
            0,
            gridColumns - 1
        );
        const maximumColumn = clamp(
            Math.floor((pointer.renderedX + radius) / gridCellSize),
            0,
            gridColumns - 1
        );
        const minimumRow = clamp(
            Math.floor((pointer.renderedY - radius) / gridCellSize),
            0,
            gridRows - 1
        );
        const maximumRow = clamp(
            Math.floor((pointer.renderedY + radius) / gridCellSize),
            0,
            gridRows - 1
        );

        for (let row = minimumRow; row <= maximumRow; row += 1) {
            for (
                let column = minimumColumn;
                column <= maximumColumn;
                column += 1
            ) {
                let candidate = gridHeads[row * gridColumns + column];
                while (candidate >= 0) {
                    const node = nodes[candidate];
                    const deltaX = node.drawX - pointer.renderedX;
                    const deltaY = node.drawY - pointer.renderedY;
                    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                    if (distanceSquared < radiusSquared) {
                        let slot = CONFIG.maximumPointerNeighbors - 1;
                        if (
                            distanceSquared
                            < pointerNeighborDistanceSquared[slot]
                        ) {
                            while (
                                slot > 0
                                && distanceSquared
                                    < pointerNeighborDistanceSquared[slot - 1]
                            ) {
                                pointerNeighborDistanceSquared[slot] =
                                    pointerNeighborDistanceSquared[slot - 1];
                                pointerNeighborIndex[slot] =
                                    pointerNeighborIndex[slot - 1];
                                slot -= 1;
                            }
                            pointerNeighborDistanceSquared[slot] = distanceSquared;
                            pointerNeighborIndex[slot] = candidate;
                        }
                    }
                    candidate = gridNext[candidate];
                }
            }
        }

        context.strokeStyle = palette.accent;
        context.lineWidth = 1;
        for (
            let slot = 0;
            slot < CONFIG.maximumPointerNeighbors;
            slot += 1
        ) {
            const index = pointerNeighborIndex[slot];
            if (index < 0) {
                continue;
            }
            const node = nodes[index];
            const distance = Math.sqrt(pointerNeighborDistanceSquared[slot]);
            context.globalAlpha = (1 - distance / radius) * 0.72
                * pointer.alpha * node.edgeAlpha;
            context.beginPath();
            context.moveTo(pointer.renderedX, pointer.renderedY);
            context.lineTo(node.drawX, node.drawY);
            context.stroke();
            pointerLinkCount += 1;
        }
    };

    const spawnPulse = (time) => {
        if (!linkCount) {
            return;
        }
        let slot = null;
        for (let index = 0; index < pulses.length; index += 1) {
            if (!pulses[index].active) {
                slot = pulses[index];
                break;
            }
        }
        if (!slot) {
            return;
        }
        const selected = Math.floor(Math.random() * linkCount);
        slot.active = true;
        slot.a = linkA[selected];
        slot.b = linkB[selected];
        slot.start = time;
    };

    const updatePulses = (time) => {
        if (!nextPulseTime) {
            nextPulseTime = time + CONFIG.pulseIntervalMs;
        } else if (time >= nextPulseTime) {
            spawnPulse(time);
            nextPulseTime = time + CONFIG.pulseIntervalMs * randomBetween(0.9, 1.1);
        }
        for (let index = 0; index < pulses.length; index += 1) {
            const pulse = pulses[index];
            if (pulse.active && time - pulse.start >= CONFIG.pulseDurationMs) {
                pulse.active = false;
            }
        }
    };

    const drawPulses = (time) => {
        context.fillStyle = palette.accent;
        for (let index = 0; index < pulses.length; index += 1) {
            const pulse = pulses[index];
            if (!pulse.active || pulse.a >= nodes.length || pulse.b >= nodes.length) {
                continue;
            }
            const progress = clamp(
                (time - pulse.start) / CONFIG.pulseDurationMs,
                0,
                1
            );
            const first = nodes[pulse.a];
            const second = nodes[pulse.b];
            const key = pairKey(pulse.a, pulse.b);
            const connectionAlpha = pairVisibility[key] * pairHeal[key]
                * first.edgeAlpha * second.edgeAlpha;
            if (connectionAlpha <= 0.002) {
                continue;
            }
            const x = first.drawX + (second.drawX - first.drawX) * progress;
            const y = first.drawY + (second.drawY - first.drawY) * progress;
            context.globalAlpha = Math.sin(progress * Math.PI) * 0.88
                * connectionAlpha;
            context.beginPath();
            context.arc(x, y, 2.1, 0, Math.PI * 2);
            context.fill();
        }
    };

    const drawRing = (time) => {
        if (!ring.active) {
            return;
        }
        const progress = clamp((time - ring.start) / CONFIG.ringDurationMs, 0, 1);
        const easedProgress = easeOutCubic(progress);
        context.strokeStyle = palette.accent;
        context.lineWidth = 1.1;
        context.globalAlpha = Math.pow(1 - progress, 1.35) * 0.78;
        context.beginPath();
        context.arc(
            ring.x,
            ring.y,
            easedProgress * CONFIG.ringDistance,
            0,
            Math.PI * 2
        );
        context.stroke();
    };

    const drawNodes = () => {
        context.fillStyle = palette.ink;
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            if (node.brightness > 0.02) {
                context.fillStyle = palette.accent;
                context.globalAlpha = node.brightness * 0.26 * node.edgeAlpha;
                context.beginPath();
                context.arc(node.drawX, node.drawY, node.radius + 2.3, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = palette.ink;
            }
            context.globalAlpha = node.isAnchor
                ? palette.anchorAlpha * node.edgeAlpha
                : palette.moteAlpha * node.edgeAlpha;
            context.beginPath();
            context.arc(node.drawX, node.drawY, node.radius, 0, Math.PI * 2);
            context.fill();
        }
    };

    const drawPointer = () => {
        if (!pointer.hasPosition || pointer.alpha <= 0.002) {
            return;
        }
        context.fillStyle = palette.accent;
        context.globalAlpha = pointer.alpha;
        context.beginPath();
        context.arc(pointer.renderedX, pointer.renderedY, 2.5, 0, Math.PI * 2);
        context.fill();
    };

    const renderFrame = (time, deltaMs = 16.67) => {
        if (!isIntersecting || !documentVisible || !canvasWidth || !canvasHeight) {
            return;
        }
        if (reducedMotionQuery.matches && !isDirty) {
            return;
        }

        const boundedDelta = clamp(deltaMs, 0, 50);
        if (!reducedMotionQuery.matches) {
            updatePointer(boundedDelta);
            applyRing(time);
            updateNodes(time, boundedDelta);
        } else {
            pointer.alpha = 0;
            pointer.inside = false;
            ring.active = false;
        }

        buildLinks(boundedDelta);
        updateLinkHealing(boundedDelta);
        if (!reducedMotionQuery.matches) {
            updatePulses(time);
        }

        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = palette.background;
        context.globalAlpha = 1;
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        drawLinks();
        drawPointerLinks();
        if (!reducedMotionQuery.matches) {
            drawPulses(time);
            drawRing(time);
        }
        drawNodes();
        drawPointer();
        context.globalAlpha = 1;
        isDirty = false;
        frameCount += 1;
    };

    const needsAnimation = () => {
        if (!isIntersecting || !documentVisible) {
            return false;
        }
        return reducedMotionQuery.matches ? isDirty : true;
    };

    canvas.addEventListener("pointerenter", enterPointer, { passive: true });
    canvas.addEventListener("pointermove", movePointer, { passive: true });
    canvas.addEventListener("pointerleave", leavePointer, { passive: true });
    canvas.addEventListener("pointercancel", leavePointer, { passive: true });
    canvas.addEventListener("pointerup", (event) => {
        if (event.pointerType === "touch") {
            leavePointer();
        }
    }, { passive: true });
    window.bindParvCanvasActivation(canvas, emitRing);

    const intersectionObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            isIntersecting = Boolean(entries[0]?.isIntersecting);
            if (!isIntersecting) {
                pointer.inside = false;
                pointer.alpha = 0;
                root.classList.remove("network-pointer-active");
            }
            wakeAnimation();
        }, { threshold: 0.01 })
        : null;
    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleResize)
        : null;
    const themeObserver = new MutationObserver(() => {
        syncPalette();
        wakeAnimation();
    });
    const onReducedMotionChange = () => {
        pointer.inside = false;
        pointer.alpha = 0;
        ring.active = false;
        pairHeal.fill(1);
        nextPulseTime = 0;
        for (let index = 0; index < pulses.length; index += 1) {
            pulses[index].active = false;
        }
        root.classList.remove("network-pointer-active");
        wakeAnimation();
    };
    const onVisibilityChange = () => {
        documentVisible = !document.hidden;
        if (!documentVisible) {
            pointer.inside = false;
            pointer.alpha = 0;
            root.classList.remove("network-pointer-active");
        }
        wakeAnimation();
    };

    if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", onReducedMotionChange);
        mobileQuery.addEventListener("change", scheduleResize);
    } else {
        reducedMotionQuery.addListener(onReducedMotionChange);
        mobileQuery.addListener(scheduleResize);
    }
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("blur", () => {
        pointer.inside = false;
        pointer.alpha = 0;
        root.classList.remove("network-pointer-active");
        wakeAnimation();
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    intersectionObserver?.observe(canvas);
    resizeObserver?.observe(panel);

    syncPalette();
    resizeCanvas(true);
    window.parvNetworkController = {
        renderFrame,
        needsAnimation,
        getState: () => ({
            nodeCount: nodes.length,
            anchorCount,
            linkCount,
            activePulses: Number(pulses[0].active) + Number(pulses[1].active),
            width: canvasWidth,
            height: canvasHeight,
            deviceScale,
            linkDistance,
            isIntersecting,
            documentVisible,
            frameCount,
            neighborLookup: "spatial-grid",
            gridColumns,
            gridRows,
            neighborCandidateChecks,
            pointerLinkCount,
            pointerLinkCap: CONFIG.maximumPointerNeighbors
        })
    };
})();
