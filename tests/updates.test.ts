import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import path from "node:path";

// Exercise the real updater controller without downloading or installing software.
test("launch checks offer an update, download requires consent, and restart requires a completed download", async () => {
  let first: (() => void) | undefined, checks = 0, downloads = 0, installs = 0;
  const events = new EventEmitter();
  const updater = Object.assign(events, {
    autoDownload: true, autoInstallOnAppQuit: true,
    async checkForUpdates() { checks++; events.emit("update-available", { version: "9.0.0" }); },
    async downloadUpdate() { downloads++; events.emit("download-progress", { percent: 50 }); events.emit("update-downloaded", { version: "9.0.0" }); },
    quitAndInstall() { installs++; },
  });
  const app = Object.assign(new EventEmitter(), { isPackaged: true, getVersion: () => "1.0.0" });
  const module = { exports: {} as { startUpdates(): { status(): { state: string }; check(): Promise<unknown>; download(): Promise<unknown>; install(): void } } };
  const code = transformSync(readFileSync("electron/updates.ts", "utf8"), { loader: "ts", format: "cjs" }).code;
  runInNewContext(code, { module, exports: module.exports, process: { resourcesPath: "/app", platform: "win32" },
    require: (name: string) => name === "electron" ? { app } : name === "electron-updater" ? { autoUpdater: updater }
      : name === "node:fs" ? { existsSync: () => true } : path,
    setTimeout: (fn: () => void) => { first = fn; }, setInterval() {}, clearTimeout() {}, clearInterval() {},
  });
  const controller = module.exports.startUpdates();
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  first!(); await Promise.resolve();
  assert.equal(checks, 1);
  assert.equal(controller.status().state, "available");
  assert.equal(downloads, 0);
  controller.install(); assert.equal(installs, 0);
  await controller.download();
  assert.equal(downloads, 1);
  assert.equal(controller.status().state, "ready");
  controller.install(); assert.equal(installs, 1);
  await controller.download(); assert.equal(downloads, 1);
});
