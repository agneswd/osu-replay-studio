const { app, nativeImage } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

app.whenReady().then(async () => {
  const { pngEncoder } = await import(path.join(root, "dist/electron/png.js"));
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
  const { captureOverlay } = await import(path.join(root, "dist/electron/capture.js"));
  const { overlayIds } = await import(path.join(root, "dist/core/types.js"));
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
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
