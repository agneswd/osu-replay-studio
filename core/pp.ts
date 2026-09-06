import type { LazerMod } from "replayviewer-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";
import { runtimeRoot } from "./runtime.js";
import type { RankedScore } from "./types.js";

export const ppEngineVersion: string = (() => {
  try { return JSON.parse(readFileSync(path.join(runtimeRoot(), "calculator/version.json"), "utf8")).version; }
  catch { return "unavailable"; }
})();
export interface PpEngineStatus { version: string; latest?: string }
let status: Promise<PpEngineStatus> | undefined;

export function ppEngineStatus(): Promise<PpEngineStatus> {
  return status ??= (async () => {
    try {
      const response = await fetch("https://api.nuget.org/v3-flatcontainer/ppy.osu.game.rulesets.osu/index.json", { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Package registry unavailable.");
      const latest = await response.json() as { versions: string[] };
      return { version: ppEngineVersion, latest: latest.versions.filter(version => !version.includes("-")).at(-1) };
    } catch { return { version: ppEngineVersion }; }
  })();
}

export interface PpScore { great: number; ok: number; meh: number; miss: number; combo: number; legacyScore?: number; largeTickHit?: number; largeTickMiss?: number; sliderTailHit?: number; sliderTailMiss?: number; accuracy?: number }
export interface PpResult { version: string; stars: number; maxCombo: number; maxPP: number; scorePP: number; pp: number[] }

const recentCalculations = new Map<string, PpResult>();

export async function calculatePP(beatmap: string, mods: number | LazerMod[], score: PpScore, snapshots: PpScore[], signal?: AbortSignal): Promise<PpResult> {
  signal?.throwIfAborted();
  const request = JSON.stringify({ beatmap, mods: typeof mods === "number" ? mods : 0, lazerMods: Array.isArray(mods) ? mods : undefined, score, snapshots });
  const bytes = await readFile(beatmap).catch(() => { throw new Error("PP calculation failed: Could not read beatmap."); });
  const key = createHash("sha256").update(bytes).update(request).digest("hex");
  signal?.throwIfAborted();
  const cached = recentCalculations.get(key);
  if (cached) return cached;
  const executable = path.join(runtimeRoot(), "calculator", `ReplayStudio.Calculator${process.platform === "win32" ? ".exe" : ""}`);
  return new Promise((resolve, reject) => {
    const child = execFile(executable, [], { signal, timeout: 130_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`PP calculation failed: ${stderr.trim() || error.message}`));
      try {
        const result = JSON.parse(stdout) as PpResult;
        if (result.pp.length !== snapshots.length || ![result.stars, result.maxPP, result.scorePP, ...result.pp].every(Number.isFinite))
          throw new Error("Invalid PP calculator output.");
        if (recentCalculations.size >= 8) recentCalculations.delete(recentCalculations.keys().next().value!);
        if (result.pp.length <= 20_000) recentCalculations.set(key, result);
        resolve(result);
      } catch (error) { reject(error); }
    });
    child.stdin?.on("error", () => {}); // execFile reports a failed helper through its callback.
    child.stdin?.end(request);
  });
}

// Match the submitted replay itself. Another score by the same player can have different PP.
export function matchingScore(scores: RankedScore[], replay: { id: string; playerId: number; score: number; combo: number; lazer?: boolean }): RankedScore | undefined {
  return scores.find(score => replay.id !== "0" && (replay.lazer ? score.id === replay.id : (score.legacyId ?? score.id) === replay.id))
    ?? scores.find(score => score.userId === replay.playerId && score.score === replay.score && score.combo === replay.combo);
}
