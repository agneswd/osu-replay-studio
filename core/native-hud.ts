import type { RenderOptions, Timeline } from "./types.js";

// One sprite command uses design coordinates at 1920 x 1080.
export interface HudSprite {
  asset: number;
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
  background: { clear: string; soft: string },
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
  const start = Math.max(0, Math.round(leadIn * fps) + startFrame);
  return {
    start,
    end: start + frames,
    filter: `trim=start_frame=${start},setpts=PTS-STARTPTS,fps=${fps}`,
  };
}

import {
  endFadeStart,
  endFadeDuration,
  outroMusicVolume,
  outroMusicTransition,
  presentationTiming,
} from "./presentation.js";

// Prepare the held images once. Chromium blends them on the GPU during each scene.
export function nativeSceneBackgroundArgs(
  gameplay: string,
  clear: string,
  soft: string,
  kind: "intro" | "outro",
  gameplayFrames: number,
  fps: number,
) {
  return [
    "-y",
    ...(kind === "outro" ? ["-ss", String((gameplayFrames - 1) / fps)] : []),
    "-i",
    gameplay,
    "-filter_complex",
    `[0:v]fps=${fps},trim=end_frame=1,setparams=color_trc=iec61966-2-1,split[clear][source];[source]gblur=sigma=8,lutrgb=r=val*0.55:g=val*0.55:b=val*0.55[soft]`,
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
  cues?: string,
) {
  const hold = timing.introFrames / fps,
    end = timing.duration,
    outro = timing.outroStartFrame / fps;
  const duck = music
    ? `,volume='1-${1 - outroMusicVolume}*min(1,max(0,(t-${timing.gameplayFrames / fps})/${outroMusicTransition}))':eval=frame`
    : "";
  const audio = `atrim=duration=${end - hold},asetpts=PTS-STARTPTS,${filter},aresample=48000${duck},adelay=${Math.round(hold * 1000)}:all=1,apad=whole_dur=${end}`;
  return [
    "-y",
    ...(music
      ? []
      : ["-ss", String(Math.max(0, leadIn + timing.startFrame / fps))]),
    "-i",
    music ?? gameplay,
    ...(cues ? ["-i", cues] : []),
    "-filter_complex",
    cues
      ? `[0:a]${audio}[music];[1:a]aresample=48000,adelay=${Math.round(outro * 1000)}:all=1[cues];[music][cues]amix=inputs=2:normalize=0,asetpts=N/SR/TB,afade=t=out:st=${outro + endFadeStart}:d=${endFadeDuration}[outa]`
      : `[0:a]${audio}[outa]`,
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
