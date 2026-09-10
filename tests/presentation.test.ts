import test from "node:test";
import assert from "node:assert/strict";
import { presentationAt, presentationTiming, compositeArgs, introPause, introEase, outroPause } from "../core/presentation.js";
import type { Timeline } from "../core/types.js";

const timeline = { duration: 2.01, speed: 1.5 } as Timeline;

test("intro holds after the fade, eases into 1x, and starts the outro when replay data ends", () => {
  for (const fps of [30, 60]) {
    const timing = presentationTiming(timeline.duration, fps, true);
    const at = (frame: number) => presentationAt(timeline, frame / fps, fps, true);
    assert.equal(at(0).scene?.kind, "intro");
    assert.equal(at(timing.introFrames - 1).gameplayTime, -1);
    assert.equal(at(timing.introFrames - 1).gameplayRate, 0);
    assert.equal(at(timing.sceneFrames).scene, null);
    assert.equal(at(timing.introFrames - 1).scene, null);
    assert.equal(at(timing.introFrames).scene, null);
    assert.equal(at(timing.introFrames).gameplayTime, -1);
    const midEase = timing.introFrames + Math.floor(timing.introEaseFrames / 2);
    assert.ok(at(midEase).gameplayRate > 0 && at(midEase).gameplayRate < 1);
    const motionStart = timing.introFrames + timing.introEaseFrames;
    assert.equal(at(motionStart).gameplayRate, 1);
    const end = timing.outroStartFrame;
    assert.equal(at(end - 1).scene, null);
    assert.equal(at(end).scene?.kind, "outro");
    assert.equal(at(end).gameplayTime, at(end - 1).gameplayTime);
    assert.equal(timing.outroPauseFrames / fps, outroPause);
    assert.equal(timing.introPauseFrames / fps, introPause);
    assert.equal(timing.introEaseFrames / fps, introEase);
    assert.deepEqual(at(timing.outroStartFrame).scene, { kind: "outro", time: 0 });
    assert.equal(at(timing.frames - 1).gameplayTime, at(end).gameplayTime);
    assert.deepEqual(at(timing.frames + 100), at(timing.frames - 1));
  }
});

test("disabled animations add no delay; duration limits only gameplay", () => {
  assert.equal(presentationTiming(2, 30).frames, 60);
  assert.equal(presentationAt(timeline, 1, 30).gameplayTime, 1);
  assert.equal(presentationAt(timeline, 1, 30).scene, null);
  const short = presentationTiming(1, 30, true);
  assert.equal(presentationAt(timeline, short.outroStartFrame / 30 - 0.05, 30, true, 1).scene, null);
  assert.equal(presentationAt(timeline, short.outroStartFrame / 30, 30, true, 1).scene?.kind, "outro");
  assert.equal(presentationTiming(1, 30, true).duration, short.frames / 30);
  const enabled = compositeArgs("in.mp4", "out.mp4", 2, 30, true);
  const holdMs = Math.round(presentationTiming(2, 30, true).introFrames / 30 * 1000);
  assert.match(enabled[enabled.indexOf("-af") + 1] ?? enabled[enabled.indexOf("-filter_complex") + 1], new RegExp(`adelay=${holdMs}:all=1`));
  assert.equal(enabled[enabled.indexOf("-t") + 1], String(presentationTiming(2, 30, true).duration));
  assert.equal(compositeArgs("in.mp4", "out.mp4", 2, 30).includes("-af"), true);
  const trimmed = compositeArgs("in.mp4", "out.mp4", 2, 30, true, 1.32);
  assert.deepEqual(trimmed.slice(0, 5), ["-y", "-ss", "0.32000000000000006", "-i", "in.mp4"]);
});

test("first note follows the intro hold and ease by one second of gameplay", () => {
  for (const speed of [.75, 1, 1.5]) for (const time of [0, 1027, 30000]) for (const fps of [24, 60, 120]) {
    const map = { ...timeline, duration: 60, speed, hitObjects: [{ time }] } as Timeline;
    const first = time / 1000 / speed;
    const timing = presentationTiming(map.duration, fps, true, first);
    const firstHitFrame = timing.introFrames + timing.introEaseFrames + Math.round(first * fps) - timing.startFrame - timing.introEaseConsumedFrames;
    assert.ok(Math.abs(firstHitFrame / fps - (timing.introFrames + timing.introEaseFrames) / fps - (1 - timing.introEaseConsumedFrames / fps)) <= 1 / fps);
    assert.equal(presentationAt(map, 0, fps, true).gameplayTime, timing.startFrame / fps);
    assert.equal(presentationAt(map, timing.introFrames / fps, fps, true).gameplayTime, timing.startFrame / fps);
    assert.equal(presentationAt(map, timing.introFrames / fps, fps, true).gameplayRate, 0);
  }
});
