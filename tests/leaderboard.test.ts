import test from "node:test";
import assert from "node:assert/strict";
import { leaderboardAt } from "../core/leaderboard.js";
import { normalizeScore } from "../core/online.js";
import { matchingScore } from "../core/pp.js";
import type { OnlineData, Snapshot, Timeline } from "../core/types.js";
const score: Snapshot = { time: 0, score: 0, pp: 0, combo: 0, maxCombo: 0, accuracy: 100, grade: "SS", hits: { "300": 0, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 0 };
const timeline = {
  player: "Replay player", mods: "HD", title: "Map", replayId: "legacy-3",
  online: { playerId: 3, leaderboard: Array.from({ length: 100 }, (_, i) => ({
    id: String(i), legacyId: `legacy-${i}`, userId: i, name: `Player ${i}`, pp: 1000 - i * 5,
    score: 10000 - i, combo: 100, accuracy: 99, misses: 0, grade: "S", mods: "NM", playedAt: "", title: "", difficulty: "",
  })) } as OnlineData,
} as Timeline;

test("leaderboard follows a replay through its score pool and removes its saved score", () => {
  const start = leaderboardAt(timeline, score, 50);
  assert.equal(start.rows.length, 8);
  assert.equal(start.rows.at(-1)?.position, 50);
  assert.equal(start.rows.at(-1)?.current, true);
  const lead = leaderboardAt(timeline, { ...score, pp: 1100 }, 50);
  assert.equal(lead.rows[0].current, true);
  assert.equal(lead.rows[0].position, 1);
  assert.ok(!lead.rows.some(row => row.id === "3"));
  assert.deepEqual(leaderboardAt(timeline, score, 50), start);
  assert.equal(leaderboardAt(timeline, score, 100).rows.at(-1)?.position, 100);
});

test("offline replay has no invented rank, and missing PP does not become a real zero", () => {
  const offline = leaderboardAt({ ...timeline, online: undefined }, score);
  assert.equal(offline.rows.length, 1);
  assert.equal(offline.rows[0].position, 0);
  const normalized = normalizeScore({ id: 1, legacy_score_id: 2, user_id: 3, pp: null, accuracy: .99,
    max_combo: 123, rank: "SH", legacy_total_score: 12345678, total_score: 987654,
    statistics: { miss: 2 }, mods: [{ acronym: "CL" }, { acronym: "HD" }] });
  assert.equal(normalized.score, 12345678);
  assert.equal(normalized.pp, null);
  assert.equal(normalized.mods, "HD");
  assert.equal(normalized.accuracy, 99);
});

test("online PP comes from the exact replay, not another personal best", () => {
  const scores = timeline.online!.leaderboard;
  const replay = { id: "legacy-3", playerId: 3, score: 9997, combo: 100 };
  assert.equal(matchingScore(scores, replay)?.id, "3");
  assert.equal(matchingScore(scores, { ...replay, id: "0" })?.id, "3");
  assert.equal(matchingScore(scores, { ...replay, id: "0", score: 12 }), undefined);
});

test("PP and score orders stay separate and use the replay score format", () => {
  const board = { ...timeline, online: { ...timeline.online!, leaderboard: [
    { ...timeline.online!.leaderboard[0], pp: 100, score: 500 },
    { ...timeline.online!.leaderboard[1], pp: 200, score: 100 },
  ] } };
  const live = { ...score, pp: 150, score: 200 };
  assert.deepEqual(leaderboardAt(board, live, 50, "pp").rows.map(row => row.id), ["1", "replay", "0"]);
  assert.deepEqual(leaderboardAt(board, live, 50, "score").rows.map(row => row.id), ["0", "replay", "1"]);
  assert.deepEqual(leaderboardAt(board, live).rows.map(row => row.id), ["1", "replay", "0"]);
  const apiScore = { id: 1, user_id: 1, pp: 100, accuracy: .99, max_combo: 10, rank: "S", legacy_total_score: 30000000, total_score: 950000, mods: [], statistics: {} };
  assert.equal(normalizeScore(apiScore).score, 30000000);
  assert.equal(normalizeScore(apiScore, true).score, 950000);
});
