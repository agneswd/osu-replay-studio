import { BrowserWindow, type NativeImage } from "electron";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Timeline } from "../core/types.js";
import { normalizeOverlayAccent } from "../core/types.js";

export async function captureThumbnail(root: string, timeline: Timeline, file: string, accent: string, signal: AbortSignal) {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, useContentSize: true, frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  try {
    signal.throwIfAborted();
    await win.loadFile(path.join(root, "overlays/thumbnail/index.html"));
    win.setContentSize(1280, 720);
    await win.webContents.executeJavaScript(`window.renderThumbnail(${JSON.stringify(timeline)},${JSON.stringify(normalizeOverlayAccent(accent))})`);
    signal.throwIfAborted();
    await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    // Use the completed offscreen frame. Windows can reject capturePage before its surface is ready.
    const painted = once(win.webContents, "paint", { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
    win.webContents.invalidate();
    const image: NativeImage = (await painted)[2];
    if (image.getSize().width !== 1280 || image.getSize().height !== 720) throw new Error("Thumbnail size does not match.");
    signal.throwIfAborted();
    await writeFile(file, image.toPNG(), { flag: "wx" });
  } finally { win.destroy(); }
}
