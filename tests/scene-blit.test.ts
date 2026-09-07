import test from "node:test";
import assert from "node:assert/strict";
import { blitSprite, fadeToBlack, fillBgra, mixBuffers } from "../core/scene-blit.js";
import { introMotion, outroMotion, widgetCloseScale } from "../src/score-scenes/widgets/motion.js";
import { sceneBlur, sceneFade } from "../core/presentation.js";
import { overlayData, sceneFlags } from "../src/score-scenes/data.js";
import type { Timeline } from "../core/types.js";

test("sprite blit tints, clips, and covers the destination", () => {
  const dest = new Uint8Array(8 * 8 * 4);
  fillBgra(dest, [0, 0, 1, 1]);
  const src = new Uint8Array([0, 0, 255, 255]);
  blitSprite(dest, 8, 8, src, 1, 1, 2, 3, 2, 2, [1, 1, 1, 1], [2, 3, 1, 1]);
  const at = (x: number, y: number) => [...dest.subarray((y * 8 + x) * 4, (y * 8 + x) * 4 + 4)].map(v => Math.round(v));
  assert.deepEqual(at(2, 3), [0, 0, 255, 255]);
  assert.deepEqual(at(3, 3), [255, 0, 0, 255]);
  const white = new Uint8Array([255, 255, 255, 255]);
  blitSprite(dest, 8, 8, white, 1, 1, 0, 0, 1, 1, [0, 1, 0, 0.5]);
  assert.ok(at(0, 0)[1] > 100);
});

test("background mix and fade keep opaque frames", () => {
  const dest = new Uint8Array(4), clear = new Uint8Array([10, 20, 30, 255]), soft = new Uint8Array([110, 120, 130, 255]);
  mixBuffers(dest, clear, soft, 0.5);
  assert.deepEqual([...dest], [60, 70, 80, 255]);
  fadeToBlack(dest, 1);
  assert.deepEqual([...dest], [0, 0, 0, 255]);
});

test("intro and outro motion keep the same clock as the browser scenes", () => {
  const data = overlayData({
    player: "mrekk", playerRank: 1, playerStats: { countryRank: 1, pp: 32190, hours: 3259, playcount: 241813, monthlyPlaycounts: [{ date: "2020-07-01", count: 5771 }, { date: "2021-01-01", count: 100 }] },
    title: "Crystalia", mods: "HDDT", stars: 12.14, bpm: 405, od: 10.64, speed: 1.5, preempt: 300,
    snapshots: [{ time: 0, score: 1, combo: 1, maxCombo: 1, accuracy: 97.44, pp: 1857, grade: "SH", hits: { "300": 551, "100": 22, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 0 }],
    sceneInfo: { title: "Crystalia", artist: "DJ TOTTO", mapper: "Hysteria", ar: 10.87, od: 10.64, arMs: 320, odMs: 16.1, cs: 3.3, hp: 6, maxCombo: 882, playedAt: "2026-01-24", score: { time: 0, score: 1, combo: 1, maxCombo: 1, accuracy: 97.44, pp: 1857, grade: "SH", hits: { "300": 551, "100": 22, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 0 } },
  } as unknown as Timeline);
  data.score!.mods = ["HD", "DT"];
  const opening = introMotion(0.2, data);
  assert.ok(opening.topCard.opacity > 0.5 && opening.topCard.y > 0);
  assert.equal(introMotion(1.2, data).topPlayer.opacity, 1);
  assert.equal(introMotion(3.5, data).showMap, true);
  assert.ok(introMotion(5.1, data).widget.originTop);
  assert.ok(widgetCloseScale(5.2).pull > 0);
  const outro = outroMotion(2.2);
  assert.equal(outro.lens.opacity, 1);
  assert.ok(outro.leftFlyout.opacity > 0.9);
  assert.equal(outroMotion(5.3).container < 0.5, true);
  assert.equal(sceneBlur("intro", 0), 1);
  assert.ok(sceneBlur("intro", 5.2) < 0.5);
  assert.equal(sceneFade("intro", 0), 1);
  assert.equal(sceneFade("outro", 5.1) > 0.7, true);
  assert.equal(sceneFlags({ online: { topPlays: [1], map: { mapperAvatar: "x" }, } } as never).topPlays, true);
});
