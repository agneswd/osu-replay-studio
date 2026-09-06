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
const emptyImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
function timeAgo(date: string, fetchedAt: string) {
  const days = Math.max(0, Math.floor((Date.parse(fetchedAt) - Date.parse(date)) / 86400000));
  if (!Number.isFinite(days)) return "";
  return days >= 365 ? `${Math.floor(days / 365)}y` : days >= 30 ? `${Math.floor(days / 30)}mo` : days > 0 ? `${days}d` : "today";
}
const format = (n: number) => Math.round(n).toLocaleString("en-US").replaceAll(",", " ");

window.prepareScenes = async (timeline: Timeline) => {
  if (OVERLAY_TOTAL_CYCLE !== sceneDuration || SHOWCASE_INTRO_TOTAL_CYCLE !== sceneDuration)
    throw new Error("Animation timing changed. Update the presentation duration before export.");
  const info = timeline.sceneInfo;
  const score = info?.score ?? timeline.snapshots.at(-1)!;
  const stats = timeline.playerStats;
  const online = timeline.online;
  const counts = stats?.monthlyPlaycounts ?? [];
  const peak = counts.reduce((best, entry) => entry.count > best.count ? entry : best, { date: "", count: 0 });
  const country = timeline.playerCountry ?? "";
  const mods = (timeline.mods.match(/.{1,2}/g) ?? []).filter(mod => mod !== "NM" && !(mod === "DT" && timeline.mods.includes("NC")));
  data = {
    player: {
      username: timeline.player, avatar: timeline.playerAvatar || emptyImage,
      banner: online?.cover || timeline.bgImage || emptyImage, isSupporter: online?.supporter ?? false,
      flag: /^[A-Z]{2}$/.test(country) ? [...country].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("") : "",
      countryCode: country, crank: stats?.countryRank ? `#${format(stats.countryRank)}` : "",
      grank: timeline.playerRank ? `#${format(timeline.playerRank)}` : "",
      pp: stats ? `${format(stats.pp)}pp` : "", hours: stats?.hours ?? 0,
      playcount: stats?.playcount ?? 0, badgeCount: online?.badges.length ?? 0, badges: online?.badges ?? [], monthlyPlaycounts: counts,
      peakMonth: peak.date.slice(0, 7), peakCount: peak.count,
    },
    map: {
      title: info?.title ?? timeline.title, artist: info?.artist ?? "", cover: timeline.bgImage || emptyImage,
      mapper: online?.map.mapper ?? info?.mapper ?? "", mapperAvatar: online?.map.mapperAvatar ?? emptyImage,
      favs: online ? format(online.map.favourites) : "", plays: online ? format(online.map.plays) : "",
      id: online?.map.id, retries: online?.map.retries, status: online?.map.status,
      sr: timeline.stars.toFixed(2), bpm: `${Math.round(timeline.bpm)}bpm`,
      ar: info?.ar ?? 0, cs: info?.cs ?? 0, hp: info?.hp ?? 0, od: info?.od ?? timeline.od,
      arMs: `${Math.round(info?.arMs ?? timeline.preempt / timeline.speed)}ms`, odMs: `${(info?.odMs ?? (80 - 6 * timeline.od) / timeline.speed).toFixed(1)}ms`,
    },
    score: {
      totalScore: String(score.score), combo: score.maxCombo, maxCombo: info?.maxCombo ?? score.maxCombo,
      pp: `${Math.round(score.pp)}pp`, accuracy: `${score.accuracy.toFixed(2)}%`, rank: score.grade.replace(/H$/, "").replace(/^X$/, "SS"),
      count300: score.hits["300"], count100: score.hits["100"], count50: score.hits["50"], countMiss: score.hits["0"],
      playedAtAgo: info?.playedAt ? `Played ${info.playedAt}` : "", mods,
    },
    topScores: (online?.topPlays ?? []).slice(0, 6).map(play => ({
      rank: play.grade.replace(/H$/, "").replace(/^X$/, "SS"), title: play.title,
      mods: play.mods === "NM" ? [] : play.mods.match(/.{1,2}/g) ?? [],
      timeAgo: timeAgo(play.playedAt, online!.fetchedAt), pp: play.pp == null ? "" : `${Math.round(play.pp)}pp`,
      cover: play.cover ?? timeline.bgImage ?? emptyImage,
    })),
  };
  document.body.classList.toggle("no-online-map", !online);
  document.body.classList.toggle("no-mapper-avatar", !online?.map.mapperAvatar);
  document.body.classList.toggle("no-top-plays", !online?.topPlays.length);
  document.body.classList.toggle("no-history", counts.length < 2);
  document.body.classList.toggle("no-profile-stats", !stats);
  document.body.classList.toggle("no-map-stats", !info);
  document.body.classList.toggle("silver-grade", mods.includes("HD") || mods.includes("FL"));
  flushSync(() => root.render(<>
    <div id="intro" className="animation-root animation-stage"><OverlayWidget data={data} spline={buildPlaycountSpline(counts)} setRef={introRef} /></div>
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
