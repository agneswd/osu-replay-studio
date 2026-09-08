import type { Timeline } from "./types.js";

export interface YouTubeInputs {
  playerUrl: string;
  beatmapUrl: string;
  pp: string;
  status: string;
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
  return {
    playerUrl: idUrl("users", timeline.online?.playerId),
    beatmapUrl: idUrl("beatmaps", timeline.online?.map.id ?? scene?.beatmapId),
    pp: finite(pp) ? String(Math.round(pp)) : "",
    status,
  };
}

export function youtubeInputErrors(input: YouTubeInputs): Partial<Record<keyof YouTubeInputs, string>> {
  const errors: Partial<Record<keyof YouTubeInputs, string>> = {};
  for (const key of ["playerUrl", "beatmapUrl"] as const) {
    const kind = key === "playerUrl" ? "users" : "beatmaps";
    if (input[key].trim() && !new RegExp(`^https://osu\\.ppy\\.sh/${kind}/[1-9]\\d*/?$`).test(input[key].trim()))
      errors[key] = `Use an osu! ${kind === "users" ? "player" : "beatmap"} URL with a numeric ID.`;
  }
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
  const scoreLine = [pp, accuracy, score && scene && finite(score.maxCombo) && scene.maxCombo > 0 ? `${score.maxCombo}x/${scene.maxCombo}x` : "",
    score ? `${score.hits["0"]} miss${score.hits["0"] === 1 ? "" : "es"}` : ""].filter(Boolean).join(" | ");
  const mapLine = [stars, finite(timeline.bpm) && timeline.bpm > 0 ? `${Number(timeline.bpm.toFixed(2))} BPM` : "",
    ...(scene ? (["ar", "od", "cs", "hp"] as const).map(key => finite(scene[key]) ? `${key.toUpperCase()}${Number(scene[key].toFixed(2))}` : "") : [])].filter(Boolean).join(" | ");
  const links = [input.beatmapUrl.trim() ? `Beatmap: ${input.beatmapUrl.trim()}` : "", input.playerUrl.trim() ? `Player: ${input.playerUrl.trim()}` : "",
    scene?.playedAt ? `Played: ${scene.playedAt}` : ""].filter(Boolean).join("\n");
  return { title, description: [ `${player ? `${player} on ` : ""}${map}${mods}`, [scoreLine, mapLine].filter(Boolean).join("\n"), links,
    "Rendered with osu! Replay Studio.", additionalText.trim()].filter(Boolean).join("\n\n") };
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
