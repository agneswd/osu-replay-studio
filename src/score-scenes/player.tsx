import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { OverlayWidget } from "./widgets/OverlayWidget";
import { ShowcaseIntroWidget } from "./widgets/ShowcaseIntroWidget";
import { seekOverlay, seekShowcaseIntro, OVERLAY_TOTAL_CYCLE, SHOWCASE_INTRO_TOTAL_CYCLE } from "./widgets/timeline";
import { buildPlaycountSpline } from "./widgets/spline";
import { applyOverlayPalette, customAccentPalette } from "./widgets/themes";
import type { OverlayData } from "./widgets/types";
import type { Timeline } from "../../core/types";
import { normalizeOverlayAccent } from "../../core/types";
import { sceneDuration } from "../../core/presentation";
import { overlayData, sceneFlags } from "./data";
import "./widgets/overlay.css";
import "./player.css";

const root = createRoot(document.getElementById("root")!);
const introNodes = new Map<import("./widgets/OverlayWidget").OverlayNode, Element>();
const outroNodes = new Map<import("./widgets/ShowcaseIntroWidget").ShowcaseNode, Element>();
const refs = <T extends string>(nodes: Map<T, Element>) => (name: T) => (element: Element | null) => {
  if (element) nodes.set(name, element); else nodes.delete(name);
};
const introRef = refs(introNodes);
const outroRef = refs(outroNodes);
let data: OverlayData;
window.prepareScenes = async (timeline: Timeline) => {
  if (OVERLAY_TOTAL_CYCLE !== sceneDuration || SHOWCASE_INTRO_TOTAL_CYCLE !== sceneDuration)
    throw new Error("Animation timing changed. Update the presentation duration before export.");
  data = overlayData(timeline);
  const flags = sceneFlags(timeline);
  document.body.classList.toggle("no-online-map", !flags.onlineMap);
  document.body.classList.toggle("no-mapper-avatar", !flags.mapperAvatar);
  document.body.classList.toggle("no-top-plays", !flags.topPlays);
  document.body.classList.toggle("no-history", !flags.history);
  document.body.classList.toggle("no-profile-stats", !flags.profileStats);
  document.body.classList.toggle("no-map-stats", !flags.mapStats);
  document.body.classList.toggle("silver-grade", flags.silverGrade);
  flushSync(() => root.render(<>
    <div id="intro" className="animation-root animation-stage"><OverlayWidget data={data} spline={buildPlaycountSpline(data.player.monthlyPlaycounts)} setRef={introRef} /></div>
    <div id="outro" className="animation-root animation-stage showcase-export"><ShowcaseIntroWidget data={data} setRef={outroRef} /></div>
  </>));
  window.setSceneAccent("#d4d7de");
  const grade = document.querySelector(".showcase-grade-rank")!;
  grade.className = `showcase-grade-rank rank-${data.score!.rank.toLowerCase()}`;
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
};
let currentAccent = "";
window.setSceneAccent = (value: string) => {
  const accent = normalizeOverlayAccent(value);
  const palette = customAccentPalette(accent);
  if (accent !== currentAccent) {
    applyOverlayPalette(palette.accent, palette.top, palette.bottom, palette.lip);
    currentAccent = accent;
  }
  for (const stage of Array.from(document.querySelectorAll<HTMLElement>(".animation-root"))) {
    for (let i = 0; i < document.documentElement.style.length; i++) {
      const name = document.documentElement.style[i];
      stage.style.setProperty(name, document.documentElement.style.getPropertyValue(name));
    }
  }
};
window.seekScene = (kind: "intro" | "outro", seconds: number) => {
  document.body.classList.toggle("intro-player", kind === "intro" && seconds < 2.7);
  document.getElementById("intro")!.style.display = kind === "intro" ? "flex" : "none";
  document.getElementById("outro")!.style.display = kind === "outro" ? "flex" : "none";
  if (kind === "intro") seekOverlay(seconds, { get: name => introNodes.get(name) ?? null }, data);
  else seekShowcaseIntro(seconds, { get: name => outroNodes.get(name) ?? null });
};

declare global {
  interface Window {
    setSceneAccent(accent: string): void;
    prepareScenes(timeline: Timeline): Promise<void>;
    seekScene(kind: "intro" | "outro", seconds: number): void;
  }
}
