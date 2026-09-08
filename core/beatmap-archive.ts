import { createHash } from "node:crypto";
import { readFile, stat, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";

// Keep imported assets together for preview and Danser, without changing an osu! installation.
export async function importBeatmapArchive(file: string, expected: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if ((await stat(file)).size > 256 * 1024 * 1024) throw new Error("Beatmap archive exceeds the 256 MiB limit.");
  const bytes = await readFile(file);
  let total = 0, count = 0;
  const names = new Set<string>();
  const entries = unzipSync(bytes, { filter: entry => {
    const name = entry.name.replace(/\\/g, "/");
    if (++count > 4096 || (total += entry.originalSize) > 512 * 1024 * 1024)
      throw new Error("Beatmap archive exceeds the extraction limit.");
    if (name.startsWith("/") || name.split("/").some(part => part === ".." || /[:\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))
      throw new Error("Beatmap archive contains an unsafe file path.");
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error("Beatmap archive contains duplicate file paths.");
    names.add(key);
    if (/\.osu$/i.test(name) && entry.originalSize > 16 * 1024 * 1024) throw new Error("Beatmap exceeds the 16 MiB limit.");
    return !name.endsWith("/");
  } });
  signal?.throwIfAborted();
  const match = Object.keys(entries).find(name => /\.osu$/i.test(name) && createHash("md5").update(entries[name]).digest("hex") === expected.toLowerCase());
  if (!match) throw new Error("This archive does not contain the replay's exact beatmap version. Choose the original map archive.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "osu-replay-studio-map-"));
  try {
    for (const [name, data] of Object.entries(entries)) {
      signal?.throwIfAborted();
      const target = path.join(dir, name.replace(/\\/g, "/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data, { flag: "wx" });
    }
    return path.join(dir, match.replace(/\\/g, "/"));
  } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
}
