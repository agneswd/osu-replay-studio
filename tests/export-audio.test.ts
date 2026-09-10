import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { outroWave, outroMusicArgs } from "../core/audio.js";
import { compositeArgs, presentationTiming } from "../core/presentation.js";
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
    const timing = presentationTiming(2, 60, true, 1);
    const args = compositeArgs("game.mp4", "out.mp4", 2, 60, true, 0, 1, "anull", cues);
    const graph = "[0:a]" + args[args.indexOf("-filter_complex") + 1].split(";[0:a]")[1].replace("[2:a]", "[1:a]");
    run(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-i", cues,
      "-filter_complex", graph, "-map", "[outa]", "-c:a", "aac", "-ar", "48000", encoded]);
    const pcm = run(["-i", encoded, "-ac", "1", "-f", "f32le", "-"]);
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    assert.ok(Math.abs(samples.length / 48000 - timing.duration) < .03);
    const peak = (from: number, to: number) => samples.subarray(from * 48000, to * 48000).reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
    const hold = timing.introFrames / 60;
    const outro = timing.outroStartFrame / 60;
    assert.ok(peak(0, hold - 0.2) < .0001);
    assert.ok(peak(hold + timing.introEaseFrames / 60 + 0.2, outro - 0.2) > .05, "Gameplay music is audible.");
    assert.ok(peak(outro + 0.2, outro + 1.8) > .005, "Outro cues are audible.");
    assert.ok(peak(timing.duration - 0.4, timing.duration - 0.05) < .0001);
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
    const timing = presentationTiming(2, 60, true, 1);
    run(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=10", song]);
    run(["-i", song, "-t", "2", "-af", "volume=0.25,afade=t=out:st=1:d=1", game]);
    writeFileSync(cues, outroWave());
    run(outroMusicArgs(game, song, music, 0, 0, 1, (timing.gameplayFrames + timing.sceneFrames) / 60, 1));
    const args = compositeArgs("unused.mp4", "unused.mp4", 2, 60, true, 0, 1, "anull", cues, music);
    const graph = "[3:a]" + args[args.indexOf("-filter_complex") + 1].split(";[3:a]")[1];
    const pcm = run(["-i", game, "-i", game, "-i", cues, "-i", music,
      "-filter_complex", graph, "-map", "[outa]", "-ac", "1", "-f", "f32le", "-"]);
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    const peak = (from: number, to: number) => samples.subarray(Math.round(from * 48000), Math.round(to * 48000))
      .reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
    const hold = timing.introFrames / 60;
    const outro = timing.outroStartFrame / 60;
    const end = timing.duration;
    const gameplayPeak = peak(hold + 0.55, hold + 0.85);
    const outroPeak = peak(outro + 2.2, outro + 3.4);
    assert.ok(outroPeak > .01, "The song remains audible after gameplay and the outro cues.");
    assert.ok(Math.abs(outroPeak / gameplayPeak - .5) < .03, "Outro music uses half the gameplay volume.");
    assert.ok(peak(end - 0.25, end - 0.15) < peak(end - 1.1, end - 1.0) * .5, "Music fades with the black transition.");
    assert.ok(peak(end - 0.14, end - 0.01) < .0001, "The final black frames are silent.");
    run(outroMusicArgs(game, game, path.join(work, "short.wav"), 0, 0, 3, (timing.gameplayFrames + timing.sceneFrames) / 60, 1.5, false));
  } finally { rmSync(work, { recursive: true, force: true }); }
});
