import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import updater from "electron-updater";

export interface UpdateStatus { state: "disabled" | "idle" | "checking" | "available" | "downloading" | "ready" | "error"; version: string; nextVersion?: string; percent?: number }
export function startUpdates() {
  const enabled = app.isPackaged && existsSync(path.join(process.resourcesPath, "app-update.yml")) &&
    (process.platform !== "linux" || !!process.env.APPIMAGE);
  const version = app.isPackaged ? app.getVersion() : JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version as string;
  let status: UpdateStatus = { state: enabled ? "idle" : "disabled", version };
  const { autoUpdater } = updater;
  if (enabled) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on("checking-for-update", () => { status = { ...status, state: "checking" }; });
    autoUpdater.on("update-available", info => { status = { ...status, state: "available", nextVersion: info.version, percent: 0 }; });
    autoUpdater.on("download-progress", progress => { status = { ...status, state: "downloading", percent: progress.percent }; });
    autoUpdater.on("update-downloaded", info => { status = { ...status, state: "ready", nextVersion: info.version }; });
    autoUpdater.on("update-not-available", () => { status = { state: "idle", version }; });
    autoUpdater.on("error", () => { status = { ...status, state: "error" }; });
  }
  async function check() {
    if (enabled && !["checking", "downloading", "ready"].includes(status.state)) {
      try { await autoUpdater.checkForUpdates(); } catch { status = { ...status, state: "error" }; }
    }
    return status;
  }
  async function download() {
    if (enabled && status.nextVersion && ["available", "error"].includes(status.state)) {
      status = { ...status, state: "downloading", percent: 0 };
      try { await autoUpdater.downloadUpdate(); } catch { status = { ...status, state: "error" }; }
    }
    return status;
  }
  function install() {
    if (enabled && status.state === "ready") autoUpdater.quitAndInstall(false, true);
  }
  if (enabled) {
    const first = setTimeout(() => void check(), 3_000);
    const repeat = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    app.once("before-quit", () => { clearTimeout(first); clearInterval(repeat); });
  }
  return { status: () => status, check, download, install };
}
