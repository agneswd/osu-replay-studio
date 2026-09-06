import type { ReplayData, LazerMod } from "replayviewer-js";
import type { PpScore } from "./pp.js";

const settings: Record<string, Record<string, readonly [number, number] | "boolean">> = {
  NM: {}, NF: {}, EZ: { retries: [0, 10] }, TD: {}, HD: {}, HR: {}, SD: {}, PF: {},
  DT: { speed_change: [1.01, 2], adjust_pitch: "boolean" }, NC: { speed_change: [1.01, 2] },
  HT: { speed_change: [.5, .99], adjust_pitch: "boolean" }, DC: { speed_change: [.5, .99] },
  FL: {}, CL: { no_slider_head_accuracy: "boolean", classic_note_lock: "boolean", always_play_tail_sample: "boolean", classic_health: "boolean" },
  DA: { approach_rate: [0, 10], circle_size: [0, 10], overall_difficulty: [0, 10], drain_rate: [0, 10] },
};
export function replayFormat(replay: ReplayData) {
  if (replay.mode !== 0) throw new Error("Only osu!standard replays are supported.");
  const lazer = !!replay.scoreInfo || replay.gameVersion >= 30000000;
  if (!lazer) {
    if (replay.mods & ~(1 | 2 | 4 | 8 | 16 | 32 | 64 | 256 | 512 | 1024 | 4096 | 16384))
      throw new Error("This replay has unsupported mods. Relax, Autopilot and ScoreV2 are not supported yet.");
    return { lazer, mods: replay.mods, classic: true, preservesPitch: true };
  }
  if (!replay.scoreInfo || !Array.isArray(replay.scoreInfo.mods)) throw new Error("The lazer replay is missing its score data. Export it again from osu!.");
  const mods: LazerMod[] = replay.scoreInfo.mods;
  const seen = new Set<string>();
  for (const mod of mods) {
    if (!Object.hasOwn(settings, mod.acronym) || seen.has(mod.acronym)) throw new Error(`Unsupported lazer mod: ${mod.acronym}.`);
    seen.add(mod.acronym);
    for (const [key, value] of Object.entries(mod.settings ?? {})) {
      const rule = settings[mod.acronym][key];
      if (!rule || (rule === "boolean" ? typeof value !== "boolean" : typeof value !== "number" || !Number.isFinite(value) || value < rule[0] || value > rule[1]))
        throw new Error(`Unsupported lazer setting: ${mod.acronym}.${key}.`);
    }
  }
  for (const group of [["DT", "NC", "HT", "DC"], ["HR", "EZ", "DA"], ["SD", "PF"]])
    if (group.filter(mod => seen.has(mod)).length > 1) throw new Error("The replay combines incompatible mods.");
  const speed = mods.find(mod => ["DT", "NC", "HT", "DC"].includes(mod.acronym));
  return { lazer, mods, classic: mods.some(mod => mod.acronym === "CL" && mod.settings?.no_slider_head_accuracy !== false),
    preservesPitch: speed ? !["NC", "DC"].includes(speed.acronym) && speed.settings?.adjust_pitch !== true : true };
}
export function scoreAccuracy(state: PpScore, classic: boolean) {
  const total = state.great + state.ok + state.meh + state.miss;
  const ticks = classic ? 0 : (state.largeTickHit ?? 0) + (state.largeTickMiss ?? 0);
  const tails = classic ? 0 : (state.sliderTailHit ?? 0) + (state.sliderTailMiss ?? 0);
  const max = 300 * total + 30 * ticks + 150 * tails;
  return max ? (300 * state.great + 100 * state.ok + 50 * state.meh +
    (classic ? 0 : 30 * (state.largeTickHit ?? 0) + 150 * (state.sliderTailHit ?? 0))) / max * 100 : 100;
}
