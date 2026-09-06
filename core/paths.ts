import { access, stat } from "node:fs/promises";
import path from "node:path";
import { runtimeRoot } from "./runtime.js";

export function songsCandidates(
  home: string,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  const paths: string[] = [];
  const add = (value?: string) => {
    if (value) paths.push(path.normalize(value));
  };
  if (platform === "win32") {
    const local = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    add(path.join(local, "osu!", "Songs"));
    add(path.join(home, "osu!", "Songs"));
    add("C:\\osu!\\Songs");
  }
  add(path.join(home, ".local/share/osu-wine/osu!/Songs"));
  add(path.join(home, ".local/share/osu-winello/osu!/Songs"));
  add(path.join(home, ".local/share/osu!/Songs"));
  add(path.join(home, "osu!", "Songs"));
  add(path.join(home, "Games/osu!/Songs"));
  add(path.join(home, "Games/osu/drive_c/osu!/Songs"));
  const wineUser = env.USER || env.USERNAME || "user";
  add(
    path.join(
      home,
      `.wine/drive_c/users/${wineUser}/AppData/Local/osu!/Songs`,
    ),
  );
  add(path.join(home, ".wine/drive_c/osu!/Songs"));
  add(path.join(home, ".local/share/wineprefixes/osu/drive_c/osu!/Songs"));
  return [...new Set(paths)];
}

export function danserCandidates(
  appRoot: string,
  platform: NodeJS.Platform,
): string[] {
  const bin = platform === "win32" ? "danser-cli.exe" : "danser-cli";
  return [
    path.join(runtimeRoot(), "danser", bin),
    path.join(appRoot, "danser", "bin", bin),
    path.join(appRoot, "danser", bin),
  ];
}

export async function firstExistingDir(
  candidates: string[],
): Promise<string | undefined> {
  for (const dir of candidates) {
    try {
      if ((await stat(dir)).isDirectory()) return dir;
    } catch {
      // try the next candidate
    }
  }
}

export async function firstExistingFile(
  candidates: string[],
): Promise<string | undefined> {
  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
}

export function sanitizeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned.slice(0, 80) || "replay";
}

export function outputStem(player: string, title: string): string {
  return `${sanitizeFileName(player || "Unknown player")} - ${sanitizeFileName(title || "unknown map")}`;
}

export async function uniqueOutputPath(
  dir: string,
  stem: string,
  extension: "mp4" | "png" = "mp4",
): Promise<string> {
  const free = async (file: string) => {
    try {
      await access(file);
      return false;
    } catch {
      return true;
    }
  };
  for (let n = 0; n < 10000; n++) {
    const file = path.join(dir, `${stem}${n ? ` ${n}` : ""}.${extension}`);
    if (await free(file) && (extension === "png" || await free(file.replace(/\.mp4$/i, ".png")))) return file;
  }
  throw new Error("Could not find a free output filename.");
}
