// Capture matched browser, native, blended, and difference images at fixed scene times.
const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("node:fs/promises"), path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.resolve(process.argv[3] ?? ".");
const [timelineFile, outputDirectory] = process.argv.slice(2);
if (!timelineFile || !outputDirectory) throw new Error("Usage: electron benchmarks/scene-parity.cjs timeline.json output-directory");
app.on("window-all-closed", () => {
});
app.whenReady().then(async () => {
  const timeline = JSON.parse(await fs.readFile(path.resolve(timelineFile), "utf8"));
  await fs.mkdir(out, { recursive: true });
  const options = { width: 1920, height: 1080, fps: 60, overlays: [], introOutro: true, overlayAccent: "#d4d7de" };
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, useContentSize: true, frame: false, transparent: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(240);
  await win.loadFile(path.join(root, "overlays/score-scenes/index.html"));
  await win.webContents.executeJavaScript(`window.prepareScenes(${JSON.stringify(timeline)})`);
  await win.webContents.executeJavaScript(`document.body.style.background='#1a1a1a';document.getElementById('root').style.transform='scale(2)';document.getElementById('root').style.transformOrigin='0 0'`);
  const samples = [["intro", 0.2], ["intro", 0.8], ["intro", 1.8], ["intro", 2.5], ["intro", 2.68], ["intro", 2.85], ["intro", 3.8], ["intro", 4.95], ["outro", 2.8], ["outro", 0.9]];
  for (const [kind, t] of samples) {
    await win.webContents.executeJavaScript(`window.seekScene('${kind}',${t});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    await win.webContents.capturePage();
    await new Promise((r) => setTimeout(r, 80));
    await fs.writeFile(path.join(out, `browser-${kind}-${t}.png`), (await win.webContents.capturePage()).toPNG());
  }
  await win.loadFile(path.join(root, "overlays/native-hud.html"));
  await win.webContents.executeJavaScript(`window.createNativeScenes(${JSON.stringify(timeline)},${JSON.stringify(options)}).then(s=>{window.scenes=s;})`);
  const { blitSprite, fillBgra } = await import(path.join(root, "dist/core/scene-blit.js"));
  const assets = /* @__PURE__ */ new Map();
  for (const [kind, t] of samples) {
    const batch = await win.webContents.executeJavaScript(`window.scenes.batch('${kind}',${Math.round(t * 60)},1)`);
    for (const a of batch.assets) {
      const im = nativeImage.createFromBuffer(Buffer.from(a.png, "base64"));
      assets.set(a.id, { ...im.getSize(), data: im.toBitmap() });
    }
    const dest = new Uint8Array(1920 * 1080 * 4);
    fillBgra(dest, [0.1, 0.1, 0.1, 1]);
    for (const s of batch.frames[0].sprites) {
      const a = assets.get(s.asset);
      if (!a) throw Error("missing " + s.asset);
      blitSprite(dest, 1920, 1080, a.data, a.width, a.height, s.x, s.y, s.w, s.h, s.color, s.clip);
    }
    await fs.writeFile(path.join(out, `native-${kind}-${t}.png`), nativeImage.createFromBitmap(Buffer.from(dest), { width: 1920, height: 1080 }).toPNG());
    const browser = nativeImage.createFromPath(path.join(out, `browser-${kind}-${t}.png`)).toBitmap();
    const overlay = Buffer.alloc(dest.length), difference = Buffer.alloc(dest.length);
    let error = 0;
    for (let i = 0; i < dest.length; i++) {
      if (i % 4 === 3) {
        overlay[i] = difference[i] = 255;
        continue;
      }
      overlay[i] = Math.round((browser[i] + dest[i]) / 2);
      difference[i] = Math.abs(browser[i] - dest[i]);
      error += difference[i];
    }
    for (const [name, bytes] of [["overlay", overlay], ["difference", difference]]) await fs.writeFile(path.join(out, `${name}-${kind}-${t}.png`), nativeImage.createFromBitmap(bytes, { width: 1920, height: 1080 }).toPNG());
    console.log(JSON.stringify({ kind, time: t, meanAbsoluteChannelError: error / (1920 * 1080 * 3) }));
  }
  win.destroy();
  app.exit(0);
}).catch((e) => {
  console.error(e);
  app.exit(1);
});
