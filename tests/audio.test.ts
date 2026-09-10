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

test("normalized AAC exports contain silent intro samples without timestamp gaps", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { nativeAudioArgs } = await import("../core/native-hud.js");
  const { presentationTiming } = await import("../core/presentation.js");
  const { exportLoudness } = await import("../core/audio.js");
  const { runtimeTool } = await import("../core/runtime.js");
  const work = mkdtempSync(path.join(tmpdir(), "studio-aac-delay-"));
  const run = (args: string[], input?: Buffer) => {
    const result = spawnSync(runtimeTool("ffmpeg"), ["-v", "info", "-y", ...args], { input, timeout: 15000, maxBuffer: 8000000 });
    assert.equal(result.status, 0, result.stderr.toString());
    return result;
  };
  try {
    const song = path.join(work, "song.wav"), video = path.join(work, "video.mp4");
    run(["-f", "lavfi", "-i", "sine=frequency=440:duration=8:sample_rate=48000", "-ac", "2", song]);
    const filter = measuredAudioFilter(run(["-i", song, "-af", `${exportLoudness}:print_format=json`, "-f", "null", "-"]).stderr.toString());
    const timing = presentationTiming(4, 60, true, 1);
    run(["-f", "lavfi", "-i", "color=black:s=16x16:r=60:d=4", "-c:v", "libx264", video]);
    const png = run(["-f", "lavfi", "-i", "color=black:s=16x16,format=rgba", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]).stdout;
    for (const kind of ["native", "browser"]) {
      const output = path.join(work, `${kind}.mp4`);
      if (kind === "native") run(nativeAudioArgs(video, output, timing, 60, 0, filter, song));
      else run(compositeArgs(video, output, 4, 60, true, 0, 1, filter, song), Buffer.concat(Array(timing.frames).fill(png)));
      const bytes = run(["-i", output, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"]).stdout;
      const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      // Raw decoding ignores packet timestamps, as some video transcoders do.
      assert.ok(Math.abs(samples.length / 48000 - timing.duration) < .03, `${kind} must encode the entire silent hold`);
      const onset = samples.findIndex(value => Math.abs(value) > .005) / 48000;
      assert.ok(Math.abs(onset - timing.introFrames / 60) < .03, `${kind} music starts at ${onset}s`);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});
