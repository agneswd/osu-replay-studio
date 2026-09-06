export function formatPp(pp: number | undefined | null, decimals = 0): string {
    if (pp === undefined || pp === null || Number.isNaN(pp))
        return "?PP";
    return `${pp.toFixed(decimals)}PP`;
}
export function formatAccuracy(accuracy: number): string {
    const clamped = Math.max(0, Math.min(1, accuracy));
    return `${(clamped * 100).toFixed(2)}%`;
}
export function formatCombo(maxCombo: number): string {
    return `${maxCombo}x`;
}
export function formatBpm(bpm: number, decimals = 0): string {
    return `${bpm.toFixed(decimals)}bpm`;
}
export function formatStarRating(rating: number | undefined, decimals = 2): string {
    if (rating === undefined || rating === null)
        return "";
    return rating.toFixed(decimals);
}
export function formatLeaderboardPosition(position: number | undefined): string {
    if (position === undefined || position === null)
        return "";
    return `#${position}`;
}
export function formatMapName(data: {
    artist: string;
    title: string;
}, format: "title" | "artist-title" | "artist-title-difficulty" = "artist-title"): string {
    switch (format) {
        case "title":
            return data.title;
        case "artist-title-difficulty":
            return `${data.artist} - ${data.title}`;
        default:
            return `${data.artist} - ${data.title}`;
    }
}
