import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPlay, sliderBreakEvents } from "../core/play-status.js";

test("slider breaks exclude circle misses, spinner misses, whole sliders, and dropped tails", () => {
  const objects = [{ type: "circle" }, { type: "spinner" }, { type: "slider" }, { type: "slider" }];
  const hit = (objectIndex: number, time: number, judgement: number, comboBreak: boolean, isSliderSub = false) => ({ objectIndex, time, judgement, comboBreak, isSliderSub });
  const events = [hit(0, 1, 0, true), hit(1, 2, 0, true), hit(2, 3, 100, true), hit(2, 4, 0, false, true), hit(2, 5, 0, false, true), hit(2, 6, 0, false, true), hit(3, 7, 0, true), hit(3, 8, 0, false, true)];
  assert.deepEqual(sliderBreakEvents(objects, events), [3, 4, 5]);
});

test("FC accepts dropped tails but requires completed and matching replay judgements", () => {
  assert.deepEqual(classifyPlay(3, [2, 1, 0, 0], [2, 1, 0, 0], 8, 9, 0), { completed: true, verified: true, fullCombo: true, perfectCombo: false, sliderBreaks: 0 });
  assert.equal(classifyPlay(3, [3, 0, 0, 0], [3, 0, 0, 0], 9, 9, 0).perfectCombo, true);
  assert.equal(classifyPlay(3, [2, 1, 0, 0], [2, 1, 0, 0], 8, 9, 1).fullCombo, false);
  assert.equal(classifyPlay(4, [3, 0, 0, 0], [3, 0, 0, 0], 9, 9, 0).fullCombo, false);
  assert.equal(classifyPlay(3, [2, 1, 0, 0], [3, 0, 0, 0], 9, 9, 0).fullCombo, false);
});
