import type { LeaderboardRow, Snapshot, Timeline } from "./types.js";

const boards = new WeakMap<Timeline, Map<string, { rows: LeaderboardRow[]; count: number }>>();
const compare = (sort: "pp" | "score", a: LeaderboardRow, b: LeaderboardRow) =>
  (sort === "pp" ? (b.pp ?? -1) - (a.pp ?? -1) : 0) || b.score - a.score || Number(a.current) - Number(b.current);

// Sort the fetched scores once. Only the replay's position changes during playback.
export function leaderboardAt(timeline: Timeline, snapshot: Snapshot, limit: 50 | 100 = 50, sort: "pp" | "score" = "pp") {
  const cacheKey = `${limit}:${sort}`;
  let byLimit = boards.get(timeline);
  if (!byLimit) { byLimit = new Map(); boards.set(timeline, byLimit); }
  let board = byLimit.get(cacheKey);
  if (!board) {
    const pool = timeline.online?.leaderboard.slice(0, limit) ?? [];
    const rows = pool.filter(score =>
      (!timeline.replayId || (timeline.replayFormat === "lazer"
        ? score.id !== timeline.replayId : (score.legacyId ?? score.id) !== timeline.replayId)) &&
      !(score.userId === timeline.online?.playerId && score.score === timeline.sceneInfo?.score.score && score.combo === timeline.sceneInfo?.score.maxCombo)
    ).map(score => ({ ...score, position: 0, current: false })).sort((a, b) => compare(sort, a, b));
    board = { rows, count: pool.length }; byLimit.set(cacheKey, board);
  }
  const replay: LeaderboardRow = {
    id: "replay", userId: timeline.online?.playerId ?? 0, name: timeline.player,
    avatar: timeline.playerAvatar, pp: snapshot.pp, accuracy: snapshot.accuracy,
    combo: snapshot.combo, score: snapshot.score, misses: snapshot.hits["0"], grade: snapshot.grade,
    mods: timeline.mods, playedAt: "", title: timeline.title, difficulty: "", position: 0, current: true,
  };
  let low = 0, high = board.rows.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(sort, board.rows[mid], replay) <= 0) low = mid + 1; else high = mid;
  }
  const start = Math.max(0, Math.min(low - 7, board.rows.length + 1 - 8));
  const rows = Array.from({ length: Math.min(8, board.rows.length + 1) }, (_, slot) => {
    const index = start + slot;
    return { ...(index === low ? replay : board.rows[index < low ? index : index - 1]), position: board.count ? index + 1 : 0 };
  });
  return { rows, caption: board.count ? `Sorted by ${sort}` : "Online scores unavailable" };
}

type PlacedRow = LeaderboardRow & { slot: number; opacity: number };
type Move = { time: number; from: PlacedRow[]; to: PlacedRow[] };
const moves = new WeakMap<Timeline, Map<string, Move[]>>();
const ease = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;

function sampleMove(move: Move, time: number, duration: number): PlacedRow[] {
  const amount = ease((time - move.time) / duration);
  if (amount === 1) return move.to;
  const before = new Map(move.from.map(row => [row.id, row]));
  const after = new Map(move.to.map(row => [row.id, row]));
  const rows = [...move.to, ...move.from.filter(row => !after.has(row.id))];
  return rows.map(row => {
    const target = after.get(row.id);
    const source = before.get(row.id);
    const edge = row.position < move.to[0].position ? -1 : 8;
    const entryEdge = row.position < move.from[0].position ? -1 : 8;
    const from = source ?? { ...row, slot: entryEdge, opacity: 0 };
    const to = target ?? { ...row, slot: edge, opacity: 0 };
    return { ...row, slot: from.slot + (to.slot - from.slot) * amount,
      opacity: from.opacity + (to.opacity - from.opacity) * amount };
  });
}

// Cache rank changes. Seeks and offline capture use the same 280 ms movement.
export function animatedLeaderboardAt(timeline: Timeline, snapshot: Snapshot, time: number, limit: 50 | 100 = 50, sort: "pp" | "score" = "pp") {
  const cacheKey = `${limit}:${sort}`;
  let byLimit = moves.get(timeline);
  if (!byLimit) { byLimit = new Map(); moves.set(timeline, byLimit); }
  let events = byLimit.get(cacheKey);
  const duration = 280 * timeline.speed;
  if (!events) {
    events = [];
    let signature = "";
    for (const state of timeline.snapshots) {
      const to = leaderboardAt(timeline, state, limit, sort).rows.map((row, slot) => ({ ...row, slot, opacity: 1 }));
      const next = to.map(row => `${row.id}:${row.position}`).join("|");
      if (next === signature) continue;
      const previous = events.at(-1);
      events.push({ time: state.time, to, from: previous ? sampleMove(previous, state.time, duration) : to });
      signature = next;
    }
    byLimit.set(cacheKey, events);
  }
  let low = 0, high = events.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (events[mid].time <= time) low = mid + 1; else high = mid;
  }
  const current = leaderboardAt(timeline, snapshot, limit, sort);
  const live = current.rows.find(row => row.current)!;
  const event = events[Math.max(0, low - 1)];
  return { caption: current.caption, rows: event ? sampleMove(event, time, duration).map(row =>
    row.current ? { ...live, slot: row.slot, opacity: row.opacity } : row) : current.rows };
}
