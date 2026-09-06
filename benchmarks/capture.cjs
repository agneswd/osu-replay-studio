const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.whenReady().then(async () => {
  const { captureOverlay } = await import(path.join(root, 'dist/electron/capture.js'));
  const { overlayIds } = await import(path.join(root, 'dist/core/types.js'));
  const snapshot = { time: 0, score: 123456, combo: 12, maxCombo: 12, accuracy: 98.12, pp: 123,
    grade: 'A', hits: {'300': 100, '100': 2, '50': 0, '0': 0, sliderBreaks: 0}, errors: [], ur: 80 };
  const timeline = { replay: '', beatmap: '', player: 'Player', title: 'Capture benchmark', mods: 'HDHR', speed: 1,
    duration: 4, preempt: 600, stars: 5, bpm: 180, od: 8, maxPP: 400, strains: Array(100).fill(1),
    health: [{time:0,value:1}], warnings: [], snapshots: [snapshot] };
  const options = {width:1280,height:720,fps:30,overlays:overlayIds,introOutro:false};
  let frames = 0, bytes = 0;
  const start = performance.now();
  for await (const buffer of captureOverlay(root)(options, timeline, 120, new AbortController().signal)) {
    frames++; bytes += buffer.length;
  }
  assert.equal(frames, 120);
  const elapsed = (performance.now() - start) / 1000;
  console.log(JSON.stringify({ frames, seconds: elapsed, framesPerSecond: frames / elapsed, pngMiB: bytes / 1048576 }));
  app.exit(0);
}).catch(error => {console.error(error);app.exit(1)});
