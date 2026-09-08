import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { resolveBeatmap } from "../core/analyze.js";

test("archive import selects the replay difficulty and preserves nested assets without a Songs folder", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-archive-test-"));
  let imported: string | undefined;
  try {
    const map = await readFile("tests/fixtures/map.osu");
    const hash = createHash("md5").update(map).digest("hex");
    const archive = path.join(dir, "map.osz");
    await writeFile(archive, zipSync({ "map/easy.osu": strToU8("another difficulty"), "map/hard.osu": map, "map/audio.wav": new Uint8Array(44), "map/images/bg.jpg": new Uint8Array([1, 2, 3]) }));
    imported = await resolveBeatmap("", hash, archive);
    assert.deepEqual(await readFile(imported), map);
    assert.equal((await readFile(path.join(path.dirname(imported), "audio.wav"))).length, 44);
    assert.deepEqual(await readFile(path.join(path.dirname(imported), "images/bg.jpg")), Buffer.from([1, 2, 3]));
    await assert.rejects(resolveBeatmap("", "0".repeat(32), archive), /exact beatmap version/);
    for (const name of ["../escaped.osu", "/absolute.osu", "C:\\escape.osu", "folder/../escape.osu", "aux.osu"]) {
      await writeFile(archive, zipSync({ [name]: map }));
      await assert.rejects(resolveBeatmap("", hash, archive), /unsafe file path/);
    }
    await writeFile(archive, zipSync({ "map.osu": map, "MAP.OSU": map }));
    await assert.rejects(resolveBeatmap("", hash, archive), /duplicate file paths/);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(resolveBeatmap("", hash, archive, abort.signal), { name: "AbortError" });
  } finally {
    if (imported) await rm(path.dirname(path.dirname(imported)), { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});
