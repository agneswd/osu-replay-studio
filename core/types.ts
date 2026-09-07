import type { VideoLayout } from "./layout.js";
export const overlayIds = [
  "player-info",
  "pp-counter",
  "accuracy-counter",
  "combo-counter",
  "health-bar",
  "hit-counts",
  "hit-error-bar",
  "leaderboard",
  "progress-graph",
  "key-overlay",
] as const;
export type OverlayId = (typeof overlayIds)[number];
export const defaultOverlayIds: readonly OverlayId[] = [...overlayIds];
export const defaultOverlayAccent = "#d4d7de";
const accentPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function normalizeOverlayAccent(value: unknown): string {
  if (typeof value !== "string") return defaultOverlayAccent;
  let hex = value.trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!accentPattern.test(hex)) return defaultOverlayAccent;
  return hex.toLowerCase();
}
export interface AnalyzeInput {
  replay: string;
  songs: string;
  beatmap?: string;
}
export interface RenderOptions extends AnalyzeInput {
  layout?: VideoLayout;
  backgroundDim?: number;
  cursorSize?: number;
  skinPath?: string;
  danser: string;
  output: string;
  width: number;
  height: number;
  fps: number;
  overlays: OverlayId[];
  overlayAccent?: string;
  thumbnail?: boolean;
  introOutro?: boolean;
  leaderboardSize?: 50 | 100;
  leaderboardSort?: "pp" | "score";
  duration?: number;
}
export interface ThumbnailTextOptions {
  bottomText?: string;
  accentRange?: { start: number; end: number };
}
export interface ThumbnailOptions extends ThumbnailTextOptions {
  timeline: Timeline;
  dir: string;
  accent: string;
}
export interface SavedSettings {
  layout?: VideoLayout;
  backgroundDim?: number;
  cursorSize?: number;
  skinPath?: string;
  songs?: string;
  danser?: string;
  outputDir?: string;
  width?: number;
  height?: number;
  fps?: number;
  overlays?: OverlayId[];
  overlayAccent?: string;
  introOutro?: boolean;
  leaderboardSize?: 50 | 100;
  leaderboardSort?: "pp" | "score";
}
export interface StudioDefaults {
  layout?: VideoLayout;
  backgroundDim: number;
  cursorSize: number;
  skinPath: string;
  replay: string;
  beatmap: string;
  songs: string;
  songsFound: boolean;
  danser: string;
  danserFound: boolean;
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  overlays: OverlayId[];
  overlayAccent: string;
  introOutro: boolean;
  leaderboardSize: 50 | 100;
  leaderboardSort: "pp" | "score";
}
export interface Snapshot {
  time: number;
  score: number;
  combo: number;
  maxCombo: number;
  accuracy: number;
  hits: {
    "300": number;
    "100": number;
    "50": number;
    "0": number;
    sliderBreaks: number;
  };
  pp: number;
  grade: string;
  errors: number[];
  ur: number;
}
export interface RankedScore {
  id: string;
  legacyId?: string;
  userId: number;
  name: string;
  avatar?: string;
  cover?: string;
  pp: number | null;
  accuracy: number;
  combo: number;
  score: number;
  misses: number;
  grade: string;
  mods: string;
  playedAt: string;
  title: string;
  difficulty: string;
}
export interface OnlineData {
  fetchedAt: string;
  warnings: string[];
  playerId: number;
  avatar?: string;
  cover?: string;
  country: string;
  rank: number | null;
  supporter: boolean;
  badges: { title: string; url: string }[];
  stats?: Timeline["playerStats"];
  map: {
    id: number; mapper: string; mapperAvatar?: string; cover?: string;
    status: string; plays: number; favourites: number;
    retries?: { fail: number[]; exit: number[] };
  };
  leaderboard: RankedScore[];
  topPlays: RankedScore[];
  replayScore?: RankedScore;
}
export interface LeaderboardRow extends RankedScore { position: number; current: boolean; slot?: number; opacity?: number }
export interface HitWindows { great: number; ok: number; meh: number; inclusive: boolean }
export interface TimingHit { time: number; error: number; ur?: number; average?: number }
export interface Timeline {
  hitWindows?: HitWindows;
  timingHits?: TimingHit[];
  replayFormat?: "stable" | "lazer";
  ppInfo?: { engineVersion: string; localFinalPP: number; onlineFinalPP?: number };
  online?: OnlineData;
  replayId?: string;
  preservesPitch?: boolean;
  audioPath?: string;
  audioUrl?: string;
  replay: string;
  beatmap: string;
  player: string;
  title: string;
  mods: string;
  speed: number;
  preempt: number;
  duration: number;
  gameplayFadeStart?: number;
  stars: number;
  bpm: number;
  od: number;
  maxPP: number;
  strains: number[];
  health: { time: number; value: number }[];
  snapshots: Snapshot[];
  warnings: string[];
  sceneInfo?: {
    title: string;
    artist: string;
    mapper: string;
    ar: number;
    od: number;
    arMs: number;
    odMs: number;
    cs: number;
    hp: number;
    maxCombo: number;
    playedAt: string;
    score: Snapshot;
  };
  playerStats?: {
    countryRank: number | null;
    pp: number;
    hours: number;
    playcount: number;
    monthlyPlaycounts: { date: string; count: number }[];
  };
  bgImage?: string;
  playerAvatar?: string;
  playerRank?: number | null;
  playerCountry?: string | null;
  hitObjects?: {
    time: number;
    type: "circle" | "slider" | "spinner";
    x: number;
    y: number;
    endTime?: number;
  }[];
  replayFrames?: {
    time: number;
    x: number;
    y: number;
    keys?: number;
  }[];
}
export interface CounterFrame {
  from: number;
  to: number;
  progress: number;
}
export interface KeyLane {
  pressed: boolean; count: number; bpm: number;
  holds: { start: number; end: number }[];
}
export interface OverlayFrame {
  judgementHistory?: { markers: { position: number; grade: "100" | "50" | "0"; progress: number }[]; progress: number };
  keys?: KeyLane[];
  timing?: { windows?: HitWindows; ticks: { error: number; opacity: number; height: number }[]; average: number };
  leaderboard?: { rows: LeaderboardRow[]; caption: string };
  counters?: {
    combo: CounterFrame;
    maxCombo: CounterFrame;
    pp: CounterFrame;
    accuracy: CounterFrame;
    ur?: CounterFrame;
    hit100?: CounterFrame;
    hit50?: CounterFrame;
    hitMiss?: CounterFrame;
    hitSB?: CounterFrame;
  };
  menu: {
    state: number;
    mods: { str: string };
    bm: {
      stats: { SR: number; OD: number; BPM: { common: number } };
      time: { current: number; mp3: number };
    };
    pp: { strains: number[] };
  };
  gameplay: {
    name: string;
    score: number;
    accuracy: number;
    combo: { current: number; max: number };
    hp: { normal: number | null };
    hits: Snapshot["hits"];
    pp: { current: number; fc: number };
    grade: string;
  };
  hitErrors: number[];
  play: { unstableRate: number };
  userProfile: {
    name: string;
    avatar?: string;
    rank?: number | null;
    countryRank?: number | null;
    country?: string | null;
  };
}
export interface Progress {
  stage: string;
  fraction?: number;
  message: string;
}
export type Capture = (
  options: RenderOptions,
  timeline: Timeline,
  frames: number,
  signal: AbortSignal,
  range?: { start: number; end: number; background?: { clear: string; soft: string } },
) => AsyncIterable<Uint8Array>;
