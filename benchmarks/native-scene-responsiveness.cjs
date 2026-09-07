// Run after building. Use the same prepared scene and backgrounds for both modes.
const { app } = require("electron");
const { monitorEventLoopDelay } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const path = require("node:path");
const [mode, sceneFile, clearFile, softFile, action] = process.argv.slice(2);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  if (!["direct", "isolated"].includes(mode) || !sceneFile || !clearFile || !softFile)
    throw new Error("Usage: electron benchmarks/native-scene-responsiveness.cjs direct|isolated scene.json clear.png soft.png [cancel]");
  const root = path.resolve(__dirname, "..");
  const composite = mode === "direct"
    ? (await import(path.join(root, "dist/electron/scene-composite.js"))).compositeNativeScene
    : (await import(path.join(root, "dist/electron/capture-process.js"))).nativeSceneWithWorker(root);
  const delay = monitorEventLoopDelay({ resolution: 1 });
  const controller = new AbortController(), hash = createHash("sha256");
  delay.enable();
  const start = performance.now();
  let frames = 0, aborted = false;
  try {
    for await (const frame of composite(path.resolve(sceneFile),
      { clear: path.resolve(clearFile), soft: path.resolve(softFile) }, "intro", 324, 60, 1920, 1080, controller.signal)) {
      hash.update(frame); frames++;
      if (action === "cancel" && frames === 3) controller.abort();
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    aborted = true;
  }
  delay.disable();
  if (action === "cancel" ? !aborted || frames !== 3 : frames !== 324) throw new Error("Unexpected frame count or cancellation result.");
  console.log(JSON.stringify({ mode, frames, aborted, seconds: (performance.now() - start) / 1000,
    mainThreadP99Ms: delay.percentile(99) / 1e6, mainThreadMaxMs: delay.max / 1e6, hash: hash.digest("hex") }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
