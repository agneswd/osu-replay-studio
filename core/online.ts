import type { OnlineData, RankedScore } from "./types.js";

export interface OsuCredentials { clientId: string; clientSecret: string }
interface ApiUser {
  id: number; username: string; avatar_url: string; country_code: string;
  join_date?: string;
  cover_url?: string; is_supporter?: boolean;
  statistics?: { global_rank: number | null; country_rank: number | null; pp: number; play_time: number; play_count: number };
  monthly_playcounts?: { start_date: string; count: number }[];
  badges?: { image_url: string; description: string }[];
}
interface ApiScore {
  id: number; legacy_score_id?: number; user_id: number; user?: ApiUser;
  pp: number | null; accuracy: number; max_combo: number; rank: string;
  total_score: number; legacy_total_score?: number; score?: number;
  statistics: import("replayviewer-js").LazerStatistics & { count_miss?: number };
  maximum_statistics?: import("replayviewer-js").LazerStatistics;
  mods: (string | { acronym: string })[]; ended_at?: string; created_at?: string;
  beatmap?: { id?: number; version: string }; beatmapset?: { title: string; covers: { cover: string } };
}
interface ApiMap {
  failtimes?: { fail: number[]; exit: number[] };
  id: number; beatmapset_id: number; user_id: number; version: string; playcount: number; difficulty_rating: number;
  beatmapset: { id: number; user_id: number; creator: string; status: string; play_count: number; favourite_count: number; covers: { cover: string } };
}

export function createOsuClient(credentials: OsuCredentials) {
  let token: { value: string; expires: number } | undefined;
  let tokenRequest: Promise<string> | undefined;
  const accessToken = async (signal: AbortSignal) => {
    if (token && token.expires > Date.now() + 60000) return token.value;
    if (!tokenRequest) tokenRequest = (async () => {
      const res = await fetch("https://osu.ppy.sh/oauth/token", {
        method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", scope: "public", client_id: Number(credentials.clientId), client_secret: credentials.clientSecret }),
      });
      if (!res.ok) throw new Error(`osu! connection failed (${res.status}). Check the client ID and secret in Settings.`);
      const body = await res.json() as { access_token: string; expires_in: number };
      token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
      return token.value;
    })().finally(() => { tokenRequest = undefined; });
    return tokenRequest;
  };
  return {
    async get<T>(endpoint: string, signal: AbortSignal): Promise<T> {
      const bearer = await accessToken(signal);
      const res = await fetch(`https://osu.ppy.sh/api/v2${endpoint}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json", "X-API-Version": "20220705" },
      });
      if (!res.ok) throw new Error(`osu! data request failed (${res.status}).`);
      return res.json() as Promise<T>;
    },
    async test(signal: AbortSignal) { await accessToken(signal); },
  };
}
export type OsuClient = ReturnType<typeof createOsuClient>;

export function normalizeScore(score: ApiScore, lazer = false): RankedScore {
  return {
    lazerStatistics: lazer ? { statistics: score.statistics, maximum_statistics: score.maximum_statistics } : undefined,
    id: String(score.id), legacyId: score.legacy_score_id ? String(score.legacy_score_id) : undefined,
    userId: score.user_id, name: score.user?.username ?? "Unknown player",
    pp: score.pp, accuracy: score.accuracy * 100, combo: score.max_combo,
    score: lazer ? score.total_score : score.legacy_total_score || score.score || score.total_score,
    misses: score.statistics.miss ?? score.statistics.count_miss ?? 0, grade: score.rank,
    mods: score.mods.map(mod => typeof mod === "string" ? mod : mod.acronym).filter(mod => lazer || mod !== "CL").join("") || "NM",
    playedAt: score.ended_at ?? score.created_at ?? "",
    title: score.beatmapset?.title ?? "", difficulty: score.beatmap?.version ?? "",
  };
}

// Download images once during import. Captured frames never depend on remote requests.
export async function fetchOnlineData(client: OsuClient, username: string, checksum: string, signal: AbortSignal, replayId?: string, lazer = false): Promise<OnlineData> {
  const [user, map] = await Promise.all([
    client.get<ApiUser>(`/users/${encodeURIComponent(username)}/osu?key=username`, signal),
    client.get<ApiMap>(`/beatmaps/lookup?checksum=${checksum}`, signal),
  ]);
  const warnings: string[] = [];
  const optional = async <T>(endpoint: string, fallback: T, label: string): Promise<T> => {
    try { return await client.get<T>(endpoint, signal); }
    catch { signal.throwIfAborted(); warnings.push(`${label} is unavailable.`); return fallback; }
  };
  const [board, best, details, mapper, replayScore] = await Promise.all([
    optional<{ scores: ApiScore[] }>(`/beatmaps/${map.id}/scores?mode=osu&limit=100&legacy_only=${lazer ? 0 : 1}`, { scores: [] }, "Map leaderboard"),
    optional<ApiScore[]>(`/users/${user.id}/scores/best?mode=osu&limit=100&legacy_only=${lazer ? 0 : 1}`, [], "Player best scores"),
    optional<ApiMap | null>(`/beatmaps/${map.id}`, null, "Map retry graph"),
    optional<ApiUser | null>(`/users/${map.beatmapset.user_id}/osu`, null, "Mapper profile"),
    replayId && /^\d+$/.test(replayId) && replayId !== "0"
      ? client.get<ApiScore>(`/scores/${lazer ? "" : "osu/"}${replayId}`, signal).catch(() => { signal.throwIfAborted(); return null; })
      : Promise.resolve(null),
  ]);
  const images = new Map<string, Promise<string | undefined>>();
  const image = (url: string | undefined): Promise<string | undefined> => {
    if (!url) return Promise.resolve(undefined);
    if (!images.has(url)) images.set(url, (async () => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !(parsed.hostname === "ppy.sh" || parsed.hostname.endsWith(".ppy.sh"))) return undefined;
        const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
        if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return undefined;
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > 5 * 1024 * 1024) return undefined;
        return `data:${res.headers.get("content-type")};base64,${bytes.toString("base64")}`;
      } catch { signal.throwIfAborted(); return undefined; }
    })());
    return images.get(url)!;
  };
  const rows = board.scores.map(score => normalizeScore(score, lazer));
  const topPlays = best.map(score => normalizeScore(score, lazer)).sort((a, b) => (b.pp ?? -1) - (a.pp ?? -1));
  // Limit concurrent image requests while retaining a complete, offline score list.
  const jobs: (() => Promise<void>)[] = rows.map((row, i) => async () => { row.avatar = await image(board.scores[i].user?.avatar_url); });
  for (const row of topPlays.slice(0, 6)) {
    const source = best.find(score => String(score.id) === row.id);
    jobs.push(async () => { row.cover = await image(source?.beatmapset?.covers.cover); });
  }
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  const [avatar, cover, mapperAvatar, mapCover] = await Promise.all([image(user.avatar_url), image(user.cover_url), image(mapper?.avatar_url), image(map.beatmapset.covers.cover)]);
  const badges = await Promise.all((user.badges ?? []).map(async badge => ({ title: badge.description, url: await image(badge.image_url) })));
  return {
    fetchedAt: new Date().toISOString(), warnings, playerId: user.id, joinedAt: user.join_date,
    avatar, cover, country: user.country_code, rank: user.statistics?.global_rank ?? null,
    supporter: user.is_supporter ?? false, badges: badges.filter((badge): badge is { title: string; url: string } => !!badge.url),
    stats: user.statistics ? {
      countryRank: user.statistics.country_rank, pp: user.statistics.pp, hours: Math.floor(user.statistics.play_time / 3600), playcount: user.statistics.play_count,
      monthlyPlaycounts: (user.monthly_playcounts ?? []).map(entry => ({ date: entry.start_date, count: entry.count })),
    } : undefined,
    map: { id: map.id, setId: map.beatmapset_id, mapperId: map.user_id, mapper: mapper?.username ?? map.beatmapset.creator, mapperAvatar,
      cover: mapCover, status: map.beatmapset.status, plays: map.beatmapset.play_count, favourites: map.beatmapset.favourite_count,
      retries: details?.failtimes,
    },
    leaderboard: rows, topPlays,
    replayScore: replayScore?.user_id === user.id && replayScore.beatmap?.id === map.id ? normalizeScore(replayScore, lazer) : undefined,
  };
}
