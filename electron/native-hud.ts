import { BrowserWindow } from "electron";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import path from "node:path";
import type { HudBatch, PrepareHud } from "../core/native-hud.js";

export function prepareNativeHud(root: string): PrepareHud {
  return async (options, timeline, directory, signal) => {
    signal.throwIfAborted();
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const abort = () => {
      if (!win.isDestroyed()) win.destroy();
    };
    signal.addEventListener("abort", abort, { once: true });
    const assets: string[] = [];
    const framesFile = path.join(directory, "hud-frames.jsonl.gz");
    try {
      await mkdir(path.join(directory, "hud-assets"), { recursive: true });
      await win.loadFile(path.join(root, "overlays/native-hud.html"));
      await win.webContents.executeJavaScript(
        `window.createNativeHud(${JSON.stringify(timeline)},${JSON.stringify(options)}).then(hud => { window.hud = hud; })`,
      );
      const frames = Math.ceil(
        Math.min(options.duration ?? timeline.duration, timeline.duration) *
          options.fps,
      );
      async function* batches() {
        for (let i = 0; i < frames; i += 60) {
          signal.throwIfAborted();
          const batch: HudBatch = await win.webContents.executeJavaScript(
            `window.hud.batch(${i},${Math.min(60, frames - i)})`,
          );
          for (const asset of batch.assets) {
            const file = path.join(directory, "hud-assets", `${asset.id}.png`);
            await writeFile(file, Buffer.from(asset.png, "base64"));
            assets[asset.id] = file;
          }
          for (const frame of batch.frames) yield JSON.stringify(frame) + "\n";
        }
      }
      await pipeline(
        batches(),
        createGzip({ level: 1 }),
        createWriteStream(framesFile),
        { signal },
      );
      const file = path.join(directory, "hud.json");
      await writeFile(
        file,
        JSON.stringify({
          fps: options.fps,
          speed: timeline.speed,
          assets,
          frames: framesFile,
        }),
      );
      return file;
    } finally {
      signal.removeEventListener("abort", abort);
      if (!win.isDestroyed()) win.destroy();
    }
  };
}
