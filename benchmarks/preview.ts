import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { frameAt } from "../core/timeline.js";
import type { Timeline } from "../core/types.js";

// Synthetic long replay. No player data or external files are used.
const snapshot = { time: 0, score: 0, combo: 1, maxCombo: 1, accuracy: 100,
  pp: 1, grade: "SS", hits: { "300": 1, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 0 };
const timeline: Timeline = {
  replay: "", beatmap: "", player: "Player", title: "Benchmark", mods: "NM", speed: 1,
  preempt: 600, duration: 600, stars: 5, bpm: 180, od: 8, maxPP: 400,
  strains: Array(100).fill(1), health: [], warnings: [], playerAvatar: "data:image/png;base64," + "A".repeat(20_000),
  snapshots: Array.from({ length: 4000 }, (_, i) => ({ ...snapshot, time: i * 150, score: i * 300, combo: i, maxCombo: i, pp: i / 10 })),
  hitObjects: Array.from({ length: 4000 }, (_, i) => ({ time: i * 150, x: i % 512, y: i % 384, type: "circle" })),
  online: { playerId: 999, leaderboard: Array.from({length: 100}, (_, id) => ({ id: String(id), userId: id, name: `Player ${id}`, pp: 500 - id * 4,
    accuracy: 99, combo: 100, score: 1000, misses: 0, grade: "S", mods: "HD", playedAt: "", title: "", difficulty: "" })),
    fetchedAt: "", warnings: [], country: "", rank: null, supporter: false, badges: [], map: { id: 0, mapper: "", status: "ranked", plays: 0, favourites: 0 }, topPlays: [] },
  replayFrames: Array.from({ length: 150_000 }, (_, i) => ({ time: i * 4, x: i % 512, y: i % 384, keys: i % 20 < 5 ? 4 : i % 20 < 10 ? 0 : i % 20 < 15 ? 8 : 0 })),
};
function measure(name: string, count: number, action: (i: number) => void) {
  for (let i = 0; i < 300; i++) action(i);
  const runs: number[] = [];
  for (let round = 0; round < 5; round++) {
    const start = performance.now();
    for (let i = 0; i < count; i++) action(i);
    runs.push((performance.now() - start) / count);
  }
  return { name, msPerFrame: runs.sort((a, b) => a - b)[2] };
}
const results = [
  measure("overlay sample and JSON", 3000, i => { JSON.stringify(frameAt(timeline, i % 600)); }),
];
console.log(JSON.stringify({ node: process.version, results }, null, 2));
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify({ results }, null, 2));
