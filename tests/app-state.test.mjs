import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canSwallowItem,
  collectItem,
  createCityItems,
  createDefaultState,
  deriveGrowthFromEatenCount,
  getGrowthForItemRadius,
  getGrowthWeightForItemRadius,
  growthPerItem,
  getHoleRadius,
  getProgressionItemRadius,
  itemsPerLevel,
  itemsSpawnedPerLevel,
  levels,
  maxHoleRadius,
  maxItemRadius,
  maxLevel,
  maxRunItems,
  parseStoredState,
  playableMaxX,
  playableMaxY,
  playableMinX,
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
    totalGrowth: 0,
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
    totalGrowth: deriveGrowthFromEatenCount(14),
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
  assert.equal(state.totalGrowth, deriveGrowthFromEatenCount(5));
  assert.equal(state.bestScore, 5);
});

test("hole radius grows from accumulated item-size growth", () => {
  const state = { ...createDefaultState(), totalEaten: 8, totalGrowth: deriveGrowthFromEatenCount(8) };

  assert.equal(getHoleRadius(state), startHoleRadius + deriveGrowthFromEatenCount(8));
  assert.equal(
    getHoleRadius({ ...state, totalEaten: maxRunItems + 4, totalGrowth: deriveGrowthFromEatenCount(maxRunItems + 4) }),
    maxHoleRadius,
  );
  assert.ok(deriveGrowthFromEatenCount(8) < 8 * growthPerItem);
});

test("larger items produce much larger hole growth near the end", () => {
  const tinyRadius = getProgressionItemRadius(0);
  const midRadius = getProgressionItemRadius(Math.floor(maxRunItems / 2));
  const finalRadius = getProgressionItemRadius(maxRunItems - 1);

  assert.ok(tinyRadius < midRadius);
  assert.ok(midRadius < finalRadius);
  assert.ok(getGrowthWeightForItemRadius(tinyRadius) < getGrowthWeightForItemRadius(midRadius));
  assert.ok(getGrowthWeightForItemRadius(midRadius) < getGrowthWeightForItemRadius(finalRadius));
  assert.ok(getGrowthForItemRadius(finalRadius) > getGrowthForItemRadius(tinyRadius) * 16);
});

test("collectItem uses swallowed object size to grow the hole", () => {
  const smallItemState = collectItem(createDefaultState(), getProgressionItemRadius(0));
  const largeItemState = collectItem(createDefaultState(), getProgressionItemRadius(maxRunItems - 1));

  assert.ok(largeItemState.totalGrowth > smallItemState.totalGrowth * 16);
  assert.ok(getHoleRadius(largeItemState) > getHoleRadius(smallItemState));
});

test("city items generally graduate in size and never exceed maximum hole size", () => {
  const items = createCityItems();

  assert.equal(levels.length, maxLevel);
  assert.ok(items.length > maxLevel * itemsPerLevel);
  assert.equal(items.length, maxLevel * itemsSpawnedPerLevel);
  assert.ok(items[0].radius < items[items.length - 1].radius);
  assert.equal(levels[levels.length - 1].maxRadius, maxItemRadius);
  assert.ok(items.every((item) => item.radius < maxHoleRadius));
  assert.ok(items.every((item) => item.width <= item.radius * 2 && item.height <= item.radius * 2));
  assert.ok(items.slice(0, 6).some((item) => ["trash", "shoe", "can", "pet"].includes(item.kind)));
  assert.ok(
    items.filter((item, index) => index > 0 && item.radius >= items[index - 1].radius).length > items.length * 0.88,
  );
});

test("spawned item radii stay within real hole growth for each level", () => {
  const items = createCityItems();
  let state = createDefaultState();

  for (let levelIndex = 0; levelIndex < maxLevel; levelIndex += 1) {
    const levelItems = items.slice(
      levelIndex * itemsSpawnedPerLevel,
      levelIndex * itemsSpawnedPerLevel + itemsSpawnedPerLevel,
    );

    for (const item of levelItems.slice(0, itemsPerLevel)) {
      assert.ok(item.radius <= getHoleRadius(state));
      state = collectItem(state, item.radius);
    }

    const holeAfterRequiredItems = getHoleRadius(state);
    assert.ok(levelItems.slice(itemsPerLevel).every((item) => item.radius <= holeAfterRequiredItems));
  }
});

test("city items initialize across the playable land plane", () => {
  const items = createCityItems();
  const starterItems = items.slice(0, itemsPerLevel);

  assert.ok(playableMinX <= 0.05);
  assert.ok(playableMaxX >= 0.95);
  assert.ok(playableMinY <= 0.15);
  assert.ok(playableMaxY >= 0.9);
  assert.ok(itemsSpawnedPerLevel <= itemsPerLevel + 1);
  assert.ok(items.every((item) => item.x >= playableMinX && item.x <= playableMaxX));
  assert.ok(items.every((item) => item.y >= playableMinY && item.y <= playableMaxY));
  assert.ok(new Set(items.map((item) => item.x)).size > maxLevel * itemsPerLevel);
  assert.ok(new Set(starterItems.map((item) => item.y)).size > 1);
  assert.ok(starterItems.every((item) => item.radius <= startHoleRadius));
  assert.deepEqual(
    createCityItems().map((item) => [item.x, item.y, item.radius]),
    items.map((item) => [item.x, item.y, item.radius]),
  );
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
