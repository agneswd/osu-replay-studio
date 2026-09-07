import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { render } from "../core/render.js";

test("failed render setup preserves diagnostics beside the requested video", async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), "studio-diagnostics-"));
  const output = path.join(work, "video.mp4");
  try {
    await assert.rejects(render({ replay: "missing.osr", songs: work, danser: path.join(work, "missing-danser"),
      output, width: 1280, height: 720, fps: 30, overlays: [] },
      async function* () { assert.fail("Setup failure must not capture frames."); }, new AbortController().signal, () => {}));
    const report = JSON.parse(await readFile(`${output}.render.json`, "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.overlayFrames, 0);
    assert.match(report.error, /missing-danser/);
    assert.match(await readFile(`${output}.render.log`, "utf8"), /Failed:/);
  } finally { await rm(work, { recursive: true, force: true }); }
});
