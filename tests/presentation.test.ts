import test from "node:test";
import assert from "node:assert/strict";
import { presentationAt, presentationTiming, compositeArgs } from "../core/presentation.js";
import type { Timeline } from "../core/types.js";

const timeline = { duration: 2.01, speed: 1.5 } as Timeline;

test("intro and outro hold the gameplay clock at exact frame boundaries", () => {
  for (const fps of [30, 60]) {
    const timing = presentationTiming(timeline.duration, fps, true);
    const at = (frame: number) => presentationAt(timeline, frame / fps, fps, true);
    assert.equal(at(0).scene?.kind, "intro");
    assert.equal(at(timing.introFrames - 1).gameplayTime, -1);
    assert.equal(at(timing.sceneFrames).scene, null);
    assert.equal(at(timing.introFrames - 1).scene?.kind, "intro");
    assert.deepEqual(at(timing.introFrames), { gameplayTime: -1, scene: null });
    const end = timing.introFrames + timing.gameplayFrames;
    assert.equal(at(end - 1).scene, null);
    assert.equal(at(end).scene?.kind, "outro");
    assert.equal(at(timing.outroStartFrame - 1).scene, null);
    assert.equal(at(end).gameplayTime, at(end - 1).gameplayTime);
    assert.equal(timing.outroStartFrame, end);
    assert.deepEqual(at(timing.outroStartFrame), { gameplayTime: (timing.gameplayFrames + timing.startFrame - 1) / fps, scene: { kind: "outro", time: 0 } });
    assert.equal(at(timing.frames - 1).gameplayTime, at(end).gameplayTime);
    assert.deepEqual(at(timing.introFrames), { gameplayTime: -1, scene: null });
    assert.deepEqual(at(timing.frames + 100), at(timing.frames - 1));
    assert.equal((timing.sceneFrames + timing.introFrames) / fps, 10.8);
  }
});

test("disabled animations add no delay; duration limits only gameplay", () => {
  assert.equal(presentationTiming(2, 30).frames, 60);
  assert.equal(presentationAt(timeline, 1, 30).gameplayTime, 1);
  assert.equal(presentationAt(timeline, 1, 30).scene, null);
  assert.equal(presentationAt(timeline, 8.9, 30, true, 1).scene?.kind, "outro");
  assert.equal(presentationTiming(1, 30, true).duration, 12.8);
  const enabled = compositeArgs("in.mp4", "out.mp4", 2, 30, true);
  assert.match(enabled[enabled.indexOf("-af") + 1], /adelay=5400:all=1/);
  assert.equal(enabled[enabled.indexOf("-t") + 1], "13.8");
  assert.equal(compositeArgs("in.mp4", "out.mp4", 2, 30).includes("-af"), true);
  const trimmed = compositeArgs("in.mp4", "out.mp4", 2, 30, true, 1.32);
  assert.deepEqual(trimmed.slice(0, 5), ["-y", "-ss", "0.32000000000000006", "-i", "in.mp4"]);
});


test("first note follows the intro by one second for early and late map starts", () => {
  for (const speed of [.75, 1, 1.5]) for (const time of [0, 1027, 30000]) for (const fps of [24, 60, 120]) {
    const map = { ...timeline, duration: 60, speed, hitObjects: [{ time }] } as Timeline;
    const first = time / 1000 / speed;
    const timing = presentationTiming(map.duration, fps, true, first);
    const firstHitFrame = timing.introFrames + Math.round(first * fps) - timing.startFrame;
    assert.ok(Math.abs(firstHitFrame / fps - 5.4 - 1) <= 1 / fps);
    assert.equal(presentationAt(map, 0, fps, true).gameplayTime, timing.startFrame / fps);
    assert.equal(presentationAt(map, timing.introFrames / fps, fps, true).gameplayTime, timing.startFrame / fps);
  }
});
