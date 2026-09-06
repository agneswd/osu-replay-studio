const { app, dialog, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
if (!process.argv[2]) throw new Error("Pass a local render job JSON file.");
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "studio-benchmark-"));
app.setPath("userData", userData);
fs.writeFileSync(path.join(userData, "settings.json"), JSON.stringify({ ...job, introOutro: false }));
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [job.replay] });
require(path.join(root, "dist/electron/main.js"));

app.whenReady().then(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let window;
  for (let i = 0; i < 100; i++) {
    window = BrowserWindow.getAllWindows()[0];
    if (window) break;
    await wait(100);
  }
  if (!window) throw new Error("App window did not open.");
  const evaluate = source => window.webContents.executeJavaScript(source);
  const until = async source => {
    for (let i = 0; i < 600; i++) {
      if (await evaluate(source).catch(() => false)) return;
      await wait(50);
    }
    throw new Error("The workspace did not become ready.");
  };
  await until('document.querySelector(".app-title")');
  const start = performance.now();
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent === 'Open replay').click()`);
  await until('document.querySelector("button[aria-label=Play]")?.disabled === false');
  console.log(JSON.stringify({ importReadyMs: performance.now() - start }));

  window.webContents.debugger.attach("1.3");
  const command = (method, params) => window.webContents.debugger.sendCommand(method, params);
  await command("Performance.enable");
  await evaluate(`document.querySelector('button[aria-label=Play]').click()`);
  await wait(1500);
  const metrics = async () => Object.fromEntries((await command("Performance.getMetrics")).metrics.map(item => [item.name, item.value]));
  const before = await metrics();
  await wait(5000);
  const after = await metrics();
  console.log(JSON.stringify({ scriptSeconds: after.ScriptDuration - before.ScriptDuration,
    taskSeconds: after.TaskDuration - before.TaskDuration, heapMiB: after.JSHeapUsedSize / 1048576,
    rssMiB: app.getAppMetrics().reduce((total, process) => total + process.memory.workingSetSize / 1024, 0) }));
  await evaluate(`document.querySelector('button[aria-label=Pause]')?.click()`);

  const asset = fs.readdirSync(path.join(root, "dist/ui/assets")).find(file => /^preview-engine-.*\.js$/.test(file));
  const scrubbing = await evaluate(`(async () => {
    const timeline = await window.studio.analyze(${JSON.stringify(job)});
    const { PreviewEngine } = await import('./assets/${asset}');
    const canvas = document.createElement('canvas');
    const engine = await PreviewEngine.create(canvas, timeline, ${JSON.stringify(job.skinPath ?? "")});
    try {
      const times = Array.from({ length: 100 }, (_, i) => (i * 7919 % 100) / 100 * timeline.duration);
      const results = [];
      for (let run = 0; run < 2; run++) {
        const samples = [];
        for (const time of times) {
          const start = performance.now();
          engine.draw(time, timeline.speed, .72);
          samples.push(performance.now() - start);
          await new Promise(requestAnimationFrame);
        }
        samples.sort((a, b) => a - b);
        results.push({ run, medianMs: samples[50], p95Ms: samples[95], maxMs: samples[99] });
      }
      return results;
    } finally { engine.destroy(); }
  })()`);
  console.log(JSON.stringify({ scrubbing }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
app.on("quit", () => fs.rmSync(userData, { recursive: true, force: true }));
