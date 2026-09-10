import test from "node:test";
import assert from "node:assert/strict";
import { presentationAt, presentationTiming, compositeArgs, introPause, introEase, gameplayLeadIn, outroPause, gameplayClock, presentationSeconds, introGameplayStart, firstNoteSeconds } from "../core/presentation.js";
import type { Timeline } from "../core/types.js";

const timeline = { duration: 2.01, speed: 1.5 } as Timeline;

test("the entrance holds one second before the first note regardless of song lead-in", () => {
  for (const speed of [.75, 1, 1.5]) for (const time of [0, 500, 1027, 10000]) {
    const map = { ...timeline, duration: 20, speed, hitObjects: [{ time }] } as Timeline;
    const first = firstNoteSeconds(map), start = introGameplayStart(map);
    assert.equal(start, first - 1);
    const timing = presentationTiming(20, 60, true, first, start);
    assert.equal(timing.introEaseFrames / 60, 1.5);
    assert.equal(presentationAt(map, 0, 60, true).gameplayTime, timing.startFrame / 60);
    const hitAt = presentationSeconds(timing, first, 60);
    assert.ok(Math.abs(hitAt - timing.introFrames / 60 - 1.75) <= 1 / 60);
    assert.equal(gameplayClock(timing, hitAt, 60).rate, 1);
    const args = compositeArgs("in.mp4", "out.mp4", 20, 60, true, 3, first, "anull", undefined, start);
    assert.equal(Number(args[args.indexOf("-ss") + 1]), 3 + timing.startFrame / 60);
    assert.equal(Number(args[args.indexOf("-t") + 1]), timing.duration);
  }
});

test("intro holds during the closing fade, eases into 1x, and fades gameplay for one second before the outro", () => {
  for (const fps of [30, 60]) {
    const timing = presentationTiming(timeline.duration, fps, true);
    const at = (frame: number) => presentationAt(timeline, frame / fps, fps, true);
    assert.equal(at(0).scene?.kind, "intro");
    assert.equal(at(timing.introFrames - 1).gameplayTime, -gameplayLeadIn);
    assert.equal(at(timing.introFrames - 1).gameplayRate, 0);
    assert.equal(at(timing.sceneFrames).scene, null);
    assert.equal(at(timing.introFrames - 1).scene?.kind, "intro");
    assert.equal(at(timing.introFrames).scene?.kind, "intro");
    assert.equal(at(timing.introFrames).gameplayTime, -gameplayLeadIn);
    const midEase = timing.introFrames + Math.floor(timing.introEaseFrames / 2);
    assert.ok(at(midEase).gameplayRate > 0 && at(midEase).gameplayRate < 1);
    const motionStart = timing.introFrames + timing.introEaseFrames;
    assert.equal(at(motionStart).gameplayRate, 1);
    const end = timing.outroStartFrame;
    assert.equal(end - timing.gameplayEndFrame, fps);
    assert.equal(at(timing.gameplayEndFrame).scene, null);
    assert.equal(at(timing.gameplayEndFrame).gameplayRate, 0);
    assert.equal(at(timing.gameplayEndFrame + fps / 2).outroTransition, .5);
    assert.equal(at(end).outroTransition, 1);
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
  assert.equal(trimmed[1], "-ss");
  assert.ok(Math.abs(Number(trimmed[2]) - .32) < 1e-8);
});

test("first note follows the intro hold and ease after at least one second of source gameplay", () => {
  for (const speed of [.75, 1, 1.5]) for (const time of [0, 1027, 30000]) for (const fps of [24, 60, 120]) {
    const map = { ...timeline, duration: 60, speed, hitObjects: [{ time }] } as Timeline;
    const first = time / 1000 / speed;
    const timing = presentationTiming(map.duration, fps, true, first, introGameplayStart(map));
    const firstHitFrame = timing.introFrames + timing.introEaseFrames + Math.round(first * fps) - timing.startFrame - timing.introEaseConsumedFrames;
    assert.ok(Math.abs(firstHitFrame / fps - (timing.introFrames + timing.introEaseFrames) / fps - (first - introGameplayStart(map) - timing.introEaseConsumedFrames / fps)) <= 1 / fps);
    assert.equal(presentationAt(map, 0, fps, true).gameplayTime, timing.startFrame / fps);
    assert.equal(presentationAt(map, timing.introFrames / fps, fps, true).gameplayTime, timing.startFrame / fps);
    assert.equal(presentationAt(map, timing.introFrames / fps, fps, true).gameplayRate, 0);
  }
});

test("entrance clock is continuous, invertible, and overlaps the last intro frames", () => {
  for (const fps of [24, 30, 60, 120]) {
    const timing = presentationTiming(10, fps, true, 2);
    const start = timing.introFrames / fps, ease = timing.introEaseFrames / fps;
    assert.ok(start < timing.sceneFrames / fps);
    assert.equal(gameplayClock(timing, start - .1, fps).rate, 0);
    for (let t = start + .001; t < start + ease + 2; t += .003) {
      const position = gameplayClock(timing, t, fps);
      assert.ok(Math.abs(presentationSeconds(timing, position.time, fps) - t) < 1e-8);
      const next = gameplayClock(timing, t + .001, fps);
      assert.ok(next.time >= position.time && next.time - position.time <= .001001);
    }
    assert.ok(gameplayClock(timing, timing.sceneFrames / fps - 1 / fps, fps).time > timing.startFrame / fps);
  }
});
