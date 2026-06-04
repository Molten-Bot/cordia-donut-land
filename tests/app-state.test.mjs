import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  clampHoleToScreen,
  consumeDisc,
  createInitialHole,
  isDiscConsumed,
  parseBestScore,
} from "../public/app.js";

test("createInitialHole centers the player and uses stored best score", () => {
  const hole = createInitialHole(800, 600, 42);

  assert.equal(hole.x, 400);
  assert.equal(hole.y, 300);
  assert.equal(hole.bestScore, 42);
  assert.equal(hole.score, 0);
  assert.equal(hole.combo, 1);
});

test("clampHoleToScreen keeps hole fully visible", () => {
  const hole = createInitialHole(400, 300);
  const clamped = clampHoleToScreen({ ...hole, x: -100, y: 999 }, 400, 300);

  assert.equal(clamped.x, clamped.radius);
  assert.equal(clamped.y, 300 - clamped.radius);
});

test("disc consumption checks center distance and grows score state", () => {
  const hole = createInitialHole(600, 500, 8);
  const disc = { id: 1, x: hole.x + 4, y: hole.y, radius: 20, speed: 1, color: "#fff" };

  assert.equal(isDiscConsumed(hole, disc), true);

  const consumed = consumeDisc(hole, disc);

  assert.equal(consumed.score, 20);
  assert.equal(consumed.bestScore, 20);
  assert.equal(consumed.combo > hole.combo, true);
  assert.equal(consumed.radius > hole.radius, true);
});

test("parseBestScore accepts positive integers only", () => {
  assert.equal(parseBestScore("18"), 18);
  assert.equal(parseBestScore("-1"), 0);
  assert.equal(parseBestScore("nope"), 0);
  assert.equal(parseBestScore(null), 0);
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
