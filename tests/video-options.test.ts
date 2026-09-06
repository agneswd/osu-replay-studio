import test from "node:test";
import assert from "node:assert/strict";
import { frameRates, resolutions, videoSettings } from "../core/video-options.js";
import { validateOptions } from "../core/render.js";

test("video defaults use 1080p60 and every listed preset can render", () => {
  assert.deepEqual(videoSettings({}), { width: 1920, height: 1080, fps: 60, backgroundDim: .95, cursorSize: 1 });
  for (const [width, height] of resolutions) for (const fps of frameRates)
    validateOptions({ width, height, fps, replay: "test.osr", songs: "Songs", danser: "danser", output: "test.mp4", overlays: [], backgroundDim: .5, cursorSize: 1.5 });
  const stored = videoSettings({ width: 2560, height: 1440, fps: 120, backgroundDim: .4, cursorSize: 1.5 });
  assert.equal(stored.width, 2560); assert.equal(stored.fps, 120);
  assert.equal(videoSettings({ cursorSize: Infinity }).cursorSize, 1);
});
