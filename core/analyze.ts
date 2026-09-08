import { importBeatmapArchive } from "./beatmap-archive.js";
import { classifyPlay, recordedLazerStatus, sliderBreakEvents } from "./play-status.js";
import { collectTimingHits, hitWindowsFor } from "./hit-timing.js";
import { rankGrade, replayFormat, scoreAccuracy } from "./replay-format.js";
import type { PpScore } from "./pp.js";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { analyzeReplay, parseBeatmap, parseReplay, type BeatmapData, type HitObject } from "replayviewer-js";
import { calculatePP, matchingScore, ppEngineVersion } from "./pp.js";
import { fetchOnlineData, type OsuClient } from "./online.js";
import { atTime } from "./timeline.js";
import type { AnalyzeInput, Snapshot, Timeline } from "./types.js";

const hash = (data: Uint8Array) => createHash("md5").update(data).digest("hex");
async function mapBytes(file: string) {
  if ((await stat(file)).size > 16 * 1024 * 1024)
    throw new Error("Beatmap exceeds the 16 MiB limit.");
  return readFile(file);
}
// Keep only successful lookups. Recheck the file hash before each reuse.
const recentMaps = new Map<string, string>();
export async function resolveBeatmap(songs: string, expected: string, explicit?: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const matches = async (file: string) => hash(await mapBytes(file)) === expected;
  if (explicit) {
    if (/\.osz$/i.test(explicit)) return importBeatmapArchive(explicit, expected, signal);
    if (!await matches(explicit)) throw new Error("Selected beatmap does not match the replay MD5.");
    return path.resolve(explicit);
  }
  if (!songs) throw new Error("Beatmap not found. Choose a beatmap archive or a Songs folder.");
  const key = `${path.resolve(songs)}:${expected}`;
  const previous = recentMaps.get(key);
  if (previous && await matches(previous).catch(() => false)) return previous;
  recentMaps.delete(key);
  async function* files(dir: string): AsyncGenerator<string> {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      signal?.throwIfAborted();
      const file = path.join(dir, item.name);
      if (item.isDirectory()) yield* files(file);
      else if (item.isFile() && /\.osu$/i.test(item.name)) yield file;
    }
  }
  const remember = (file: string) => {
    if (recentMaps.size >= 256) recentMaps.delete(recentMaps.keys().next().value!);
    const resolved = path.resolve(file);
    recentMaps.set(key, resolved);
    return resolved;
  };
  // Bound disk reads and memory while allowing the filesystem to overlap requests.
  let batch: string[] = [];
  const check = async () => {
    const results = await Promise.all(batch.map(matches));
    signal?.throwIfAborted();
    return batch.find((_, i) => results[i]);
  };
  for await (const file of files(songs)) {
    batch.push(file);
    if (batch.length < 16) continue;
    const found = await check();
    if (found) return remember(found);
    batch = [];
  }
  const found = await check();
  if (found) return remember(found);
  throw new Error("Beatmap not found in Songs. Choose a matching .osz archive or .osu file.");
}

function extractBgFilename(osuText: string): string | null {
  const eventsMatch = osuText.match(/\[Events\]([\s\S]*?)(?:\[\w+\]|$)/);
  if (!eventsMatch) return null;
  const events = eventsMatch[1];
  for (const line of events.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || !trimmed) continue;
    const m = trimmed.match(
      /^0\s*,\s*0\s*,\s*"([^"]+)"|^0\s*,\s*0\s*,\s*([^,]+)/,
    );
    if (m) {
      return (m[1] || m[2]).trim();
    }
  }
  return null;
}

function defaultAvatar(username: string): string {
  const initial = (username[0] || "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2a3b5c"/><stop offset="100%" stop-color="#141a29"/></linearGradient></defs><rect width="128" height="128" rx="20" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#75a5ff" font-family="sans-serif" font-weight="bold" font-size="64">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function simulateHealth(
  hitResults: readonly { time: number; judgement: number }[],
  hpDrainRate: number,
  endTime: number,
): { time: number; value: number }[] {
  const points: { time: number; value: number }[] = [{ time: 0, value: 1 }];
  let hp = 1.0;
  const drain = Math.max(1, Math.min(10, hpDrainRate || 5));
  let lastTime = 0;

  for (const result of hitResults) {
    const dt = Math.max(0, result.time - lastTime);
    if (dt > 120) {
      hp = Math.max(0.18, hp - (dt / 1000) * (drain * 0.012));
      points.push({
        time: Math.round(result.time - 40),
        value: Math.round(hp * 100) / 100,
      });
    }
    if (result.judgement === 300) {
      hp = Math.min(1.0, hp + 0.045);
    } else if (result.judgement === 100) {
      hp = Math.min(1.0, hp + 0.02);
    } else if (result.judgement === 50) {
      hp = Math.min(1.0, hp + 0.005);
    } else if (result.judgement === 0) {
      hp = Math.max(0.08, hp - (0.05 + drain * 0.009));
    }
    points.push({
      time: Math.round(result.time),
      value: Math.round(hp * 100) / 100,
    });
    lastTime = result.time;
  }

  if (lastTime < endTime) {
    points.push({
      time: Math.round(endTime),
      value: Math.round(hp * 100) / 100,
    });
  }
  return points;
}

function sliderDurationMs(map: BeatmapData, slider: Extract<HitObject, { type: "slider" }>) {
  let baseBeatLength = 500;
  let sv = 1;
  for (const tp of map.timingPoints) {
    if (tp.time > slider.time) break;
    if (!tp.inherited) {
      baseBeatLength = tp.beatLength;
      sv = 1;
    } else sv = Math.max(0.1, Math.min(10, -100 / tp.beatLength));
  }
  const velocity = 100 * map.sliderMultiplier * sv / baseBeatLength;
  return velocity > 0 ? slider.length / velocity : 1000;
}

function objectEndTime(map: BeatmapData, object: HitObject) {
  if (object.type === "slider") return object.time + sliderDurationMs(map, object) * object.slides;
  if (object.type === "spinner") return object.endTime;
  return object.time;
}

export async function analyze(
  input: AnalyzeInput,
  signal?: AbortSignal,
  onlineClient?: OsuClient,
): Promise<Timeline> {
  if (
    !input ||
    typeof input.replay !== "string" ||
    typeof input.songs !== "string"
  )
    throw new Error("Select a replay and Songs folder.");
  if ((await stat(input.replay)).size > 32 * 1024 * 1024)
    throw new Error("Replay exceeds the 32 MiB limit.");
  const data = await readFile(input.replay);
  const replay = await parseReplay(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
  const format = replayFormat(replay);
  if (!replay.frames.length || !/^[a-f0-9]{32}$/i.test(replay.beatmapHash))
    throw new Error("Replay has no usable input frames or beatmap hash.");
  signal?.throwIfAborted();
  const beatmap = await resolveBeatmap(
    input.songs,
    replay.beatmapHash,
    input.beatmap,
    signal,
  );
  const bytes = await mapBytes(beatmap);
  const mapText = bytes.toString("utf8");
  const map = parseBeatmap(mapText);
  if (!map.hitObjects.length || map.formatVersion < 5)
    throw new Error("Beatmap is empty or uses an unsupported pre-v5 format.");
  const audio = path.resolve(path.dirname(beatmap), map.audioFilename);
  if (!audio.startsWith(path.dirname(beatmap) + path.sep))
    throw new Error("Beatmap audio must be inside its map folder.");
  await stat(audio).catch(() => {
    throw new Error(`Beatmap audio is missing: ${map.audioFilename}`);
  });

  let bgImage: string | undefined;
  const bgFile = extractBgFilename(mapText);
  if (bgFile) {
    try {
      const bgPath = path.resolve(path.dirname(beatmap), bgFile);
      if (bgPath.startsWith(path.dirname(beatmap) + path.sep)) {
        const bgBytes = await readFile(bgPath);
        const mime = bgFile.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg";
        bgImage = `data:${mime};base64,${bgBytes.toString("base64")}`;
      }
    } catch {}
  }

  const parsed = analyzeReplay(map, replay);
  const snapshots: Snapshot[] = [
    {
      time: -1,
      score: 0,
      combo: 0,
      maxCombo: 0,
      accuracy: 100,
      hits: { "300": 0, "100": 0, "50": 0, "0": 0, sliderBreaks: 0 },
      pp: 0,
      grade: "SS",
      errors: [],
      ur: 0,
    },
  ];
  const hitWindows = hitWindowsFor(parsed.modDiff);
  const timingHits = collectTimingHits(map.hitObjects, parsed.hitResults, parsed.modDiff);
  let timingIndex = 0;
  const errors: number[] = [];
  const totalHits = replay.count300 + replay.count100 + replay.count50 + replay.countMiss;
  let accuracy = totalHits ? (replay.count300 * 300 + replay.count100 * 100 + replay.count50 * 50) / (totalHits * 3) : 100;
  const silver = format.lazer
    ? (replay.scoreInfo?.mods ?? []).some(mod => mod.acronym === "HD" || mod.acronym === "FL")
    : !!(replay.mods & (8 | 1024));
  let grade = rankGrade(
    { great: replay.count300, ok: replay.count100, meh: replay.count50, miss: replay.countMiss },
    accuracy, false, silver);
  const playedAtMs = Number(replay.timestamp / 10000n - 62135596800000n);
  const bpm =
    parsed.modDiff.speed *
    (map.timingPoints.find((p) => p.beatLength > 0)
      ? 60000 / map.timingPoints.find((p) => p.beatLength > 0)!.beatLength
      : 0);
  const warnings: string[] = [];
  const onlineData = onlineClient
    ? fetchOnlineData(onlineClient, replay.username || "Unknown player", replay.beatmapHash, signal ?? new AbortController().signal,
      String(replay.scoreInfo?.online_id ?? replay.replayId), format.lazer).catch(error => {
        warnings.push(error instanceof Error ? error.message : "Online data is unavailable.");
        return undefined;
      })
    : Promise.resolve(undefined);


  const mainResults = parsed.hitResults
    .filter((r) => format.lazer || !r.isSliderSub)
    .map((r) => ({
      ...r,
      effectiveTime: !format.classic || r.isSliderSub ? r.time : r.displayTime ?? r.time,
    }))
    .sort((a, b) => a.effectiveTime - b.effectiveTime);

  const breaks = sliderBreakEvents(map.hitObjects, parsed.hitResults, format.classic);
  let breakIndex = 0;
  const nested = { largeTickHit: 0, largeTickMiss: 0, sliderTailHit: 0, sliderTailMiss: 0 };
  const ppSnapshots: PpScore[] = [{ great: 0, ok: 0, meh: 0, miss: 0, combo: 0 }];
  for (let i = 0; i < mainResults.length; i++) {
      signal?.throwIfAborted();
      const result = mainResults[i];
      const hits = { ...snapshots.at(-1)!.hits };
      while (breakIndex < breaks.length && breaks[breakIndex] <= result.effectiveTime) breakIndex++;
      hits.sliderBreaks = breakIndex;
      if (!result.isSliderSub && (
        result.judgement === 300 ||
        result.judgement === 100 ||
        result.judgement === 50 ||
        result.judgement === 0
      ))
        hits[String(result.judgement) as "300" | "100" | "50" | "0"]++;
      if (result.isSliderSub && !format.classic) {
        if (result.accMax === 150) nested[result.judgement ? "sliderTailHit" : "sliderTailMiss"]++;
        else nested[result.judgement ? "largeTickHit" : "largeTickMiss"]++;
      }
      const score = atTime(parsed.scoreFrames, result.effectiveTime);
      while (timingIndex < timingHits.length && timingHits[timingIndex].time <= result.effectiveTime) {
        errors.push(timingHits[timingIndex++].error);
        if (errors.length > 100) errors.shift();
      }
      const ppState: PpScore = { great: hits["300"], ok: hits["100"], meh: hits["50"], miss: hits["0"], combo: score?.maxCombo ?? 0, ...nested };
      ppState.accuracy = scoreAccuracy(ppState, format.classic) / 100;
      ppSnapshots.push(ppState);
      snapshots.push({
        time: result.effectiveTime,
        score: score?.score ?? 0,
        combo: atTime(parsed.comboFrames, result.effectiveTime)?.combo ?? 0,
        maxCombo: score?.maxCombo ?? 0,
        accuracy: ppState.accuracy * 100,
        grade: rankGrade(ppState, ppState.accuracy * 100, format.lazer, silver),
        hits,
        pp: 0,
        errors: [...errors],
        ur: timingHits[timingIndex - 1]?.ur ?? 0,
      });
  }
  const stats = replay.scoreInfo?.statistics;
  const maximum = replay.scoreInfo?.maximum_statistics;
  const finalState: PpScore = { great: stats?.great ?? replay.count300, ok: stats?.ok ?? replay.count100,
    meh: stats?.meh ?? replay.count50, miss: stats?.miss ?? replay.countMiss, combo: replay.maxCombo,
    legacyScore: format.lazer ? undefined : replay.score,
    largeTickHit: stats?.large_tick_hit ?? nested.largeTickHit, largeTickMiss: stats?.large_tick_miss ?? nested.largeTickMiss,
    sliderTailHit: stats?.slider_tail_hit ?? nested.sliderTailHit,
    sliderTailMiss: stats?.slider_tail_hit !== undefined ? Math.max(0, (maximum?.slider_tail_hit ?? map.hitObjects.filter(object => object.type === "slider").length) - stats.slider_tail_hit) : nested.sliderTailMiss };
  accuracy = scoreAccuracy(finalState, format.classic);
  finalState.accuracy = accuracy / 100;
  if (format.lazer) grade = replay.scoreInfo?.rank?.replace("XH", "SS").replace("X", "SS").replace("SH", "S") ??
    rankGrade(finalState, accuracy, true, silver);
  const calculated = await calculatePP(beatmap, format.mods, finalState, ppSnapshots, signal);
  snapshots.forEach((snapshot, index) => { snapshot.pp = calculated.pp[index]; });
  const { maxPP, scorePP, stars } = calculated;
  const arMs = parsed.modDiff.preemptMs / parsed.modDiff.speed;
  const odMs = parsed.modDiff.hitWindow300U / parsed.modDiff.speed;
  const mapAttributes = {
    ar: arMs > 1200 ? (1800 - arMs) / 120 : 5 + (1200 - arMs) / 150,
    od: (80 - odMs) / 6, cs: parsed.modDiff.cs, hp: parsed.modDiff.hp,
  };
  const last = snapshots.at(-1)!;
  if (
    last.hits["300"] !== replay.count300 ||
    last.hits["100"] !== replay.count100 ||
    last.hits["50"] !== replay.count50 ||
    last.hits["0"] !== replay.countMiss ||
    last.maxCombo !== replay.maxCombo ||
    last.score !== replay.score
  )
    warnings.push(
      `Re-simulated totals differ from the replay header. Header: ${replay.count300}/${replay.count100}/${replay.count50}/${replay.countMiss}, ${replay.maxCombo}x, ${replay.score} score. Analysis: ${last.hits["300"]}/${last.hits["100"]}/${last.hits["50"]}/${last.hits["0"]}, ${last.maxCombo}x, ${last.score} score.`,
    );
  warnings.push(
    "Score and PP are re-simulated estimates. Timing error and UR include circles and slider heads.",
  );

  const end = Math.max(...map.hitObjects.map((o) => objectEndTime(map, o)));
  // Danser finishes the last judgement window, the one-second fade, and its 100 ms tail.
  const gameplayFadeStart = (end + Math.trunc(200 - 10 * parsed.modDiff.od)) / 1000 / parsed.modDiff.speed;

  let health = replay.lifebarGraph
    .split(",")
    .filter(Boolean)
    .map((p) => {
      const [time, value] = p.split("|").map(Number);
      return { time, value };
    })
    .filter(
      (p) =>
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.value >= 0 &&
        p.value <= 1,
    )
    .sort((a, b) => a.time - b.time);

  if (!health.length) {
    health = simulateHealth(
      mainResults.map((r) => ({ time: r.effectiveTime, judgement: r.judgement })),
      map.hpDrainRate,
      end,
    );
  }

  const strains = Array.from({ length: 100 }, () => 0);
  for (const o of map.hitObjects)
    strains[Math.min(99, Math.floor((o.time / Math.max(1, end)) * 100))]++;

  const player = replay.username || "Unknown player";
  const online = await onlineData;
  signal?.throwIfAborted();
  if (!onlineClient) warnings.push("Connect osu! in Settings to load playcount graphs, mapper portraits and leaderboards.");
  if (online) warnings.push(...online.warnings);
  const onlineScore = online && matchingScore([...(online.replayScore ? [online.replayScore] : []), ...online.leaderboard, ...online.topPlays], {
    id: String(replay.scoreInfo?.online_id ?? replay.replayId), lazer: format.lazer, playerId: online.playerId, score: replay.score, combo: replay.maxCombo,
  });
  const onlinePP = onlineScore?.pp ?? undefined;
  if (onlinePP !== undefined && Math.abs(onlinePP - scorePP) > 1)
    warnings.push(`Local PP uses osu! ${ppEngineVersion}: ${Math.round(scorePP)}pp. osu! reports ${Math.round(onlinePP)}pp for this score. The outro uses osu!'s current value.`);
  const audioPath = path.resolve(path.dirname(beatmap), map.audioFilename);

  const hitObjects = map.hitObjects.map((o) => ({
    time: o.time,
    type: o.type as "circle" | "slider" | "spinner",
    x: "x" in o ? (o as { x: number }).x : 256,
    y: "y" in o ? (o as { y: number }).y : 192,
    endTime: "endTime" in o ? (o.endTime as number) : undefined,
  }));

  let frameTime = 0;
  const replayFrames = replay.frames.map((f) => {
    frameTime += f.timeDelta;
    return {
      time: frameTime,
      x: f.x,
      y: f.y,
      keys: f.keys,
    };
  });

  const simulatedStatus = classifyPlay(map.hitObjects.length, [300, 100, 50, 0].map(j => parsed.hitResults.filter(r => !r.isSliderSub && r.judgement === j).length),
    [replay.count300, replay.count100, replay.count50, replay.countMiss], replay.maxCombo, calculated.maxCombo, breaks.length);
  let playStatus = format.lazer
    ? recordedLazerStatus(map.hitObjects.length, replay.scoreInfo, format.classic, replay.maxCombo, calculated.maxCombo) ?? (format.classic ? simulatedStatus : { ...simulatedStatus, verified: false, fullCombo: false, perfectCombo: false })
    : simulatedStatus;

  const exactOnline = online?.replayScore;
  if (format.lazer && exactOnline?.id === String(replay.scoreInfo?.online_id) && exactOnline.combo === replay.maxCombo && exactOnline.score === replay.score) {
    const apiStatus = recordedLazerStatus(map.hitObjects.length, exactOnline.lazerStatistics, format.classic, replay.maxCombo, calculated.maxCombo);
    if (apiStatus?.verified) {
      if (playStatus.verified && (playStatus.fullCombo !== apiStatus.fullCombo || playStatus.sliderBreaks !== apiStatus.sliderBreaks)) {
        playStatus = { ...playStatus, verified: false, fullCombo: false, perfectCombo: false };
        warnings.push("Recorded and online play status disagree. FC is not verified.");
      } else if (!playStatus.verified) playStatus = apiStatus;
    }
  }
  if (format.lazer && playStatus.verified && !format.classic) warnings.push("Final play status uses recorded lazer statistics. Live event timing remains a simulation.");

  return {
      online,
      ppInfo: { engineVersion: ppEngineVersion, localFinalPP: scorePP, onlineFinalPP: onlinePP },
      replayId: String(replay.scoreInfo?.online_id ?? replay.replayId),
      audioPath: audioPath.startsWith(path.dirname(beatmap) + path.sep) ? audioPath : undefined,
      replay: path.resolve(input.replay),
      beatmap,
      player,
      title: `${map.artist} - ${map.title} [${map.version}]`,
      mods: format.lazer ? replay.scoreInfo!.mods.map(mod => mod.acronym).join("") || "NM" :
        [
          [1, "NF"],
          [2, "EZ"],
          [8, "HD"],
          [16, "HR"],
          [64, "DT"],
          [256, "HT"],
          [512, "NC"],
          [1024, "FL"],
          [4096, "SO"],
        ]
          .filter(([bit]) => replay.mods & Number(bit))
          .map(([, name]) => name)
          .join("") || "NM",
      preservesPitch: format.preservesPitch,
      timingHits,
      hitWindows,
    replayFormat: format.lazer ? "lazer" : "stable",
      speed: parsed.modDiff.speed,
      preempt: Math.min(1800, parsed.modDiff.preemptMs),
      duration: gameplayFadeStart + 1.1 / parsed.modDiff.speed,
      gameplayFadeStart,
      stars,
      bpm,
      od: parsed.modDiff.od,
      maxPP,
      strains,
      health,
      snapshots,
      warnings,
      bgImage,
      sceneInfo: {
        playStatus,
        title: `${map.title} [${map.version}]`, artist: map.artist,
        mapper: bytes.toString().match(/^Creator:(.*)$/m)?.[1].trim() ?? "",
        ar: mapAttributes.ar, od: mapAttributes.od, cs: mapAttributes.cs, hp: mapAttributes.hp,
        arMs,
        odMs,
        maxCombo: calculated.maxCombo,
        playedAt: Number.isFinite(playedAtMs) && playedAtMs > 0 ? new Date(playedAtMs).toISOString().slice(0, 10) : "",
        score: { ...last, score: replay.score, combo: replay.maxCombo, maxCombo: replay.maxCombo,
          accuracy, pp: onlinePP ?? scorePP, grade, hits: { "300": replay.count300, "100": replay.count100,
            "50": replay.count50, "0": replay.countMiss, sliderBreaks: playStatus.sliderBreaks } },
      },
      playerStats: online?.stats,
      playerAvatar: online?.avatar ?? defaultAvatar(player),
      playerRank: online?.rank,
      playerCountry: online?.country,
      hitObjects,
      replayFrames,
    };
}
