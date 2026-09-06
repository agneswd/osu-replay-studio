import os from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile, mkdtemp, copyFile, writeFile, rm } from "node:fs/promises";
import { parseReplay } from "replayviewer-js";
import { replayFormat, scoreAccuracy } from "../core/replay-format.js";
import { calculatePP } from "../core/pp.js";
import { analyze } from "../core/analyze.js";

const map = path.resolve("tests/fixtures/map.osu");
test("lazer accuracy includes slider tails and ticks", () => {
  const score = { great: 1, ok: 0, meh: 0, miss: 0, combo: 2, sliderTailMiss: 1, largeTickHit: 1 };
  assert.equal(scoreAccuracy(score, false), 330 / 480 * 100);
  assert.equal(scoreAccuracy(score, true), 100);
});
test("official lazer PP uses the selected mods and slider statistics", async () => {
  const score = { great: 3, ok: 0, meh: 0, miss: 0, combo: 4, sliderTailHit: 1, accuracy: 1 };
  const clean = await calculatePP(map, [], score, [score]);
  assert.equal(clean.scorePP, clean.maxPP);
  assert.equal(clean.pp[0], clean.scorePP);
  const dropped = await calculatePP(map, [], { ...score, sliderTailHit: 0, sliderTailMiss: 1, accuracy: 900 / 1050 }, []);
  // This short, slow map has no difficult-slider PP contribution. A tail drop must not increase PP.
  assert.ok(dropped.scorePP <= clean.scorePP);
  const custom = await calculatePP(map, [{ acronym: "DT", settings: { speed_change: 1.2 } }], score, []);
  const dt = await calculatePP(map, [{ acronym: "DT" }], score, []);
  assert.notEqual(custom.stars, dt.stars);
});
test("lazer import retains head and tail timing and rejects unknown settings", async () => {
  const replayPath = path.resolve("tests/fixtures/lazer.osr");
  const bytes = await readFile(replayPath);
  const replay = await parseReplay(new Uint8Array(bytes).buffer);
  assert.equal(replayFormat(replay).lazer, true);
  assert.throws(() => replayFormat({ ...replay, scoreInfo: { mods: [{ acronym: "WG" }] } }), /Unsupported lazer mod/);
  assert.throws(() => replayFormat({ ...replay, scoreInfo: { mods: [{ acronym: "DT", settings: { speed_change: 99 } }] } }), /Unsupported lazer setting/);
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-lazer-"));
  await copyFile(map, path.join(dir, "map.osu"));
  await writeFile(path.join(dir, "audio.wav"), Buffer.alloc(44));
  const result = await analyze({ replay: replayPath, songs: dir }).finally(() => rm(dir, { recursive: true, force: true }));
  assert.equal(result.replayFormat, "lazer");
  assert.equal(result.snapshots.find(s => s.time === 4000)?.hits["300"], 3);
  assert.equal(result.snapshots.at(-1)?.accuracy, 100);
  assert.equal(result.sceneInfo?.score.accuracy, 100);
  assert.equal(result.sceneInfo?.score.pp, result.maxPP);
});
