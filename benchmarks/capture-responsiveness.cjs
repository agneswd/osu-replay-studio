// Run with Electron after building. Use the same timeline and background for both modes.
const { app, session } = require("electron");
const { monitorEventLoopDelay } = require("node:perf_hooks");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const [mode, timelineFile, backgroundFile] = process.argv.slice(2);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  if (!["direct", "isolated"].includes(mode) || !timelineFile || !backgroundFile)
    throw new Error("Usage: electron benchmarks/capture-responsiveness.cjs direct|isolated timeline.json background.png");
  const root = path.resolve(__dirname, "..");
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => callback({ cancel: true }));
  const timeline = JSON.parse(readFileSync(timelineFile, "utf8"));
  const capture = mode === "direct"
    ? (await import(pathToFileURL(path.join(root, "dist/electron/capture.js")))).captureOverlay(root)
    : (await import(pathToFileURL(path.join(root, "dist/electron/capture-process.js")))).captureWithWorker(root);
  const background = pathToFileURL(path.resolve(backgroundFile)).href;
  const delays = monitorEventLoopDelay({ resolution: 1 });
  delays.enable();
  const started = performance.now();
  let count = 0;
  for await (const _frame of capture(
    { width: 1920, height: 1080, fps: 60, overlays: [], introOutro: true, backgroundDim: .95 },
    timeline, 648, new AbortController().signal,
    { start: 0, end: 120, background: { clear: background, soft: background } },
  )) count++;
  delays.disable();
  console.log(JSON.stringify({ mode, frames: count, seconds: (performance.now() - started) / 1000,
    mainThreadMaxMs: delays.max / 1e6, mainThreadP99Ms: delays.percentile(99) / 1e6 }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
