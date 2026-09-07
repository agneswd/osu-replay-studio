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
  const verified = judged.length === recorded.length && judged.every((n, i) => n === recorded[i]);
  const fullCombo = completed && verified && recorded[3] === 0 && sliderBreaks === 0;
  return { completed, verified, fullCombo, perfectCombo: fullCombo && combo >= maxCombo, sliderBreaks };
}
