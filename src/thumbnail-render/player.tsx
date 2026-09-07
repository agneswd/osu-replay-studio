import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Timeline, ThumbnailTextOptions } from "../../core/types.js";
import { defaultThumbnail } from "../../core/thumbnail-document.js";
import { ThumbnailScene } from "./scene.js";
import "./style.css";
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { async renderThumbnail(timeline: Timeline, accent: string, customization: ThumbnailTextOptions = {}) {
  const value = customization.document ?? defaultThumbnail(accent);
  if (!customization.document && customization.bottomText !== undefined) {
    value.layers["bottom-message"] = { text: customization.bottomText };
    value.accentRange = customization.accentRange;
  }
  await document.fonts.load('700 72px "Baloo 2"');
  await document.fonts.load('700 72px "Fredoka"');
  flushSync(() => root.render(<ThumbnailScene timeline={timeline} value={value} scale={value.width / 1280} />));
  await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
  await document.fonts.ready;
  await new Promise(requestAnimationFrame);
} });
