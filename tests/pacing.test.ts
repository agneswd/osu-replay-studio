import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { entranceSamples } from "../core/audio.js";
import { gameplayClock, gameplayPaceArgs, gameplayLeadIn, introEase, presentationTiming, presentationSeconds } from "../core/presentation.js";
import { nativeSceneMotionArgs } from "../core/native-hud.js";
import { runtimeTool } from "../core/runtime.js";

test("encoded gameplay follows the preview speed ramp at each supported frame rate", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-pace-"));
  const ffmpeg = (args: string[], input?: Buffer) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", "-y", ...args], { input, timeout: 15000, maxBuffer: 4000000 });
    assert.equal(result.status, 0, result.stderr.toString());
    return result.stdout;
  };
  try {
    for (const fps of [24, 30, 60, 120]) for (const duration of [1, .001]) {
      const timing = presentationTiming(duration, fps, true, gameplayLeadIn);
      // Each frame encodes its source position as a gray level.
      const sourceFrames = Math.ceil(duration * fps);
      const input = Buffer.concat(Array.from({ length: sourceFrames }, (_, i) => Buffer.alloc(16 * 16 * 3, 30 + Math.round(180 * i / fps))));
      const source = path.join(work, "source.mkv"), output = path.join(work, "paced.mp4");
      ffmpeg(["-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", "16x16", "-framerate", String(fps), "-i", "-", "-c:v", "ffv1", source], input);
      ffmpeg(nativeSceneMotionArgs(source, work, timing, fps));
      const images = readdirSync(work).filter(name => name.startsWith("motion-"));
      assert.equal(images.length, (timing.sceneFrames - timing.introFrames) * 2);
      for (const kind of ["clear", "soft"]) for (let frame = timing.introFrames; frame < timing.sceneFrames; frame++)
        assert.ok(images.includes(`motion-${kind}-${frame}.png`), `Missing ${fps} fps overlap frame ${frame}`);
      for (const name of images) unlinkSync(path.join(work, name));
      ffmpeg(gameplayPaceArgs(source, output, timing, fps));
      const pixels = ffmpeg(["-i", output, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      assert.equal(pixels.length / (16 * 16 * 3), timing.gameplayEndFrame);
      for (let frame = timing.introFrames; frame < timing.gameplayEndFrame; frame++) {
        const sourceTime = Math.min((sourceFrames - 1) / fps, gameplayClock(timing, frame / fps, fps).time);
        const expected = 30 + Math.round(180 * sourceTime);
        assert.ok(Math.abs(pixels[frame * 768] - expected) <= 180 / fps + 3,
          `${fps} fps, frame ${frame}: ${pixels[frame * 768]} vs ${expected}`);
      }
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("audio markers follow the same entrance clock without a seek at full speed", () => {
  const rate = 48000, ease = introEase;
  const timing = presentationTiming(2, 60, true, gameplayLeadIn);
  const source = new Float32Array(rate);
  for (const time of [.03, .12, .27]) {
    source.fill(1, Math.round(time * rate), Math.round((time + .002) * rate));
  }
  const output = entranceSamples(source, rate, 1, ease);
  const starts: number[] = [];
  for (let i = 1; i < output.length; i++) if (output[i] > .5 && output[i - 1] <= .5) starts.push(i / rate);
  assert.equal(starts.length, 3);
  for (const [i, time] of [.03, .12, .27].entries())
    assert.ok(Math.abs(starts[i] - (presentationSeconds(timing, time - .5 / rate, 60) - timing.introFrames / 60)) < 1 / rate);
});
