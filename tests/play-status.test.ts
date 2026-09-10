import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlay, sliderBreakEvents } from "../core/play-status.js";

test("slider breaks exclude circle misses, spinner misses, whole sliders, and dropped tails", () => {
  const objects = [{ type: "circle" }, { type: "spinner" }, { type: "slider" }, { type: "slider" }];
  const hit = (objectIndex: number, time: number, judgement: number, comboBreak: boolean, isSliderSub = false) => ({ objectIndex, time, judgement, comboBreak, isSliderSub });
  const events = [hit(0, 1, 0, true), hit(1, 2, 0, true), hit(2, 3, 100, true), hit(2, 4, 0, false, true), hit(2, 5, 0, false, true), hit(2, 6, 0, false, true), hit(3, 7, 0, true), hit(3, 8, 0, false, true)];
  assert.deepEqual(sliderBreakEvents(objects, events), [3, 4, 5]);
});

test("FC accepts dropped tails and accuracy differences but requires matching completion and misses", () => {
  assert.deepEqual(classifyPlay(3, [2, 1, 0, 0], [2, 1, 0, 0], 8, 9, 0), { completed: true, verified: true, fullCombo: true, perfectCombo: false, sliderBreaks: 0 });
  assert.deepEqual(classifyPlay(479, [458, 19, 2, 0], [457, 20, 2, 0], 587, 589, 0),
    { completed: true, verified: true, fullCombo: true, perfectCombo: false, sliderBreaks: 0 });
  assert.equal(classifyPlay(3, [2, 0, 0, 1], [3, 0, 0, 0], 8, 9, 0).verified, false);
  assert.equal(classifyPlay(3, [3, 0, 0, 0], [2, 0, 0, 1], 8, 9, 0).fullCombo, false);
  assert.equal(classifyPlay(3, [2, 0, 0, 0], [3, 0, 0, 0], 8, 9, 0).verified, false);
  assert.equal(classifyPlay(3, [3, 0, 0, 0], [3, 0, 0, 0], 9, 9, 0).perfectCombo, true);
  assert.equal(classifyPlay(3, [2, 1, 0, 0], [2, 1, 0, 0], 8, 9, 1).fullCombo, false);
  assert.equal(classifyPlay(4, [3, 0, 0, 0], [3, 0, 0, 0], 9, 9, 0).fullCombo, false);
  assert.equal(classifyPlay(3, [2, 1, 0, 0], [3, 0, 0, 0], 9, 9, 0).fullCombo, true);
});

test("recorded lazer results verify FC despite different simulated judgements and dropped tails", async () => {
  const { recordedLazerStatus } = await import("../core/play-status.js");
  const info = { statistics: { great: 467, ok: 10, large_tick_hit: 24, slider_tail_hit: 120, ignore_miss: 2 }, maximum_statistics: { great: 477, large_tick_hit: 24, slider_tail_hit: 122 } };
  assert.deepEqual(recordedLazerStatus(477, info, false, 621, 623), { completed: true, verified: true, fullCombo: true, perfectCombo: false, sliderBreaks: 0 });
  assert.equal(recordedLazerStatus(477, { ...info, statistics: { ...info.statistics, large_tick_hit: 23, large_tick_miss: 1 } }, false, 600, 623)?.sliderBreaks, 1);
  assert.equal(recordedLazerStatus(477, { ...info, statistics: { ...info.statistics, great: 466, miss: 1 } }, false, 600, 623)?.fullCombo, false);
  assert.equal(recordedLazerStatus(477, { ...info, statistics: { ...info.statistics, great: 400 } }, false, 600, 623)?.completed, false);
  assert.equal(recordedLazerStatus(477, { statistics: info.statistics }, false, 621, 623), undefined);
  assert.equal(recordedLazerStatus(477, info, true, 621, 623), undefined);
  assert.equal(recordedLazerStatus(477, { ...info, statistics: { ...info.statistics, large_tick_miss: -1 } }, false, 621, 623), undefined);
});
