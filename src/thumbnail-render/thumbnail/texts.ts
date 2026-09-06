import type { ThumbnailData } from "../shared/types/thumbnail";
import { formatAccuracy, formatBpm, formatCombo, formatLeaderboardPosition, formatMapName, formatPp, formatStarRating, } from "../shared/formatting/format";
import type { ThumbnailTemplate } from "./types";
export function computeTexts(data: ThumbnailData, template: ThumbnailTemplate): Record<string, string> {
    const status = data.status.kind === "fc"
        ? template.dataOptions.fcText
        : data.status.kind === "miss"
            ? template.dataOptions.missText.replace("{count}", String(data.status.count))
            : "";
    const maxLb = template.dataOptions.maxLeaderboardPosition ?? 50;
    const lb = data.leaderboardPosition !== undefined && data.leaderboardPosition > 0 && data.leaderboardPosition <= maxLb
        ? data.leaderboardPosition
        : undefined;
    return {
        status,
        "status-sb": data.sbCount > 0
            ? template.dataOptions.sbText.replace("{count}", String(data.sbCount))
            : "",
        "star-rating": formatStarRating(data.moddedStarRating ?? data.baseStarRating),
        pp: formatPp(data.pp),
        combo: formatCombo(data.maxCombo),
        difficulty: data.difficultyName,
        bpm: formatBpm(data.effectiveBpm),
        "map-artist": data.artist,
        "map-title": formatMapName(data, template.dataOptions.mapNameFormat),
        grade: data.grade,
        accuracy: formatAccuracy(data.accuracy),
        leaderboard: formatLeaderboardPosition(lb),
        username: data.username,
        "bottom-text": template.dataOptions.bottomPrefix || `${data.username} - ${formatPp(data.pp)}`,
    };
}
