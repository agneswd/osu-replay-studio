import { pngEncoder } from "./png.js";
import { BrowserWindow } from "electron";
import path from "node:path";
import { presentationAt } from "../core/presentation.js";
import {
  defaultOverlayAccent,
  normalizeOverlayAccent,
  type Capture,
} from "../core/types.js";

export function captureOverlay(root: string): Capture {
  return async function* (options, timeline, frames, signal, range) {
    const win = new BrowserWindow({
      show: false,
      width: options.width,
      height: options.height,
      useContentSize: true,
      transparent: true,
      frame: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        offscreen: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // Video time is explicit. A faster paint clock avoids waiting at the display refresh rate.
    win.webContents.setFrameRate(240);
    const encode = pngEncoder(options.width, options.height);
    try {
      await win.loadFile(path.join(root, "overlays/index.html"), { query: { overlays: options.overlays.join(",") } });
      // Hidden windows can keep the initial viewport until content finishes loading.
      win.setContentSize(options.width, options.height);
      await win.webContents.executeJavaScript("window.overlayReady");
      await win.webContents.executeJavaScript(`window.replayTimeline=${JSON.stringify(timeline)}`);
      if (range?.background) await win.webContents.executeJavaScript(`window.setSceneBackground(${JSON.stringify(range.background)})`);
      if (options.introOutro)
        await win.webContents.executeJavaScript("window.prepareScenes(window.replayTimeline)");
      await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      for (let i = range?.start ?? 0; i < (range?.end ?? frames); i++) {
        signal.throwIfAborted();
        const position = presentationAt(timeline, i / options.fps, options.fps, options.introOutro, Math.min(options.duration ?? timeline.duration, timeline.duration));
        await win.webContents.executeJavaScript(
          `window.setReplayFrame(window.sampleReplayFrame(window.replayTimeline,${position.gameplayTime},${options.leaderboardSize ?? 50},${JSON.stringify(options.leaderboardSort ?? "pp")}),${JSON.stringify(options.overlays)},${JSON.stringify({ layout: options.layout, accent: normalizeOverlayAccent(options.overlayAccent ?? defaultOverlayAccent), scene: position.scene, backgroundDim: options.backgroundDim })})`,
        );
        if (i === (range?.start ?? 0)) {
          // The first update creates player rows and starts their image and font loads.
          await win.webContents.executeJavaScript(`Promise.all([document, ...[...document.querySelectorAll('iframe')].map(frame => frame.contentDocument)].map(async doc => {
            void doc.body.offsetHeight;
            await doc.fonts.ready;
            await Promise.all([...doc.images].map(image => image.decode().catch(() => {})));
          }))`);
          // Flush the initial iframe surfaces before recording the first frame.
          await win.webContents.capturePage();
        }
        await win.webContents.executeJavaScript(
          "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        );
        const image = await win.webContents.capturePage();
        if (
          image.getSize().width !== options.width ||
          image.getSize().height !== options.height
        )
          throw new Error(
            "Overlay capture size does not match output resolution.",
          );
        // Scene backgrounds are opaque. Native PNG encoding avoids the JavaScript pixel conversion.
        yield range?.background ? image.toPNG() : encode(image.toBitmap());
      }
    } finally {
      win.destroy();
    }
  };
}
