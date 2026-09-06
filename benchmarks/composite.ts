import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compositeArgs, presentationTiming } from "../core/presentation.js";
import { runtimeTool } from "../core/runtime.js";
const work = mkdtempSync(path.join(os.tmpdir(), "studio-benchmark-"));
function run(args: string[], input?: Buffer) {
  const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], { input, timeout: 120_000, maxBuffer: 2_000_000 });
  if (result.status !== 0) throw Error(result.stderr.toString() || result.error?.message);
}
try {
  const source = path.join(work, "game.mp4");
  run(["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=13", "-c:v", "libx264", "-preset", "ultrafast", source]);
  const { frames } = presentationTiming(12, 30, true);
  const png = readFileSync(new URL("../tests/fixtures/transparent.png", import.meta.url));
  const input = Buffer.concat(Array(frames).fill(png));
  const start = performance.now();
  run(compositeArgs(source, path.join(work, "out.mp4"), 12, 30, true), input);
  console.log(JSON.stringify({ frames, seconds: (performance.now() - start) / 1000 }));
} finally { rmSync(work, { recursive: true, force: true }); }
