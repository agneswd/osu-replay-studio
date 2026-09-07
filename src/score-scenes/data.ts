import { displayMods } from "../../core/mods.js";
import type { Timeline } from "../../core/types";
import type { OverlayData } from "./widgets/types";

const emptyImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
const format = (n: number) => Math.round(n).toLocaleString("en-US").replaceAll(",", " ");

function timeAgo(date: string, fetchedAt: string) {
  const days = Math.max(0, Math.floor((Date.parse(fetchedAt) - Date.parse(date)) / 86400000));
  if (!Number.isFinite(days)) return "";
  return days >= 365 ? `${Math.floor(days / 365)}y` : days >= 30 ? `${Math.floor(days / 30)}mo` : days > 0 ? `${days}d` : "today";
}

// Preview and native export share this payload so missing online fields stay empty.
export function overlayData(timeline: Timeline): OverlayData {
  const info = timeline.sceneInfo;
  const score = info?.score ?? timeline.snapshots.at(-1)!;
  const stats = timeline.playerStats;
  const online = timeline.online;
  const counts = stats?.monthlyPlaycounts ?? [];
  const peak = counts.reduce((best, entry) => entry.count > best.count ? entry : best, { date: "", count: 0 });
  const country = timeline.playerCountry ?? "";
  const mods = displayMods(timeline.mods);
  return {
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
      count300: score.hits["300"], count100: score.hits["100"], count50: score.hits["50"], sliderBreaks: score.hits.sliderBreaks, countMiss: score.hits["0"],
      playedAtAgo: info?.playedAt ? `Played ${info.playedAt}` : "", mods,
    },
    topScores: (online?.topPlays ?? []).slice(0, 6).map(play => ({
      rank: play.grade.replace(/H$/, "").replace(/^X$/, "SS"), title: play.title,
      mods: displayMods(play.mods),
      timeAgo: timeAgo(play.playedAt, online!.fetchedAt), pp: play.pp == null ? "" : `${Math.round(play.pp)}pp`,
      cover: play.cover ?? timeline.bgImage ?? emptyImage,
    })),
  };
}

export function sceneFlags(timeline: Timeline) {
  const mods = timeline.mods;
  return {
    onlineMap: !!timeline.online,
    mapperAvatar: !!timeline.online?.map.mapperAvatar,
    topPlays: !!timeline.online?.topPlays.length,
    history: (timeline.playerStats?.monthlyPlaycounts.length ?? 0) >= 2,
    profileStats: !!timeline.playerStats,
    mapStats: !!timeline.sceneInfo,
    silverGrade: /HD|FL/.test(mods),
  };
}
