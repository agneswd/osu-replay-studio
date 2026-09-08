import type { Timeline } from "./types.js";

export interface YouTubeInputs {
  playerUrl: string;
  beatmapUrl: string;
  pp: string;
  status: string;
  youtubeUrl: string;
  twitchUrl: string;
  twitterUrl: string;
  skinUrl: string;
  mapperUrl: string;
  totalPlayed: string;
  playcount: string;
  rank: string;
  joined: string;
  playerPP: string;
}
export interface YouTubeText { title: string; description: string }

const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value >= 0;
const clean = (value: string) => value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const idUrl = (kind: "users" | "beatmaps", id?: number) => id && Number.isSafeInteger(id) && id > 0 ? `https://osu.ppy.sh/${kind}/${id}` : "";

// Only verified classifications become automatic claims about the play.
export function youtubeInputs(timeline: Timeline): YouTubeInputs {
  const scene = timeline.sceneInfo, play = scene?.playStatus;
  const pp = [timeline.ppInfo?.onlineFinalPP, timeline.ppInfo?.localFinalPP].find(finite);
  let status = "";
  if (scene && play?.verified) {
    if (!play.completed) status = "FAIL";
    else if (play.fullCombo) status = "FC";
    else if (scene.score.hits["0"] > 0) status = `${scene.score.hits["0"]}xMiss`;
    else if (play.sliderBreaks > 0) status = `${play.sliderBreaks}xSB`;
  }
  const stats = timeline.online?.stats ?? timeline.playerStats;
  const number = (value?: number | null) => value != null && finite(value) ? Math.round(value).toLocaleString("en-US") : "";
  return {
    youtubeUrl: "", twitchUrl: "", twitterUrl: "", skinUrl: "",
    mapperUrl: idUrl("users", timeline.online?.map.mapperId),
    totalPlayed: stats && finite(stats.hours) ? `${stats.hours}h` : "",
    playcount: number(stats?.playcount), rank: number(timeline.online?.rank ?? timeline.playerRank),
    joined: timeline.online?.joinedAt?.split("T")[0] ?? "", playerPP: number(stats?.pp),
    playerUrl: idUrl("users", timeline.online?.playerId),
    beatmapUrl: timeline.online?.map.setId && timeline.online.map.id
      ? `https://osu.ppy.sh/beatmapsets/${timeline.online.map.setId}#osu/${timeline.online.map.id}`
      : idUrl("beatmaps", timeline.online?.map.id ?? scene?.beatmapId),
    pp: finite(pp) ? String(Math.round(pp)) : "",
    status,
  };
}

export function youtubeInputErrors(input: YouTubeInputs): Partial<Record<keyof YouTubeInputs, string>> {
  const errors: Partial<Record<keyof YouTubeInputs, string>> = {};
  for (const key of ["playerUrl", "beatmapUrl", "mapperUrl"] as const) {
    const kind = key === "beatmapUrl" ? "beatmaps" : "users";
    if (key === "beatmapUrl" && /^https:\/\/osu\.ppy\.sh\/beatmapsets\/[1-9]\d*#osu\/[1-9]\d*$/.test(input[key].trim())) continue;
    if (input[key].trim() && !new RegExp(`^https://osu\\.ppy\\.sh/${kind}/[1-9]\\d*/?$`).test(input[key].trim()))
      errors[key] = `Use an osu! ${kind === "users" ? "player" : "beatmap"} URL with a numeric ID.`;
  }
  for (const key of ["youtubeUrl", "twitchUrl", "twitterUrl", "skinUrl"] as const) {
    if (!input[key].trim()) continue;
    try {
      const url = new URL(input[key]);
      const domains = key === "youtubeUrl" ? ["youtube.com", "www.youtube.com", "youtu.be"]
        : key === "twitchUrl" ? ["twitch.tv", "www.twitch.tv"]
        : key === "twitterUrl" ? ["twitter.com", "www.twitter.com", "x.com", "www.x.com"] : undefined;
      if (url.protocol !== "https:" || url.username || url.password || domains && !domains.includes(url.hostname)) throw Error();
    } catch { errors[key] = "Enter a valid HTTPS link."; }
  }
  if (input.status && !/^(FC|FAIL|[1-9]\d*x(?:Miss|SB))$/.test(input.status)) errors.status = "Choose a status and a positive count.";
  if (input.pp.trim() && (!/^\d+(?:\.\d+)?$/.test(input.pp.trim()) || !Number.isFinite(Number(input.pp))))
    errors.pp = "Enter a positive PP value or leave it blank.";
  return errors;
}

export function generateYouTubeText(timeline: Timeline, input = youtubeInputs(timeline), additionalText = ""): YouTubeText {
  const scene = timeline.sceneInfo, score = scene?.score;
  const map = clean(scene?.songTitle && scene.difficulty
    ? `${scene.artist} - ${scene.songTitle} [${scene.difficulty}]` : timeline.title);
  const player = clean(timeline.player);
  const mods = timeline.mods && timeline.mods !== "NM" ? ` +${clean(timeline.mods.replace(/^\+/, ""))}` : "";
  const pp = input.pp.trim() ? `${input.pp.trim()}pp` : "";
  const accuracy = score && finite(score.accuracy) ? `${score.accuracy.toFixed(2)}%` : "";
  const stars = finite(timeline.stars) ? `${timeline.stars.toFixed(2)}⭐` : "";
  const result = [clean(input.status), pp].filter(Boolean).join(" ");
  const title = [player, stars, `${map}${mods}${result ? ` ${result}` : ""}`, accuracy].filter(Boolean).join(" | ");
  const section = (heading: string, lines: string[]) => {
    const content = lines.filter(Boolean);
    return content.length ? `// = ${heading}\n${content.join("\n")}` : "";
  };
  const line = (label: string, value: string) => value.trim() ? `${label}: ${value.trim()}` : "";
  const mapLine = [finite(timeline.stars) ? `⭐${timeline.stars.toFixed(2)}` : "",
    finite(timeline.bpm) && timeline.bpm > 0 ? `${Number(timeline.bpm.toFixed(2))}bpm` : "",
    ...(scene ? (["ar", "cs", "od", "hp"] as const).map(key => finite(scene[key])
      ? `${key.toUpperCase()}: ${key === "ar" ? Number(scene[key].toFixed(2)) : scene[key].toFixed(2)}` : "") : [])].filter(Boolean).join(" | ");
  return { title, description: [
    section("Player links", [line("Profile", input.playerUrl), line("YouTube", input.youtubeUrl), line("Twitch", input.twitchUrl),
      line("Twitter", input.twitterUrl), line("Skin", input.skinUrl)]),
    section("Beatmap info", [line("Link", input.beatmapUrl), line("Mapper", input.mapperUrl), mapLine]),
    section("Player info", [line("Total played", input.totalPlayed), line("Playcount", input.playcount),
      line("Rank", input.rank.trim() ? `#${input.rank.trim().replace(/^#/, "")}` : ""), line("Join", input.joined), line("PP", input.playerPP)]),
    additionalText.trim(),
  ].filter(Boolean).join("\n\n") };
}

export function youtubeTextError(field: keyof YouTubeText, value: string): string | undefined {
  if (field === "title" && !value.trim()) return "Enter a title.";
  if (/[<>]/.test(value)) return "Remove < and >. YouTube does not allow these characters.";
  const count = field === "title" ? Array.from(value).length : new TextEncoder().encode(value).length;
  const limit = field === "title" ? 100 : 5000;
  if (count > limit) {
    const excess = count - limit, unit = field === "title" ? "character" : "byte";
    return `Remove ${excess} ${unit}${excess === 1 ? "" : "s"} before copying.`;
  }
}
