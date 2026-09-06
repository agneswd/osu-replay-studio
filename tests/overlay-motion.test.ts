import test from "node:test";
import assert from "node:assert/strict";
import { animatedLeaderboardAt } from "../core/leaderboard.js";
import { keysAt } from "../core/keys.js";
import type { Snapshot, Timeline } from "../core/types.js";
const snapshot = (time: number, pp: number): Snapshot => ({ time, pp, score: pp * 100, combo: 10, maxCombo: 10,
  accuracy: 100, grade: "SS", hits: { "300": 10, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 0 });

test("leaderboard overtakes animate, survive interruption, and repeat after a seek", () => {
  const snapshots = [snapshot(0, 0), snapshot(1000, 35), snapshot(1100, 65)];
  const timeline = { speed: 1, player: "Replay", mods: "NM", snapshots,
    online: { leaderboard: Array.from({ length: 12 }, (_, id) => ({ id: String(id), name: String(id), pp: 120 - id * 10, score: 0 })) },
  } as unknown as Timeline;
  const at = (time: number) => animatedLeaderboardAt(timeline, snapshots[time >= 1100 ? 2 : time >= 1000 ? 1 : 0], time);
  const player = (time: number) => at(time).rows.find(row => row.current)!;
  assert.equal(player(1000).slot, 7);
  assert.equal(player(1050).slot, 7, "the replay stays at the bottom until it reaches the top eight");
  assert.ok(Math.abs(player(1099.999).slot! - player(1100).slot!) < .001, "no jump during an interrupted move");
  const entering = at(1101).rows.filter(row => !at(1099).rows.some(old => old.id === row.id));
  assert.ok(entering.length > 0);
  assert.ok(entering.every(row => row.slot! < 0), "higher ranks enter through the top edge");
  const middle = at(1150);
  assert.equal(player(1500).slot, 6);
  assert.deepEqual(at(1150), middle, "capture order does not change the animation");
  assert.equal(player(0).slot, 7);
});

test("key lanes merge duplicate buttons and keep counts and holds correct after seeking", () => {
  const timeline = { speed: 1, replayFrames: [
    { time: 0, keys: 0 }, { time: 100, keys: 5 }, { time: 200, keys: 1 }, { time: 300, keys: 0 },
    { time: 400, keys: 10 }, { time: 450, keys: 0 }, { time: 600, keys: 4 }, { time: 650, keys: 0 },
  ] } as Timeline;
  assert.deepEqual(keysAt(timeline, 50).map(lane => lane.count), [0, 0]);
  assert.equal(keysAt(timeline, 250)[0].pressed, true);
  assert.equal(keysAt(timeline, 250)[0].count, 1);
  assert.equal(keysAt(timeline, 300)[0].pressed, false);
  assert.equal(keysAt(timeline, 600)[0].bpm, 60);
  assert.deepEqual(keysAt(timeline, 800).map(lane => lane.count), [2, 1]);
  assert.equal(keysAt(timeline, 2000)[0].bpm, 0);
  assert.deepEqual(keysAt(timeline, 2000)[0].holds, []);
  assert.equal(keysAt(timeline, 250)[0].count, 1);
});

test("timing markers fade with replay time and return after a backward seek", async () => {
  const { frameAt } = await import("../core/timeline.js");
  const timeline = { speed: 1, snapshots: [snapshot(0, 0)], health: [], strains: [],
    timingHits: [{ time: 100, error: -12 }, { time: 300, error: 20 }], duration: 10,
  } as unknown as Timeline;
  const first = frameAt(timeline, .1).timing!;
  assert.equal(first.ticks[0].opacity, 1);
  assert.equal(first.ticks[0].height, .15);
  assert.ok(frameAt(timeline, .15).timing!.ticks[0].height > .15);
  assert.equal(frameAt(timeline, .25).timing!.ticks[0].height, 1);
  assert.ok(frameAt(timeline, 2).timing!.ticks[0].opacity < 1);
  assert.equal(frameAt(timeline, 6).timing!.ticks.length, 0);
  assert.deepEqual(frameAt(timeline, .1).timing, first);
  assert.equal(frameAt(timeline, -1).timing!.ticks.length, 0);
});


test("judgement history appears after the first non-300 hit and survives seeking", async () => {
  const { frameAt } = await import("../core/timeline.js");
  const snapshots = [snapshot(0, 0), snapshot(1000, 10), snapshot(2000, 20), snapshot(3000, 30)];
  snapshots[1].hits["100"] = 1;
  snapshots[2].hits = { ...snapshots[1].hits, "50": 1 };
  snapshots[3].hits = { ...snapshots[2].hits, "0": 1 };
  const timeline = { speed: 1, snapshots, health: [], strains: [], duration: 10 } as unknown as Timeline;
  assert.equal(frameAt(timeline, .9).judgementHistory!.progress, 0);
  const entering = frameAt(timeline, 1.1).judgementHistory!;
  assert.ok(entering.progress > 0 && entering.progress < 1);
  const complete = frameAt(timeline, 4).judgementHistory!;
  assert.deepEqual(complete.markers.map(marker => [marker.position, marker.grade]), [[.1, "100"], [.2, "50"], [.3, "0"]]);
  assert.equal(frameAt(timeline, .9).judgementHistory!.markers.length, 0);
  assert.deepEqual(frameAt(timeline, 4).judgementHistory, complete);
});
