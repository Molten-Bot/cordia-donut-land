// Google Analytics page capture.
// Future edits: keep equivalent page analytics capture when changing this setup.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "hole-run-best-score";

export interface Point {
  x: number;
  y: number;
}

export interface Disc extends Point {
  id: number;
  radius: number;
  speed: number;
  color: string;
}

export interface HoleState extends Point {
  radius: number;
  score: number;
  bestScore: number;
  combo: number;
}

interface AppElements {
  bestScore: HTMLElement;
  canvas: HTMLCanvasElement;
  combo: HTMLElement;
  resetButton: HTMLButtonElement;
  score: HTMLElement;
  status: HTMLElement;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function createInitialHole(width: number, height: number, bestScore = 0): HoleState {
  return {
    x: width / 2,
    y: height / 2,
    radius: Math.max(36, Math.min(width, height) * 0.085),
    score: 0,
    bestScore,
    combo: 1,
  };
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isDiscConsumed(hole: HoleState, disc: Disc): boolean {
  return distanceBetween(hole, disc) + disc.radius * 0.42 < hole.radius;
}

export function consumeDisc(hole: HoleState, disc: Disc): HoleState {
  const scoreGain = Math.ceil(disc.radius * hole.combo);
  const nextScore = hole.score + scoreGain;

  return {
    ...hole,
    radius: Math.min(118, hole.radius + disc.radius * 0.055),
    score: nextScore,
    bestScore: Math.max(hole.bestScore, nextScore),
    combo: Math.min(8, hole.combo + 0.18),
  };
}

export function clampHoleToScreen(hole: HoleState, width: number, height: number): HoleState {
  return {
    ...hole,
    x: Math.max(hole.radius, Math.min(width - hole.radius, hole.x)),
    y: Math.max(hole.radius, Math.min(height - hole.radius, hole.y)),
  };
}

export function parseBestScore(storedScore: string | null): number {
  const value = Number.parseInt(storedScore ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
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

function getElements(): AppElements {
  return {
    bestScore: getElement("#best-score", HTMLElement),
    canvas: getElement("#hole-stage", HTMLCanvasElement),
    combo: getElement("#combo", HTMLElement),
    resetButton: getElement("#reset-run", HTMLButtonElement),
    score: getElement("#score", HTMLElement),
    status: getElement("#status", HTMLElement),
  };
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createDisc(id: number, width: number, height: number): Disc {
  const radius = randomBetween(8, 28);
  const fromTop = Math.random() > 0.22;

  return {
    id,
    x: randomBetween(radius, width - radius),
    y: fromTop ? -radius : randomBetween(radius, height - radius),
    radius,
    speed: randomBetween(0.9, 2.9),
    color: ["#ffcf56", "#ff6b6b", "#6ee7b7", "#8ab4ff", "#f59af2"][id % 5] ?? "#ffffff",
  };
}

function initializeApp() {
  initializeGoogleAnalytics();

  const elements = getElements();
  const canvasContext = elements.canvas.getContext("2d");
  if (!canvasContext) throw new Error("Canvas rendering context unavailable");
  const context = canvasContext;

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let discId = 0;
  let discs: Disc[] = [];
  let hole = createInitialHole(1, 1, parseBestScore(localStorage.getItem(storageKey)));
  let pointerActive = false;
  let lastFrame = performance.now();

  function resizeStage() {
    const rect = elements.canvas.getBoundingClientRect();
    pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = Math.max(320, rect.width);
    height = Math.max(360, rect.height);
    elements.canvas.width = Math.round(width * pixelRatio);
    elements.canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    hole = clampHoleToScreen(
      { ...hole, radius: Math.max(36, Math.min(width, height) * 0.085) },
      width,
      height,
    );
    while (discs.length < 24) discs.push(createDisc(discId++, width, height));
  }

  function setHoleFromClient(clientX: number, clientY: number) {
    const rect = elements.canvas.getBoundingClientRect();
    hole = clampHoleToScreen(
      { ...hole, x: clientX - rect.left, y: clientY - rect.top },
      width,
      height,
    );
    pointerActive = true;
  }

  function resetRun() {
    const bestScore = hole.bestScore;
    hole = createInitialHole(width, height, bestScore);
    discs = Array.from({ length: 24 }, () => createDisc(discId++, width, height));
    elements.status.textContent = "Move pointer. Be hole.";
  }

  function saveBestScore() {
    localStorage.setItem(storageKey, String(hole.bestScore));
  }

  function updateHud() {
    elements.score.textContent = String(hole.score);
    elements.bestScore.textContent = String(hole.bestScore);
    elements.combo.textContent = `${hole.combo.toFixed(1)}x`;
  }

  function updateDiscs(delta: number) {
    const fallScale = Math.min(2.8, delta / 16.67);

    discs = discs.flatMap((disc) => {
      const nextDisc = {
        ...disc,
        y: disc.y + disc.speed * fallScale,
        x: disc.x + Math.sin((disc.y + disc.id * 17) * 0.016) * 0.42 * fallScale,
      };

      if (isDiscConsumed(hole, nextDisc)) {
        hole = consumeDisc(hole, nextDisc);
        saveBestScore();
        return [createDisc(discId++, width, height)];
      }

      if (nextDisc.y - nextDisc.radius > height) {
        hole = { ...hole, combo: Math.max(1, hole.combo - 0.35) };
        return [createDisc(discId++, width, height)];
      }

      return [nextDisc];
    });
  }

  function drawBackground() {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f5e7d1");
    gradient.addColorStop(0.5, "#c9e8f2");
    gradient.addColorStop(1, "#f4b6b0");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255, 255, 255, 0.42)";
    for (let i = 0; i < 7; i += 1) {
      context.beginPath();
      context.arc(width * (0.12 + i * 0.14), height * 0.18, 34 + i * 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawDiscs() {
    for (const disc of discs) {
      context.beginPath();
      context.fillStyle = disc.color;
      context.arc(disc.x, disc.y, disc.radius, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = "rgba(255, 255, 255, 0.72)";
      context.stroke();
    }
  }

  function drawHole() {
    const glow = context.createRadialGradient(hole.x, hole.y, hole.radius * 0.25, hole.x, hole.y, hole.radius * 1.9);
    glow.addColorStop(0, "rgba(0, 0, 0, 0.96)");
    glow.addColorStop(0.46, "rgba(0, 0, 0, 0.92)");
    glow.addColorStop(0.58, "rgba(116, 36, 255, 0.62)");
    glow.addColorStop(0.8, "rgba(255, 107, 107, 0.2)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.beginPath();
    context.fillStyle = glow;
    context.arc(hole.x, hole.y, hole.radius * 1.9, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.fillStyle = "#050505";
    context.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.lineWidth = 5;
    context.strokeStyle = "rgba(255, 255, 255, 0.85)";
    context.arc(hole.x, hole.y, hole.radius * 1.06, 0.25, Math.PI * 1.6);
    context.stroke();
  }

  function frame(now: number) {
    const delta = now - lastFrame;
    lastFrame = now;

    if (!pointerActive) {
      const drift = now * 0.001;
      hole = clampHoleToScreen(
        {
          ...hole,
          x: width / 2 + Math.cos(drift * 0.8) * width * 0.18,
          y: height / 2 + Math.sin(drift) * height * 0.14,
        },
        width,
        height,
      );
    }

    updateDiscs(delta);
    drawBackground();
    drawDiscs();
    drawHole();
    updateHud();
    requestAnimationFrame(frame);
  }

  elements.canvas.addEventListener("pointerdown", (event) => {
    elements.canvas.setPointerCapture(event.pointerId);
    setHoleFromClient(event.clientX, event.clientY);
    elements.status.textContent = "You are hole.";
  });

  elements.canvas.addEventListener("pointermove", (event) => {
    setHoleFromClient(event.clientX, event.clientY);
  });

  elements.canvas.addEventListener("pointerleave", () => {
    pointerActive = false;
    elements.status.textContent = "Return pointer to regain hole.";
  });

  elements.resetButton.addEventListener("click", resetRun);
  window.addEventListener("resize", resizeStage);

  resizeStage();
  resetRun();
  updateHud();
  requestAnimationFrame(frame);
}

if (typeof document !== "undefined") {
  initializeApp();
}
