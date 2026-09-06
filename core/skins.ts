import { readdir } from "node:fs/promises";
import path from "node:path";

export interface SkinChoice { name: string; path: string }


export async function listSkins(songs: string): Promise<SkinChoice[]> {
  if (!songs) return [];
  const folder = path.join(path.dirname(songs), "Skins");
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries.filter(entry => entry.isDirectory())
    .map(entry => ({ name: entry.name, path: path.join(folder, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
