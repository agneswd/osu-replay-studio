import type { Timeline } from "./types.js";
import type { ReplayFrame } from "replayviewer-js";

// Skip stable's off-screen startup markers without changing the recorded cursor clock.
export function visibleCursorFrames(frames: ReplayFrame[]): ReplayFrame[] {
  const start = frames.findIndex(frame => frame.x >= 0 && frame.x <= 512 && frame.y >= 0 && frame.y <= 384);
  if (start <= 0) return frames;
  const firstTime = frames.slice(0, start + 1).reduce((time, frame) => time + frame.timeDelta, 0);
  return [{ ...frames[start], timeDelta: firstTime }, ...frames.slice(start + 1)];
}

// Danser expands the skin cursor for 100 ms after an input changes.
export function cursorExpansion(frames: NonNullable<Timeline["replayFrames"]>, speed: number) {
  const duration = 100 * speed;
  const events: { time: number; from: number; to: number }[] = [];
  const valueAt = (event: typeof events[number] | undefined, time: number) => event
    ? event.from + (event.to - event.from) * Math.min(1, Math.max(0, (time - event.time) / duration)) : 1;
  let previous = 0;
  for (const frame of frames) {
    const state = ((frame.keys ?? 0) & 5 ? 1 : 0) | ((frame.keys ?? 0) & 10 ? 2 : 0);
    if (state !== previous) {
      events.push({ time: frame.time, from: state ? 1 : valueAt(events.at(-1), frame.time), to: state ? 1.3 : 1 });
      previous = state;
    }
  }
  return (time: number) => {
    let low = 0, high = events.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (events[mid].time <= time) low = mid + 1; else high = mid;
    }
    return valueAt(events[low - 1], time);
  };
}
