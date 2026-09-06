import type { KeyLane, Timeline } from "./types.js";

type Press = { time: number; end: number };
const histories = new WeakMap<Timeline, Press[][]>();

// Combine mouse and keyboard buttons for each logical input lane.
export function keysAt(timeline: Timeline, time: number): KeyLane[] {
  let lanes = histories.get(timeline);
  if (!lanes) {
    lanes = [[], []];
    const active: (Press | undefined)[] = [];
    for (const frame of timeline.replayFrames ?? []) {
      for (let lane = 0; lane < 2; lane++) {
        const pressed = Boolean((frame.keys ?? 0) & (lane === 0 ? 5 : 10));
        if (pressed && !active[lane]) {
          const press = { time: frame.time, end: Infinity };
          lanes[lane].push(press); active[lane] = press;
        } else if (!pressed && active[lane]) {
          active[lane]!.end = frame.time; active[lane] = undefined;
        }
      }
    }
    histories.set(timeline, lanes);
  }
  const window = 1000 * timeline.speed;
  return lanes.map(presses => {
    let low = 0, high = presses.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (presses[mid].time <= time) low = mid + 1; else high = mid;
    }
    const count = low;
    const last = presses[count - 1];
    const holds: KeyLane["holds"] = [];
    for (let i = count - 1; i >= 0 && presses[i].end >= time - window; i--) {
      holds.unshift({ start: Math.max(0, 1 + (presses[i].time - time) / window),
        end: Math.min(1, 1 + (presses[i].end - time) / window) });
    }
    const first = presses[Math.max(0, count - 5)];
    const intervals = Math.min(4, count - 1);
    const bpm = last && first && intervals > 0 && time - last.time < window && last.time > first.time
      ? Math.round(30000 * timeline.speed * intervals / (last.time - first.time)) : 0;
    return { pressed: Boolean(last && last.end > time), count, bpm, holds };
  });
}
