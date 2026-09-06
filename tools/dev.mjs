import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const env = { ...process.env, STUDIO_DEV: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const children = new Set();
function start(command, args) {
  const child = spawn(command, args, { stdio: "inherit", env });
  children.add(child);
  child.on("exit", () => children.delete(child));
  child.on("error", error => console.error(error.message));
  return child;
}
async function run(script, args) {
  const child = start(process.execPath, [script, ...args]);
  const code = await new Promise(resolve => child.once("exit", resolve));
  if (code !== 0) throw new Error(`Build failed with exit code ${code}.`);
}
await run("tools/patch-replayviewer.mjs", []);
async function buildDesktop() {
  await run("node_modules/typescript/bin/tsc", ["-p", "tsconfig.node.json"]);
  await build({ entryPoints: ["electron/preload.ts"], bundle: true, platform: "node", format: "cjs", external: ["electron"], outfile: "dist/electron/preload.cjs" });
}
await buildDesktop();
await run("tools/build-score-scenes.mjs", []);
const server = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: false } });
await server.listen();
server.printUrls();
env.STUDIO_DEV_URL = server.resolvedUrls.local[0];
start(process.execPath, ["tools/build-score-scenes.mjs", "--watch"]);
start(require("electron"), ["."]);
let timer;
let building = false;
let pending = false;
async function rebuild() {
  if (building) { pending = true; return; }
  building = true;
  try {
    await buildDesktop();
    console.log("Desktop code rebuilt. Restart bun run dev when you want to apply backend changes.");
  } catch (error) { console.error(error.message); }
  finally { building = false; if (pending) { pending = false; void rebuild(); } }
}
const watchers = ["core", "electron"].map(dir => watch(dir, { recursive: true }, (_event, file) => {
  if (!file?.endsWith(".ts")) return;
  clearTimeout(timer);
  timer = setTimeout(rebuild, 350);
}));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  clearTimeout(timer);
  watchers.forEach(watcher => watcher.close());
  children.forEach(child => child.kill());
  await server.close();
  process.exit(0);
});
