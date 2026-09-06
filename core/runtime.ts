import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const developmentRoot = fileURLToPath(new URL("../", import.meta.url));
// Electron supplies resourcesPath. Source tests and CLI tools use the local runtime folder.
export function runtimeRoot(): string {
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resources && existsSync(path.join(resources, "runtime"))) return path.join(resources, "runtime");
  const root = path.basename(developmentRoot.replace(/[\\/]$/, "")) === "dist"
    ? path.dirname(developmentRoot.replace(/[\\/]$/, "")) : developmentRoot;
  return path.join(root, "runtime");
}

export function runtimeTool(name: string): string {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  const bundled = path.join(runtimeRoot(), "ffmpeg", executable);
  return existsSync(bundled) ? bundled : executable;
}
