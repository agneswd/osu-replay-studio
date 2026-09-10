import type { RenderOptions, Timeline } from "./types.js";

// One sprite command uses design coordinates at 1920 x 1080.
export interface HudSprite {
  asset: number;
  underlay?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number, number];
  clip?: [number, number, number, number];
}
export interface HudFrame {
  sprites: HudSprite[];
  ticks: HudSprite[];
  tickPlacement?: { x: number; y: number; scale: number; after: number };
}
export interface HudBatch {
  frames: HudFrame[];
  assets: { id: number; png: string }[];
}
export type PrepareHud = (
  options: RenderOptions,
  timeline: Timeline,
  directory: string,
  signal: AbortSignal,
) => Promise<string>;
export type CompositeNativeScene = (
  scene: string,
  background: { clear: string; soft: string; motion?: { directory: string; start: number } },
  kind: "intro" | "outro",
  frames: number,
  fps: number,
  width: number,
  height: number,
  signal: AbortSignal,
) => AsyncIterable<Uint8Array>;

// The current compositor selects the nearest raw frame at the requested cut.
export function nativeFrameWindow(
  leadIn: number,
  startFrame: number,
  frames: number,
  fps: number,
) {
  const requested = Math.round(leadIn * fps) + startFrame;
  const start = Math.max(0, requested), padding = Math.max(0, -requested);
  return {
    start,
    end: start + frames - padding,
    filter: `trim=start_frame=${start},setpts=PTS-STARTPTS,fps=${fps}${padding ? `,tpad=start=${padding}:start_mode=clone` : ""}`,
  };
}

import {
  endFadeStart,
  endFadeDuration,
  outroMusicVolume,
  outroMusicTransition,
  presentationTiming,
  pacedGameplayFilter,
} from "./presentation.js";

export function nativeSceneMotionArgs(gameplay: string, directory: string, timing: ReturnType<typeof presentationTiming>, fps: number) {
  return ["-y", "-i", gameplay,
    "-filter_complex", `fps=${fps},setpts=PTS-STARTPTS,${pacedGameplayFilter(timing.introFrames, timing.introEaseFrames, timing.introEaseConsumedFrames, fps)},tpad=stop_mode=clone:stop=-1,trim=start_frame=${timing.introFrames}:end_frame=${timing.sceneFrames},setpts=PTS-STARTPTS,setparams=color_trc=iec61966-2-1,split[clear][source];[source]format=gbrp,gblur=sigma=8,lutrgb=r=val*0.55:g=val*0.55:b=val*0.55[soft]`,
    ...["clear", "soft"].flatMap(kind => ["-map", `[${kind}]`, "-r", String(fps), "-start_number", String(timing.introFrames), `${directory}/motion-${kind}-%d.png`])];
}

// Prepare the held images once. Chromium blends them on the GPU during each scene.
export function nativeSceneBackgroundArgs(
  gameplay: string,
  clear: string,
  soft: string,
  kind: "intro" | "outro",
  gameplayFrames: number,
  fps: number,
  background?: { file: string; width: number; height: number; dim: number },
) {
  return [
    "-y",
    ...(kind === "outro" ? ["-ss", String((gameplayFrames - 1) / fps)] : []),
    "-i",
    gameplay,
    ...(background ? ["-i", background.file] : []),
    "-filter_complex",
    background
      ? `[0:v]fps=${fps},trim=end_frame=1,setparams=color_trc=iec61966-2-1[clear];[1:v]scale=${background.width}:${background.height}:force_original_aspect_ratio=increase,crop=${background.width}:${background.height},format=gbrp,gblur=sigma=8,lutrgb=r=val*${(1 - background.dim) * .55}:g=val*${(1 - background.dim) * .55}:b=val*${(1 - background.dim) * .55}[soft]`
      : `[0:v]fps=${fps},trim=end_frame=1,setparams=color_trc=iec61966-2-1,split[clear][source];[source]format=gbrp,gblur=sigma=8,lutrgb=r=val*${kind === "outro" ? 0 : .55}:g=val*${kind === "outro" ? 0 : .55}:b=val*${kind === "outro" ? 0 : .55}[soft]`,
    "-map",
    "[clear]",
    "-frames:v",
    "1",
    clear,
    "-map",
    "[soft]",
    "-frames:v",
    "1",
    soft,
  ];
}

export function nativeSceneArgs(output: string, frames: number, fps: number, width = 1920, height = 1080, raw = false) {
  return [
    "-y",
    ...(raw
      ? ["-f", "rawvideo", "-pixel_format", "bgra", "-video_size", `${width}x${height}`]
      : ["-f", "image2pipe"]),
    "-framerate",
    String(fps),
    "-i",
    "pipe:0",
    "-an",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-frames:v",
    String(frames),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-video_track_timescale",
    "90000",
    output,
  ];
}

export function nativeAudioArgs(
  gameplay: string,
  output: string,
  timing: ReturnType<typeof presentationTiming>,
  fps: number,
  leadIn: number,
  filter: string,
  music?: string,
) {
  const hold = timing.introFrames / fps,
    end = timing.duration,
    outro = timing.outroStartFrame / fps;
  const duckAt = (timing.outroStartFrame - timing.introFrames) / fps;
  const duck = music
    ? `,volume='1-${1 - outroMusicVolume}*min(1,max(0,(t-${duckAt})/${outroMusicTransition}))':eval=frame`
    : "";
  const sourceSeconds = music ? end - hold : timing.gameplayFrames / fps;
  // Rebuild timestamps after delay so AAC retains the silent intro samples.
  const audio = `atrim=duration=${sourceSeconds},asetpts=PTS-STARTPTS,aresample=48000,${filter}${duck},adelay=${Math.round(hold * 1000)}:all=1,asetpts=N/SR/TB,apad=whole_dur=${end}`;
  return [
    "-y",
    ...(music
      ? []
      : ["-ss", String(Math.max(0, leadIn + timing.startFrame / fps))]),
    "-i",
    music ?? gameplay,
    "-filter_complex",
    `[0:a]${audio},afade=t=out:st=${outro + endFadeStart}:d=${endFadeDuration}[outa]`,
    "-map",
    "[outa]",
    "-vn",
    "-t",
    String(end),
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "320k",
    output,
  ];
}
