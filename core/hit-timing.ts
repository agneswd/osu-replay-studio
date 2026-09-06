import type { BeatmapData, HitResult, ModDifficulty } from "replayviewer-js";
import type { HitWindows, Timeline, TimingHit } from "./types.js";

// Use the same windows as replay judging, in milliseconds of playback time.
export function hitWindowsFor(difficulty: ModDifficulty): HitWindows {
  const inclusive = difficulty.isLazer && !difficulty.lzLegacyNotelock;
  return {
    great: (inclusive ? difficulty.hitWindow300U : difficulty.hitWindow300) / difficulty.speed,
    ok: (inclusive ? difficulty.hitWindow100U : difficulty.hitWindow100) / difficulty.speed,
    meh: (inclusive ? difficulty.hitWindow50U : difficulty.hitWindow50) / difficulty.speed,
    inclusive,
  };
}

export function timelineHitWindows(timeline: Timeline): HitWindows {
  return timeline.hitWindows ?? {
    great: Math.floor(80 - 6 * timeline.od) / timeline.speed,
    ok: Math.floor(140 - 8 * timeline.od) / timeline.speed,
    meh: Math.floor(200 - 10 * timeline.od) / timeline.speed,
    inclusive: false,
  };
}

export function collectTimingHits(
  objects: BeatmapData["hitObjects"], results: readonly HitResult[], difficulty: ModDifficulty,
): TimingHit[] {
  const windows = hitWindowsFor(difficulty);
  const hits: TimingHit[] = [];
  for (const result of results) {
    const object = objects[result.objectIndex];
    if (!object || object.type === "spinner" || result.isSliderSub || result.comboBreak || !result.judgement) continue;
    const error = (result.time - object.time) / difficulty.speed;
    if (windows.inclusive ? Math.abs(error) > windows.meh : Math.abs(error) >= windows.meh) continue;
    hits.push({ time: result.time, error });
  }
  hits.sort((a, b) => a.time - b.time);
  let sum = 0, sumSq = 0, recentSum = 0;
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    sum += hit.error;
    sumSq += hit.error ** 2;
    recentSum += hit.error;
    if (i >= 100) recentSum -= hits[i - 100].error;
    hit.average = recentSum / Math.min(i + 1, 100);
    hit.ur = 10 * Math.sqrt(Math.max(0, sumSq / (i + 1) - (sum / (i + 1)) ** 2));
  }
  return hits;
}
