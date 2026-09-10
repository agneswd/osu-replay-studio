import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { outroMusicArgs } from "../core/audio.js";
import { compositeArgs, presentationTiming } from "../core/presentation.js";
import { runtimeTool } from "../core/runtime.js";

test("music continues through the outro and fades to silence with the black transition", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-outro-music-"));
  const run = (args: string[]) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", "-y", ...args], { maxBuffer: 8_000_000, timeout: 20_000 });
    assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
    return result.stdout;
  };
  try {
    const song = path.join(work, "song.wav"), game = path.join(work, "game.wav");
    const music = path.join(work, "music.wav");
    const timing = presentationTiming(2, 60, true, 1);
    run(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=20", song]);
    run(["-i", song, "-t", "2", "-af", "volume=0.25,afade=t=out:st=1:d=1", game]);
    run(outroMusicArgs(game, song, music, 0, 0, 1, (timing.gameplayFrames + timing.outroPauseFrames + timing.sceneFrames) / 60, 1));
    const args = compositeArgs("unused.mp4", "unused.mp4", 2, 60, true, 0, 1, "anull", music);
    const graph = "[2:a]" + args[args.indexOf("-filter_complex") + 1].split(";[2:a]")[1];
    const pcm = run(["-i", game, "-i", game, "-i", music,
      "-filter_complex", graph, "-map", "[outa]", "-ac", "1", "-f", "f32le", "-"]);
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    const peak = (from: number, to: number) => samples.subarray(Math.round(from * 48000), Math.round(to * 48000))
      .reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
    const hold = timing.introFrames / 60;
    const outro = timing.outroStartFrame / 60;
    const end = timing.duration;
    const gameplayPeak = peak(hold + 0.55, hold + 0.85);
    const outroPeak = peak(outro + 2.2, outro + 3.4);
    assert.ok(outroPeak > .01, "The song remains audible through the outro.");
    assert.ok(Math.abs(outroPeak / gameplayPeak - .5) < .03, "Outro music uses half the gameplay volume.");
    assert.ok(peak(end - 0.25, end - 0.15) < peak(end - 1.1, end - 1.0) * .5, "Music fades with the black transition.");
    assert.ok(peak(end - 0.14, end - 0.01) < .0001, "The final black frames are silent.");
    run(outroMusicArgs(game, game, path.join(work, "short.wav"), 0, 0, 3, (timing.gameplayFrames + timing.outroPauseFrames + timing.sceneFrames) / 60, 1.5, false));
  } finally { rmSync(work, { recursive: true, force: true }); }
});
