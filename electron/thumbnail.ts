import { validateThumbnailDocument } from "../core/thumbnail-document.js";
import { validateThumbnailText } from "../core/thumbnail.js";
import { BrowserWindow } from "electron";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Timeline, ThumbnailTextOptions } from "../core/types.js";
import { normalizeOverlayAccent } from "../core/types.js";

export async function captureThumbnail(root: string, timeline: Timeline, file: string, accent: string, signal: AbortSignal, text: ThumbnailTextOptions = {}) {
  validateThumbnailText(text);
  if (text.document) validateThumbnailDocument(text.document);
  const width = text.document?.width ?? 1280, height = width * 9 / 16;
  const win = new BrowserWindow({ show: false, width, height, useContentSize: true, frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  try {
    signal.throwIfAborted();
    await win.loadFile(path.join(root, "overlays/thumbnail/index.html"));
    win.setContentSize(width, height);
    await win.webContents.executeJavaScript(`window.renderThumbnail(${JSON.stringify(timeline)},${JSON.stringify(normalizeOverlayAccent(accent))},${JSON.stringify(text)})`);
    signal.throwIfAborted();
    await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    // Wait for the offscreen surface before capturing all composited image layers.
    const painted = once(win.webContents, "paint", { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
    win.webContents.invalidate();
    await painted;
    await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const image = await win.webContents.capturePage();
    if (image.getSize().width !== width || image.getSize().height !== height) throw new Error("Thumbnail size does not match.");
    signal.throwIfAborted();
    await writeFile(file, image.toPNG(), { flag: "wx" });
  } finally { win.destroy(); }
}
