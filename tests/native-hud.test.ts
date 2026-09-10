import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { nativeFrameWindow, nativeSceneArgs } from "../core/native-hud.js";
import { runtimeTool } from "../core/runtime.js";

test("native cuts use the same nearest-frame clock at each supported frame rate", () => {
  for (const fps of [24, 30, 60, 120])
    for (const speed of [0.75, 1, 1.5]) {
      const lead = 1 + 0.48 / speed,
        start = -fps,
        frames = fps * 2;
      const cut = nativeFrameWindow(lead, start, frames, fps);
      assert.ok(Math.abs((cut.start - start) / fps - lead) <= 0.5 / fps + 1e-9);
      assert.equal(cut.end - cut.start, frames);
      const early = nativeFrameWindow(lead, -2 * fps, frames, fps);
      const padding = 2 * fps - Math.round(lead * fps);
      assert.equal(early.end + padding, frames);
      assert.ok(early.filter.includes(`tpad=start=${padding}:start_mode=clone`));
    }
});

test("native scene segments join without extra frames or a second gameplay encode", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "studio-native-"));
  const run = (args: string[], input?: Buffer) => {
    const r = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], {
      input,
      timeout: 15000,
      killSignal: "SIGKILL",
      maxBuffer: 2000000,
    });
    assert.equal(r.status, 0, r.error?.message ?? r.stderr.toString());
    return r.stdout;
  };
  try {
    const game = path.join(dir, "game.mp4"),
      intro = path.join(dir, "intro.mp4"),
      outro = path.join(dir, "outro.mp4"),
      output = path.join(dir, "out.mp4");
    run([
      "-f",
      "lavfi",
      "-i",
      "color=white:s=16x16:r=30:d=1",
      "-c:v",
      "libx264",
      "-video_track_timescale",
      "90000",
      game,
    ]);
    const fixture = (name: string) =>
      readFileSync(new URL(`./fixtures/${name}.png`, import.meta.url));
    run(
      nativeSceneArgs(intro, 6, 30),
      Buffer.concat(Array(6).fill(fixture("opaque-red"))),
    );
    assert.ok(nativeSceneArgs(intro, 6, 30, 16, 16, true).includes("rawvideo"));
    run(
      nativeSceneArgs(outro, 6, 30),
      Buffer.concat(Array(6).fill(fixture("opaque-blue"))),
    );
    writeFileSync(
      path.join(dir, "list.txt"),
      "file 'intro.mp4'\nfile 'game.mp4'\nfile 'outro.mp4'\n",
    );
    run([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      path.join(dir, "list.txt"),
      "-c:v",
      "copy",
      output,
    ]);
    const pixels = run([
      "-i",
      output,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ]);
    assert.equal(pixels.length, 42 * 768);
    const at = (frame: number) => [
      ...pixels.subarray(frame * 768, frame * 768 + 3),
    ];
    assert.ok(at(5)[0] > 240 && at(5)[2] < 10);
    assert.ok(at(6).every((c) => c > 240));
    assert.ok(at(35).every((c) => c > 240));
    assert.ok(at(36)[2] > 240 && at(36)[0] < 10);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
