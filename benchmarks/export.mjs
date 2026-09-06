import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const [jobFile, baselineDanser, outputDirectory] = process.argv.slice(2);
if (!jobFile || !baselineDanser || !outputDirectory) throw Error("Usage: node benchmarks/export.mjs job.json baseline-danser output-directory");
const job = JSON.parse(await readFile(jobFile, "utf8"));
const directory = path.resolve(outputDirectory);
await mkdir(directory, { recursive: true });
const results = { browser: [], native: [] };
// Alternate order to reduce cache and temperature bias. Run one export at a time.
for (const [mode, trial] of [["browser",1],["native",1],["native",2],["browser",2],["browser",3],["native",3]]) {
  const output = path.join(directory, `${mode}-${trial}.mp4`);
  const input = path.join(directory, `${mode}-${trial}.json`);
  await writeFile(input, JSON.stringify({ ...job, danser: mode === "browser" ? path.resolve(baselineDanser) : job.danser, output }));
  const log = createWriteStream(path.join(directory, `${mode}-${trial}.log`));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require("electron"), [".", "--render", input], { cwd: process.cwd(), env });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  await new Promise(resolve => log.end(resolve));
  if (code !== 0) throw Error(`${mode} trial ${trial} failed. See its log.`);
  const report = JSON.parse(await readFile(`${output}.render.json`, "utf8"));
  if (report.renderer !== mode || report.status !== "complete") throw Error("The export did not use the expected renderer.");
  results[mode].push(report);
  console.log(`${mode} ${trial}: ${report.seconds.toFixed(2)} seconds`);
  await writeFile(path.join(directory, "results.json"), JSON.stringify(results, null, 2));
}
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const browser = median(results.browser.map(r => r.seconds)), native = median(results.native.map(r => r.seconds));
console.log(JSON.stringify({ browser, native, speedup: browser/native, reductionPercent: 100*(1-native/browser) }, null, 2));
