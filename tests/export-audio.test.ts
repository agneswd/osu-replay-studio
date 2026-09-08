import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { outroWave, outroMusicArgs } from "../core/audio.js";
import { compositeArgs } from "../core/presentation.js";
import { runtimeTool } from "../core/runtime.js";

test("encoded audio keeps music and outro cues at their presentation times", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-audio-"));
  const run = (args: string[]) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", "-y", ...args], { maxBuffer: 8_000_000, timeout: 20_000 });
    assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
    return result.stdout;
  };
  try {
    const cues = path.join(work, "cues.wav"), encoded = path.join(work, "audio.m4a");
    writeFileSync(cues, outroWave());
    const args = compositeArgs("game.mp4", "out.mp4", 2, 60, true, 0, 1, "anull", cues);
    const graph = "[0:a]" + args[args.indexOf("-filter_complex") + 1].split(";[0:a]")[1].replace("[2:a]", "[1:a]");
    run(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-i", cues,
      "-filter_complex", graph, "-map", "[outa]", "-c:a", "aac", "-ar", "48000", encoded]);
    const pcm = run(["-i", encoded, "-ac", "1", "-f", "f32le", "-"]);
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    assert.ok(Math.abs(samples.length / 48000 - 13.8) < .03);
    const peak = (from: number, to: number) => samples.subarray(from * 48000, to * 48000).reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
    assert.ok(peak(0, 5) < .0001);
    assert.ok(peak(5.5, 7) > .05, "Gameplay music is audible.");
    assert.ok(peak(8.5, 10.3) > .005, "Outro cues are audible.");
    assert.ok(peak(11, 13.5) < .0001);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("music continues through the outro and fades to silence with the black transition", () => {
  const work = mkdtempSync(path.join(os.tmpdir(), "studio-outro-music-"));
  const run = (args: string[]) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", "-y", ...args], { maxBuffer: 8_000_000, timeout: 20_000 });
    assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
    return result.stdout;
  };
  try {
    const song = path.join(work, "song.wav"), game = path.join(work, "game.wav");
    const music = path.join(work, "music.wav"), cues = path.join(work, "cues.wav");
    run(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=10", song]);
    run(["-i", song, "-t", "2", "-af", "volume=0.25,afade=t=out:st=1:d=1", game]);
    writeFileSync(cues, outroWave());
    run(outroMusicArgs(game, song, music, 0, 0, 1, 8.4, 1));
    const args = compositeArgs("unused.mp4", "unused.mp4", 2, 60, true, 0, 1, "anull", cues, music);
    const graph = "[3:a]" + args[args.indexOf("-filter_complex") + 1].split(";[3:a]")[1];
    const pcm = run(["-i", game, "-i", game, "-i", cues, "-i", music,
      "-filter_complex", graph, "-map", "[outa]", "-ac", "1", "-f", "f32le", "-"]);
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    const peak = (from: number, to: number) => samples.subarray(Math.round(from * 48000), Math.round(to * 48000))
      .reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
    assert.ok(peak(10.5, 12) > .01, "The song remains audible after gameplay and the outro cues.");
    assert.ok(Math.abs(peak(10.5, 12) / peak(5.6, 6.2) - .5) < .03, "Outro music uses half the gameplay volume.");
    assert.ok(peak(13.5, 13.6) < peak(13.1, 13.2) * .5, "Music fades with the black transition.");
    assert.ok(peak(13.66, 13.79) < .0001, "The final black frames are silent.");
    // An audio file that ends before the outro must produce silence instead of a stuck filter.
    run(outroMusicArgs(game, game, path.join(work, "short.wav"), 0, 0, 3, 8.4, 1.5, false));
  } finally { rmSync(work, { recursive: true, force: true }); }
});
