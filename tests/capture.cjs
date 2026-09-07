const { app, nativeImage, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs/promises");
const os = require("node:os");
const root = path.resolve(__dirname, "..");

app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const { pngEncoder } = await import(pathToFileURL(path.join(root, "dist/electron/png.js")).href);
  const bitmap = Buffer.alloc(256 * 256 * 4);
  for (let alpha = 0; alpha < 256; alpha++) for (let color = 0; color < 256; color++) {
    const at = (alpha * 256 + color) * 4;
    bitmap[at] = Math.round(color * alpha / 255);
    bitmap[at + 1] = Math.round((255 - color) * alpha / 255);
    bitmap[at + 2] = alpha;
    bitmap[at + 3] = alpha;
  }
  const encode = pngEncoder(256, 256);
  assert.deepEqual(nativeImage.createFromBuffer(encode(bitmap)).toBitmap(), bitmap);
  bitmap.fill(0);
  assert.deepEqual(nativeImage.createFromBuffer(encode(bitmap)).toBitmap(), bitmap);
  const { captureOverlay } = await import(pathToFileURL(path.join(root, "dist/electron/capture.js")).href);
  const { overlayIds } = await import(pathToFileURL(path.join(root, "dist/core/types.js")).href);
  const timeline = {
    player: "First frame", playerAvatar: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="red" d="M0 0h128v128H0z"/></svg>')}`,
    title: "Capture check", mods: "HD", speed: 1, duration: 1, stars: 5, bpm: 180, od: 8, maxPP: 400,
    health: [], strains: [1, 2, 1], warnings: [], snapshots: [{ time: 0, score: 1000, combo: 12, maxCombo: 12,
      accuracy: 99, pp: 120, grade: "S", hits: { "300": 100, "100": 1, "50": 0, "0": 0, sliderBreaks: 0 }, errors: [], ur: 80 }],
  };
  let count = 0;
  for await (const png of captureOverlay(root)({ width: 1920, height: 1080, fps: 60, overlays: overlayIds }, timeline, 2, new AbortController().signal)) {
    const image = nativeImage.createFromBuffer(png);
    const bitmap = image.toBitmap();
    const pixel = bitmap.subarray((50 * 1920 + 960) * 4, (50 * 1920 + 960) * 4 + 4);
    assert.ok(pixel[2] > 240 && pixel[1] < 10 && pixel[0] < 10 && pixel[3] === 255, `Frame ${count} must contain the loaded avatar.`);
    if (count === 0) {
      let visibleKeyPixels = 0;
      for (let y = 394; y < 504; y++) for (let x = 1694; x < 1920; x++)
        if (bitmap[(y * 1920 + x) * 4 + 3] > 0) visibleKeyPixels++;
      assert.ok(visibleKeyPixels > 100, "The default capture contains the key press overlay.");
    }
    count++;
  }
  assert.equal(count, 2);
  console.log("First captured frame contains loaded replay assets.");
  const { captureWithWorker } = await import(pathToFileURL(path.join(root, "dist/electron/capture-process.js")).href);
  const isolated = captureWithWorker(root)({ width: 1920, height: 1080, fps: 60, overlays: overlayIds }, timeline, 2, new AbortController().signal);
  let isolatedCount = 0;
  for await (const png of isolated) {
    const image = nativeImage.createFromBuffer(Buffer.from(png));
    assert.deepEqual(image.getSize(), { width: 1920, height: 1080 });
    const pixel = image.toBitmap().subarray((50 * 1920 + 960) * 4, (50 * 1920 + 960) * 4 + 4);
    assert.deepEqual([...pixel], [0, 0, 255, 255], "The isolated frame retains the loaded avatar pixels.");
    isolatedCount++;
  }
  assert.equal(isolatedCount, 2, "The capture process sends one complete PNG per requested frame.");
  const abortCapture = new AbortController();
  const cancelled = captureWithWorker(root)({ width: 1920, height: 1080, fps: 60, overlays: [] }, timeline, 120, abortCapture.signal);
  await cancelled.next();
  abortCapture.abort();
  await assert.rejects(cancelled.next());
  console.log("Isolated capture completes and cancels without blocking the app process.");

  for (const value of [0, 1]) {
    const healthTimeline = { ...timeline, health: [{ time: 0, value }] };
    for await (const png of captureOverlay(root)({ width: 1920, height: 1080, fps: 60, overlays: ["health-bar"] }, healthTimeline, 1, new AbortController().signal)) {
      const bitmap = nativeImage.createFromBuffer(png).toBitmap();
      const pixel = (x, y) => bitmap.subarray((y * 1920 + x) * 4, (y * 1920 + x) * 4 + 4);
      if (value === 0) assert.deepEqual(pixel(426, 26), pixel(426, 22), "Empty HP has the same solid color as its outline.");
      else assert.ok(pixel(426, 26)[2] < pixel(426, 22)[2] / 2, "Full HP has a dark center.");
    }
  }
  const { frameAt } = await import(pathToFileURL(path.join(root, "dist/core/timeline.js")).href);
  const tickWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await tickWindow.loadFile(path.join(root, "overlays/hit-error-bar/index.html"));
    const frame = frameAt(timeline, 0);
    frame.timing.ticks = [{ error: -30, opacity: .8, height: 1 }, ...Array.from({ length: 5 }, () => ({ error: 10, opacity: .8, height: 1 }))];
    await tickWindow.webContents.executeJavaScript(`window.renderReplayFrame(${JSON.stringify(frame)})`);
    const tickPixels = [-30, 10].map(error => Math.round(2 * (192 + error * 192 / frame.timing.windows.meh)));
    const colors = await tickWindow.webContents.executeJavaScript(`(() => {
      const context = document.getElementById('timingTicks').getContext('2d');
      return ${JSON.stringify(tickPixels)}.map(x => [...context.getImageData(x, 32, 1, 1).data]);
    })()`);
    assert.ok(colors[1][0] > colors[0][0] + 100, "Overlapping ticks become brighter.");
    assert.ok(colors[1].slice(0, 3).every(value => value > 240), "Dense ticks approach white.");
    frame.timing.ticks = [];
    await tickWindow.webContents.executeJavaScript(`window.renderReplayFrame(${JSON.stringify(frame)})`);
    assert.equal(await tickWindow.webContents.executeJavaScript(`document.getElementById('timingTicks').getContext('2d').getImageData(${tickPixels[1]},32,1,1).data[3]`), 0, "Seeking to an empty frame clears old ticks.");
  } finally { tickWindow.destroy(); }
  const nativeWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await nativeWindow.loadFile(path.join(root, "overlays/native-hud.html"));
    const widths = [];
    for (const value of [0, .5, 1]) {
      const input = { ...timeline, health: [{ time: 0, value }] };
      const result = await nativeWindow.webContents.executeJavaScript(`window.createNativeHud(${JSON.stringify(input)},{fps:60,overlays:['health-bar']}).then(hud=>hud.batch(0,1).frames[0])`);
      assert.equal(result.sprites.length, value === 0 ? 1 : 2, "Empty HP has no dark center.");
      widths.push(result.sprites[1]?.clip[2] ?? 0);
    }
    assert.ok(widths[1] > widths[2] * .45 && widths[1] < widths[2] * .6, "Half HP fills half the curved bar, not the whole bar.");
    console.log("Native HUD preserves the HP percentage scale.");
  } finally { nativeWindow.destroy(); }
  const { captureThumbnail } = await import(pathToFileURL(path.join(root, "dist/electron/thumbnail.js")).href);
  timeline.playerCountry = "SE";
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "studio-thumbnail-"));
  try {
    const { spawnSync } = require("node:child_process");
    const { runtimeTool } = await import(pathToFileURL(path.join(root, "dist/core/runtime.js")).href);
    const { nativeSceneBackgroundArgs } = await import(pathToFileURL(path.join(root, "dist/core/native-hud.js")).href);
    const ffmpeg = args => {
      const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "error", ...args], { timeout: 15000 });
      assert.equal(result.status, 0, result.stderr.toString());
      return result.stdout;
    };
    const source = path.join(work, "background.mp4"), clear = path.join(work, "clear.png"), soft = path.join(work, "soft.png");
    ffmpeg(["-f", "lavfi", "-i", "color=0x404040:s=16x16:r=30:d=1", "-c:v", "libx264", source]);
    const expected = ffmpeg(["-i", source, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])[0];
    ffmpeg(nativeSceneBackgroundArgs(source, clear, soft, "intro", 30, 30));
    for await (const png of captureWithWorker(root)(
      { width: 320, height: 180, fps: 30, overlays: [] }, timeline, 1, new AbortController().signal,
      { start: 0, end: 1, background: { clear: pathToFileURL(clear).href, soft: pathToFileURL(soft).href } },
    )) {
      const actual = nativeImage.createFromBuffer(Buffer.from(png)).toBitmap()[(90 * 320 + 160) * 4];
      assert.ok(Math.abs(actual - expected) <= 1, `Scene backgrounds retain video brightness: ${actual} vs ${expected}.`);
    }
    console.log("Scene backgrounds retain their brightness through Chromium.");
    const { compositeNativeScene } = await import(pathToFileURL(path.join(root, "dist/electron/scene-composite.js")).href);
    const { nativeSceneWithWorker } = await import(pathToFileURL(path.join(root, "dist/electron/capture-process.js")).href);
    const scene = path.join(work, "native-scene.json"), commands = path.join(work, "native-frames.jsonl.gz");
    await fs.writeFile(commands, require("node:zlib").gzipSync(Array.from({ length: 3 }, () => JSON.stringify({ sprites: [], ticks: [] }) + "\n").join("")));
    await fs.writeFile(scene, JSON.stringify({ fps: 30, assets: [], frames: commands }));
    const sceneArgs = [scene, { clear, soft }, "intro", 3, 30, 16, 16];
    const reference = [];
    for await (const frame of compositeNativeScene(...sceneArgs, new AbortController().signal)) reference.push(Buffer.from(frame));
    let nativeCount = 0;
    for await (const frame of nativeSceneWithWorker(root)(...sceneArgs, new AbortController().signal))
      assert.deepEqual(Buffer.from(frame), reference[nativeCount++]);
    assert.equal(nativeCount, 3);
    const cancelled = new AbortController();
    const iterator = nativeSceneWithWorker(root)(...sceneArgs, cancelled.signal)[Symbol.asyncIterator]();
    await iterator.next();
    cancelled.abort();
    await assert.rejects(iterator.next());
    const missing = nativeSceneWithWorker(root)(path.join(work, "missing.json"), ...sceneArgs.slice(1), new AbortController().signal)[Symbol.asyncIterator]();
    await assert.rejects(missing.next(), /ENOENT/);
    console.log("Native scene worker preserves pixels, cancels, and reports failures.");
    const file = path.join(work, "score.png");
    await captureThumbnail(root, { ...timeline, sceneInfo: { title: "Capture check", artist: "Artist", maxCombo: 12, score: timeline.snapshots[0] } }, file, "#d4d7de", new AbortController().signal);
    const image = nativeImage.createFromPath(file);
    assert.deepEqual(image.getSize(), { width: 1280, height: 720 });
    const pixel = image.toBitmap().subarray((490 * 1280 + 640) * 4, (490 * 1280 + 640) * 4 + 4);
    assert.ok(pixel[2] > 240 && pixel[1] < 10 && pixel[0] < 10, "The first thumbnail contains the rendered avatar.");
    const bitmap = image.toBitmap();
    let darkModPixels = 0;
    for (let y = 530; y < 565; y++) for (let x = 766; x < 801; x++) {
      const at = (y * 1280 + x) * 4;
      const [b, g, r, alpha] = bitmap.subarray(at, at + 4);
      if (alpha > 200 && Math.max(b, g, r) < 70) darkModPixels++;
    }
    assert.ok(darkModPixels > 20, "The thumbnail contains the mod icon, not only its background.");
    let blue = 0, yellow = 0;
    for (let y = 554; y < 590; y++) for (let x = 612; x < 669; x++) {
      const at = (y * 1280 + x) * 4;
      const [b, g, r] = bitmap.subarray(at, at + 3);
      if (b > r + 40 && g > r + 20) blue++;
      if (r > 170 && g > 130 && b < 80) yellow++;
    }
    assert.ok(blue > 100 && yellow > 100, "The thumbnail loads the bundled Swedish flag.");
    console.log("Thumbnail capture contains loaded replay assets.");
  } finally { await fs.rm(work, { recursive: true, force: true }); }

  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
