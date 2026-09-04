(() => {
    "use strict";

    const canvas = document.getElementById("topo-panel");
    const panel = canvas?.closest(".topographic-panel");
    const context = canvas?.getContext("2d");

    if (!canvas || !panel || !context) {
        return;
    }

    const CONFIG = Object.freeze({
        desktopCellSize: 7,
        mobileCellSize: 9,
        maximumCells: 5000,
        damping: 0.975,
        clickDamping: 0.955,
        clickWaveSpeedSquared: 0.30,
        fixedStepMs: 1000 / 60,
        maximumCatchUpSteps: 5,
        contourLevels: 14,
        desktopPointerRadius: 56,
        mobilePointerRadius: 44,
        pointerDisplacement: 0.62,
        clickRadiusCells: 1.6,
        clickImpulse: 1.45,
        ambientImpulse: 2.8 * 0.04,
        pointerLerpPerFrame: 0.35,
        pointerFadeMs: 400,
        pointerTintRadius: 60,
        clickTintMs: 720,
        clickWaveLifetimeMs: 950,
        minimumRenderRange: 0.28,
        maximumRenderRange: 5.5,
        resizeDebounceMs: 150
    });

    const root = document.documentElement;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const pointer = {
        inside: false,
        hasPosition: false,
        x: 0,
        y: 0,
        renderedX: 0,
        renderedY: 0,
        alpha: 0
    };

    let canvasWidth = 0;
    let canvasHeight = 0;
    let deviceScale = 1;
    let columns = 0;
    let rows = 0;
    let stepX = 1;
    let stepY = 1;
    let effectiveCellSize = CONFIG.desktopCellSize;
    let previousAmbientField = new Float32Array(0);
    let currentAmbientField = new Float32Array(0);
    let nextAmbientField = new Float32Array(0);
    let previousClickField = new Float32Array(0);
    let currentClickField = new Float32Array(0);
    let nextClickField = new Float32Array(0);
    let renderField = new Float32Array(0);
    let simulationAccumulator = 0;
    let simulationTime = 0;
    let clickTintUntil = 0;
    let clickWaveUntil = 0;
    let resizeTimer = 0;
    let resizeSignature = "";
    let isIntersecting = true;
    let documentVisible = !document.hidden;
    let isDirty = true;
    let frameCount = 0;
    let simulationStepCount = 0;
    let renderRange = 0.6;
    let palette = null;
    let squareX = 0;
    let squareY = 0;
    let squareTopLeft = 0;
    let squareTopRight = 0;
    let squareBottomRight = 0;
    let squareBottomLeft = 0;
    let squareThreshold = 0;
    let squareAccentPass = false;
    let squareClickEnergy = 0;
    let squareClickFade = 0;
    let clickMinColumn = 0;
    let clickMaxColumn = -1;
    let clickMinRow = 0;
    let clickMaxRow = -1;

    const clamp = (value, minimum, maximum) =>
        Math.min(Math.max(value, minimum), maximum);
    const smoothstep = (value) => value * value * (3 - 2 * value);
    const frameRateIndependent = (amountPerFrame, deltaMs) =>
        1 - Math.pow(1 - amountPerFrame, deltaMs / 16.67);
    const wakeAnimation = () => {
        isDirty = true;
        window.requestParvAnimationFrame?.();
    };
    const syncPalette = () => {
        const darkMode = document.body.classList.contains("dark-mode");
        palette = darkMode
            ? {
                ink: "#f4f2ef",
                accent: "#90caf9",
                baseAlpha: 0.45,
                indexAlpha: 0.70
            }
            : {
                ink: "#171a1f",
                accent: "#1a73e8",
                baseAlpha: 0.35,
                indexAlpha: 0.55
            };
        wakeAnimation();
    };

    const staticNoise = (column, row, time) => {
        const broad = Math.sin(column * 0.19 + time * 0.17)
            * Math.cos(row * 0.23 - time * 0.13);
        const diagonal = Math.sin((column + row) * 0.11 - time * 0.09);
        const detail = Math.cos(column * 0.37 - row * 0.29 + time * 0.07);
        return broad * 0.58 + diagonal * 0.29 + detail * 0.13;
    };

    const zeroBorders = (field) => {
        if (columns < 2 || rows < 2) {
            return;
        }
        const bottomOffset = (rows - 1) * columns;
        for (let column = 0; column < columns; column += 1) {
            field[column] = 0;
            field[bottomOffset + column] = 0;
        }
        for (let row = 1; row < rows - 1; row += 1) {
            const offset = row * columns;
            field[offset] = 0;
            field[offset + columns - 1] = 0;
        }
    };

    const seedField = () => {
        const staticScale = reducedMotionQuery.matches ? 0.92 : 0.42;
        previousAmbientField.fill(0);
        currentAmbientField.fill(0);
        nextAmbientField.fill(0);
        previousClickField.fill(0);
        currentClickField.fill(0);
        nextClickField.fill(0);
        renderField.fill(0);
        for (let row = 1; row < rows - 1; row += 1) {
            const offset = row * columns;
            for (let column = 1; column < columns - 1; column += 1) {
                const value = staticNoise(column, row, 0) * staticScale;
                previousAmbientField[offset + column] = value;
                currentAmbientField[offset + column] = value;
            }
        }
        zeroBorders(previousAmbientField);
        zeroBorders(currentAmbientField);
        renderRange = reducedMotionQuery.matches ? 0.62 : 0.42;
        simulationAccumulator = 0;
        simulationTime = 0;
        clickTintUntil = 0;
        clickWaveUntil = 0;
    };

    const rebuildGrid = (force = false) => {
        const rect = canvas.getBoundingClientRect();
        const nextWidth = Math.max(rect.width, 1);
        const nextHeight = Math.max(rect.height, 1);
        const nextScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
        const nextSignature = `${nextWidth.toFixed(2)}:${nextHeight.toFixed(2)}:${nextScale}:${mobileQuery.matches}:${reducedMotionQuery.matches}`;
        if (!force && nextSignature === resizeSignature) return;
        resizeSignature = nextSignature;
        canvasWidth = nextWidth;
        canvasHeight = nextHeight;
        deviceScale = nextScale;
        canvas.width = Math.max(1, Math.round(canvasWidth * deviceScale));
        canvas.height = Math.max(1, Math.round(canvasHeight * deviceScale));
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

        let targetCellSize = mobileQuery.matches
            ? CONFIG.mobileCellSize
            : CONFIG.desktopCellSize;
        let nextColumns = Math.max(4, Math.floor(canvasWidth / targetCellSize) + 1);
        let nextRows = Math.max(4, Math.floor(canvasHeight / targetCellSize) + 1);

        if (nextColumns * nextRows > CONFIG.maximumCells) {
            targetCellSize = Math.sqrt(
                canvasWidth * canvasHeight / CONFIG.maximumCells
            );
            nextColumns = Math.max(4, Math.floor(canvasWidth / targetCellSize) + 1);
            nextRows = Math.max(4, Math.floor(canvasHeight / targetCellSize) + 1);
            while (nextColumns * nextRows > CONFIG.maximumCells) {
                targetCellSize += 0.25;
                nextColumns = Math.max(4, Math.floor(canvasWidth / targetCellSize) + 1);
                nextRows = Math.max(4, Math.floor(canvasHeight / targetCellSize) + 1);
            }
        }

        columns = nextColumns;
        rows = nextRows;
        stepX = canvasWidth / (columns - 1);
        stepY = canvasHeight / (rows - 1);
        effectiveCellSize = (stepX + stepY) * 0.5;
        const cellCount = columns * rows;
        previousAmbientField = new Float32Array(cellCount);
        currentAmbientField = new Float32Array(cellCount);
        nextAmbientField = new Float32Array(cellCount);
        previousClickField = new Float32Array(cellCount);
        currentClickField = new Float32Array(cellCount);
        nextClickField = new Float32Array(cellCount);
        renderField = new Float32Array(cellCount);
        seedField();

        canvas.dataset.gridColumns = String(columns);
        canvas.dataset.gridRows = String(rows);
        canvas.dataset.gridCells = String(cellCount);
        canvas.dataset.contourLevels = String(CONFIG.contourLevels);
        canvas.dataset.renderer = "marching-squares";
        canvas.dataset.simulation = reducedMotionQuery.matches
            ? "static"
            : "wave-equation";
        wakeAnimation();
    };

    const scheduleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(rebuildGrid, CONFIG.resizeDebounceMs);
    };

    const localPointerPosition = (event) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: clamp(event.clientX - rect.left, 0, rect.width),
            y: clamp(event.clientY - rect.top, 0, rect.height)
        };
    };

    const updatePointerPosition = (event, initializeRendered = false) => {
        const rect = canvas.getBoundingClientRect();
        const nextX = clamp(event.clientX - rect.left, 0, rect.width);
        const nextY = clamp(event.clientY - rect.top, 0, rect.height);

        pointer.x = nextX;
        pointer.y = nextY;
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
        updatePointerPosition(event, true);
        root.classList.add("topo-pointer-active");
        wakeAnimation();
    };

    const movePointer = (event) => {
        if (reducedMotionQuery.matches || event.pointerType === "touch") {
            return;
        }
        pointer.inside = true;
        updatePointerPosition(event);
        root.classList.add("topo-pointer-active");
        wakeAnimation();
    };

    const leavePointer = () => {
        pointer.inside = false;
        root.classList.remove("topo-pointer-active");
        wakeAnimation();
    };

    const injectClickWave = (x, y) => {
        if (!columns || !rows) {
            return;
        }
        const radius = effectiveCellSize * CONFIG.clickRadiusCells;
        const radiusSquared = radius * radius;
        const startColumn = clamp(Math.floor((x - radius) / stepX), 1, columns - 2);
        const endColumn = clamp(Math.ceil((x + radius) / stepX), 1, columns - 2);
        const startRow = clamp(Math.floor((y - radius) / stepY), 1, rows - 2);
        const endRow = clamp(Math.ceil((y + radius) / stepY), 1, rows - 2);

        for (let row = startRow; row <= endRow; row += 1) {
            const deltaY = row * stepY - y;
            const offset = row * columns;
            for (let column = startColumn; column <= endColumn; column += 1) {
                const deltaX = column * stepX - x;
                const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                if (distanceSquared >= radiusSquared) {
                    continue;
                }
                const distance = Math.sqrt(distanceSquared) / radius;
                const displacement = CONFIG.clickImpulse * (1 - smoothstep(distance));
                const index = offset + column;
                // Equal displacement in both time slices starts a clean,
                // zero-velocity pulse instead of a directional kick.
                previousClickField[index] += displacement;
                currentClickField[index] += displacement;
            }
        }
    };

    const clickField = (event) => {
        if (
            reducedMotionQuery.matches
            || (event.pointerType !== "touch" && event.button > 0)
        ) {
            return;
        }
        const position = localPointerPosition(event);
        injectClickWave(position.x, position.y);
        const now = performance.now();
        clickTintUntil = now + CONFIG.clickTintMs;
        clickWaveUntil = now + CONFIG.clickWaveLifetimeMs;
        if (event.pointerType !== "touch") {
            pointer.inside = true;
            updatePointerPosition(event);
            root.classList.add("topo-pointer-active");
        }
        wakeAnimation();
    };

    const injectAmbientDrift = () => {
        for (let row = 1; row < rows - 1; row += 1) {
            const offset = row * columns;
            for (let column = 1; column < columns - 1; column += 1) {
                currentAmbientField[offset + column] += (
                    staticNoise(column, row, simulationTime) * CONFIG.ambientImpulse
                );
            }
        }
    };

    const stepSimulation = () => {
        injectAmbientDrift();

        for (let row = 1; row < rows - 1; row += 1) {
            const offset = row * columns;
            for (let column = 1; column < columns - 1; column += 1) {
                const index = offset + column;
                nextAmbientField[index] = (
                    (
                        currentAmbientField[index - 1]
                        + currentAmbientField[index + 1]
                        + currentAmbientField[index - columns]
                        + currentAmbientField[index + columns]
                    ) / 2
                    - previousAmbientField[index]
                ) * CONFIG.damping;
                const clickHeight = currentClickField[index];
                const clickLaplacian = (
                    currentClickField[index - 1]
                    + currentClickField[index + 1]
                    + currentClickField[index - columns]
                    + currentClickField[index + columns]
                    - 4 * clickHeight
                );
                const clickVelocity = (
                    clickHeight - previousClickField[index]
                ) * CONFIG.clickDamping;
                nextClickField[index] = clickHeight
                    + clickVelocity
                    + CONFIG.clickWaveSpeedSquared * clickLaplacian;
            }
        }
        zeroBorders(nextAmbientField);
        zeroBorders(nextClickField);

        const recycledAmbientField = previousAmbientField;
        previousAmbientField = currentAmbientField;
        currentAmbientField = nextAmbientField;
        nextAmbientField = recycledAmbientField;
        nextAmbientField.fill(0);
        const recycledClickField = previousClickField;
        previousClickField = currentClickField;
        currentClickField = nextClickField;
        nextClickField = recycledClickField;
        nextClickField.fill(0);
        simulationTime += CONFIG.fixedStepMs / 1000;
        simulationStepCount += 1;
    };

    const composeRenderField = () => {
        renderField.set(currentAmbientField);
        for (let index = 0; index < renderField.length; index += 1) {
            renderField[index] += currentClickField[index];
        }

        if (!pointer.hasPosition || pointer.alpha <= 0.002) {
            return;
        }
        const radius = mobileQuery.matches
            ? CONFIG.mobilePointerRadius
            : CONFIG.desktopPointerRadius;
        const radiusSquared = radius * radius;
        const startColumn = clamp(
            Math.floor((pointer.renderedX - radius) / stepX),
            0,
            columns - 1
        );
        const endColumn = clamp(
            Math.ceil((pointer.renderedX + radius) / stepX),
            0,
            columns - 1
        );
        const startRow = clamp(
            Math.floor((pointer.renderedY - radius) / stepY),
            0,
            rows - 1
        );
        const endRow = clamp(
            Math.ceil((pointer.renderedY + radius) / stepY),
            0,
            rows - 1
        );
        const strength = CONFIG.pointerDisplacement * pointer.alpha;

        for (let row = startRow; row <= endRow; row += 1) {
            const deltaY = row * stepY - pointer.renderedY;
            const offset = row * columns;
            for (let column = startColumn; column <= endColumn; column += 1) {
                const deltaX = column * stepX - pointer.renderedX;
                const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                if (distanceSquared >= radiusSquared) {
                    continue;
                }
                const distance = Math.sqrt(distanceSquared) / radius;
                renderField[offset + column] += strength
                    * (1 - smoothstep(distance));
            }
        }
    };

    const edgePoint = (edge, x, y, topLeft, topRight, bottomRight, bottomLeft, threshold) => {
        let first = 0;
        let second = 0;
        let amount = 0.5;
        let pointX = x;
        let pointY = y;

        if (edge === 0) {
            first = topLeft;
            second = topRight;
            amount = Math.abs(second - first) < 0.000001
                ? 0.5
                : clamp((threshold - first) / (second - first), 0, 1);
            pointX = x + stepX * amount;
        } else if (edge === 1) {
            first = topRight;
            second = bottomRight;
            amount = Math.abs(second - first) < 0.000001
                ? 0.5
                : clamp((threshold - first) / (second - first), 0, 1);
            pointX = x + stepX;
            pointY = y + stepY * amount;
        } else if (edge === 2) {
            first = bottomLeft;
            second = bottomRight;
            amount = Math.abs(second - first) < 0.000001
                ? 0.5
                : clamp((threshold - first) / (second - first), 0, 1);
            pointX = x + stepX * amount;
            pointY = y + stepY;
        } else {
            first = topLeft;
            second = bottomLeft;
            amount = Math.abs(second - first) < 0.000001
                ? 0.5
                : clamp((threshold - first) / (second - first), 0, 1);
            pointY = y + stepY * amount;
        }

        return edge === 0 || edge === 2 ? pointX : pointY;
    };

    const appendSegment = (
        firstEdge,
        secondEdge,
        x,
        y,
        topLeft,
        topRight,
        bottomRight,
        bottomLeft,
        threshold,
        accentPass,
        clickEnergy,
        clickFade
    ) => {
        const firstAxis = edgePoint(
            firstEdge,
            x,
            y,
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            threshold
        );
        const secondAxis = edgePoint(
            secondEdge,
            x,
            y,
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            threshold
        );
        let firstX = x;
        let firstY = y;
        let secondX = x;
        let secondY = y;

        if (firstEdge === 0) {
            firstX = firstAxis;
        } else if (firstEdge === 1) {
            firstX = x + stepX;
            firstY = firstAxis;
        } else if (firstEdge === 2) {
            firstX = firstAxis;
            firstY = y + stepY;
        } else {
            firstY = firstAxis;
        }

        if (secondEdge === 0) {
            secondX = secondAxis;
        } else if (secondEdge === 1) {
            secondX = x + stepX;
            secondY = secondAxis;
        } else if (secondEdge === 2) {
            secondX = secondAxis;
            secondY = y + stepY;
        } else {
            secondY = secondAxis;
        }

        if (accentPass) {
            let pointerTint = false;
            if (pointer.hasPosition && pointer.alpha > 0.002) {
                const midpointX = (firstX + secondX) * 0.5;
                const midpointY = (firstY + secondY) * 0.5;
                const deltaX = midpointX - pointer.renderedX;
                const deltaY = midpointY - pointer.renderedY;
                pointerTint = deltaX * deltaX + deltaY * deltaY
                    <= CONFIG.pointerTintRadius * CONFIG.pointerTintRadius;
            }
            const clickTint = clickFade > 0
                && clickEnergy > CONFIG.clickImpulse * 0.004;
            if (!pointerTint && !clickTint) {
                return;
            }
        }

        context.moveTo(firstX, firstY);
        context.lineTo(secondX, secondY);
    };

    const appendCurrentSquareSegment = (firstEdge, secondEdge) => {
        appendSegment(
            firstEdge,
            secondEdge,
            squareX,
            squareY,
            squareTopLeft,
            squareTopRight,
            squareBottomRight,
            squareBottomLeft,
            squareThreshold,
            squareAccentPass,
            squareClickEnergy,
            squareClickFade
        );
    };

    const appendSquare = (
        column,
        row,
        threshold,
        accentPass,
        clickFade
    ) => {
        const index = row * columns + column;
        const topLeft = renderField[index];
        const topRight = renderField[index + 1];
        const bottomRight = renderField[index + columns + 1];
        const bottomLeft = renderField[index + columns];
        const caseIndex = (topLeft >= threshold ? 1 : 0)
            | (topRight >= threshold ? 2 : 0)
            | (bottomRight >= threshold ? 4 : 0)
            | (bottomLeft >= threshold ? 8 : 0);

        if (caseIndex === 0 || caseIndex === 15) {
            return;
        }

        squareClickEnergy = (
            Math.abs(currentClickField[index])
            + Math.abs(currentClickField[index + 1])
            + Math.abs(currentClickField[index + columns + 1])
            + Math.abs(currentClickField[index + columns])
        ) * 0.25;
        const topLeftDelta = topLeft - threshold;
        const topRightDelta = topRight - threshold;
        const bottomRightDelta = bottomRight - threshold;
        const bottomLeftDelta = bottomLeft - threshold;
        const saddleDeterminant = (
            topLeftDelta * bottomRightDelta
            - topRightDelta * bottomLeftDelta
        );
        squareX = column * stepX;
        squareY = row * stepY;
        squareTopLeft = topLeft;
        squareTopRight = topRight;
        squareBottomRight = bottomRight;
        squareBottomLeft = bottomLeft;
        squareThreshold = threshold;
        squareAccentPass = accentPass;
        squareClickFade = clickFade;

        switch (caseIndex) {
        case 1:
        case 14:
            appendCurrentSquareSegment(3, 0);
            break;
        case 2:
        case 13:
            appendCurrentSquareSegment(0, 1);
            break;
        case 3:
        case 12:
            appendCurrentSquareSegment(3, 1);
            break;
        case 4:
        case 11:
            appendCurrentSquareSegment(1, 2);
            break;
        case 5:
            if (saddleDeterminant >= 0) {
                appendCurrentSquareSegment(0, 1);
                appendCurrentSquareSegment(2, 3);
            } else {
                appendCurrentSquareSegment(3, 0);
                appendCurrentSquareSegment(1, 2);
            }
            break;
        case 6:
        case 9:
            appendCurrentSquareSegment(0, 2);
            break;
        case 7:
        case 8:
            appendCurrentSquareSegment(3, 2);
            break;
        case 10:
            if (saddleDeterminant <= 0) {
                appendCurrentSquareSegment(3, 0);
                appendCurrentSquareSegment(1, 2);
            } else {
                appendCurrentSquareSegment(0, 1);
                appendCurrentSquareSegment(2, 3);
            }
            break;
        default:
            break;
        }
    };

    const updateRenderRange = (deltaMs) => {
        let maximumHeight = 0;
        clickMinColumn = columns;
        clickMaxColumn = -1;
        clickMinRow = rows;
        clickMaxRow = -1;
        for (let index = 0; index < currentAmbientField.length; index += 1) {
            maximumHeight = Math.max(
                maximumHeight,
                Math.abs(currentAmbientField[index])
            );
            if (Math.abs(currentClickField[index]) > CONFIG.clickImpulse * 0.002) {
                const row = Math.floor(index / columns);
                const column = index - row * columns;
                clickMinColumn = Math.min(clickMinColumn, column);
                clickMaxColumn = Math.max(clickMaxColumn, column);
                clickMinRow = Math.min(clickMinRow, row);
                clickMaxRow = Math.max(clickMaxRow, row);
            }
        }
        const target = clamp(
            maximumHeight * 0.78,
            CONFIG.minimumRenderRange,
            CONFIG.maximumRenderRange
        );
        const amount = reducedMotionQuery.matches
            ? 1
            : frameRateIndependent(0.09, deltaMs);
        renderRange += (target - renderRange) * amount;
        return maximumHeight;
    };

    const contourThreshold = (level) => {
        return -renderRange + (
            2 * renderRange * level / (CONFIG.contourLevels - 1)
        );
    };

    const drawContours = (accentPass, time) => {
        const clickFade = clamp(
            (clickTintUntil - time) / CONFIG.clickTintMs,
            0,
            1
        );
        const accentStrength = Math.max(pointer.alpha * 0.86, clickFade * 0.82);
        if (accentPass && accentStrength <= 0.002) {
            return;
        }

        let startColumn = 0;
        let endColumn = columns - 2;
        let startRow = 0;
        let endRow = rows - 2;
        if (accentPass) {
            startColumn = columns;
            endColumn = -1;
            startRow = rows;
            endRow = -1;

            if (pointer.hasPosition && pointer.alpha > 0.002) {
                const columnRadius = Math.ceil(CONFIG.pointerTintRadius / stepX) + 1;
                const rowRadius = Math.ceil(CONFIG.pointerTintRadius / stepY) + 1;
                const centerColumn = Math.round(pointer.renderedX / stepX);
                const centerRow = Math.round(pointer.renderedY / stepY);
                startColumn = clamp(centerColumn - columnRadius, 0, columns - 2);
                endColumn = clamp(centerColumn + columnRadius, 0, columns - 2);
                startRow = clamp(centerRow - rowRadius, 0, rows - 2);
                endRow = clamp(centerRow + rowRadius, 0, rows - 2);
            }

            if (clickFade > 0 && clickMaxColumn >= clickMinColumn) {
                startColumn = Math.min(startColumn, Math.max(clickMinColumn - 1, 0));
                endColumn = Math.max(endColumn, Math.min(clickMaxColumn, columns - 2));
                startRow = Math.min(startRow, Math.max(clickMinRow - 1, 0));
                endRow = Math.max(endRow, Math.min(clickMaxRow, rows - 2));
            }

            if (endColumn < startColumn || endRow < startRow) {
                return;
            }
        }

        context.strokeStyle = accentPass ? palette.accent : palette.ink;
        context.lineCap = "round";
        context.lineJoin = "round";

        for (let level = 0; level < CONFIG.contourLevels; level += 1) {
            const threshold = contourThreshold(level);
            const isIndexContour = (level + 1) % 4 === 0;
            const elevationStrength = 0.82
                + Math.abs(threshold / renderRange) * 0.18;
            context.lineWidth = isIndexContour ? 1.5 : 1;
            context.globalAlpha = (
                isIndexContour ? palette.indexAlpha : palette.baseAlpha
            ) * elevationStrength * (accentPass ? accentStrength : 1);
            context.beginPath();
            for (let row = startRow; row <= endRow; row += 1) {
                for (let column = startColumn; column <= endColumn; column += 1) {
                    appendSquare(column, row, threshold, accentPass, clickFade);
                }
            }
            context.stroke();
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
    };

    const drawPointer = () => {
        if (!pointer.hasPosition || pointer.alpha <= 0.002) {
            return;
        }
        context.fillStyle = palette.accent;
        context.globalAlpha = pointer.alpha;
        context.beginPath();
        context.arc(pointer.renderedX, pointer.renderedY, 3, 0, Math.PI * 2);
        context.fill();
    };

    const renderFrame = (time, deltaMs = 16.67) => {
        if (
            !isIntersecting
            || !documentVisible
            || !canvasWidth
            || !canvasHeight
        ) {
            return;
        }
        if (reducedMotionQuery.matches && !isDirty) {
            return;
        }

        const boundedDelta = clamp(deltaMs, 0, 83.34);
        updatePointer(boundedDelta);

        if (clickWaveUntil && time >= clickWaveUntil) {
            previousClickField.fill(0);
            currentClickField.fill(0);
            nextClickField.fill(0);
            clickTintUntil = 0;
            clickWaveUntil = 0;
        }

        if (!reducedMotionQuery.matches) {
            simulationAccumulator += boundedDelta;
            let steps = 0;
            while (
                simulationAccumulator >= CONFIG.fixedStepMs
                && steps < CONFIG.maximumCatchUpSteps
            ) {
                stepSimulation();
                simulationAccumulator -= CONFIG.fixedStepMs;
                steps += 1;
            }
            if (steps === CONFIG.maximumCatchUpSteps) {
                simulationAccumulator = Math.min(
                    simulationAccumulator,
                    CONFIG.fixedStepMs
                );
            }
        } else {
            pointer.alpha = 0;
        }

        composeRenderField();
        const maximumHeight = updateRenderRange(boundedDelta);
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        drawContours(false, time);
        if (!reducedMotionQuery.matches) {
            drawContours(true, time);
            drawPointer();
        }
        context.globalAlpha = 1;
        isDirty = false;
        frameCount += 1;

        if (frameCount % 60 === 0) {
            canvas.dataset.frameCount = String(frameCount);
            canvas.dataset.maximumHeight = maximumHeight.toFixed(3);
        }
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
    window.bindParvCanvasActivation(canvas, clickField);

    const intersectionObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            isIntersecting = Boolean(entries[0]?.isIntersecting);
            if (!isIntersecting) {
                pointer.inside = false;
                pointer.alpha = 0;
                root.classList.remove("topo-pointer-active");
            }
            wakeAnimation();
        }, { threshold: 0.01 })
        : null;
    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleResize)
        : null;
    const themeObserver = new MutationObserver(syncPalette);
    const onReducedMotionChange = () => {
        pointer.inside = false;
        pointer.alpha = 0;
        clickTintUntil = 0;
        clickWaveUntil = 0;
        root.classList.remove("topo-pointer-active");
        rebuildGrid(true);
    };
    const onVisibilityChange = () => {
        documentVisible = !document.hidden;
        if (!documentVisible) {
            pointer.inside = false;
            pointer.alpha = 0;
            root.classList.remove("topo-pointer-active");
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
        root.classList.remove("topo-pointer-active");
        wakeAnimation();
    });
    themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"]
    });
    intersectionObserver?.observe(canvas);
    resizeObserver?.observe(panel);

    syncPalette();
    rebuildGrid(true);
    window.parvTopographicController = {
        renderFrame,
        needsAnimation,
        getState: () => ({
            width: canvasWidth,
            height: canvasHeight,
            deviceScale,
            columns,
            rows,
            cellCount: columns * rows,
            effectiveCellSize,
            contourLevels: CONFIG.contourLevels,
            frameCount,
            simulationStepCount,
            renderRange,
            isIntersecting,
            documentVisible
        })
    };
})();
