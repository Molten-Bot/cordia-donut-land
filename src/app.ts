// Google Analytics default capture for this static app.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "city-hole-state";

export const maxLevel = 10;
export const itemsPerLevel = 5;
export const startHoleRadius = 20;
export const growthPerItem = 4;
export const gameplayLaneY = 0.74;

export type CityItemKind =
  | "trash"
  | "shoe"
  | "can"
  | "pet"
  | "bin"
  | "bench"
  | "cart"
  | "car"
  | "store"
  | "house"
  | "tower";

export interface Level {
  id: number;
  minRadius: number;
  maxRadius: number;
}

export interface GameState {
  release: "0";
  level: number;
  eaten: number;
  totalEaten: number;
  bestScore: number;
  muted: boolean;
}

interface CityItem {
  id: number;
  kind: CityItemKind;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  color: string;
  eaten: boolean;
}

interface Hole {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface PointerState {
  active: boolean;
  x: number;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const levels: Level[] = Array.from({ length: maxLevel }, (_, index) => {
  const id = index + 1;
  const minRadius = startHoleRadius + index * itemsPerLevel * growthPerItem;
  return {
    id,
    minRadius,
    maxRadius: minRadius + itemsPerLevel * growthPerItem,
  };
});

const itemKinds: CityItemKind[] = [
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

export function createDefaultState(): GameState {
  return {
    release: "0",
    level: 1,
    eaten: 0,
    totalEaten: 0,
    bestScore: 0,
    muted: false,
  };
}

function cleanCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function clampLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 1;
  return Math.min(Math.max(value, 1), maxLevel);
}

export function getLevel(state: GameState): Level {
  return levels[state.level - 1] ?? levels[0]!;
}

export function getHoleRadius(state: GameState): number {
  return startHoleRadius + state.totalEaten * growthPerItem;
}

export function parseStoredState(storedState: string | null, defaultState: GameState): GameState {
  if (!storedState) return defaultState;

  try {
    const parsed = JSON.parse(storedState) as Record<string, unknown>;
    const totalEaten = cleanCount(parsed.totalEaten);
    const levelFromTotal = Math.min(Math.floor(totalEaten / itemsPerLevel) + 1, maxLevel);
    const level = Math.max(clampLevel(parsed.level), levelFromTotal);

    return {
      release: "0",
      level,
      eaten: Math.min(cleanCount(parsed.eaten), itemsPerLevel - 1),
      totalEaten,
      bestScore: cleanCount(parsed.bestScore),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : defaultState.muted,
    };
  } catch {
    return defaultState;
  }
}

export function collectItem(state: GameState): GameState {
  const totalEaten = state.totalEaten + 1;
  const level = Math.min(Math.floor(totalEaten / itemsPerLevel) + 1, maxLevel);
  return {
    ...state,
    level,
    eaten: totalEaten % itemsPerLevel,
    totalEaten,
    bestScore: Math.max(state.bestScore, totalEaten),
  };
}

export function canSwallowItem(itemRadius: number, holeRadius: number, distance: number): boolean {
  if (itemRadius > holeRadius) return false;
  return distance <= holeRadius + itemRadius * 0.5;
}

export function canAdvance(state: GameState): boolean {
  const reachedBatch = state.totalEaten > 0 && state.totalEaten % itemsPerLevel === 0;
  return state.level < maxLevel && (state.eaten >= itemsPerLevel || reachedBatch);
}

export function advanceLevel(state: GameState): GameState {
  if (!canAdvance(state)) return state;
  return {
    ...state,
    level: Math.min(state.level + 1, maxLevel),
    eaten: 0,
  };
}

export function resetRun(state: GameState): GameState {
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

function getElement<T extends Element>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function getKindForRadius(radius: number): CityItemKind {
  if (radius < 11) return "trash";
  if (radius < 15) return "shoe";
  if (radius < 19) return "pet";
  if (radius < 24) return "can";
  if (radius < 31) return "bin";
  if (radius < 40) return "bench";
  if (radius < 51) return "cart";
  if (radius < 63) return "car";
  if (radius < 75) return "store";
  if (radius < 90) return "house";
  return "tower";
}

function makeItem(id: number, x: number, y: number, radius: number): CityItem {
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
    color: palette[id % palette.length]!,
    eaten: false,
  };
}

export function createCityItems(): CityItem[] {
  const items: CityItem[] = [];
  const maxHoleRadius = levels[levels.length - 1]!.maxRadius;
  let id = 0;

  for (let levelIndex = 0; levelIndex < maxLevel; levelIndex += 1) {
    const level = levels[levelIndex]!;
    const sectionStart = 260 + levelIndex * 720;

    for (let offset = 0; offset < 9; offset += 1) {
      const graduatedRadius = level.minRadius * 0.42 + offset * 2.6 + levelIndex * 1.8;
      const radius = Math.min(Math.max(7, graduatedRadius), level.maxRadius - 2, maxHoleRadius);
      const lane = offset % 3;
      items.push(
        makeItem(
          id,
          sectionStart + offset * 74 + (lane === 1 ? 18 : 0),
          gameplayLaneY,
          radius,
        ),
      );
      id += 1;
    }
  }

  return items;
}

function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawIsoBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  color: string,
) {
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

function drawCityStage(ctx: CanvasRenderingContext2D, width: number, height: number, cameraX: number) {
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
    const x = ((i * 124 - cameraX * 0.12) % (width + 220)) - 90;
    const blockHeight = height * (0.08 + ((i + 5) % 4) * 0.025);
    drawIsoBlock(ctx, x, horizon + height * 0.1, 54, 30, blockHeight, ["#5667b8", "#e65f59", "#f6c64f", "#4fb8a7"][Math.abs(i) % 4]!);
  }

  const laneY = height * gameplayLaneY;
  ctx.save();
  ctx.translate(width / 2, laneY + height * 0.03);
  ctx.scale(1, 0.46);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(width, height) * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#16bd6f";
  ctx.fill();
  ctx.restore();

  for (let row = 0; row < 4; row += 1) {
    for (let col = -3; col < 8; col += 1) {
      const x = ((col * 164 + row * 58 - cameraX * 0.42) % (width + 260)) - 130;
      const y = laneY - 104 + row * 58;
      drawIsoDiamond(ctx, x, y, 116, 48, row % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(16,137,90,0.14)");
    }
  }

  ctx.strokeStyle = "rgba(9,104,77,0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, laneY + 8);
  ctx.quadraticCurveTo(width * 0.5, laneY - 68, width, laneY + 12);
  ctx.stroke();

  for (let i = -2; i < 15; i += 1) {
    const x = ((i * 132 - cameraX * 0.3) % (width + 180)) - 90;
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

function itemScreenBox(item: CityItem, cameraX: number, height: number) {
  const x = item.x - cameraX;
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

function drawItem(ctx: CanvasRenderingContext2D, item: CityItem, cameraX: number, height: number) {
  const box = itemScreenBox(item, cameraX, height);
  if (box.right < -80 || box.left > ctx.canvas.width + 80 || item.eaten) return;

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
  } else if (item.kind === "pet") {
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
  } else if (item.kind === "shoe") {
    ctx.fillStyle = "#f278c7";
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height * 0.62, item.width, item.height * 0.48, 9);
    ctx.fill();
    ctx.fillStyle = "#eec75b";
    ctx.fillRect(-item.width * 0.38, -item.height * 0.34, item.width * 0.7, item.height * 0.18);
  } else if (item.kind === "trash" || item.kind === "can") {
    ctx.rotate((item.id % 5) * 0.14 - 0.28);
    ctx.fillStyle = item.kind === "can" ? "#d9dde2" : "#f1c95e";
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height, item.width, item.height, 5);
    ctx.fill();
    ctx.fillStyle = item.kind === "can" ? "#7a8796" : "#e64e94";
    ctx.fillRect(-item.width * 0.38, -item.height * 0.68, item.width * 0.76, item.height * 0.18);
  } else {
    drawIsoDiamond(ctx, 0, -item.height * 0.4, item.width, item.height, item.color);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(-item.width * 0.28, -item.height * 0.58, item.width * 0.56, item.height * 0.22, 4);
    ctx.fill();
  }

  ctx.restore();
}

function drawHole(ctx: CanvasRenderingContext2D, hole: Hole) {
  const radius = Math.max(hole.radius, 38);
  const gradient = ctx.createRadialGradient(
    hole.x - radius * 0.22,
    hole.y - radius * 0.26,
    radius * 0.18,
    hole.x,
    hole.y,
    radius,
  );
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

function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = "#f4f6f1";
  ctx.beginPath();
  ctx.roundRect(-18, -82, 56, 46, 6);
  ctx.fill();
  ctx.fillStyle = "#343536";
  ctx.fillRect(26, -76, 16, 42);
  ctx.fillRect(-24, -50, 20, 38);
  ctx.fillStyle = "#7f553e";
  ctx.beginPath();
  ctx.arc(-26, -8, 8, 0, Math.PI * 2);
  ctx.arc(42, -24, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#383334";
  ctx.beginPath();
  ctx.arc(0, -104, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f2022";
  ctx.beginPath();
  ctx.moveTo(-30, -116);
  ctx.lineTo(8, -132);
  ctx.lineTo(34, -104);
  ctx.lineTo(0, -96);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ee5aa6";
  ctx.fillRect(4, -58, 8, 18);
  ctx.fillStyle = "#2f3031";
  ctx.fillRect(32, -34, 22, 70);
  ctx.fillRect(62, -30, 22, 66);
  ctx.fillStyle = "#d8dad6";
  ctx.beginPath();
  ctx.roundRect(48, 28, 34, 16, 8);
  ctx.roundRect(78, 26, 34, 16, 8);
  ctx.fill();

  ctx.restore();
}

function drawMascot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 7;

  ctx.fillStyle = "#8c807b";
  ctx.beginPath();
  ctx.ellipse(0, -34, 34, 48, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d383a";
  ctx.beginPath();
  ctx.roundRect(22, -88, 20, 70, 10);
  ctx.fill();
  ctx.fillStyle = "#817774";
  for (let band = 0; band < 3; band += 1) {
    ctx.fillRect(24, -78 + band * 18, 16, 9);
  }
  ctx.fillStyle = "#d8d1c9";
  ctx.beginPath();
  ctx.arc(36, -48, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#282426";
  ctx.fillRect(20, -54, 32, 12);
  ctx.beginPath();
  ctx.arc(44, -44, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#29262a";
  ctx.beginPath();
  ctx.moveTo(18, -68);
  ctx.lineTo(28, -86);
  ctx.lineTo(35, -64);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSceneCharacters(ctx: CanvasRenderingContext2D, width: number, height: number, hole: Hole) {
  const scale = Math.max(0.58, Math.min(1.15, width / 1180));
  drawMascot(ctx, hole.x - hole.radius * 1.9, hole.y - hole.radius * 0.18, scale);
  drawCharacter(ctx, hole.x + hole.radius * 1.95, hole.y + hole.radius * 0.1, scale);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, width: number) {
  const pipSize = Math.max(8, Math.min(15, width / 62));
  const gap = pipSize * 0.65;
  const levelWidth = maxLevel * (pipSize + gap) - gap;
  let x = (width - levelWidth) / 2;

  for (let i = 0; i < maxLevel; i += 1) {
    ctx.beginPath();
    ctx.arc(x + pipSize / 2, 22, pipSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = i < state.level ? "#f2b134" : "rgba(255,255,255,0.42)";
    ctx.fill();
    x += pipSize + gap;
  }

  const biteWidth = itemsPerLevel * (pipSize + gap) - gap;
  x = (width - biteWidth) / 2;
  for (let i = 0; i < itemsPerLevel; i += 1) {
    ctx.beginPath();
    ctx.rect(x, 42, pipSize, pipSize);
    ctx.fillStyle = i < state.eaten ? "#e04f39" : "rgba(255,255,255,0.36)";
    ctx.fill();
    x += pipSize + gap;
  }
}

function initializeGame() {
  initializeGoogleAnalytics();

  const canvas = getElement("#game", HTMLCanvasElement);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  const context = ctx;

  const defaultState = createDefaultState();
  let state = parseStoredState(localStorage.getItem(storageKey), defaultState);
  let items = createCityItems();
  const keys = new Set<string>();
  const pointer: PointerState = { active: false, x: 0 };
  const hole: Hole = {
    x: Math.max(120, window.innerWidth * 0.5),
    y: 0,
    radius: getHoleRadius(state),
    speed: 160,
  };
  let cameraX = 0;
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
    hole.y = window.innerHeight * gameplayLaneY;
    hole.x = Math.max(window.innerWidth * 0.22, Math.min(window.innerWidth * 0.78, hole.x));
  }

  function resetWorldIfComplete() {
    if (state.level < maxLevel || state.totalEaten < maxLevel * itemsPerLevel) return;
    const allVisibleItemsEaten = items.every((item) => item.eaten || item.x < cameraX - 160);
    if (!allVisibleItemsEaten) return;
    state = resetRun(state);
    items = createCityItems();
    hole.x = window.innerWidth * 0.5;
    cameraX = 0;
    saveState();
  }

  function eatCollisions() {
    for (const item of items) {
      if (item.eaten) continue;
      const box = itemScreenBox(item, cameraX, window.innerHeight);
      if (box.right < hole.x - hole.radius || box.left > hole.x + hole.radius) continue;
      const dx = box.x - hole.x;
      const dy = box.y - hole.y;
      const distance = Math.hypot(dx, dy);
      if (canSwallowItem(item.radius, hole.radius, distance)) {
        item.eaten = true;
        state = collectItem(state);
        hole.radius = getHoleRadius(state);
        saveState();
      }
    }
  }

  function update(delta: number) {
    const width = window.innerWidth;
    const forward = hole.speed * delta;
    cameraX += forward;

    let movement = 0;
    if (keys.has("ArrowRight")) movement += 1;
    if (keys.has("ArrowLeft")) movement -= 1;
    if (pointer.active) {
      const target = pointer.x;
      movement += Math.max(-1, Math.min(1, (target - hole.x) / 80));
    }

    hole.x += movement * 260 * delta;
    hole.x += forward * 0.18;
    hole.x = Math.max(width * 0.12, Math.min(width * 0.88, hole.x));

    if (hole.x > width * 0.68) {
      cameraX += (hole.x - width * 0.68) * 0.035;
      hole.x -= (hole.x - width * 0.68) * 0.025;
    }

    eatCollisions();
    resetWorldIfComplete();
  }

  function render() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);
    drawCityStage(context, width, height, cameraX);
    for (const item of items) drawItem(context, item, cameraX, height);
    drawHole(context, hole);
    drawSceneCharacters(context, width, height, hole);
    drawHud(context, state, width);
  }

  function frame(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(delta);
    render();
    window.requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
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
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active) return;
    pointer.x = event.clientX;
  });
  canvas.addEventListener("pointerup", () => {
    pointer.active = false;
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.active = false;
  });

  document.title = "";
  resize();
  window.requestAnimationFrame(frame);
}

if (typeof document !== "undefined") {
  initializeGame();
}
