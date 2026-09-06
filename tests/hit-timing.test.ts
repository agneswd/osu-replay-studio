import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBeatmap, parseReplay, computeModDifficulty, type HitResult } from "replayviewer-js";
import { collectTimingHits, hitWindowsFor } from "../core/hit-timing.js";
import { frameAt } from "../core/timeline.js";
import type { Timeline } from "../core/types.js";

const map = parseBeatmap(readFileSync("tests/fixtures/map.osu", "utf8"));
const bytes = new Uint8Array(readFileSync("tests/fixtures/lazer.osr"));
const replay = await parseReplay(bytes.buffer);

test("timing windows follow the judge's mod rules and playback speed", () => {
  for (const mods of [0, 2, 16, 64, 256, 16 | 64]) {
    const d = computeModDifficulty(map, { ...replay, gameVersion: 20200101, mods, scoreInfo: undefined });
    const stable = hitWindowsFor({ ...d, isLazer: false });
    assert.equal(stable.great, d.hitWindow300 / d.speed);
    assert.equal(stable.ok, d.hitWindow100 / d.speed);
    assert.equal(stable.meh, d.hitWindow50 / d.speed);
    assert.equal(stable.inclusive, false);
    const lazer = hitWindowsFor({ ...d, isLazer: true, lzLegacyNotelock: false });
    assert.equal(lazer.great, d.hitWindow300U / d.speed);
    assert.equal(lazer.inclusive, true);
    assert.deepEqual(hitWindowsFor({ ...d, isLazer: true, lzLegacyNotelock: true }), stable);
  }
});

test("slider heads appear at the press, before the tail or first circle", () => {
  const difficulty = { ...computeModDifficulty(map, replay), speed: 1.5, isLazer: false };
  const objects = [{ ...map.hitObjects[0], type: "slider", time: 1000 },
    { ...map.hitObjects[0], type: "circle", time: 7000 }] as typeof map.hitObjects;
  const hit = (objectIndex: number, time: number, extra: Partial<HitResult> = {}): HitResult =>
    ({ objectIndex, time, x: 0, y: 0, hitSound: 0, judgement: 300, comboBreak: false, ...extra });
  const hits = collectTimingHits(objects, [
    hit(1, 7015), hit(0, 1030, { displayTime: 2500, judgement: 100 }),
    hit(0, 1200, { isSliderSub: true }), hit(0, 1100, { comboBreak: true }),
  ], difficulty);
  assert.deepEqual(hits.map(h => [h.time, h.error]), [[1030, 20], [7015, 10]]);
  assert.equal(hits[1].ur, 50);
  const timeline = { speed: 1.5, od: difficulty.od, duration: 10, strains: [], health: [],
    timingHits: hits, hitWindows: hitWindowsFor(difficulty),
    snapshots: [{ time: -1, errors: [], ur: 0, hits: { "300": 0, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 },
      combo: 0, maxCombo: 0, pp: 0, accuracy: 100, score: 0 }],
  } as unknown as Timeline;
  const early = frameAt(timeline, 0.8);
  assert.equal(early.timing?.ticks.length, 1);
  assert.deepEqual(early.hitErrors, [20]);
  assert.equal(frameAt(timeline, 5).play.unstableRate, 50);
  assert.equal(frameAt(timeline, 0.5).timing?.ticks.length, 0);
  assert.deepEqual(frameAt(timeline, 0.8), early);
});
