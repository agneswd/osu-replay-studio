import { displayMods } from "../../core/mods.js";
import { leaderboardAt } from "../../core/leaderboard.js";
import type { Timeline } from "../../core/types.js";
import type { ThumbnailData } from "./shared/types/thumbnail.js";
export function thumbnailData(timeline: Timeline): ThumbnailData {
  const score = timeline.sceneInfo!.score;
  const info = timeline.sceneInfo!;
  const difficulty = timeline.title.match(/\[([^\]]+)\]$/)?.[1] ?? "";
  const fullCombo = info.playStatus?.fullCombo ?? (score.maxCombo >= info.maxCombo && score.hits["0"] === 0 && score.hits.sliderBreaks === 0);
  const rank = leaderboardAt(timeline, score, 100).rows.find(row => row.current)?.position;
  const data: ThumbnailData = { scoreId: timeline.replayId ?? "0", ruleset: "osu", username: timeline.player,
    userId: timeline.online?.playerId ?? 0, avatarUrl: timeline.playerAvatar, countryCode: timeline.playerCountry ?? undefined,
    leaderboardPosition: rank || undefined,
    pp: score.pp, accuracy: score.accuracy / 100, grade: score.grade.replace("SSH", "SS").replace("SH", "S"), maxCombo: score.maxCombo,
    status: fullCombo ? { kind: "fc" } : score.hits["0"] ? { kind: "miss", count: score.hits["0"] } : { kind: "unknown" },
    missCount: score.hits["0"], sbCount: fullCombo ? 0 : score.hits.sliderBreaks, isFullCombo: fullCombo,
    mods: displayMods(displayMods(timeline.mods).join("") + (timeline.replayFormat === "stable" ? "CL" : "")).map(acronym => ({ acronym })), statistics: {}, beatmapId: timeline.online?.map.id ?? 0, beatmapsetId: 0,
    beatmapStatus: timeline.online?.map.status, artist: info.artist, title: info.title.replace(/\s*\[[^\]]+\]$/, ""),
    difficultyName: difficulty, baseBpm: timeline.bpm / timeline.speed, effectiveBpm: timeline.bpm, clockRate: timeline.speed,
    moddedStarRating: timeline.stars, backgroundUrl: timeline.bgImage };
  return data;
}
