import type { Timeline } from "./types.js";
import { exportLoudness } from "./audio.js";

// The two built-in animations each run for 5.4 seconds.
export const sceneDuration = 5.4;
export const introPause = 1;
export const introEase = 1.5;
export const introExitStart = 4.1;
export const outroPause = 1;
export const endFadeStart = 4.65;
export const endFadeDuration = .6;
export const outroBlurDuration = outroPause;

export function sceneBlur(kind: "intro" | "outro", time: number) {
  const progress = Math.max(0, Math.min(1, kind === "intro" ? (sceneDuration - time) / (sceneDuration - introExitStart) : 1));
  return progress * progress * (3 - 2 * progress);
}
export function sceneFade(kind: "intro" | "outro", time: number) {
  return kind === "intro" ? 0 : Math.max(0, Math.min(1, (time - endFadeStart) / endFadeDuration));
}
export const outroMusicVolume = .5;
export const outroMusicTransition = .8;

export function outroMusicGain(seconds: number) {
  return 1 - (1 - outroMusicVolume) * Math.max(0, Math.min(1, seconds / outroMusicTransition));
}
export const gameplayLeadIn = 1;

export function firstNoteSeconds(timeline: Timeline) {
  return (timeline.hitObjects?.[0]?.time ?? 0) / 1000 / timeline.speed;
}

// Start at the song origin, with at least one second before the first object.
export function introGameplayStart(timeline: Timeline) {
  return Math.min(0, firstNoteSeconds(timeline) - gameplayLeadIn);
}

export function presentationTiming(duration: number, fps: number, enabled = false, firstNote = 0, gameplayStart = firstNote - gameplayLeadIn) {
  const startFrame = enabled ? Math.round(gameplayStart * fps) : 0;
  const gameplayFrames = Math.max(1, Math.ceil(duration * fps) - startFrame);
  const sceneFrames = enabled ? Math.round(sceneDuration * fps) : 0;
  const introPauseFrames = enabled ? Math.round(introPause * fps) : 0;
  const introEaseFrames = enabled ? Math.round(introEase * fps) : 0;
  // A linear speed ramp consumes half its duration in source time.
  const introEaseConsumedFrames = enabled ? introEaseFrames / 2 : 0;
  const introFrames = enabled ? Math.round(introExitStart * fps) + introPauseFrames : 0;
  const outroPauseFrames = enabled ? Math.round(outroPause * fps) : 0;
  const pacedGameplayFrames = Math.max(1, Math.ceil(gameplayFrames - introEaseConsumedFrames + introEaseFrames));
  const gameplayEndFrame = introFrames + pacedGameplayFrames;
  const outroStartFrame = gameplayEndFrame + outroPauseFrames;
  return {
    introPauseFrames,
    introEaseFrames,
    introEaseConsumedFrames,
    outroPauseFrames,
    outroStartFrame,
    gameplayEndFrame,
    gameplayFrames,
    startFrame,
    introFrames,
    sceneFrames,
    frames: outroStartFrame + sceneFrames,
    duration: (outroStartFrame + sceneFrames) / fps,
  };
}

export type PresentationTiming = ReturnType<typeof presentationTiming>;

// One continuous source clock drives video, audio, seeks, and encoded frames.
export function gameplayClock(timing: PresentationTiming, seconds: number, fps: number) {
  const elapsed = Math.max(0, seconds - timing.introFrames / fps);
  const ease = timing.introEaseFrames / fps;
  const consumed = ease > 0 && elapsed < ease ? elapsed * elapsed / (2 * ease) : elapsed - ease / 2;
  return { time: timing.startFrame / fps + consumed, rate: ease > 0 ? Math.min(1, elapsed / ease) : 1 };
}

export function presentationSeconds(timing: PresentationTiming, gameplayTime: number, fps: number) {
  const consumed = Math.max(0, gameplayTime - timing.startFrame / fps);
  const ease = timing.introEaseFrames / fps;
  return timing.introFrames / fps + (consumed < ease / 2 ? Math.sqrt(2 * ease * consumed) : consumed + ease / 2);
}

export function presentationAt(timeline: Timeline, seconds: number, fps: number, enabled = false, duration = timeline.duration) {
  const timing = presentationTiming(duration, fps, enabled, firstNoteSeconds(timeline), introGameplayStart(timeline));
  const index = Math.min(timing.frames - 1, Math.max(0, Math.floor(seconds * fps + 1e-7)));
  const position = gameplayClock(timing, index / fps, fps);
  const scene: "intro" | "outro" | null = index < timing.sceneFrames ? "intro" : index >= timing.outroStartFrame ? "outro" : null;
  return {
    gameplayTime: Math.min((timing.startFrame + timing.gameplayFrames - 1) / fps, position.time),
    gameplayRate: index >= timing.gameplayEndFrame ? 0 : position.rate,
    outroTransition: enabled && index >= timing.gameplayEndFrame ? Math.min(1, (index - timing.gameplayEndFrame) / timing.outroPauseFrames) : 0,
    scene: scene ? { kind: scene, time: (scene === "intro" ? index : index - timing.outroStartFrame) / fps } : null,
  };
}

// Retiming only the short entrance keeps the existing constant-rate gameplay pipeline.
export function pacedGameplayFilter(holdFrames: number, easeFrames: number, consumedFrames: number, fps: number) {
  const position = easeFrames > 0
    ? `if(lt(N,${consumedFrames}),sqrt(2*${easeFrames}*N),N+${easeFrames / 2})`
    : "N";
  return `settb=1/90000,setpts='(${holdFrames}+${position})/(${fps}*TB)',fps=${fps}:start_time=0:round=near`;
}

export function gameplayPaceArgs(input: string, output: string, timing: PresentationTiming, fps: number, startFrame = 0) {
  return ["-y", "-i", input, "-an", "-vf",
    `fps=${fps},setpts=PTS-STARTPTS,${pacedGameplayFilter(timing.introFrames, timing.introEaseFrames, timing.introEaseConsumedFrames, fps)},tpad=stop_mode=clone:stop=-1,trim=start_frame=${startFrame}:end_frame=${timing.gameplayEndFrame},setpts=N/(${fps}*TB)`,
    "-r", String(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", output];
}

export function compositeArgs(gameplay: string, output: string, duration: number, fps: number, enabled = false, leadIn = 0, firstNote = 0, audioFilter = exportLoudness, musicAudio?: string, gameplayStart = firstNote - gameplayLeadIn) {
  const timing = presentationTiming(duration, fps, enabled, firstNote, gameplayStart);
  const hold = timing.introFrames / fps;
  const outroHold = timing.sceneFrames / fps;
  const introEnd = timing.sceneFrames / fps;
  const end = timing.duration;
  const sourceStart = Math.max(0, leadIn + timing.startFrame / fps);
  const padding = Math.max(0, -Math.round(leadIn * fps) - timing.startFrame);
  const pace = enabled ? pacedGameplayFilter(timing.introFrames, timing.introEaseFrames, timing.introEaseConsumedFrames, fps) : `setpts=N/(${fps}*TB)`;
  // Blend a blurred copy of the held gameplay frame. No background image is swapped at the boundary.
  const blur = `if(lt(T,${introEnd}),max(0,min(1,(${introEnd}-T)/${sceneDuration - introExitStart})),if(gte(T,${timing.gameplayEndFrame / fps}),min(1,(T-${timing.gameplayEndFrame / fps})/${outroBlurDuration}),0))`;
  const scenes = `lt(t,${introEnd})+gte(t,${timing.gameplayEndFrame / fps})`;
  const video = enabled
    ? `[0:v]fps=${fps},format=gbrp,tpad=start=${padding}:start_mode=clone:stop_mode=clone:stop=-1,trim=end_frame=${timing.gameplayFrames},setpts=PTS-STARTPTS,${pace},tpad=stop_mode=clone:stop=-1,trim=end_frame=${timing.frames},split[clear][soft];[soft]gblur=sigma=8:enable='${scenes}',lutrgb=r=val*0.55:g=val*0.55:b=val*0.55:enable='${scenes}'[blurred];[clear][blurred]blend=all_expr='A*(1-(${blur})*(${blur})*(3-2*(${blur})))+B*(${blur})*(${blur})*(3-2*(${blur}))':enable='${scenes}'[game];[1:v]format=rgba[hud];[game][hud]overlay=0:0:shortest=1[outv]`
    : "[1:v]format=rgba[hud];[0:v][hud]overlay=0:0:shortest=1[outv]";
  const duckAt = (timing.outroStartFrame - timing.introFrames) / fps;
  const duck = musicAudio ? `,volume='1-${1 - outroMusicVolume}*min(1,max(0,(t-${duckAt})/${outroMusicTransition}))':eval=frame` : "";
  const sourceSeconds = musicAudio ? end - hold : timing.gameplayFrames / fps;
  const audio = `atrim=duration=${sourceSeconds},asetpts=PTS-STARTPTS,aresample=48000,${audioFilter}${duck}${enabled ? `,adelay=${Math.round(hold * 1000)}:all=1,apad=whole_dur=${timing.duration}` : ""}`;
  const musicInput = musicAudio ? 2 : 0;
  const fade = `afade=t=out:st=${end - outroHold + endFadeStart}:d=${endFadeDuration}`;
  const audioGraph = musicAudio ? `;[${musicInput}:a]${audio},${fade}[outa]` : "";
  return [
    // Chromium omits PNG alpha on opaque frames. Keep format changes from resetting the hold clock.
    "-y", ...(sourceStart > 0 ? ["-ss", String(sourceStart)] : []), "-i", gameplay,
    "-f", "image2pipe",
    "-framerate", String(fps), "-reinit_filter", "0", "-i", "pipe:0",
    ...(musicAudio ? ["-i", musicAudio] : []),
    "-filter_complex", video + audioGraph,
    "-map", "[outv]", "-map", audioGraph ? "[outa]" : `${musicInput}:a?`,
    ...(audioGraph ? [] : ["-af", audio]),
    "-t", String(timing.duration),
    "-r", String(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-b:a", "320k", output,
  ];
}

// Keep frame-accurate trimming and audio processing without an overlay input.
export function gameplayOutputArgs(gameplay: string, output: string, duration: number, fps: number, leadIn: number, audioFilter = exportLoudness) {
  return ["-y", "-ss", String(leadIn), "-i", gameplay,
    "-map", "0:v:0", "-map", "0:a?", "-t", String(duration), "-r", String(fps),
    "-vf", `fps=${fps},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=-1,trim=end_frame=${Math.ceil(duration * fps)}`,
    "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
    "-af", audioFilter, "-c:a", "aac", "-ar", "48000", "-b:a", "320k", output];
}
