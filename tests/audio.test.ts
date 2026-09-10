import test from "node:test";
import assert from "node:assert/strict";
import { measuredAudioFilter } from "../core/audio.js";
import { compositeArgs } from "../core/presentation.js";

test("export audio uses measured loudness and preserves silence", () => {
  const measured = measuredAudioFilter('log\n{"input_i":"-20","input_tp":"-8","input_lra":"3","input_thresh":"-30","target_offset":"0.1"}');
  assert.match(measured, /I=-14:TP=-1.5:LRA=50:measured_I=-20/);
  assert.match(measured, /linear=true$/);
  assert.equal(measuredAudioFilter('{"input_i":"-inf"}'), "anull");
  assert.throws(() => measuredAudioFilter("no measurement"));
  for (const intro of [false, true]) {
    const args = compositeArgs("in.mp4", "out.mp4", 10, 60, intro, 1, 0, measured);
    assert.ok(args[args.indexOf("-af") + 1].includes(measured));
    assert.equal(args[args.indexOf("-ar") + 1], "48000");
  }
});
