import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { zipSync, unzipSync } from "fflate";
import { gameplaySkinAssets } from "./skin-assets.js";
import { runtimeRoot } from "./runtime.js";

export interface PreviewData { mapText: string; replay: Uint8Array; samples: Record<string, Uint8Array> }

async function assets(folder: string, pattern: RegExp, limit: number, exclude?: string, include = (_name: string) => true) {
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.toLowerCase() === exclude?.toLowerCase() || !pattern.test(entry.name) || !include(entry.name)) continue;
    const file = path.join(folder, entry.name);
    const size = (await stat(file)).size;
    if (size > 16 * 1024 * 1024 || (total += size) > limit) throw new Error("Preview assets exceed the size limit.");
    files[entry.name] = await readFile(file);
  }
  return files;
}
let defaultSkin: Promise<Uint8Array> | undefined;
export function previewSkin(folder: string): Promise<Uint8Array> {
  if (folder) return (async () => {
    const entries = await readdir(folder);
    const iniFile = entries.find(name => name.toLowerCase() === "skin.ini");
    const ini = iniFile ? await readFile(path.join(folder, iniFile), "utf8") : "";
    return zipSync(await assets(folder, /\.(png|wav|ogg|mp3|ini)$/i, 128 * 1024 * 1024, undefined, gameplaySkinAssets(ini)), { level: 0 });
  })();
  return defaultSkin ??= (async () => {
    // Danser's asset archive uses an XOR mask over a ZIP file.
    const bytes = await readFile(path.join(runtimeRoot(), "danser/assets.dpak"));
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    for (let i = 4; i < bytes.length; i++) bytes[i] ^= (i + i % 20) & 255;
    const entries = unzipSync(bytes, { filter: file => file.name.startsWith("assets/default-skin/") });
    const files = Object.fromEntries(Object.entries(entries).map(([name, data]) => [path.basename(name), data]));
    const keep = gameplaySkinAssets(new TextDecoder().decode(files["skin.ini"]));
    return zipSync(Object.fromEntries(Object.entries(files).filter(([name]) => keep(name))), { level: 0 });
  })();
}
export async function previewData(beatmap: string, replay: string): Promise<PreviewData> {
  const mapText = await readFile(beatmap, "utf8");
  const audio = mapText.match(/^AudioFilename\s*:\s*(.+)$/m)?.[1].trim();
  return { mapText, replay: await readFile(replay),
    samples: await assets(path.dirname(beatmap), /\.(wav|ogg|mp3)$/i, 64 * 1024 * 1024, audio) };
}
