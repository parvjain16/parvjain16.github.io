(() => {
    "use strict";

    const shell = document.getElementById("liquidNameShell");
    const canvas = document.getElementById("liquidNameCanvas");

    if (!shell || !canvas) {
        return;
    }

    const DEFAULTS = Object.freeze({
        chromeTint: "#eef2f6",
        wobbleAmount: 0.30,
        wobbleSpeed: 0.82,
        rippleStrength: 0.62,
        rippleRadius: 0.30,
        splashStrength: 1.0,
        extrudeDepth: 0.52,
        envIntensity: 1.18,
        environment: 0
    });
    const settings = { ...DEFAULTS };
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance"
    });

    if (!gl) {
        return;
    }

    const vertexSource = [
        "#version 300 es",
        "precision highp float;",
        "out vec2 vUv;",
        "void main() {",
        "    vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));",
        "    vUv = position;",
        "    gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);",
        "}"
    ].join("\n");

    const fragmentSource = [
        "#version 300 es",
        "precision highp float;",
        "in vec2 vUv;",
        "out vec4 outColor;",
        "uniform sampler2D uSdf;",
        "uniform sampler2D uEnvironmentTexture;",
        "uniform vec2 uSdfTexel;",
        "uniform vec2 uResolution;",
        "uniform vec2 uPointer;",
        "uniform vec2 uParallax;",
        "uniform vec2 uSplashCenter;",
        "uniform vec3 uChromeTint;",
        "uniform float uSdfSpread;",
        "uniform float uTime;",
        "uniform float uWobbleAmount;",
        "uniform float uRippleStrength;",
        "uniform float uRippleRadius;",
        "uniform float uPointerActive;",
        "uniform float uSplashAge;",
        "uniform float uSplashStrength;",
        "uniform float uExtrudeDepth;",
        "uniform float uEnvIntensity;",
        "uniform float uUseEnvironmentTexture;",
        "uniform float uDarkMode;",
        "uniform int uEnvironmentPreset;",
        "const float PI = 3.141592653589793;",
        "float hash21(vec2 point) {",
        "    point = fract(point * vec2(123.34, 456.21));",
        "    point += dot(point, point + 45.32);",
        "    return fract(point.x * point.y);",
        "}",
        "float valueNoise(vec2 point) {",
        "    vec2 cell = floor(point);",
        "    vec2 local = fract(point);",
        "    local = local * local * (3.0 - 2.0 * local);",
        "    float a = hash21(cell);",
        "    float b = hash21(cell + vec2(1.0, 0.0));",
        "    float c = hash21(cell + vec2(0.0, 1.0));",
        "    float d = hash21(cell + vec2(1.0, 1.0));",
        "    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);",
        "}",
        "float fbm(vec2 point) {",
        "    float value = 0.0;",
        "    float amplitude = 0.55;",
        "    mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);",
        "    for (int octave = 0; octave < 4; octave += 1) {",
        "        value += amplitude * valueNoise(point);",
        "        point = rotation * point * 2.03 + 11.7;",
        "        amplitude *= 0.50;",
        "    }",
        "    return value;",
        "}",
        "float signedDistanceAt(vec2 uv) {",
        "    return (texture(uSdf, uv).r - 0.5) * (2.0 * uSdfSpread);",
        "}",
        "vec2 aspectVector(vec2 point) {",
        "    return vec2(point.x * (uResolution.x / max(uResolution.y, 1.0)), point.y);",
        "}",
        "vec3 proceduralEnvironment(vec3 direction, int preset) {",
        "    direction = normalize(direction);",
        "    float horizon = pow(max(0.0, 1.0 - abs(direction.y)), 4.0);",
        "    float verticalBand = pow(max(0.0, 1.0 - abs(direction.x + 0.30)), 30.0);",
        "    float softBand = pow(max(0.0, 1.0 - abs(direction.x - 0.52)), 9.0);",
        "    float topGlow = pow(max(direction.y, 0.0), 5.0);",
        "    float lowerShade = smoothstep(-1.0, 0.2, direction.y);",
        "    vec3 color;",
        "    if (preset == 1) {",
        "        color = mix(vec3(0.035, 0.025, 0.055), vec3(1.75, 0.40, 0.12), horizon);",
        "        color += vec3(2.9, 1.10, 0.26) * verticalBand;",
        "        color += vec3(0.48, 0.12, 0.48) * softBand;",
        "        color += vec3(1.10, 0.42, 0.18) * topGlow;",
        "    } else if (preset == 2) {",
        "        color = mix(vec3(0.025, 0.045, 0.070), vec3(0.32, 1.05, 1.28), horizon);",
        "        color += vec3(2.4, 3.1, 3.5) * verticalBand;",
        "        color += vec3(0.25, 0.70, 1.75) * softBand;",
        "        color += vec3(0.62, 1.34, 1.72) * topGlow;",
        "    } else {",
        "        color = mix(vec3(0.028, 0.032, 0.040), vec3(0.64, 0.72, 0.82), horizon);",
        "        color += vec3(3.5, 3.7, 4.0) * verticalBand;",
        "        color += vec3(0.90, 0.72, 0.48) * softBand;",
        "        color += vec3(0.92, 1.02, 1.20) * topGlow;",
        "    }",
        "    return color * mix(0.58, 1.0, lowerShade);",
        "}",
        "vec3 sampleEnvironment(vec3 direction) {",
        "    if (uUseEnvironmentTexture > 0.5) {",
        "        vec2 envUv = vec2(atan(direction.z, direction.x) / (2.0 * PI) + 0.5, asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5);",
        "        return pow(texture(uEnvironmentTexture, envUv).rgb, vec3(2.2)) * 2.25;",
        "    }",
        "    return proceduralEnvironment(direction, uEnvironmentPreset);",
        "}",
        "void main() {",
        "    float noiseA = fbm(vUv * vec2(7.0, 5.0) + vec2(uTime * 0.18, -uTime * 0.13));",
        "    float noiseB = fbm(vUv.yx * vec2(8.0, 6.0) + vec2(-uTime * 0.11, uTime * 0.16) + 17.0);",
        "    vec2 outlineWobble = (vec2(noiseA, noiseB) - 0.50) * uSdfTexel * (9.0 * uWobbleAmount);",
        "    vec2 geometryShift = vec2(uParallax.x * 0.010, uParallax.y * 0.018);",
        "    vec2 pointerDelta = aspectVector(vUv - uPointer);",
        "    float pointerDistance = length(pointerDelta);",
        "    vec2 pointerDirection = pointerDistance > 0.0001 ? pointerDelta / pointerDistance : vec2(0.0);",
        "    float pointerEnvelope = exp(-pow(pointerDistance / max(0.05, uRippleRadius), 2.0) * 2.25) * uPointerActive;",
        "    float pointerWave = sin(pointerDistance * 54.0 - uTime * 5.0) * pointerEnvelope * uRippleStrength;",
        "    vec2 splashDelta = aspectVector(vUv - uSplashCenter);",
        "    float splashDistance = length(splashDelta);",
        "    float splashRadius = uSplashAge * 0.62;",
        "    float splashEnvelope = exp(-pow((splashDistance - splashRadius) * 28.0, 2.0)) * exp(-uSplashAge * 2.25) * step(uSplashAge, 1.35);",
        "    float splashWave = sin((splashDistance - splashRadius) * 80.0) * splashEnvelope * uSplashStrength;",
        "    vec2 warpedUv = vUv - geometryShift + outlineWobble;",
        "    float distanceValue = signedDistanceAt(warpedUv);",
        "    float antialiasWidth = max(fwidth(distanceValue), 0.70);",
        "    float face = smoothstep(-antialiasWidth, antialiasWidth, distanceValue);",
        "    float sideField = -1000.0;",
        "    vec2 depthDirection = normalize(vec2(-0.72, 0.68) + vec2(-uParallax.x, uParallax.y) * 0.10);",
        "    float depthPixels = mix(3.0, 24.0, uExtrudeDepth);",
        "    for (int stepIndex = 1; stepIndex <= 12; stepIndex += 1) {",
        "        float progress = float(stepIndex) / 12.0;",
        "        vec2 depthOffset = depthDirection * uSdfTexel * depthPixels * progress;",
        "        sideField = max(sideField, signedDistanceAt(warpedUv + depthOffset));",
        "    }",
        "    float side = smoothstep(-antialiasWidth, antialiasWidth, sideField) * (1.0 - face);",
        "    float alpha = max(face, side);",
        "    if (alpha < 0.002) { discard; }",
        "    float leftDistance = signedDistanceAt(warpedUv - vec2(uSdfTexel.x, 0.0));",
        "    float rightDistance = signedDistanceAt(warpedUv + vec2(uSdfTexel.x, 0.0));",
        "    float downDistance = signedDistanceAt(warpedUv - vec2(0.0, uSdfTexel.y));",
        "    float upDistance = signedDistanceAt(warpedUv + vec2(0.0, uSdfTexel.y));",
        "    vec2 distanceGradient = vec2(rightDistance - leftDistance, upDistance - downDistance);",
        "    float bevel = 1.0 - smoothstep(0.0, 7.0, max(distanceValue, 0.0));",
        "    vec2 surfaceNoise = (vec2(noiseA, noiseB) - 0.50) * (1.0 * uWobbleAmount);",
        "    vec2 rippleNormal = pointerDirection * pointerWave * 0.82;",
        "    vec2 splashDirection = splashDistance > 0.0001 ? splashDelta / splashDistance : vec2(0.0);",
        "    vec2 splashNormal = splashDirection * splashWave * 1.12;",
        "    vec2 parallaxNormal = vec2(uParallax.x, uParallax.y) * 0.16;",
        "    vec2 normalXY = -distanceGradient * bevel * 0.62 + surfaceNoise + rippleNormal + splashNormal + parallaxNormal * face;",
        "    vec3 normal = normalize(vec3(normalXY, 0.62 + 0.38 * (1.0 - bevel)));",
        "    vec3 viewDirection = vec3(0.0, 0.0, 1.0);",
        "    vec3 reflectionDirection = reflect(-viewDirection, normal);",
        "    vec3 environment = sampleEnvironment(reflectionDirection) * uEnvIntensity;",
        "    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);",
        "    float rim = pow(1.0 - max(normal.z, 0.0), 2.4);",
        "    float movingGlint = pow(max(0.0, 1.0 - abs(normal.x * 0.72 + normal.y * 0.45 - 0.12)), 22.0);",
        "    vec3 tintLinear = pow(max(uChromeTint, vec3(0.01)), vec3(2.2));",
        "    vec3 faceColor = environment * mix(tintLinear * 0.76, vec3(1.0), 0.28);",
        "    faceColor += vec3(1.4) * movingGlint;",
        "    faceColor += mix(vec3(0.18), tintLinear, 0.48) * (0.26 + fresnel * 1.35 + rim * 0.55);",
        "    float sideShade = mix(0.16, 0.48, clamp(sideField / 9.0 + 0.5, 0.0, 1.0));",
        "    vec3 sideColor = environment * tintLinear * sideShade + vec3(0.035, 0.045, 0.060) * (1.0 + uDarkMode * 0.25);",
        "    vec3 color = mix(sideColor, faceColor, face);",
        "    color = color / (color + vec3(1.0));",
        "    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));",
        "    outColor = vec4(color * alpha, alpha);",
        "}"
    ].join("\n");

    const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error("Liquid metal shader failed to compile: " + message);
        }
        return shader;
    };

    const createProgram = () => {
        const nextProgram = gl.createProgram();
        const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        gl.attachShader(nextProgram, vertexShader);
        gl.attachShader(nextProgram, fragmentShader);
        gl.linkProgram(nextProgram);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(nextProgram);
            gl.deleteProgram(nextProgram);
            throw new Error("Liquid metal program failed to link: " + message);
        }
        return nextProgram;
    };

    const uniformNames = [
        "uSdf", "uEnvironmentTexture", "uSdfTexel", "uResolution", "uPointer", "uParallax",
        "uSplashCenter", "uChromeTint", "uSdfSpread", "uTime", "uWobbleAmount",
        "uRippleStrength", "uRippleRadius", "uPointerActive", "uSplashAge",
        "uSplashStrength", "uExtrudeDepth", "uEnvIntensity",
        "uUseEnvironmentTexture", "uDarkMode", "uEnvironmentPreset"
    ];
    let program = null;
    let uniforms = {};
    let sdfTexture = null;
    let environmentTexture = null;
    const initializeGraphicsResources = () => {
        program = createProgram();
        uniforms = Object.fromEntries(
            uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])
        );
        sdfTexture = gl.createTexture();
        environmentTexture = gl.createTexture();
        if (!sdfTexture || !environmentTexture) {
            throw new Error("This device could not allocate the liquid-metal textures.");
        }
        gl.bindTexture(gl.TEXTURE_2D, environmentTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([210, 220, 232, 255])
        );
    };
    try {
        initializeGraphicsResources();
    } catch (error) {
        console.error(error);
        return;
    }
    const maskCanvas = document.createElement("canvas");
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    const pointer = {
        active: false,
        targetX: 0.5,
        targetY: 0.5,
        renderedX: 0.5,
        renderedY: 0.5
    };
    const parallax = {
        targetX: 0,
        targetY: 0,
        renderedX: 0,
        renderedY: 0
    };

    let canvasWidth = 0;
    let canvasHeight = 0;
    let sdfSpread = 24;
    let isVisible = true;
    let isDirty = true;
    let maskReady = false;
    let hasRendered = false;
    let contextLost = false;
    let splashStart = -10;
    let splashX = 0.5;
    let splashY = 0.5;
    let resizeTimer = 0;
    let useEnvironmentTexture = false;
    let environmentObjectUrl = "";
    let environmentLoadToken = 0;
    let pointerInsideName = false;
    let controlPreviewActive = false;
    let controlPreviewTimer = 0;
    let customizer = null;

    const clamp = (value, minimum, maximum) =>
        Math.min(Math.max(value, minimum), maximum);
    const frameRateIndependent = (amountPerFrame, deltaMs) =>
        1 - Math.pow(1 - amountPerFrame, deltaMs / 16.67);
    const hexToRgb = (hex) => {
        const numeric = Number.parseInt(hex.replace("#", ""), 16);
        return [
            ((numeric >> 16) & 255) / 255,
            ((numeric >> 8) & 255) / 255,
            (numeric & 255) / 255
        ];
    };
    const wakeAnimation = () => {
        isDirty = true;
        window.requestParvAnimationFrame?.();
    };

    const distanceTransform1D = (source, result, length, vertices, boundaries) => {
        let envelopeIndex = 0;
        vertices[0] = 0;
        boundaries[0] = -Infinity;
        boundaries[1] = Infinity;
        for (let point = 1; point < length; point += 1) {
            let intersection = (
                source[point] + point * point
                - source[vertices[envelopeIndex]]
                - vertices[envelopeIndex] * vertices[envelopeIndex]
            ) / (2 * point - 2 * vertices[envelopeIndex]);
            while (intersection <= boundaries[envelopeIndex]) {
                envelopeIndex -= 1;
                intersection = (
                    source[point] + point * point
                    - source[vertices[envelopeIndex]]
                    - vertices[envelopeIndex] * vertices[envelopeIndex]
                ) / (2 * point - 2 * vertices[envelopeIndex]);
            }
            envelopeIndex += 1;
            vertices[envelopeIndex] = point;
            boundaries[envelopeIndex] = intersection;
            boundaries[envelopeIndex + 1] = Infinity;
        }
        envelopeIndex = 0;
        for (let point = 0; point < length; point += 1) {
            while (boundaries[envelopeIndex + 1] < point) {
                envelopeIndex += 1;
            }
            const difference = point - vertices[envelopeIndex];
            result[point] = difference * difference + source[vertices[envelopeIndex]];
        }
    };

    const distanceTransform2D = (binaryMask, width, height, featureValue) => {
        const source = new Float32Array(width * height);
        const intermediate = new Float32Array(width * height);
        const result = new Float32Array(width * height);
        const longestSide = Math.max(width, height);
        const line = new Float32Array(longestSide);
        const transformedLine = new Float32Array(longestSide);
        const vertices = new Int32Array(longestSide);
        const boundaries = new Float32Array(longestSide + 1);
        for (let index = 0; index < source.length; index += 1) {
            source[index] = binaryMask[index] === featureValue ? 0 : 1e20;
        }
        for (let x = 0; x < width; x += 1) {
            for (let y = 0; y < height; y += 1) {
                line[y] = source[y * width + x];
            }
            distanceTransform1D(line, transformedLine, height, vertices, boundaries);
            for (let y = 0; y < height; y += 1) {
                intermediate[y * width + x] = transformedLine[y];
            }
        }
        for (let y = 0; y < height; y += 1) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x += 1) {
                line[x] = intermediate[rowOffset + x];
            }
            distanceTransform1D(line, transformedLine, width, vertices, boundaries);
            for (let x = 0; x < width; x += 1) {
                result[rowOffset + x] = transformedLine[x];
            }
        }
        return result;
    };

    const rebuildSdfTexture = () => {
        if (!canvasWidth || !canvasHeight || !maskContext) {
            return;
        }
        maskCanvas.width = canvasWidth;
        maskCanvas.height = canvasHeight;
        maskContext.clearRect(0, 0, canvasWidth, canvasHeight);
        maskContext.fillStyle = "#ffffff";
        maskContext.textAlign = "center";
        maskContext.textBaseline = "middle";
        let fontSize = canvasHeight * 0.62;
        maskContext.font = "700 " + fontSize + "px \"Product Sans\", Arial, sans-serif";
        const maximumTextWidth = canvasWidth * 0.82;
        const measuredWidth = maskContext.measureText("Parv Jain").width;
        if (measuredWidth > maximumTextWidth) {
            fontSize *= maximumTextWidth / measuredWidth;
            maskContext.font = "700 " + fontSize + "px \"Product Sans\", Arial, sans-serif";
        }
        maskContext.fillText("Parv Jain", canvasWidth * 0.5, canvasHeight * 0.50);
        const imageData = maskContext.getImageData(0, 0, canvasWidth, canvasHeight);
        const binaryMask = new Uint8Array(canvasWidth * canvasHeight);
        for (let pixel = 0; pixel < binaryMask.length; pixel += 1) {
            binaryMask[pixel] = imageData.data[pixel * 4 + 3] > 100 ? 1 : 0;
        }
        const distanceToInside = distanceTransform2D(binaryMask, canvasWidth, canvasHeight, 1);
        const distanceToOutside = distanceTransform2D(binaryMask, canvasWidth, canvasHeight, 0);
        const encodedSdf = new Uint8Array(binaryMask.length);
        sdfSpread = clamp(canvasHeight * 0.15, 18, 34);
        for (let pixel = 0; pixel < encodedSdf.length; pixel += 1) {
            const signedDistance = Math.sqrt(distanceToOutside[pixel])
                - Math.sqrt(distanceToInside[pixel]);
            encodedSdf[pixel] = Math.round(
                clamp(0.5 + signedDistance / (2 * sdfSpread), 0, 1) * 255
            );
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sdfTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.R8, canvasWidth, canvasHeight, 0,
            gl.RED, gl.UNSIGNED_BYTE, encodedSdf
        );
        maskReady = true;
        wakeAnimation();
    };

    const resizeCanvas = () => {
        const rect = shell.getBoundingClientRect();
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const nextWidth = Math.max(1, Math.round(rect.width * scale));
        const nextHeight = Math.max(1, Math.round(rect.height * scale));
        if (nextWidth === canvasWidth && nextHeight === canvasHeight) {
            return;
        }
        canvasWidth = nextWidth;
        canvasHeight = nextHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        maskReady = false;
        rebuildSdfTexture();
    };
    const scheduleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resizeCanvas, 100);
    };
    const pointerCoordinates = (event) => {
        const rect = shell.getBoundingClientRect();
        return {
            x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
            y: clamp(1 - (event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
        };
    };
    const onPointerEnter = (event) => {
        if (event.pointerType === "touch" || reducedMotionQuery.matches) return;
        const coordinates = pointerCoordinates(event);
        pointerInsideName = true;
        controlPreviewActive = false;
        window.clearTimeout(controlPreviewTimer);
        pointer.active = true;
        pointer.targetX = coordinates.x;
        pointer.targetY = coordinates.y;
        pointer.renderedX = coordinates.x;
        pointer.renderedY = coordinates.y;
        parallax.targetX = (coordinates.x - 0.5) * 2;
        parallax.targetY = (coordinates.y - 0.5) * 2;
        root.classList.add("liquid-name-pointer-active");
        wakeAnimation();
    };
    const onPointerMove = (event) => {
        if (event.pointerType === "touch" || reducedMotionQuery.matches) return;
        const coordinates = pointerCoordinates(event);
        pointerInsideName = true;
        pointer.active = true;
        pointer.targetX = coordinates.x;
        pointer.targetY = coordinates.y;
        parallax.targetX = (coordinates.x - 0.5) * 2;
        parallax.targetY = (coordinates.y - 0.5) * 2;
        wakeAnimation();
    };
    const onPointerLeave = () => {
        pointerInsideName = false;
        if (!controlPreviewActive) {
            pointer.active = false;
        }
        parallax.targetX = 0;
        parallax.targetY = 0;
        root.classList.remove("liquid-name-pointer-active");
        wakeAnimation();
    };
    const onPointerDown = (event) => {
        if (event.button !== 0 || event.isPrimary === false || reducedMotionQuery.matches) return;
        const coordinates = pointerCoordinates(event);
        splashX = coordinates.x;
        splashY = coordinates.y;
        splashStart = performance.now() * 0.001;
        wakeAnimation();
    };
    const previewControl = (settingName) => {
        window.clearTimeout(controlPreviewTimer);
        controlPreviewActive = false;
        if (!pointerInsideName) {
            pointer.active = false;
        }
        if (settingName === "rippleStrength" || settingName === "rippleRadius") {
            controlPreviewActive = true;
            pointer.active = true;
            pointer.targetX = 0.5;
            pointer.targetY = 0.5;
            pointer.renderedX = 0.5;
            pointer.renderedY = 0.5;
            controlPreviewTimer = window.setTimeout(() => {
                controlPreviewActive = false;
                if (!pointerInsideName) {
                    pointer.active = false;
                }
                wakeAnimation();
            }, 900);
        } else if (settingName === "splashStrength") {
            splashX = 0.5;
            splashY = 0.5;
            splashStart = performance.now() * 0.001;
        }
        wakeAnimation();
    };

    const renderFrame = (time, deltaMs = 16.67) => {
        if (contextLost || !isVisible || !maskReady || !canvasWidth || !canvasHeight) {
            return;
        }
        const now = time * 0.001;
        const pointerEase = reducedMotionQuery.matches
            ? 1
            : frameRateIndependent(0.24, deltaMs);
        pointer.renderedX += (pointer.targetX - pointer.renderedX) * pointerEase;
        pointer.renderedY += (pointer.targetY - pointer.renderedY) * pointerEase;
        const parallaxEase = reducedMotionQuery.matches
            ? 1
            : frameRateIndependent(pointerInsideName ? 0.08 : 0.055, deltaMs);
        if (reducedMotionQuery.matches) {
            parallax.targetX = 0;
            parallax.targetY = 0;
        }
        parallax.renderedX += (parallax.targetX - parallax.renderedX) * parallaxEase;
        parallax.renderedY += (parallax.targetY - parallax.renderedY) * parallaxEase;
        const motionTime = reducedMotionQuery.matches ? 0 : now * settings.wobbleSpeed;
        const splashAge = reducedMotionQuery.matches ? 10 : Math.max(0, now - splashStart);
        const tint = hexToRgb(settings.chromeTint);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sdfTexture);
        gl.uniform1i(uniforms.uSdf, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, environmentTexture);
        gl.uniform1i(uniforms.uEnvironmentTexture, 1);
        gl.uniform2f(uniforms.uSdfTexel, 1 / canvasWidth, 1 / canvasHeight);
        gl.uniform2f(uniforms.uResolution, canvasWidth, canvasHeight);
        gl.uniform2f(uniforms.uPointer, pointer.renderedX, pointer.renderedY);
        gl.uniform2f(uniforms.uParallax, parallax.renderedX, parallax.renderedY);
        gl.uniform2f(uniforms.uSplashCenter, splashX, splashY);
        gl.uniform3f(uniforms.uChromeTint, tint[0], tint[1], tint[2]);
        gl.uniform1f(uniforms.uSdfSpread, sdfSpread);
        gl.uniform1f(uniforms.uTime, motionTime);
        gl.uniform1f(uniforms.uWobbleAmount, settings.wobbleAmount);
        gl.uniform1f(uniforms.uRippleStrength, settings.rippleStrength);
        gl.uniform1f(uniforms.uRippleRadius, settings.rippleRadius);
        gl.uniform1f(uniforms.uPointerActive, pointer.active ? 1 : 0);
        gl.uniform1f(uniforms.uSplashAge, splashAge);
        gl.uniform1f(uniforms.uSplashStrength, settings.splashStrength);
        gl.uniform1f(uniforms.uExtrudeDepth, settings.extrudeDepth);
        gl.uniform1f(uniforms.uEnvIntensity, settings.envIntensity);
        gl.uniform1f(uniforms.uUseEnvironmentTexture, useEnvironmentTexture ? 1 : 0);
        gl.uniform1f(
            uniforms.uDarkMode,
            document.body.classList.contains("dark-mode") ? 1 : 0
        );
        gl.uniform1i(uniforms.uEnvironmentPreset, settings.environment);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        isDirty = false;
        if (!hasRendered) {
            hasRendered = true;
            shell.classList.add("is-liquid-ready");
        }
    };

    const needsAnimation = () => {
        if (contextLost || !isVisible || !maskReady) {
            return false;
        }
        return reducedMotionQuery.matches ? isDirty : true;
    };

    const releaseEnvironmentObjectUrl = (objectUrl) => {
        if (!objectUrl) {
            return;
        }
        URL.revokeObjectURL(objectUrl);
        if (environmentObjectUrl === objectUrl) {
            environmentObjectUrl = "";
        }
    };

    const setUploadStatus = (message) => {
        const status = customizer?.querySelector("#liquidUploadStatus");
        if (status) status.textContent = message;
    };

    const releaseCustomEnvironmentTexture = () => {
        if (!useEnvironmentTexture || contextLost) return;
        const placeholder = gl.createTexture();
        if (!placeholder) return;
        gl.bindTexture(gl.TEXTURE_2D, placeholder);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([210, 220, 232, 255])
        );
        const previousTexture = environmentTexture;
        environmentTexture = placeholder;
        gl.deleteTexture(previousTexture);
    };

    const updateEnvironmentImage = (file) => {
        const requestToken = ++environmentLoadToken;
        releaseEnvironmentObjectUrl(environmentObjectUrl);
        if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
            setUploadStatus("Choose a JPG, PNG, or WebP image.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setUploadStatus("Please choose an image smaller than 10 MB.");
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        environmentObjectUrl = objectUrl;
        setUploadStatus("Preparing your reflection…");
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
            if (requestToken !== environmentLoadToken || contextLost) {
                releaseEnvironmentObjectUrl(objectUrl);
                return;
            }
            let candidateTexture = null;
            try {
                const width = image.naturalWidth, height = image.naturalHeight;
                if (!width || !height || width > 8192 || height > 8192 || width * height > 24000000) {
                    throw new Error("Use an image up to 8,192 pixels per side and 24 megapixels.");
                }
                const edge = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
                const scale = Math.min(1, edge / Math.max(width, height));
                const buffer = document.createElement("canvas");
                buffer.width = Math.max(1, Math.round(width * scale));
                buffer.height = Math.max(1, Math.round(height * scale));
                const context = buffer.getContext("2d");
                if (!context) throw new Error("This image could not be prepared.");
                context.drawImage(image, 0, 0, buffer.width, buffer.height);
                for (let attempt = 0; attempt < 8 && gl.getError() !== gl.NO_ERROR; attempt += 1) { /* Clear earlier errors. */ }
                candidateTexture = gl.createTexture();
                if (!candidateTexture) throw new Error("This device has no space for another reflection.");
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, candidateTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
                if (gl.getError() !== gl.NO_ERROR) throw new Error("The reflection could not be loaded by this device.");
                const previousTexture = environmentTexture;
                environmentTexture = candidateTexture;
                candidateTexture = null;
                gl.deleteTexture(previousTexture);
                useEnvironmentTexture = true;
                customizer.querySelector("#liquidEnvironment").value = "custom";
                setUploadStatus("Reflection ready. Your image stays on this device.");
                wakeAnimation();
            } catch (error) {
                setUploadStatus(error.message || "Unable to use that image. Please try another.");
            } finally {
                if (candidateTexture) gl.deleteTexture(candidateTexture);
                releaseEnvironmentObjectUrl(objectUrl);
            }
        };
        image.onerror = () => {
            if (requestToken === environmentLoadToken) setUploadStatus("That image could not be read. Please try another.");
            releaseEnvironmentObjectUrl(objectUrl);
        };
        image.src = objectUrl;
    };

    const createCustomizer = () => {
        const element = document.createElement("div");
        element.className = "liquid-customizer";
        element.id = "liquidCustomizer";
        element.innerHTML = [
            "<button class=\"liquid-customizer__toggle\" id=\"liquidCustomizerToggle\" type=\"button\" aria-expanded=\"false\" aria-controls=\"liquidCustomizerPanel\" aria-label=\"Open Melt Lab controls\"><span class=\"liquid-customizer__mark\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M12 2.8C9.6 6.2 5.8 9.7 5.8 14a6.2 6.2 0 0 0 12.4 0C18.2 9.7 14.4 6.2 12 2.8Z\"/><path d=\"M8.5 14.1c1.2-1.2 2.3 1.2 3.5 0s2.3 1.2 3.5 0\"/></svg></span><span class=\"visually-hidden\">Melt Lab</span></button>",
            "<aside class=\"liquid-customizer__panel\" id=\"liquidCustomizerPanel\" aria-labelledby=\"liquidCustomizerTitle\" aria-hidden=\"true\" inert data-lenis-prevent>",
            "<div class=\"liquid-customizer__header\"><div><p class=\"liquid-customizer__eyebrow\">Live material studio</p><p class=\"liquid-customizer__title\" id=\"liquidCustomizerTitle\">Melt Lab</p></div><button class=\"liquid-customizer__reset\" id=\"liquidReset\" type=\"button\">Reset</button></div>",
            "<p class=\"liquid-customizer__hint\">Bend, ripple, and tint Parv's chrome in real time.</p>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidWobble\">Wobble <output id=\"liquidWobbleValue\">0.30</output></label><input id=\"liquidWobble\" type=\"range\" min=\"0\" max=\"0.65\" step=\"0.01\" value=\"0.30\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidSpeed\">Flow speed <output id=\"liquidSpeedValue\">0.82</output></label><input id=\"liquidSpeed\" type=\"range\" min=\"0.15\" max=\"1.8\" step=\"0.01\" value=\"0.82\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidDepth\">Metal depth <output id=\"liquidDepthValue\">0.52</output></label><input id=\"liquidDepth\" type=\"range\" min=\"0.1\" max=\"1\" step=\"0.01\" value=\"0.52\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidRipple\">Pointer ripple <output id=\"liquidRippleValue\">0.62</output></label><input id=\"liquidRipple\" type=\"range\" min=\"0\" max=\"1.25\" step=\"0.01\" value=\"0.62\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidRippleRadius\">Ripple size <output id=\"liquidRippleRadiusValue\">0.30</output></label><input id=\"liquidRippleRadius\" type=\"range\" min=\"0.12\" max=\"0.55\" step=\"0.01\" value=\"0.30\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidSplash\">Click splash <output id=\"liquidSplashValue\">1.00</output></label><input id=\"liquidSplash\" type=\"range\" min=\"0\" max=\"1.6\" step=\"0.01\" value=\"1\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidTint\">Chrome tint</label><input id=\"liquidTint\" type=\"color\" value=\"#eef2f6\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidEnvironmentIntensity\">Reflection brightness <output id=\"liquidEnvironmentIntensityValue\">1.18</output></label><input id=\"liquidEnvironmentIntensity\" type=\"range\" min=\"0.5\" max=\"2\" step=\"0.01\" value=\"1.18\"></div>",
            "<div class=\"liquid-control\"><label class=\"liquid-control__label\" for=\"liquidEnvironment\">Reflection environment</label><select id=\"liquidEnvironment\"><option value=\"0\">Studio HDR</option><option value=\"1\">Sunset HDR</option><option value=\"2\">Arctic HDR</option><option value=\"custom\">Uploaded panorama</option></select><label class=\"liquid-control__upload\" for=\"liquidEnvironmentUpload\">Use JPG / PNG panorama<input id=\"liquidEnvironmentUpload\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\"></label></div>",
            "<p class=\"liquid-customizer__hint\" id=\"liquidUploadStatus\" role=\"status\" aria-live=\"polite\">JPG, PNG, or WebP · up to 10 MB. Kept on your device.</p>",
            "</aside>"
        ].join("");
        const customizerSlot = document.getElementById("liquidCustomizerSlot");
        const navigation = document.querySelector("nav");
        if (customizerSlot) {
            customizerSlot.appendChild(element);
        } else if (navigation) {
            navigation.insertAdjacentElement("afterend", element);
        } else {
            document.body.appendChild(element);
        }

        const toggle = element.querySelector("#liquidCustomizerToggle");
        const panel = element.querySelector("#liquidCustomizerPanel");
        const reset = element.querySelector("#liquidReset");
        const environmentSelect = element.querySelector("#liquidEnvironment");
        const environmentUpload = element.querySelector("#liquidEnvironmentUpload");
        const tintInput = element.querySelector("#liquidTint");

        const setOpen = (open, returnFocus = false) => {
            element.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute(
                "aria-label",
                open ? "Close Melt Lab controls" : "Open Melt Lab controls"
            );
            panel.setAttribute("aria-hidden", String(!open));
            if (open) {
                panel.removeAttribute("inert");
            } else {
                panel.setAttribute("inert", "");
                if (returnFocus) {
                    toggle.focus();
                }
            }
        };

        const bindRange = (inputId, outputId, settingName) => {
            const input = element.querySelector("#" + inputId);
            const output = element.querySelector("#" + outputId);
            const applyValue = () => {
                settings[settingName] = Number(input.value);
                output.value = Number(input.value).toFixed(2);
                previewControl(settingName);
            };
            input.addEventListener("input", applyValue);
            input.addEventListener("change", applyValue);
            return { input, output };
        };
        const boundRanges = {
            wobbleAmount: bindRange("liquidWobble", "liquidWobbleValue", "wobbleAmount"),
            wobbleSpeed: bindRange("liquidSpeed", "liquidSpeedValue", "wobbleSpeed"),
            extrudeDepth: bindRange("liquidDepth", "liquidDepthValue", "extrudeDepth"),
            rippleStrength: bindRange("liquidRipple", "liquidRippleValue", "rippleStrength"),
            rippleRadius: bindRange("liquidRippleRadius", "liquidRippleRadiusValue", "rippleRadius"),
            splashStrength: bindRange("liquidSplash", "liquidSplashValue", "splashStrength"),
            envIntensity: bindRange(
                "liquidEnvironmentIntensity",
                "liquidEnvironmentIntensityValue",
                "envIntensity"
            )
        };

        toggle.addEventListener("click", () => {
            setOpen(!element.classList.contains("is-open"));
        });
        tintInput.addEventListener("input", () => {
            settings.chromeTint = tintInput.value;
            wakeAnimation();
        });
        tintInput.addEventListener("change", () => {
            settings.chromeTint = tintInput.value;
            wakeAnimation();
        });
        environmentSelect.addEventListener("change", () => {
            if (environmentSelect.value !== "custom") {
                environmentLoadToken += 1;
                releaseEnvironmentObjectUrl(environmentObjectUrl);
                setUploadStatus("JPG, PNG, or WebP · up to 10 MB. Kept on your device.");
                settings.environment = Number(environmentSelect.value);
                releaseCustomEnvironmentTexture();
                useEnvironmentTexture = false;
                wakeAnimation();
            } else if (!useEnvironmentTexture) {
                environmentSelect.value = String(settings.environment);
            }
        });
        environmentUpload.addEventListener("change", () => {
            const file = environmentUpload.files[0];
            if (file) {
                updateEnvironmentImage(file);
                environmentUpload.value = "";
            }
        });
        reset.addEventListener("click", () => {
            window.clearTimeout(controlPreviewTimer);
            controlPreviewActive = false;
            if (!pointerInsideName) {
                pointer.active = false;
            }
            Object.assign(settings, DEFAULTS);
            releaseCustomEnvironmentTexture();
            useEnvironmentTexture = false;
            environmentLoadToken += 1;
            releaseEnvironmentObjectUrl(environmentObjectUrl);
            environmentSelect.value = String(DEFAULTS.environment);
            environmentUpload.value = "";
            setUploadStatus("JPG, PNG, or WebP · up to 10 MB. Kept on your device.");
            tintInput.value = DEFAULTS.chromeTint;
            Object.entries(boundRanges).forEach(([settingName, binding]) => {
                binding.input.value = DEFAULTS[settingName];
                binding.output.value = Number(DEFAULTS[settingName]).toFixed(2);
            });
            wakeAnimation();
        });
        element.addEventListener("pointerenter", () => {
            root.classList.add("liquid-customizer-active");
        });
        element.addEventListener("pointerleave", () => {
            root.classList.remove("liquid-customizer-active");
        });
        document.addEventListener("pointerdown", (event) => {
            if (element.classList.contains("is-open") && !element.contains(event.target)) {
                setOpen(false);
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && element.classList.contains("is-open")) {
                setOpen(false, true);
            }
        });
        return element;
    };

    shell.addEventListener("pointerenter", onPointerEnter);
    shell.addEventListener("pointermove", onPointerMove);
    shell.addEventListener("pointerleave", onPointerLeave);
    shell.addEventListener("pointercancel", onPointerLeave);
    window.bindParvCanvasActivation(shell, onPointerDown);
    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        contextLost = true;
        environmentLoadToken += 1;
        releaseEnvironmentObjectUrl(environmentObjectUrl);
        pointer.active = false;
        parallax.targetX = 0;
        parallax.targetY = 0;
        parallax.renderedX = 0;
        parallax.renderedY = 0;
        root.classList.remove("liquid-name-pointer-active", "liquid-customizer-active");
        shell.classList.remove("is-liquid-ready");
        customizer?.setAttribute("hidden", "");
    });
    canvas.addEventListener("webglcontextrestored", () => {
        const hadCustomEnvironment = useEnvironmentTexture;
        contextLost = false;
        maskReady = false;
        hasRendered = false;
        useEnvironmentTexture = false;
        try {
            initializeGraphicsResources();
            gl.viewport(0, 0, canvasWidth, canvasHeight);
            rebuildSdfTexture();
            const environmentSelect = customizer?.querySelector("#liquidEnvironment");
            if (environmentSelect) environmentSelect.value = String(settings.environment);
            customizer?.removeAttribute("hidden");
            setUploadStatus(hadCustomEnvironment
                ? "The graphics reset restored the studio reflection. You can upload your panorama again."
                : "JPG, PNG, or WebP · up to 10 MB. Kept on your device.");
            wakeAnimation();
        } catch (error) {
            contextLost = true;
            console.error("[liquid-metal] context restore failed", error);
            setUploadStatus("The liquid effect is unavailable, but the rest of the page is still ready.");
        }
    });

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleResize)
        : null;
    const intersectionObserver = typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            isVisible = entries[0]?.isIntersecting ?? true;
            if (!isVisible) {
                pointerInsideName = false;
                pointer.active = false;
                parallax.targetX = 0;
                parallax.targetY = 0;
                parallax.renderedX = 0;
                parallax.renderedY = 0;
                root.classList.remove("liquid-name-pointer-active");
            }
            wakeAnimation();
        }, { threshold: 0.01 })
        : null;
    const themeObserver = new MutationObserver(wakeAnimation);
    const onReducedMotionChange = () => {
        if (reducedMotionQuery.matches) {
            pointerInsideName = false;
            pointer.active = false;
            parallax.targetX = 0;
            parallax.targetY = 0;
            parallax.renderedX = 0;
            parallax.renderedY = 0;
            root.classList.remove("liquid-name-pointer-active");
        }
        wakeAnimation();
    };
    const onVisibilityChange = () => {
        if (document.hidden) onPointerLeave();
    };
    if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", onReducedMotionChange);
    } else {
        reducedMotionQuery.addListener(onReducedMotionChange);
    }
    resizeObserver?.observe(shell);
    intersectionObserver?.observe(shell);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });

    window.parvLiquidNameController = {
        renderFrame,
        needsAnimation,
        getSettings: () => ({ ...settings })
    };
    resizeCanvas();
    customizer = createCustomizer();
    if (document.fonts?.ready) {
        document.fonts.ready.then(rebuildSdfTexture);
    }
})();
