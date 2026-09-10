import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { atTime, frameAt, healthAt } from "../core/timeline.js";
import { resolveBeatmap } from "../core/analyze.js";
import { validateOptions, run } from "../core/render.js";
import {
  defaultOverlayIds,
  defaultOverlayAccent,
  normalizeOverlayAccent,
  overlayIds,
  type Timeline,
} from "../core/types.js";

test("timeline uses the latest event and applies speed once, including backward seeks", () => {
  const samples = [
    { time: 0, score: 0 },
    { time: 1000, score: 300 },
    { time: 1000, score: 600 },
    { time: 2000, score: 900 },
  ];
  assert.equal(atTime(samples, -1), undefined);
  assert.equal(atTime(samples, 1000)?.score, 600);
  assert.equal(atTime(samples, 500)?.score, 0);
  const timeline: Timeline = {
    replay: "",
    beatmap: "",
    player: "a",
    playerRank: 42,
    playerStats: { countryRank: 7, pp: 1, hours: 1, playcount: 1, monthlyPlaycounts: [] },
    title: "b",
    mods: "DT",
    speed: 1.5,
    preempt: 600,
    duration: 2,
    stars: 1,
    bpm: 180,
    od: 5,
    maxPP: 1,
    strains: [],
    health: [{ time: 0, value: 0.7 }],
    warnings: [],
    snapshots: samples.map((s) => ({
      ...s,
      combo: 1,
      maxCombo: 1,
      accuracy: 100,
      hits: { "300": 1, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 },
      pp: 1,
      grade: "SS",
      errors: [],
      ur: 0,
    })),
  };
  assert.equal(frameAt(timeline, 1).userProfile.rank, 42);
  assert.equal(frameAt(timeline, 1).userProfile.countryRank, 7);
  assert.equal(frameAt(timeline, 1).gameplay.score, 600);
  assert.equal(frameAt(timeline, 1).menu.bm.time.current, 1500);
  assert.equal(frameAt(timeline, 0.2).gameplay.score, 0);
  assert.equal(frameAt(timeline, 1).gameplay.hp.normal, 70);
});

test("odometer timing survives unrelated events, duplicate timestamps, and backward seeks", () => {
  const base = {
    time: 0, score: 0, combo: 11, maxCombo: 13, accuracy: 100, pp: 11,
    hits: { "300": 1, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 },
    grade: "SS", errors: [], ur: 0,
  };
  const timeline: Timeline = {
    replay: "", beatmap: "", player: "a", title: "b", mods: "NM",
    speed: 1, preempt: 600, duration: 2, stars: 1, bpm: 180, od: 5,
    maxPP: 100, strains: [], health: [], warnings: [],
    snapshots: [
      base,
      { ...base, time: 300, combo: 12, pp: 12.2 },
      { ...base, time: 300, combo: 13, pp: 12.4 },
      { ...base, time: 360, combo: 13, pp: 12.49, score: 900 },
      { ...base, time: 1000, combo: 0, pp: 10.5, accuracy: 99.11 },
    ],
  };
  for (const speed of [1, 1.5, 0.75]) {
    timeline.speed = speed;
    const seconds = (300 / speed + 80) / 1000;
    const middle = frameAt(timeline, seconds);
    assert.deepEqual(middle.counters?.combo, { from: 11, to: 13, progress: 0.5 });
    assert.deepEqual(middle.counters?.pp, { from: 11, to: 12, progress: 0.5 });
    assert.deepEqual(middle.counters?.accuracy, { from: 100, to: 100, progress: 1 });
    const settled = frameAt(timeline, (300 / speed + 200) / 1000);
    assert.equal(settled.counters?.combo.progress, 1);
    const broken = frameAt(timeline, (1000 / speed + 80) / 1000);
    assert.equal(broken.counters?.combo.from, 13);
    assert.equal(broken.counters?.combo.to, 0);
    assert.equal(broken.counters?.accuracy.from, 100);
    assert.equal(broken.counters?.accuracy.to, 99.11);
    assert.deepEqual(frameAt(timeline, seconds), middle);
    assert.equal(frameAt(timeline, 0).counters?.combo.progress, 1);
  }
});

test("beatmap resolution validates the actual bytes, including manual selection", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-test-"));
  try {
    const file = path.join(dir, "map.osu");
    const bytes = Buffer.from("osu file format v14\r\n");
    await writeFile(file, bytes);
    const md5 = createHash("md5").update(bytes).digest("hex");
    assert.equal(await resolveBeatmap(dir, md5), file);
    await assert.rejects(
      resolveBeatmap(dir, "0".repeat(32), file),
      /does not match/,
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      resolveBeatmap(dir, md5, undefined, controller.signal),
      /abort/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("render settings reject unknown components and unsupported output geometry", () => {
  const options = {
    replay: "r",
    songs: "s",
    danser: "d",
    output: "out.mp4",
    width: 1280,
    height: 720,
    fps: 30,
    overlays: [...overlayIds],
  };
  validateOptions(options);
  assert.throws(() => validateOptions({ ...options, fps: 0 }), /resolution/);
  assert.throws(
    () => validateOptions({ ...options, duration: NaN }),
    /Duration/,
  );
  assert.throws(
    () =>
      validateOptions({
        ...options,
        overlays: ["../x" as (typeof overlayIds)[number]],
      }),
    /overlay/,
  );
  validateOptions({ ...options, overlayAccent: "#9cf" });
  assert.throws(
    () => validateOptions({ ...options, overlayAccent: "blue" }),
    /overlayAccent/,
  );
});

test("overlay accent falls back to light gray and accepts hex", () => {
  assert.equal(normalizeOverlayAccent(undefined), defaultOverlayAccent);
  assert.equal(normalizeOverlayAccent("not-a-color"), defaultOverlayAccent);
  assert.equal(normalizeOverlayAccent("#9cf"), "#99ccff");
  assert.equal(normalizeOverlayAccent("#00D2FF"), "#00d2ff");
});

test("key presses are enabled in the default overlay set", () => {
  assert.ok(defaultOverlayIds.includes("key-overlay"));
  assert.deepEqual(defaultOverlayIds, overlayIds);
});

test("tool failures and cancellation stop the job", async () => {
  await assert.rejects(
    run(
      process.execPath,
      ["-e", "process.exit(7)"],
      new AbortController().signal,
      () => {},
    ),
    /exited with 7/,
  );
  const controller = new AbortController();
  const task = run(
    process.execPath,
    ["-e", "setInterval(() => {},1000)"],
    controller.signal,
    () => {},
  );
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(task, /abort/i);
});

test("real OSR decoding keeps slider events ordered and judges the slider at its tail", async () => {
  const { analyze } = await import("../core/analyze.js");
  const { copyFile } = await import("node:fs/promises");
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-replay-test-"));
  try {
    await copyFile("tests/fixtures/map.osu", path.join(dir, "map.osu"));
    await writeFile(path.join(dir, "audio.wav"), Buffer.alloc(44));
    const timeline = await analyze({
      replay: path.resolve("tests/fixtures/replay.osr"),
      songs: dir,
    });
    assert.ok(
      timeline.snapshots.every((s, i, a) => !i || s.time >= a[i - 1].time),
    );
    assert.equal(frameAt(timeline, 1.9).gameplay.hits["300"], 0);
    assert.equal(frameAt(timeline, 3.5).gameplay.hits["300"], 2);
    assert.equal(frameAt(timeline, 4.2).gameplay.hits["300"], 2);
    assert.equal(frameAt(timeline, 4.6).gameplay.hits["300"], 3);
    assert.equal(frameAt(timeline, 4.6).gameplay.accuracy, 100);
    assert.equal(frameAt(timeline, 4.6).gameplay.combo.current, 4);
    assert.equal(frameAt(timeline, 4.6).gameplay.grade, "SS");
    // Last object is a 500 ms slider from 4000. Fade waits for the tail plus the 50 window.
    assert.equal(timeline.gameplayFadeStart, 4.65);
    assert.ok(timeline.duration >= 5.75, "Finish the slider tail, judgement fade and recorded cursor data.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("HP interpolates sparse samples, holds endpoints, preserves zero and handles missing graphs", () => {
  const samples = [
    { time: 1000, value: 1 },
    { time: 3000, value: 0 },
    { time: 5000, value: 0.5 },
  ];
  assert.equal(healthAt(samples, 0), 100);
  assert.equal(healthAt(samples, 2000), 50);
  assert.equal(healthAt(samples, 3000), 0);
  assert.equal(healthAt(samples, 4000), 25);
  assert.equal(healthAt(samples, 9000), 50);
  assert.equal(healthAt(samples, 2000), 50);
  assert.equal(healthAt([], 0), null);
});
