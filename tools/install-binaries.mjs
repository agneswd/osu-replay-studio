import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
for (const [file, installer] of [
  ["node_modules/electron/path.txt", "node_modules/electron/install.js"],
  [require("ffmpeg-static"), "node_modules/ffmpeg-static/install.js"],
]) {
  if (existsSync(file)) continue;
  const result = spawnSync(process.execPath, [installer], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
