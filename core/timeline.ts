import { animatedLeaderboardAt } from "./leaderboard.js";
import { keysAt } from "./keys.js";
import type { CounterFrame, OverlayFrame, Timeline } from "./types.js";

// Closest past entry.
export function atTime<T extends { time: number }>(
  items: readonly T[],
  time: number,
): T | undefined {
  return items[indexAtTime(items, time)];
}

function indexAtTime(items: readonly { time: number }[], time: number): number {
  let low = 0;
  let high = items.length - 1;
  let match = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].time <= time) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return match;
}

const judgementCache = new WeakMap<Timeline, { time: number; grade: "100" | "50" | "0" }[]>();
function judgementHistoryAt(timeline: Timeline, time: number) {
  let events = judgementCache.get(timeline);
  if (!events) {
    events = [];
    for (let i = 1; i < timeline.snapshots.length; i++) {
      const current = timeline.snapshots[i];
      const previous = timeline.snapshots[i - 1];
      for (const grade of ["100", "50", "0"] as const)
        if (current.hits[grade] > previous.hits[grade]) events.push({ time: current.time, grade });
    }
    judgementCache.set(timeline, events);
  }
  const progress = (at: number) => 1 - (1 - Math.max(0, Math.min(1, (time - at) / (220 * timeline.speed)))) ** 3;
  return {
    progress: events.length ? progress(events[0].time) : 0,
    markers: events.slice(0, indexAtTime(events, time) + 1).map(event => ({
      position: event.time / (timeline.duration * 1000 * timeline.speed), grade: event.grade, progress: progress(event.time),
    })),
  };
}

// The roll lasts 160 ms of video time, independent of capture speed and seek order.
function counterAt(
  timeline: Timeline,
  index: number,
  time: number,
  key: "combo" | "maxCombo" | "pp" | "accuracy" | "ur" | "100" | "50" | "0" | "sliderBreaks" | "average",
): CounterFrame {
  const snapshots = timeline.snapshots;
  const rounded = (i: number) => {
    const state = snapshots[i];
    if (key === "average") return state.errors.reduce((sum, error) => sum + error, 0) / (state.errors.length || 1);
    const value = key === "100" || key === "50" || key === "0" || key === "sliderBreaks" ? state.hits[key] : state[key];
    return Number(value.toFixed(key === "accuracy" ? 2 : 0));
  };
  const to = rounded(index);
  const duration = 160 * timeline.speed;
  let changed = index;
  while (
    changed > 0 &&
    time - snapshots[changed].time < duration &&
    rounded(changed - 1) === to
  ) {
    changed--;
  }
  if (changed === 0 || time - snapshots[changed].time >= duration) {
    return { from: to, to, progress: 1 };
  }
  let previous = changed - 1;
  // Events at the same timestamp form one visible update.
  while (previous > 0 && snapshots[previous].time === snapshots[changed].time) {
    previous--;
  }
  return {
    from: rounded(previous),
    to,
    progress: Math.max(0, (time - snapshots[changed].time) / duration),
  };
}

export function healthAt(
  samples: readonly { time: number; value: number }[],
  time: number,
): number | null {
  if (!samples.length) return null;
  let low = 0;
  let high = samples.length - 1;
  let index = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].time <= time) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (index === -1) return samples[0].value * 100;
  const left = samples[index];
  const right = samples[index + 1];
  if (time <= left.time || !right) return left.value * 100;
  return (
    (left.value +
      ((right.value - left.value) * (time - left.time)) /
        (right.time - left.time)) *
    100
  );
}

// Video time starts at audio position zero. Replay and beatmap times use milliseconds.
export function frameAt(timeline: Timeline, seconds: number, leaderboardSize: 50 | 100 = 50, leaderboardSort: "pp" | "score" = "pp"): OverlayFrame {
  const time = seconds * 1000 * timeline.speed;
  const index = Math.max(0, indexAtTime(timeline.snapshots, time));
  const s = timeline.snapshots[index];
  const hp = healthAt(timeline.health, time);
  const average = counterAt(timeline, index, time, "average");
  const timingHits = timeline.timingHits ?? [];
  const hitIndex = indexAtTime(timingHits, time);
  const ticks: { error: number; opacity: number; height: number }[] = [];
  for (let i = hitIndex; i >= 0 && time - timingHits[i].time < 5000 * timeline.speed && ticks.length < 50; i--) {
    const age = (time - timingHits[i].time) / timeline.speed;
    ticks.unshift({ error: timingHits[i].error, opacity: (1 - age / 5000) ** .7,
      height: .15 + .85 * (1 - (1 - Math.min(1, age / 140)) ** 3) });
  }
  return {
    judgementHistory: judgementHistoryAt(timeline, time),
    timing: { ticks: timeline.timingHits ? ticks : s.errors.map(error => ({ error, opacity: .7, height: 1 })),
      average: average.from + (average.to - average.from) * (1 - (1 - average.progress) ** 3) },
    leaderboard: animatedLeaderboardAt(timeline, s, time, leaderboardSize, leaderboardSort),
    keys: keysAt(timeline, time),
    counters: {
      ur: counterAt(timeline, index, time, "ur"),
      hit100: counterAt(timeline, index, time, "100"),
      hit50: counterAt(timeline, index, time, "50"),
      hitMiss: counterAt(timeline, index, time, "0"),
      hitSB: counterAt(timeline, index, time, "sliderBreaks"),
      combo: counterAt(timeline, index, time, "combo"),
      maxCombo: counterAt(timeline, index, time, "maxCombo"),
      pp: counterAt(timeline, index, time, "pp"),
      accuracy: counterAt(timeline, index, time, "accuracy"),
    },
    menu: {
      state: 2,
      mods: { str: timeline.mods },
      bm: {
        stats: {
          SR: timeline.stars,
          OD: timeline.od,
          BPM: { common: timeline.bpm },
        },
        time: { current: time, mp3: timeline.duration * 1000 * timeline.speed },
      },
      pp: { strains: timeline.strains },
    },
    gameplay: {
      name: timeline.player,
      score: s.score,
      accuracy: s.accuracy,
      combo: { current: s.combo, max: s.maxCombo },
      hp: { normal: hp },
      hits: s.hits,
      pp: { current: s.pp, fc: timeline.maxPP },
      grade: s.grade,
    },
    hitErrors: s.errors,
    play: { unstableRate: s.ur },
    userProfile: {
      name: timeline.player,
      avatar: timeline.playerAvatar,
      rank: timeline.playerRank,
      country: timeline.playerCountry,
    },
  };
}
