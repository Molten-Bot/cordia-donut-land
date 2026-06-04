// Google Analytics default capture for this static app.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "city-hole-state";
export const maxLevel = 10;
export const itemsPerLevel = 5;
export const itemsSpawnedPerLevel = 6;
export const startHoleRadius = 10;
export const maxHoleRadius = 38;
export const maxRunItems = maxLevel * itemsPerLevel;
export const growthPerItem = (maxHoleRadius - startHoleRadius) / maxRunItems;
export const minItemRadius = 7;
export const maxItemRadius = maxHoleRadius - 2;
export const gameplayLaneY = 0.58;
export const playableMinX = 0.04;
export const playableMaxX = 0.96;
export const playableMinY = 0.14;
export const playableMaxY = 0.92;
export const levels = Array.from({ length: maxLevel }, (_, index) => {
    const id = index + 1;
    const minRadius = getProgressionItemRadius(index * itemsPerLevel);
    return {
        id,
        minRadius,
        maxRadius: Math.min(getProgressionItemRadius((index + 1) * itemsPerLevel), maxHoleRadius),
    };
});
const itemKinds = [
    "trash",
    "shoe",
    "can",
    "pet",
    "bin",
    "bench",
    "cart",
    "car",
    "store",
    "house",
    "tower",
];
const palette = ["#e04f39", "#f6d83f", "#2f9a88", "#5a78d6", "#8d58a8", "#3f4248", "#f6efe4"];
const shadow = "rgba(24,42,38,0.22)";
export function createDefaultState() {
    return {
        release: "0",
        level: 1,
        eaten: 0,
        totalEaten: 0,
        totalGrowth: 0,
        bestScore: 0,
        muted: false,
    };
}
function cleanCount(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
function clampLevel(value) {
    if (typeof value !== "number" || !Number.isInteger(value))
        return 1;
    return Math.min(Math.max(value, 1), maxLevel);
}
export function getLevel(state) {
    return levels[state.level - 1] ?? levels[0];
}
export function getProgressionItemRadius(itemIndex) {
    const clampedIndex = Math.min(Math.max(Math.floor(itemIndex), 0), maxRunItems - 1);
    const progress = clampedIndex / (maxRunItems - 1);
    return minItemRadius + (maxItemRadius - minItemRadius) * progress ** 3;
}
export function getGrowthWeightForItemRadius(itemRadius) {
    const clampedRadius = Math.min(Math.max(itemRadius, minItemRadius), maxItemRadius);
    const sizeProgress = (clampedRadius - minItemRadius) / (maxItemRadius - minItemRadius);
    return 0.22 + sizeProgress ** 0.7 * 4.8;
}
const progressionGrowthWeightTotal = Array.from({ length: maxRunItems }, (_, index) => getGrowthWeightForItemRadius(getProgressionItemRadius(index))).reduce((total, weight) => total + weight, 0);
export function getGrowthForItemRadius(itemRadius) {
    return ((maxHoleRadius - startHoleRadius) * getGrowthWeightForItemRadius(itemRadius)) / progressionGrowthWeightTotal;
}
export function deriveGrowthFromEatenCount(totalEaten) {
    const count = Math.min(cleanCount(totalEaten), maxRunItems);
    let totalGrowth = 0;
    for (let index = 0; index < count; index += 1) {
        totalGrowth += getGrowthForItemRadius(getProgressionItemRadius(index));
    }
    return Math.min(totalGrowth, maxHoleRadius - startHoleRadius);
}
export function getHoleRadius(state) {
    const totalGrowth = typeof state.totalGrowth === "number" && Number.isFinite(state.totalGrowth)
        ? Math.max(state.totalGrowth, 0)
        : deriveGrowthFromEatenCount(state.totalEaten);
    return Math.min(startHoleRadius + totalGrowth, maxHoleRadius);
}
export function parseStoredState(storedState, defaultState) {
    if (!storedState)
        return defaultState;
    try {
        const parsed = JSON.parse(storedState);
        const totalEaten = cleanCount(parsed.totalEaten);
        const levelFromTotal = Math.min(Math.floor(totalEaten / itemsPerLevel) + 1, maxLevel);
        const level = Math.max(clampLevel(parsed.level), levelFromTotal);
        const totalGrowth = typeof parsed.totalGrowth === "number" && Number.isFinite(parsed.totalGrowth)
            ? Math.min(Math.max(parsed.totalGrowth, 0), maxHoleRadius - startHoleRadius)
            : deriveGrowthFromEatenCount(totalEaten);
        return {
            release: "0",
            level,
            eaten: Math.min(cleanCount(parsed.eaten), itemsPerLevel - 1),
            totalEaten,
            totalGrowth,
            bestScore: cleanCount(parsed.bestScore),
            muted: typeof parsed.muted === "boolean" ? parsed.muted : defaultState.muted,
        };
    }
    catch {
        return defaultState;
    }
}
export function collectItem(state, itemRadius = getProgressionItemRadius(state.totalEaten)) {
    const totalEaten = state.totalEaten + 1;
    const level = Math.min(Math.floor(totalEaten / itemsPerLevel) + 1, maxLevel);
    const currentGrowth = typeof state.totalGrowth === "number" && Number.isFinite(state.totalGrowth)
        ? Math.max(state.totalGrowth, 0)
        : deriveGrowthFromEatenCount(state.totalEaten);
    const totalGrowth = Math.min(currentGrowth + getGrowthForItemRadius(itemRadius), maxHoleRadius - startHoleRadius);
    return {
        ...state,
        level,
        eaten: totalEaten % itemsPerLevel,
        totalEaten,
        totalGrowth,
        bestScore: Math.max(state.bestScore, totalEaten),
    };
}
export function canSwallowItem(itemRadius, holeRadius, distance) {
    if (itemRadius > holeRadius)
        return false;
    return distance <= holeRadius + itemRadius * 0.5;
}
export function canAdvance(state) {
    const reachedBatch = state.totalEaten > 0 && state.totalEaten % itemsPerLevel === 0;
    return state.level < maxLevel && (state.eaten >= itemsPerLevel || reachedBatch);
}
export function advanceLevel(state) {
    if (!canAdvance(state))
        return state;
    return {
        ...state,
        level: Math.min(state.level + 1, maxLevel),
        eaten: 0,
    };
}
export function resetRun(state) {
    return {
        ...createDefaultState(),
        bestScore: state.bestScore,
        muted: state.muted,
    };
}
function initializeGoogleAnalytics() {
    const googleTagScript = document.createElement("script");
    googleTagScript.async = true;
    googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
    document.head.append(googleTagScript);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", googleAnalyticsId);
}
function getElement(selector, type) {
    const element = document.querySelector(selector);
    if (!(element instanceof type)) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
function getKindForRadius(radius) {
    if (radius < 11)
        return "trash";
    if (radius < 15)
        return "shoe";
    if (radius < 19)
        return "pet";
    if (radius < 24)
        return "can";
    if (radius < 31)
        return "bin";
    if (radius < 40)
        return "bench";
    if (radius < 51)
        return "cart";
    if (radius < 63)
        return "car";
    if (radius < 75)
        return "store";
    if (radius < 90)
        return "house";
    return "tower";
}
function makeItem(id, x, y, radius) {
    const kind = getKindForRadius(radius);
    const isBuilding = kind === "store" || kind === "house" || kind === "tower";
    const maxDimension = radius * 2;
    return {
        id,
        kind,
        x,
        y,
        radius,
        width: Math.min(isBuilding ? radius * 1.25 : radius * 1.75, maxDimension),
        height: Math.min(isBuilding ? radius * 1.8 : radius * 1.35, maxDimension),
        color: palette[id % palette.length],
        eaten: false,
    };
}
function seededUnit(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}
export function createCityItems() {
    const items = [];
    let simulatedState = createDefaultState();
    let id = 0;
    for (let levelIndex = 0; levelIndex < maxLevel; levelIndex += 1) {
        const level = levels[levelIndex];
        let holeAfterRequiredItems = getHoleRadius(simulatedState);
        for (let offset = 0; offset < itemsSpawnedPerLevel; offset += 1) {
            const itemProgress = levelIndex * itemsPerLevel + Math.min(offset, itemsPerLevel - 1) / 1.25;
            const graduatedRadius = getProgressionItemRadius(itemProgress) + offset * 0.22;
            const availableHoleRadius = offset < itemsPerLevel ? getHoleRadius(simulatedState) : holeAfterRequiredItems;
            const radius = Math.min(Math.max(minItemRadius, graduatedRadius), availableHoleRadius, level.maxRadius, maxItemRadius);
            const xBand = ((levelIndex * 4 + offset * 3) % 12) / 12;
            const yBand = ((levelIndex * 5 + offset * 7) % 12) / 12;
            const x = playableMinX +
                (xBand + seededUnit(id + 1) * 0.08) * (playableMaxX - playableMinX);
            const y = playableMinY +
                (yBand + seededUnit(id + 91) * 0.1) * (playableMaxY - playableMinY);
            items.push(makeItem(id, Math.min(playableMaxX, x), Math.min(playableMaxY, y), radius));
            id += 1;
            if (offset < itemsPerLevel) {
                simulatedState = collectItem(simulatedState, radius);
                holeAfterRequiredItems = getHoleRadius(simulatedState);
            }
        }
    }
    return items;
}
function drawIsoDiamond(ctx, x, y, width, height, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - height / 2);
    ctx.lineTo(x + width / 2, y);
    ctx.lineTo(x, y + height / 2);
    ctx.lineTo(x - width / 2, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
function drawIsoBlock(ctx, x, y, width, depth, height, color) {
    const top = y - height;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    ctx.beginPath();
    ctx.moveTo(x, top - halfDepth);
    ctx.lineTo(x + halfWidth, top);
    ctx.lineTo(x, top + halfDepth);
    ctx.lineTo(x - halfWidth, top);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + halfWidth, top);
    ctx.lineTo(x + halfWidth, y);
    ctx.lineTo(x, y + halfDepth);
    ctx.lineTo(x, top + halfDepth);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - halfWidth, top);
    ctx.lineTo(x, top + halfDepth);
    ctx.lineTo(x, y + halfDepth);
    ctx.lineTo(x - halfWidth, y);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
}
function drawCityStage(ctx, width, height) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#27d27f");
    sky.addColorStop(0.58, "#30f198");
    sky.addColorStop(1, "#20d979");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const horizon = height * 0.36;
    ctx.fillStyle = "rgba(25,133,99,0.12)";
    ctx.fillRect(0, horizon, width, height * 0.2);
    for (let i = -2; i < 18; i += 1) {
        const x = ((i * 124) % (width + 220)) - 90;
        const blockHeight = height * (0.08 + ((i + 5) % 4) * 0.025);
        drawIsoBlock(ctx, x, horizon + height * 0.1, 54, 30, blockHeight, ["#5667b8", "#e65f59", "#f6c64f", "#4fb8a7"][Math.abs(i) % 4]);
    }
    const laneY = height * gameplayLaneY;
    const landTop = height * playableMinY;
    const landBottom = height * playableMaxY;
    for (let row = 0; row < 4; row += 1) {
        for (let col = -3; col < 8; col += 1) {
            const x = ((col * 164 + row * 58) % (width + 260)) - 130;
            const y = laneY - 104 + row * 58;
            drawIsoDiamond(ctx, x, y, 116, 48, row % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(16,137,90,0.14)");
        }
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let row = 0; row < 5; row += 1) {
        const y = landTop + ((landBottom - landTop) / 4) * row;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(width * 0.5, y - 42, width, y + 6);
        ctx.strokeStyle = row === 2 ? "rgba(9,104,77,0.28)" : "rgba(9,104,77,0.14)";
        ctx.lineWidth = row === 2 ? 3 : 2;
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(9,104,77,0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, laneY + 8);
    ctx.quadraticCurveTo(width * 0.5, laneY - 68, width, laneY + 12);
    ctx.stroke();
    for (let i = -2; i < 15; i += 1) {
        const x = ((i * 132) % (width + 180)) - 90;
        const y = laneY + 58 + ((i % 3) * 22);
        ctx.fillStyle = i % 2 === 0 ? "#10b56a" : "#13c675";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 16, y - 54);
        ctx.lineTo(x + 25, y);
        ctx.closePath();
        ctx.fill();
    }
}
function itemScreenBox(item, width, height) {
    const x = item.x * width;
    const y = item.y * height;
    return {
        x,
        y,
        left: x - item.width / 2,
        top: y - item.height,
        right: x + item.width / 2,
        bottom: y,
    };
}
function drawItem(ctx, item, width, height) {
    const box = itemScreenBox(item, width, height);
    if (box.right < -80 || box.left > ctx.canvas.width + 80 || item.eaten)
        return;
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    if (item.kind === "store" || item.kind === "house" || item.kind === "tower") {
        drawIsoBlock(ctx, 0, 0, item.width * 1.18, item.width * 0.72, item.height, item.color);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff2a8";
        const rows = Math.max(1, Math.floor(item.height / 28));
        for (let row = 0; row < rows; row += 1) {
            for (let col = -1; col <= 1; col += 1) {
                ctx.fillRect(col * item.width * 0.18 - 4, -item.height + 10 + row * 24, 8, 8);
            }
        }
    }
    else if (item.kind === "pet") {
        ctx.fillStyle = "#887b76";
        ctx.beginPath();
        ctx.ellipse(-item.radius * 0.12, -item.radius * 0.62, item.radius, item.radius * 0.62, -0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3b3839";
        for (let band = 0; band < 4; band += 1) {
            ctx.fillRect(-item.radius * 0.88 + band * item.radius * 0.36, -item.radius * 1.08, item.radius * 0.18, item.radius * 0.86);
        }
        ctx.fillStyle = "#d8d2c7";
        ctx.beginPath();
        ctx.arc(item.radius * 0.66, -item.radius * 0.96, item.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2c292b";
        ctx.fillRect(item.radius * 0.36, -item.radius * 1.05, item.radius * 0.54, item.radius * 0.18);
        ctx.fillRect(item.radius * 0.52, -item.radius * 0.88, item.radius * 0.16, item.radius * 0.12);
    }
    else if (item.kind === "shoe") {
        ctx.fillStyle = "#f278c7";
        ctx.beginPath();
        ctx.roundRect(-item.width / 2, -item.height * 0.62, item.width, item.height * 0.48, 9);
        ctx.fill();
        ctx.fillStyle = "#eec75b";
        ctx.fillRect(-item.width * 0.38, -item.height * 0.34, item.width * 0.7, item.height * 0.18);
    }
    else if (item.kind === "trash" || item.kind === "can") {
        ctx.rotate((item.id % 5) * 0.14 - 0.28);
        ctx.fillStyle = item.kind === "can" ? "#d9dde2" : "#f1c95e";
        ctx.beginPath();
        ctx.roundRect(-item.width / 2, -item.height, item.width, item.height, 5);
        ctx.fill();
        ctx.fillStyle = item.kind === "can" ? "#7a8796" : "#e64e94";
        ctx.fillRect(-item.width * 0.38, -item.height * 0.68, item.width * 0.76, item.height * 0.18);
    }
    else {
        drawIsoDiamond(ctx, 0, -item.height * 0.4, item.width, item.height, item.color);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.roundRect(-item.width * 0.28, -item.height * 0.58, item.width * 0.56, item.height * 0.22, 4);
        ctx.fill();
    }
    ctx.restore();
}
function drawHole(ctx, hole) {
    const radius = Math.min(Math.max(hole.radius, startHoleRadius), maxHoleRadius);
    const gradient = ctx.createRadialGradient(hole.x - radius * 0.22, hole.y - radius * 0.26, radius * 0.18, hole.x, hole.y, radius);
    gradient.addColorStop(0, "#364046");
    gradient.addColorStop(0.58, "#070808");
    gradient.addColorStop(1, "#000000");
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + radius * 0.08, radius * 1.26, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,84,60,0.32)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y, radius * 1.14, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(38,220,144,0.36)";
    ctx.lineWidth = Math.max(3, radius * 0.08);
    ctx.stroke();
    ctx.restore();
}
function initializeGame() {
    initializeGoogleAnalytics();
    const canvas = getElement("#game", HTMLCanvasElement);
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("Canvas context unavailable.");
    const context = ctx;
    const defaultState = createDefaultState();
    let state = parseStoredState(localStorage.getItem(storageKey), defaultState);
    let items = createCityItems();
    const keys = new Set();
    const pointer = { active: false, x: 0, y: 0 };
    const hole = {
        x: Math.max(120, window.innerWidth * 0.5),
        y: 0,
        radius: getHoleRadius(state),
        speed: 160,
    };
    let lastTime = performance.now();
    function saveState() {
        localStorage.setItem(storageKey, JSON.stringify(state));
    }
    function resize() {
        const scale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(window.innerWidth * scale);
        canvas.height = Math.floor(window.innerHeight * scale);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        if (hole.y === 0)
            hole.y = window.innerHeight * gameplayLaneY;
        hole.x = Math.max(window.innerWidth * playableMinX, Math.min(window.innerWidth * playableMaxX, hole.x));
        hole.y = Math.max(window.innerHeight * playableMinY, Math.min(window.innerHeight * playableMaxY, hole.y));
    }
    function resetWorldIfComplete() {
        if (state.level < maxLevel || state.totalEaten < maxLevel * itemsPerLevel)
            return;
        const allVisibleItemsEaten = items.every((item) => item.eaten);
        if (!allVisibleItemsEaten)
            return;
        state = resetRun(state);
        items = createCityItems();
        hole.x = window.innerWidth * 0.5;
        hole.y = window.innerHeight * gameplayLaneY;
        saveState();
    }
    function eatCollisions() {
        for (const item of items) {
            if (item.eaten)
                continue;
            const box = itemScreenBox(item, window.innerWidth, window.innerHeight);
            if (box.right < hole.x - hole.radius || box.left > hole.x + hole.radius)
                continue;
            const dx = box.x - hole.x;
            const dy = box.y - hole.y;
            const distance = Math.hypot(dx, dy);
            if (canSwallowItem(item.radius, hole.radius, distance)) {
                item.eaten = true;
                state = collectItem(state, item.radius);
                hole.radius = getHoleRadius(state);
                saveState();
            }
        }
    }
    function update(delta) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        let movementX = 0;
        let movementY = 0;
        if (keys.has("ArrowRight"))
            movementX += 1;
        if (keys.has("ArrowLeft"))
            movementX -= 1;
        if (keys.has("ArrowDown"))
            movementY += 1;
        if (keys.has("ArrowUp"))
            movementY -= 1;
        if (pointer.active) {
            movementX += Math.max(-1, Math.min(1, (pointer.x - hole.x) / 80));
            movementY += Math.max(-1, Math.min(1, (pointer.y - hole.y) / 80));
        }
        const diagonalScale = movementX !== 0 && movementY !== 0 ? Math.SQRT1_2 : 1;
        hole.x += movementX * hole.speed * 1.65 * diagonalScale * delta;
        hole.y += movementY * hole.speed * 1.65 * diagonalScale * delta;
        hole.x = Math.max(width * playableMinX, Math.min(width * playableMaxX, hole.x));
        hole.y = Math.max(height * playableMinY, Math.min(height * playableMaxY, hole.y));
        eatCollisions();
        resetWorldIfComplete();
    }
    function render() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        context.clearRect(0, 0, width, height);
        drawCityStage(context, width, height);
        for (const item of items)
            drawItem(context, item, width, height);
        drawHole(context, hole);
    }
    function frame(now) {
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        update(delta);
        render();
        window.requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            keys.add(event.key);
        }
    });
    window.addEventListener("keyup", (event) => {
        keys.delete(event.key);
    });
    canvas.addEventListener("pointerdown", (event) => {
        pointer.active = true;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!pointer.active)
            return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    });
    canvas.addEventListener("pointerup", () => {
        pointer.active = false;
    });
    canvas.addEventListener("pointercancel", () => {
        pointer.active = false;
    });
    document.title = "";
    resize();
    canvas.focus({ preventScroll: true });
    window.requestAnimationFrame(frame);
}
if (typeof document !== "undefined") {
    initializeGame();
}
