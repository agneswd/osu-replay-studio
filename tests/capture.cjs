const { app, nativeImage } = require("electron");
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
    const pixel = image.toBitmap().subarray((50 * 1920 + 960) * 4, (50 * 1920 + 960) * 4 + 4);
    assert.ok(pixel[2] > 240 && pixel[1] < 10 && pixel[0] < 10 && pixel[3] === 255, `Frame ${count} must contain the loaded avatar.`);
    count++;
  }
  assert.equal(count, 2);
  console.log("First captured frame contains loaded replay assets.");
  const { captureThumbnail } = await import(pathToFileURL(path.join(root, "dist/electron/thumbnail.js")).href);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "studio-thumbnail-"));
  try {
    const file = path.join(work, "score.png");
    await captureThumbnail(root, { ...timeline, sceneInfo: { title: "Capture check", artist: "Artist", maxCombo: 12, score: timeline.snapshots[0] } }, file, "#d4d7de", new AbortController().signal);
    const image = nativeImage.createFromPath(file);
    assert.deepEqual(image.getSize(), { width: 1280, height: 720 });
    const pixel = image.toBitmap().subarray((490 * 1280 + 640) * 4, (490 * 1280 + 640) * 4 + 4);
    assert.ok(pixel[2] > 240 && pixel[1] < 10 && pixel[0] < 10, "The first thumbnail contains the rendered avatar.");
    const bitmap = image.toBitmap();
    const colors = new Set();
    for (let y = 530; y < 565; y++) for (let x = 766; x < 801; x++) {
      const at = (y * 1280 + x) * 4;
      colors.add(bitmap.subarray(at, at + 3).toString("hex"));
    }
    assert.ok(colors.size > 10, "The thumbnail contains the mod icon, not only its background.");
    console.log("Thumbnail capture contains loaded replay assets.");
  } finally { await fs.rm(work, { recursive: true, force: true }); }

  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
