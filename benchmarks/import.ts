import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { analyze, resolveBeatmap } from "../core/analyze.js";
import { previewData, previewSkin } from "../core/preview.js";
import type { RenderOptions } from "../core/types.js";

// Use a local render job. Results contain timings, not replay paths or player data.
if (!process.argv[2]) throw new Error("Pass a render job JSON file with an explicit beatmap path.");
const job = JSON.parse(await readFile(process.argv[2], "utf8")) as RenderOptions;
if (!job.beatmap) throw new Error("The benchmark needs an explicit beatmap path.");
const hash = createHash("md5").update(await readFile(job.beatmap)).digest("hex");
for (let run = 0; run < 3; run++) {
  const start = performance.now();
  await resolveBeatmap(job.songs, hash);
  const found = performance.now();
  const timeline = await analyze(job);
  const analyzed = performance.now();
  await Promise.all([previewData(job.beatmap, job.replay), previewSkin(""), job.skinPath ? previewSkin(job.skinPath) : undefined]);
  console.log(JSON.stringify({ run, lookupMs: found - start, analysisMs: analyzed - found,
    assetsMs: performance.now() - analyzed, rssMiB: process.memoryUsage().rss / 1048576, snapshots: timeline.snapshots.length }));
}
