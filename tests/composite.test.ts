import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compositeArgs, gameplayOutputArgs, presentationTiming } from "../core/presentation.js";
import { runtimeTool } from "../core/runtime.js";

test("opaque scenes and transparent gameplay preserve export frames and colors", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-composite-"));
  const ffmpeg = (args: string[], input?: Buffer) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], {
      input, timeout: 15_000, maxBuffer: 2_000_000,
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr.toString());
    return result.stdout;
  };
  try {
    const gameplay = path.join(work, "gameplay.mp4");
    const output = path.join(work, "out.mp4");
    ffmpeg(["-f", "lavfi", "-i", "color=white:s=16x16:r=30:d=1", "-c:v", "libx264", gameplay]);
    const timing = presentationTiming(0.2, 30, true);
    const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.png`, import.meta.url));
    const frames = Buffer.concat([
      ...Array<Buffer>(timing.sceneFrames).fill(fixture("opaque-red")),
      ...Array<Buffer>(timing.introFrames - timing.sceneFrames).fill(fixture("transparent")),
      ...Array<Buffer>(timing.outroStartFrame - timing.introFrames).fill(fixture("transparent")),
      ...Array<Buffer>(timing.sceneFrames).fill(fixture("opaque-blue")),
    ]);
    ffmpeg(compositeArgs(gameplay, output, 0.2, 30, true), frames);
    const pixels = ffmpeg(["-i", output, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    assert.equal(pixels.length, timing.frames * 16 * 16 * 3);
    const pixel = (frame: number) => [...pixels.subarray(frame * 768, frame * 768 + 3)];
    const red = pixel(30), white = pixel(timing.sceneFrames + 2), blue = pixel(timing.frames - 30);
    assert.ok(red[0] > 240 && red[1] < 10 && red[2] < 10);
    assert.ok(white.every(value => value > 240));
    assert.ok(pixel(timing.outroStartFrame - 1).every(value => value > 240), "The final gameplay frame stays clear before the outro.");
    assert.ok(blue[0] < 10 && blue[1] < 10 && blue[2] > 240);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});


test("plain gameplay export trims between keyframes without an overlay input", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-plain-"));
  const run = (args: string[]) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], { timeout: 15_000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.stderr.toString());
    return result.stdout;
  };
  try {
    const source = path.join(work, "source.mp4"), output = path.join(work, "out.mp4");
    run(["-f", "lavfi", "-i", "testsrc2=s=64x64:r=30:d=2", "-c:v", "libx264", "-g", "60", source]);
    run(gameplayOutputArgs(source, output, .6, 30, .37));
    const pixels = run(["-i", output, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    assert.equal(pixels.length, 18 * 64 * 64 * 3);
    const reference = run(["-ss", "0.37", "-i", source, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const error = reference.reduce((sum, value, i) => sum + Math.abs(value - pixels[i]!), 0) / reference.length;
    assert.ok(error < 3, `The first frame must match the requested cut, mean error ${error}.`);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
