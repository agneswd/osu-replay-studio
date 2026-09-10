export interface PlayStatus {
  completed: boolean;
  verified: boolean;
  fullCombo: boolean;
  perfectCombo: boolean;
  sliderBreaks: number;
}
interface HitResult {
  objectIndex: number;
  time: number;
  judgement: number;
  comboBreak: boolean;
  isSliderSub?: boolean;
}

// Count failed slider heads, ticks, and repeats. Tails and whole-object misses are separate.
export function sliderBreakEvents(objects: readonly { type: string }[], results: readonly HitResult[], classic = true) {
  const main = new Map(results.filter(r => !r.isSliderSub).map(r => [r.objectIndex, r]));
  const tails = new Map<number, HitResult>();
  for (const r of results) if (r.isSliderSub && (!tails.has(r.objectIndex) || tails.get(r.objectIndex)!.time < r.time)) tails.set(r.objectIndex, r);
  return results.filter(r => objects[r.objectIndex]?.type === "slider" &&
    (r.isSliderSub ? (!classic || main.get(r.objectIndex)?.judgement !== 0) && r !== tails.get(r.objectIndex) && r.judgement === 0 : main.get(r.objectIndex)?.judgement !== 0 && r.comboBreak)).map(r => r.time).sort((a, b) => a - b);
}

export function classifyPlay(objectCount: number, judged: readonly number[], recorded: readonly number[], combo: number, maxCombo: number, sliderBreaks: number): PlayStatus {
  const completed = recorded.reduce((a, b) => a + b, 0) === objectCount && objectCount > 0;
  // FC depends on completion and combo breaks, not the accuracy of successful hits.
  const verified = judged.length === 4 && recorded.length === 4 &&
    judged.reduce((a, b) => a + b, 0) === recorded.reduce((a, b) => a + b, 0) && judged[3] === recorded[3];
  const fullCombo = completed && verified && recorded[3] === 0 && sliderBreaks === 0;
  return { completed, verified, fullCombo, perfectCombo: fullCombo && combo >= maxCombo, sliderBreaks };
}

// Non-Classic lazer records slider heads as normal judgements and ticks/repeats separately.
// Missing tails reduce accuracy but do not break combo. Missing payloads remain unverified.
export function recordedLazerStatus(objectCount: number, info: Pick<import("replayviewer-js").ScoreInfo, "statistics" | "maximum_statistics"> | undefined, classic: boolean, combo: number, maxCombo: number): PlayStatus | undefined {
  if (classic || !info?.statistics || !info.maximum_statistics) return undefined;
  const stats = info.statistics, maximum = info.maximum_statistics;
  if (![...Object.values(stats), ...Object.values(maximum)].every(n => Number.isSafeInteger(n) && n >= 0)) return undefined;
  if (maximum.great !== objectCount || objectCount <= 0) return undefined;
  const judged = (stats.great ?? 0) + (stats.ok ?? 0) + (stats.meh ?? 0) + (stats.miss ?? 0);
  const ticks = (stats.large_tick_hit ?? 0) + (stats.large_tick_miss ?? 0);
  if (judged > objectCount || ticks > (maximum.large_tick_hit ?? 0) || (stats.slider_tail_hit ?? 0) > (maximum.slider_tail_hit ?? 0)) return undefined;
  const completed = judged === objectCount;
  const verified = completed && ticks === (maximum.large_tick_hit ?? 0);
  const sliderBreaks = (stats.large_tick_miss ?? 0) + (stats.combo_break ?? 0);
  const fullCombo = verified && (stats.miss ?? 0) === 0 && sliderBreaks === 0;
  return { completed, verified, fullCombo, perfectCombo: fullCombo && combo >= maxCombo, sliderBreaks };
}
