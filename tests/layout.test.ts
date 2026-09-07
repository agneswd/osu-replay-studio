import test from "node:test";
import assert from "node:assert/strict";
import { defaultLayout, normalizeLayout, validateLayout, danserPlayfield } from "../core/layout.js";

test("old and damaged settings recover a complete independent layout", () => {
  assert.deepEqual(normalizeLayout(undefined), defaultLayout());
  const value = normalizeLayout({ playfield: { x: NaN, y: 400, scale: 99 }, overlays: { leaderboard: { x: 250, scale: .5, z: -10 } } });
  assert.deepEqual(value.playfield, { x: 960, y: 400, scale: 2 });
  assert.deepEqual(value.overlays.leaderboard, { x: 250, y: 434, scale: .5, z: 0 });
  value.overlays.leaderboard.x = 123;
  assert.equal(defaultLayout().overlays.leaderboard.x, 4);
});
test("render requests reject invalid layouts instead of silently changing the export", () => {
  validateLayout(undefined);
  validateLayout(defaultLayout());
  for (const invalid of [null, [], {}, { ...defaultLayout(), playfield: { x: 10, y: 20, scale: Infinity } }])
    assert.throws(() => validateLayout(invalid), /Invalid video layout/);
});
test("Danser positions retain design coordinates when scale and output resolution change", () => {
  for (const scale of [.1, .5, 1, 2]) {
    const layout = defaultLayout();
    layout.playfield = { x: 1240, y: 400, scale };
    const settings = danserPlayfield(layout);
    for (const height of [480, 720, 1080, 2160]) {
      const osuScale = height / 384 * .8 * scale;
      assert.ok(Math.abs(settings.ShiftX * osuScale - 280 * height / 1080) < 1e-9);
      assert.ok(Math.abs(settings.ShiftY * osuScale + 140 * height / 1080) < 1e-9);
    }
    assert.equal(settings.ScaleStoryboardWithPlayfield, false);
    assert.equal(settings.MoveStoryboardWithPlayfield, false);
  }
});
