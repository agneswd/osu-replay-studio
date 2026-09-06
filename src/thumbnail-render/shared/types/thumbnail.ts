export type Ruleset = "osu" | "taiko" | "fruits" | "mania";
export interface NormalizedMod {
    acronym: string;
    name?: string;
    settings?: Record<string, unknown>;
}
export type PlayStatus = {
    kind: "fc";
} | {
    kind: "miss";
    count: number;
} | {
    kind: "unknown";
};
export interface ThumbnailData {
    scoreId: string;
    ruleset: Ruleset;
    username: string;
    userId: number;
    avatarUrl?: string;
    countryCode?: string;
    pp?: number;
    accuracy: number;
    grade: string;
    maxCombo: number;
    leaderboardPosition?: number;
    status: PlayStatus;
    missCount: number;
    sbCount: number;
    isFullCombo: boolean;
    mods: NormalizedMod[];
    statistics: Record<string, number>;
    beatmapId: number;
    beatmapsetId: number;
    beatmapStatus?: string;
    artist: string;
    title: string;
    difficultyName: string;
    mapper?: string;
    baseBpm: number;
    effectiveBpm: number;
    clockRate: number;
    baseStarRating?: number;
    moddedStarRating?: number;
    backgroundUrl?: string;
    backgroundFallbacks?: string[];
    playedAt?: string;
}
