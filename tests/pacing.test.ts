import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { entranceSamples, entranceAudioArgs } from "../core/audio.js";
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
  for (let i = 1; i < output.length; i++) if (output[i] > .05 && output[i - 1] <= .05) starts.push(i / rate);
  assert.equal(starts.length, 3);
  for (const [i, time] of [.03, .12, .27].entries())
    assert.ok(Math.abs(starts[i] - (presentationSeconds(timing, time - .5 / rate, 60) - timing.introFrames / 60)) < 2 / rate);
});

test("entrance audio fades to half volume over the speed ramp", () => {
  const rate = 48000;
  const output = entranceSamples(new Float32Array(rate * 2).fill(1), rate, 2, introEase);
  for (const progress of [0, .25, .5, .75, 1 - 1 / rate]) {
    const frame = Math.round(progress * introEase * rate);
    for (const channel of [0, 1]) assert.ok(Math.abs(output[frame * 2 + channel] - progress * .5) < .0001);
  }
});

test("export audio joins the half-volume ramp and returns smoothly to normal", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-audio-fade-"));
  const run = (args: string[]) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], { maxBuffer: 4000000 });
    assert.equal(result.status, 0, result.stderr.toString());
    return result.stdout;
  };
  try {
    const rate = 48000, source = path.join(work, "source.wav"), ramp = path.join(work, "ramp.f32"), output = path.join(work, "output.wav");
    run(["-f", "lavfi", "-i", "aevalsrc=0.8|0.4:s=48000:d=2", "-c:a", "pcm_f32le", source]);
    const input = new Float32Array(rate * 2);
    for (let i = 0; i < rate; i++) { input[i * 2] = .8; input[i * 2 + 1] = .4; }
    writeFileSync(ramp, Buffer.from(entranceSamples(input, rate, 2, introEase).buffer));
    run(entranceAudioArgs(source, ramp, output, introEase));
    const bytes = run(["-i", output, "-f", "f32le", "-"]);
    const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    for (const [time, gain] of [[.5, .25], [1, .5], [1.125, .75], [1.25, 1], [1.5, 1]]) {
      const frame = Math.round(time * rate);
      for (const [channel, level] of [[0, .8], [1, .4]])
        assert.ok(Math.abs(samples[frame * 2 + channel] - level * gain) < .0001, `Volume at ${time}s, channel ${channel}: ${samples[frame * 2 + channel]} vs ${level * gain}`);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});
