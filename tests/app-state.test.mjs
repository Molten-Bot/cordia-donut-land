import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  advanceLevel,
  canAdvance,
  collectFood,
  createDefaultState,
  getLevel,
  parseStoredState,
  resetRun,
} from "../public/app.js";

test("createDefaultState marks release zero and starts level one", () => {
  const state = createDefaultState();

  assert.deepEqual(state, {
    release: "0",
    level: 1,
    donuts: 0,
    treats: { donut: 0, milk: 0, sprinkles: 0 },
    bestScore: 0,
    muted: false,
  });
});

test("parseStoredState sanitizes stored values", () => {
  const defaultState = createDefaultState();
  const stored = JSON.stringify({
    release: "old",
    level: 99,
    donuts: 14.8,
    treats: { donut: 2.2, milk: -4, sprinkles: 1 },
    bestScore: 22,
    muted: true,
  });

  assert.deepEqual(parseStoredState(stored, defaultState), {
    release: "0",
    level: 4,
    donuts: 14,
    treats: { donut: 2, milk: 0, sprinkles: 1 },
    bestScore: 22,
    muted: true,
  });
});

test("parseStoredState falls back when stored JSON is invalid", () => {
  const defaultState = createDefaultState();

  assert.equal(parseStoredState("{", defaultState), defaultState);
});

test("collectFood updates score, treat totals, and best score immutably", () => {
  const state = createDefaultState();
  const collected = collectFood(collectFood(state, "milk"), "sprinkles");

  assert.equal(collected.donuts, 8);
  assert.equal(collected.bestScore, 8);
  assert.deepEqual(collected.treats, { donut: 0, milk: 1, sprinkles: 1 });
  assert.equal(state.donuts, 0);
});

test("advanceLevel moves forward only after goal", () => {
  const state = {
    ...createDefaultState(),
    donuts: getLevel(createDefaultState()).goal,
  };

  assert.equal(canAdvance(state), true);
  assert.deepEqual(advanceLevel(state), {
    ...state,
    level: 2,
    donuts: 0,
  });
  assert.equal(advanceLevel(createDefaultState()).level, 1);
});

test("resetRun preserves best score and quiet mode", () => {
  const reset = resetRun({
    ...createDefaultState(),
    level: 3,
    donuts: 12,
    bestScore: 90,
    muted: true,
  });

  assert.equal(reset.level, 1);
  assert.equal(reset.bestScore, 90);
  assert.equal(reset.muted, true);
});

test("release marker reports release zero", async () => {
  const release = JSON.parse(await readFile("public/release.json", "utf8"));

  assert.deepEqual(release, { release: "0" });
});

test("served files do not reference disallowed providers or tooling", async () => {
  const servedFiles = [
    "public/app.js",
    "public/humans.txt",
    "public/index.html",
    "public/llm.txt",
  ];

  for (const file of servedFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bgit\b|cloudflare/i, file);
  }
});
