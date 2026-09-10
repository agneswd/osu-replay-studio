import type { Timeline } from "./types.js";
import { exportLoudness } from "./audio.js";

// The two built-in animations each run for 5.4 seconds.
export const sceneDuration = 5.4;
export const introPause = 1;
export const introEase = .5;
export const outroPause = 0;
export const endFadeStart = 4.65;
export const endFadeDuration = .6;

export function sceneBlur(kind: "intro" | "outro", time: number) {
  return Math.min(1, kind === "intro" ? 1 : time / .25, Math.max(0, (sceneDuration - time) / .45));
}
export function sceneFade(kind: "intro" | "outro", time: number) {
  return kind === "intro" ? Math.max(0, 1 - time / .6) : Math.max(0, Math.min(1, (time - endFadeStart) / endFadeDuration));
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

export function presentationTiming(duration: number, fps: number, enabled = false, firstNote = 0) {
  const startFrame = enabled ? Math.round((firstNote - gameplayLeadIn) * fps) : 0;
  const gameplayFrames = Math.max(1, Math.ceil(duration * fps) - startFrame);
  const sceneFrames = enabled ? Math.round(sceneDuration * fps) : 0;
  const introPauseFrames = enabled ? Math.round(introPause * fps) : 0;
  const introEaseFrames = enabled ? Math.round(introEase * fps) : 0;
  // Smoothstep 0→1 averages half speed, so the ease consumes half as much gameplay.
  const introEaseConsumedFrames = enabled ? Math.round(introEase * .5 * fps) : 0;
  const introFrames = sceneFrames + introPauseFrames;
  const outroPauseFrames = enabled ? Math.round(outroPause * fps) : 0;
  const pacedGameplayFrames = Math.max(1, gameplayFrames - introEaseConsumedFrames + introEaseFrames);
  const outroStartFrame = introFrames + pacedGameplayFrames + outroPauseFrames;
  return {
    introPauseFrames,
    introEaseFrames,
    introEaseConsumedFrames,
    outroPauseFrames,
    outroStartFrame,
    gameplayFrames,
    startFrame,
    introFrames,
    sceneFrames,
    frames: outroStartFrame + sceneFrames,
    duration: (outroStartFrame + sceneFrames) / fps,
  };
}

export type PresentationTiming = ReturnType<typeof presentationTiming>;

function easeProgress(index: number, frames: number) {
  if (frames <= 1) return 1;
  const u = Math.max(0, Math.min(1, index / (frames - 1)));
  return 2 * u ** 3 - u ** 4;
}

export function presentationAt(timeline: Timeline, seconds: number, fps: number, enabled = false, duration = timeline.duration) {
  const timing = presentationTiming(duration, fps, enabled, firstNoteSeconds(timeline));
  const index = Math.min(timing.frames - 1, Math.max(0, Math.floor(seconds * fps + 1e-7)));
  const motionIndex = index - timing.introFrames;
  let gameplayIndex = 0;
  let rate = 0;
  if (motionIndex >= timing.introEaseFrames) {
    gameplayIndex = timing.introEaseConsumedFrames + (motionIndex - timing.introEaseFrames);
    rate = 1;
  } else if (motionIndex >= 0 && timing.introEaseFrames > 0) {
    const u = timing.introEaseFrames <= 1 ? 1 : Math.max(0, Math.min(1, motionIndex / (timing.introEaseFrames - 1)));
    rate = 3 * u ** 2 - 2 * u ** 3;
    gameplayIndex = timing.introEaseConsumedFrames * easeProgress(motionIndex, timing.introEaseFrames);
  }
  gameplayIndex = Math.max(0, Math.min(timing.gameplayFrames - 1, gameplayIndex));
  const scene = index < timing.sceneFrames ? "intro" : index >= timing.outroStartFrame ? "outro" : null;
  return {
    gameplayTime: (gameplayIndex + timing.startFrame) / fps,
    gameplayRate: rate,
    scene: scene ? {
      kind: scene,
      time: (scene === "intro" ? index : index - timing.outroStartFrame) / fps,
    } : null,
  };
}

export function paceSetpts(holdFrames: number, easeFrames: number, consumedFrames: number, fps: number) {
  if (easeFrames <= 0 || consumedFrames <= 0) return `N/(${fps}*TB)`;
  // Commas separate ffmpeg filters, so the expression has to escape them.
  return `if(lt(N\\,${holdFrames})\\,N/${fps}/TB\\,if(lt(N\\,${holdFrames + consumedFrames})\\,(${holdFrames}+(N-${holdFrames})*${easeFrames}/${consumedFrames})/${fps}/TB\\,(N+${easeFrames - consumedFrames})/${fps}/TB))`;
}

export function pacedGameplayFilter(holdFrames: number, easeFrames: number, consumedFrames: number, fps: number) {
  return `setpts=${paceSetpts(holdFrames, easeFrames, consumedFrames, fps)},fps=${fps}`;
}

export function pacedAudioFilter(timing: PresentationTiming, fps: number) {
  const ease = timing.introEaseFrames / fps;
  const consumed = timing.introEaseConsumedFrames / fps;
  if (ease <= 0 || consumed <= 0) return "";
  const tempo = Math.max(.5, Math.min(100, consumed / ease));
  return `,asplit[ez][rs];[ez]atrim=end=${consumed},asetpts=PTS-STARTPTS,atempo=${tempo}[slow];[rs]atrim=start=${consumed},asetpts=PTS-STARTPTS[tail];[slow][tail]concat=n=2:v=0:a=1`;
}

export function gameplayPaceArgs(input: string, output: string, timing: PresentationTiming, fps: number) {
  const hold = timing.introPauseFrames;
  const end = hold + timing.introEaseFrames + Math.max(1, timing.gameplayFrames - timing.introEaseConsumedFrames);
  return [
    "-y", "-i", input, "-an",
    "-vf", `fps=${fps},setpts=PTS-STARTPTS,tpad=start_mode=clone:start=${hold},${pacedGameplayFilter(hold, timing.introEaseFrames, timing.introEaseConsumedFrames, fps)},trim=end_frame=${end},setpts=PTS-STARTPTS`,
    "-r", String(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
    "-video_track_timescale", "90000", output,
  ];
}

export function compositeArgs(gameplay: string, output: string, duration: number, fps: number, enabled = false, leadIn = 0, firstNote = 0, audioFilter = exportLoudness, outroAudio?: string, musicAudio?: string) {
  const timing = presentationTiming(duration, fps, enabled, firstNote);
  const hold = timing.introFrames / fps;
  const outroHold = timing.sceneFrames / fps;
  const introEnd = timing.sceneFrames / fps;
  const end = timing.duration;
  const sourceStart = Math.max(0, leadIn + timing.startFrame / fps);
  const pace = enabled ? pacedGameplayFilter(timing.introFrames, timing.introEaseFrames, timing.introEaseConsumedFrames, fps) : `setpts=N/(${fps}*TB)`;
  // Blend a blurred copy of the held gameplay frame. No background image is swapped at the boundary.
  const blur = `if(lt(T,${hold}),max(0,min(1,(${introEnd}-T)/0.45)),if(gte(T,${end - outroHold}),min(1,min((T-${end - outroHold})/0.25,(${end}-T)/0.45)),0))`;
  const scenes = `lt(t,${hold})+gte(t,${end - outroHold})`;
  const video = enabled
    ? `[0:v]fps=${fps},tpad=stop_mode=clone:stop=-1,trim=end_frame=${timing.gameplayFrames},setpts=PTS-STARTPTS,tpad=start_mode=clone:start=${timing.introFrames}:stop_mode=clone:stop=${timing.outroPauseFrames + timing.sceneFrames},${pace},split[clear][soft];[soft]gblur=sigma=8:enable='${scenes}',lutrgb=r=val*0.55:g=val*0.55:b=val*0.55:enable='${scenes}'[blurred];[clear][blurred]blend=all_expr='A*(1-(${blur}))+B*(${blur})':enable='${scenes}'[game];[1:v]format=rgba[hud];[game][hud]overlay=0:0:shortest=1[outv]`
    : "[1:v]format=rgba[hud];[0:v][hud]overlay=0:0:shortest=1[outv]";
  const duckAt = (timing.outroStartFrame - timing.introFrames) / fps;
  const duck = musicAudio ? `,volume='1-${1 - outroMusicVolume}*min(1,max(0,(t-${duckAt})/${outroMusicTransition}))':eval=frame` : "";
  const sourceSeconds = musicAudio ? (timing.gameplayFrames + timing.sceneFrames) / fps : timing.gameplayFrames / fps;
  const mix = enabled && outroAudio;
  const graphAudio = mix || !!musicAudio;
  const audio = `atrim=duration=${sourceSeconds},asetpts=PTS-STARTPTS,aresample=48000${graphAudio ? pacedAudioFilter(timing, fps) : ""},${audioFilter}${duck}${enabled ? `,adelay=${Math.round(hold * 1000)}:all=1,apad=whole_dur=${timing.duration}` : ""}`;
  const musicInput = musicAudio ? (mix ? 3 : 2) : 0;
  const fade = `afade=t=out:st=${end - outroHold + endFadeStart}:d=${endFadeDuration}`;
  const audioGraph = mix
    ? `;[${musicInput}:a]${audio}[music];[2:a]aresample=48000,adelay=${Math.round((end - outroHold) * 1000)}:all=1[cues];[music][cues]amix=inputs=2:normalize=0,asetpts=N/SR/TB,${fade}[outa]`
    : musicAudio ? `;[${musicInput}:a]${audio}[outa]` : "";
  return [
    // Chromium omits PNG alpha on opaque frames. Keep format changes from resetting the hold clock.
    "-y", ...(sourceStart > 0 ? ["-ss", String(sourceStart)] : []), "-i", gameplay,
    "-f", "image2pipe",
    "-framerate", String(fps), "-reinit_filter", "0", "-i", "pipe:0",
    ...(mix ? ["-i", outroAudio] : []),
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
