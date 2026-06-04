// Google Analytics default capture for this static app.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "donut-land-state";

export type FoodKind = "donut" | "milk" | "sprinkles";

export interface Level {
  id: number;
  name: string;
  goal: number;
  helper: string;
}

export interface GameState {
  release: "0";
  level: number;
  donuts: number;
  treats: Record<FoodKind, number>;
  bestScore: number;
  muted: boolean;
}

interface AppElements {
  bestScore: HTMLElement;
  celebration: HTMLElement;
  currentLevel: HTMLElement;
  donutButton: HTMLButtonElement;
  donutCount: HTMLElement;
  foodButtons: NodeListOf<HTMLButtonElement>;
  goalText: HTMLElement;
  helperText: HTMLElement;
  levelList: HTMLElement;
  muteToggle: HTMLInputElement;
  resetButton: HTMLButtonElement;
  title: HTMLHeadingElement;
  treatSummary: HTMLElement;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const levels: Level[] = [
  { id: 1, name: "Glaze Grove", goal: 12, helper: "Warm glaze drips from every tree." },
  { id: 2, name: "Sprinkle Skyline", goal: 26, helper: "Catch rainbow crunch before it melts." },
  { id: 3, name: "Fritter Falls", goal: 44, helper: "Big stacks need quick taps and snacks." },
  { id: 4, name: "Jelly Moon", goal: 70, helper: "Final feast. Fill moon with donut joy." },
];

const foodValues: Record<FoodKind, number> = {
  donut: 1,
  milk: 3,
  sprinkles: 5,
};

const foodLabels: Record<FoodKind, string> = {
  donut: "Donuts",
  milk: "Milk",
  sprinkles: "Sprinkles",
};

export function createDefaultState(): GameState {
  return {
    release: "0",
    level: 1,
    donuts: 0,
    treats: { donut: 0, milk: 0, sprinkles: 0 },
    bestScore: 0,
    muted: false,
  };
}

function isFoodKind(value: string): value is FoodKind {
  return value === "donut" || value === "milk" || value === "sprinkles";
}

function isTreatRecord(value: unknown): value is Record<FoodKind, number> {
  if (!value || typeof value !== "object") return false;
  const treats = value as Record<string, unknown>;
  return (
    typeof treats.donut === "number" &&
    typeof treats.milk === "number" &&
    typeof treats.sprinkles === "number"
  );
}

function clampLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 1;
  return Math.min(Math.max(value, 1), levels.length);
}

function cleanCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function getLevel(state: GameState): Level {
  const firstLevel = levels[0];
  if (!firstLevel) {
    throw new Error("Donut land needs at least one level.");
  }
  return levels[state.level - 1] ?? firstLevel;
}

export function parseStoredState(storedState: string | null, defaultState: GameState): GameState {
  if (!storedState) return defaultState;

  try {
    const parsed = JSON.parse(storedState) as Record<string, unknown>;
    const treats = isTreatRecord(parsed.treats) ? parsed.treats : defaultState.treats;

    return {
      release: "0",
      level: clampLevel(parsed.level),
      donuts: cleanCount(parsed.donuts),
      treats: {
        donut: cleanCount(treats.donut),
        milk: cleanCount(treats.milk),
        sprinkles: cleanCount(treats.sprinkles),
      },
      bestScore: cleanCount(parsed.bestScore),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : defaultState.muted,
    };
  } catch {
    return defaultState;
  }
}

export function collectFood(state: GameState, food: FoodKind): GameState {
  const gained = foodValues[food];
  const donuts = state.donuts + gained;
  return {
    ...state,
    donuts,
    bestScore: Math.max(state.bestScore, donuts),
    treats: {
      ...state.treats,
      [food]: state.treats[food] + 1,
    },
  };
}

export function canAdvance(state: GameState): boolean {
  return state.donuts >= getLevel(state).goal && state.level < levels.length;
}

export function advanceLevel(state: GameState): GameState {
  if (!canAdvance(state)) return state;
  return {
    ...state,
    level: state.level + 1,
    donuts: 0,
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

function getElements(): AppElements {
  return {
    bestScore: getElement("#best-score", HTMLElement),
    celebration: getElement("#celebration", HTMLElement),
    currentLevel: getElement("#current-level", HTMLElement),
    donutButton: getElement("#donut-button", HTMLButtonElement),
    donutCount: getElement("#donut-count", HTMLElement),
    foodButtons: document.querySelectorAll<HTMLButtonElement>("[data-food]"),
    goalText: getElement("#goal-text", HTMLElement),
    helperText: getElement("#helper-text", HTMLElement),
    levelList: getElement("#level-list", HTMLElement),
    muteToggle: getElement("#mute-toggle", HTMLInputElement),
    resetButton: getElement("#reset-run", HTMLButtonElement),
    title: getElement(".topbar h1", HTMLHeadingElement),
    treatSummary: getElement("#treat-summary", HTMLElement),
  };
}

function initializeApp() {
  initializeGoogleAnalytics();

  const defaultState = createDefaultState();
  const elements = getElements();
  let state = parseStoredState(localStorage.getItem(storageKey), defaultState);

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function renderLevels() {
    elements.levelList.replaceChildren();

    levels.forEach((level) => {
      const item = document.createElement("li");
      item.className = "level-step";
      item.dataset.current = String(level.id === state.level);
      item.dataset.done = String(level.id < state.level);

      const badge = document.createElement("span");
      badge.textContent = String(level.id);

      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = level.name;
      const goal = document.createElement("small");
      goal.textContent = `${level.goal} donut goal`;
      copy.append(name, goal);

      item.append(badge, copy);
      elements.levelList.append(item);
    });
  }

  function render() {
    const level = getLevel(state);
    const remaining = Math.max(level.goal - state.donuts, 0);
    const complete = state.donuts >= level.goal;
    const finalComplete = complete && state.level === levels.length;

    document.title = "Donut land";
    elements.title.textContent = "Donut land";
    elements.currentLevel.textContent = `Level ${level.id}: ${level.name}`;
    elements.donutCount.textContent = String(state.donuts);
    elements.bestScore.textContent = String(state.bestScore);
    elements.goalText.textContent = complete ? "Goal reached" : `${remaining} until next level`;
    elements.helperText.textContent = level.helper;
    elements.muteToggle.checked = state.muted;
    elements.treatSummary.textContent = `${foodLabels.donut}: ${state.treats.donut} | ${foodLabels.milk}: ${state.treats.milk} | ${foodLabels.sprinkles}: ${state.treats.sprinkles}`;
    elements.celebration.textContent = finalComplete
      ? "Jelly Moon complete. Donut land full."
      : complete
        ? "Goal reached. Next level unlocked."
        : "Tap treats. Feed fun. Climb levels.";

    elements.donutButton.disabled = finalComplete;
    const donutLabel = elements.donutButton.querySelector("span:last-child");
    if (donutLabel instanceof HTMLElement) {
      donutLabel.textContent = finalComplete ? "Feast complete" : "Grab donut";
    }
    elements.foodButtons.forEach((button) => {
      button.disabled = finalComplete;
    });

    renderLevels();
  }

  function collect(food: FoodKind) {
    state = collectFood(state, food);
    if (canAdvance(state)) {
      state = advanceLevel(state);
    }
    saveState();
    render();
  }

  elements.donutButton.addEventListener("click", () => collect("donut"));

  elements.foodButtons.forEach((button) => {
    const food = button.dataset.food;
    if (!food || !isFoodKind(food)) return;
    button.addEventListener("click", () => collect(food));
  });

  elements.resetButton.addEventListener("click", () => {
    state = resetRun(state);
    saveState();
    render();
  });

  elements.muteToggle.addEventListener("change", () => {
    state = { ...state, muted: elements.muteToggle.checked };
    saveState();
    render();
  });

  render();
}

if (typeof document !== "undefined") {
  initializeApp();
}
