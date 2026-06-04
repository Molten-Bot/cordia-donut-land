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

const palette = ["#e04f39", "#f2b134", "#288a7a", "#4c6fbf", "#774c9e", "#30333a", "#f6efe4"];

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

function drawRoad(ctx: CanvasRenderingContext2D, width: number, height: number, cameraX: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#86c7d7");
  sky.addColorStop(0.46, "#d8e3c5");
  sky.addColorStop(0.461, "#76736d");
  sky.addColorStop(1, "#3c3b38");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 4;
  ctx.setLineDash([34, 40]);
  const laneY = height * 0.72;
  ctx.beginPath();
  ctx.moveTo((-cameraX * 0.8) % 74, laneY);
  ctx.lineTo(width, laneY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(40,45,47,0.22)";
  for (let i = -1; i < 22; i += 1) {
    const x = ((i * 120 - cameraX * 0.18) % (width + 140)) - 80;
    ctx.fillRect(x, height * 0.34, 46, height * 0.16);
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
  ctx.fillStyle = item.color;
  ctx.strokeStyle = "rgba(22,24,26,0.42)";
  ctx.lineWidth = 2;

  if (item.kind === "store" || item.kind === "house" || item.kind === "tower") {
    ctx.fillRect(-item.width / 2, -item.height, item.width, item.height);
    ctx.strokeRect(-item.width / 2, -item.height, item.width, item.height);
    ctx.fillStyle = "rgba(255,239,180,0.88)";
    const rows = Math.max(1, Math.floor(item.height / 28));
    for (let row = 0; row < rows; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        ctx.fillRect(col * item.width * 0.22 - 5, -item.height + 12 + row * 24, 10, 10);
      }
    }
  } else if (item.kind === "pet") {
    ctx.beginPath();
    ctx.ellipse(0, -item.radius * 0.55, item.radius, item.radius * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(item.radius * 0.7, -item.radius, item.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (item.kind === "shoe") {
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height * 0.62, item.width, item.height * 0.5, 7);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height, item.width, item.height, 6);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawHole(ctx: CanvasRenderingContext2D, hole: Hole) {
  const gradient = ctx.createRadialGradient(
    hole.x - hole.radius * 0.22,
    hole.y - hole.radius * 0.26,
    hole.radius * 0.18,
    hole.x,
    hole.y,
    hole.radius,
  );
  gradient.addColorStop(0, "#364046");
  gradient.addColorStop(0.58, "#070808");
  gradient.addColorStop(1, "#000000");

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hole.x, hole.y, hole.radius * 1.18, hole.radius * 0.66, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
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
    x: 120,
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
    hole.x = Math.max(hole.x, window.innerWidth * 0.18);
  }

  function resetWorldIfComplete() {
    if (state.level < maxLevel || state.totalEaten < maxLevel * itemsPerLevel) return;
    const allVisibleItemsEaten = items.every((item) => item.eaten || item.x < cameraX - 160);
    if (!allVisibleItemsEaten) return;
    state = resetRun(state);
    items = createCityItems();
    hole.x = window.innerWidth * 0.2;
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
    drawRoad(context, width, height, cameraX);
    for (const item of items) drawItem(context, item, cameraX, height);
    drawHole(context, hole);
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
