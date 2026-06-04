import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canSwallowItem,
  collectItem,
  createCityItems,
  createDefaultState,
  growthPerItem,
  getHoleRadius,
  itemsPerLevel,
  levels,
  maxHoleRadius,
  maxLevel,
  parseStoredState,
  playableMaxY,
  playableMinY,
  resetRun,
  startHoleRadius,
} from "../public/app.js";

test("createDefaultState marks release zero and starts level one", () => {
  const state = createDefaultState();

  assert.deepEqual(state, {
    release: "0",
    level: 1,
    eaten: 0,
    totalEaten: 0,
    bestScore: 0,
    muted: false,
  });
});

test("parseStoredState sanitizes stored values and derives progress", () => {
  const defaultState = createDefaultState();
  const stored = JSON.stringify({
    release: "old",
    level: 2,
    eaten: 19.8,
    totalEaten: 14.8,
    bestScore: 22,
    muted: true,
  });

  assert.deepEqual(parseStoredState(stored, defaultState), {
    release: "0",
    level: 3,
    eaten: 4,
    totalEaten: 14,
    bestScore: 22,
    muted: true,
  });
});

test("parseStoredState falls back when stored JSON is invalid", () => {
  const defaultState = createDefaultState();

  assert.equal(parseStoredState("{", defaultState), defaultState);
});

test("collectItem levels up every five swallowed items", () => {
  let state = createDefaultState();

  for (let index = 0; index < itemsPerLevel; index += 1) {
    state = collectItem(state);
  }

  assert.equal(state.level, 2);
  assert.equal(state.eaten, 0);
  assert.equal(state.totalEaten, 5);
  assert.equal(state.bestScore, 5);
});

test("hole radius grows with swallowed item count", () => {
  const state = { ...createDefaultState(), totalEaten: 8 };

  assert.equal(getHoleRadius(state), startHoleRadius + 8 * growthPerItem);
  assert.equal(getHoleRadius({ ...state, totalEaten: maxLevel * itemsPerLevel + 4 }), maxHoleRadius);
});

test("city items graduate in size and never exceed maximum hole size", () => {
  const items = createCityItems();

  assert.equal(levels.length, maxLevel);
  assert.ok(items.length > maxLevel * itemsPerLevel);
  assert.ok(items[0].radius < items[items.length - 1].radius);
  assert.equal(levels[levels.length - 1].maxRadius, maxHoleRadius);
  assert.ok(items.every((item) => item.radius <= maxHoleRadius));
  assert.ok(items.every((item) => item.width <= item.radius * 2 && item.height <= item.radius * 2));
  assert.ok(items.slice(0, 6).some((item) => ["trash", "shoe", "can", "pet"].includes(item.kind)));
});

test("city items spawn randomly across the playable land plane", () => {
  const items = createCityItems();
  const starterItems = items.slice(0, itemsPerLevel);

  assert.ok(items.every((item) => item.y >= playableMinY && item.y <= playableMaxY));
  assert.ok(items.every((item) => item.x >= 296));
  assert.ok(new Set(items.map((item) => item.x)).size > maxLevel * itemsPerLevel);
  assert.ok(new Set(starterItems.map((item) => item.y)).size > 1);
  assert.ok(starterItems.every((item) => item.radius <= startHoleRadius));
});

test("starter item collision allows reachable overlap before center alignment", () => {
  const [starterItem] = createCityItems();
  const oldCenterOnlyReach = startHoleRadius * 0.86;
  const overlapDistance = oldCenterOnlyReach + 1;

  assert.ok(starterItem);
  assert.ok(canSwallowItem(starterItem.radius, startHoleRadius, overlapDistance));
  assert.equal(canSwallowItem(startHoleRadius + 1, startHoleRadius, 0), false);
});

test("resetRun preserves best score and quiet mode", () => {
  const reset = resetRun({
    ...createDefaultState(),
    level: 3,
    eaten: 2,
    totalEaten: 12,
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
