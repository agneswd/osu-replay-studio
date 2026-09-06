import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveBeatmap } from "../core/analyze.js";

test("map lookup rechecks cached files and finds moved maps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-lookup-"));
  const data = "osu file format v14\n[Metadata]\nTitle:Lookup";
  const hash = createHash("md5").update(data).digest("hex");
  const first = path.join(root, "first.osu"), second = path.join(root, "nested", "second.OSU");
  try {
    await writeFile(first, data);
    assert.equal(await resolveBeatmap(root, hash), first);
    assert.equal(await resolveBeatmap(root, hash), first);
    await mkdir(path.dirname(second));
    await writeFile(first, "changed");
    await writeFile(second, data);
    assert.equal(await resolveBeatmap(root, hash), second);
    await assert.rejects(resolveBeatmap(root, hash, first), /does not match/);
    await assert.rejects(resolveBeatmap(root, hash, undefined, AbortSignal.abort()), /abort/i);
    await rm(second);
    await assert.rejects(resolveBeatmap(root, hash), /not found/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
