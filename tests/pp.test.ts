import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { calculatePP, type PpScore } from "../core/pp.js";

const map = path.resolve("tests/fixtures/map.osu");
const perfect: PpScore = { great: 3, ok: 0, meh: 0, miss: 0, combo: 4 };
test("official calculator agrees between the completed timeline and an SS score", async () => {
  for (const mods of [0, 8, 16, 64, 256, 512]) {
    const result = await calculatePP(map, mods, perfect, [
      { ...perfect, great: 0, combo: 0 }, { ...perfect, great: 1, combo: 1 }, perfect,
    ]);
    assert.equal(result.maxCombo, 4);
    assert.equal(result.pp[0], 0);
    assert.ok(result.stars > 0 && result.pp[1] > 0);
    assert.ok(Math.abs(result.pp[2] - result.scorePP) < 1e-9);
    assert.equal(result.scorePP, result.maxPP);
  }
});
test("official calculator reduces PP for misses and supports cancellation", async () => {
  const miss = { ...perfect, great: 2, miss: 1, combo: 2 };
  const result = await calculatePP(map, 0, miss, [miss]);
  assert.ok(result.scorePP < result.maxPP);
  await assert.rejects(calculatePP(map, 0, perfect, [], AbortSignal.abort()), /abort/i);
  await assert.rejects(calculatePP(`${map}.missing`, 0, perfect, []), /PP calculation failed/);
});
