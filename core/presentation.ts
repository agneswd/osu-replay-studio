import type { Timeline } from "./types.js";
import { exportLoudness } from "./audio.js";

// The two built-in animations each run for 5.4 seconds.
export const sceneDuration = 5.4;
export const introPause = 0;
export const outroPause = 1;
export const gameplayLeadIn = 1;

export function firstNoteSeconds(timeline: Timeline) {
  return (timeline.hitObjects?.[0]?.time ?? 0) / 1000 / timeline.speed;
}

export function presentationTiming(duration: number, fps: number, enabled = false, firstNote = 0) {
  const startFrame = enabled ? Math.round((firstNote - gameplayLeadIn) * fps) : 0;
  const gameplayFrames = Math.max(1, Math.ceil(duration * fps) - startFrame);
  const sceneFrames = enabled ? Math.round(sceneDuration * fps) : 0;
  const introFrames = sceneFrames + (enabled ? Math.round(introPause * fps) : 0);
  const outroPauseFrames = enabled ? Math.round(outroPause * fps) : 0;
  const outroStartFrame = introFrames + gameplayFrames + outroPauseFrames;
  return {
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

// Preview and capture use the same clock, including frame boundaries and backward seeks.
export function presentationAt(timeline: Timeline, seconds: number, fps: number, enabled = false, duration = timeline.duration) {
  const timing = presentationTiming(duration, fps, enabled, firstNoteSeconds(timeline));
  const index = Math.min(timing.frames - 1, Math.max(0, Math.floor(seconds * fps + 1e-7)));
  const gameplayIndex = Math.max(0, Math.min(timing.gameplayFrames - 1, index - timing.introFrames));
  const scene = index < timing.sceneFrames ? "intro" : index >= timing.outroStartFrame ? "outro" : null;
  return {
    gameplayTime: (gameplayIndex + timing.startFrame) / fps,
    scene: scene ? {
      kind: scene,
      time: (scene === "intro" ? index : index - timing.outroStartFrame) / fps,
    } : null,
  };
}

export function compositeArgs(gameplay: string, output: string, duration: number, fps: number, enabled = false, leadIn = 0, firstNote = 0, audioFilter = exportLoudness, outroAudio?: string) {
  const timing = presentationTiming(duration, fps, enabled, firstNote);
  const hold = timing.introFrames / fps;
  const outroHold = timing.sceneFrames / fps;
  const introEnd = timing.sceneFrames / fps;
  const end = timing.duration;
  const sourceStart = Math.max(0, leadIn + timing.startFrame / fps);
  // Blend a blurred copy of the held gameplay frame. No background image is swapped at the boundary.
  const blur = `if(lt(T,${hold}),max(0,min(1,(${introEnd}-T)/0.45)),if(gte(T,${end - outroHold}),min(1,min((T-${end - outroHold})/0.25,(${end}-T)/0.45)),0))`;
  const scenes = `lt(t,${hold})+gte(t,${end - outroHold})`;
  const video = enabled
    ? `[0:v]fps=${fps},trim=end_frame=${timing.gameplayFrames},setpts=PTS-STARTPTS,tpad=start_mode=clone:start=${timing.introFrames}:stop_mode=clone:stop=${timing.outroPauseFrames + timing.sceneFrames},setpts=N/(${fps}*TB),split[clear][soft];[soft]gblur=sigma=8:enable='${scenes}',lutrgb=r=val*0.55:g=val*0.55:b=val*0.55:enable='${scenes}'[blurred];[clear][blurred]blend=all_expr='A*(1-(${blur}))+B*(${blur})':enable='${scenes}'[game];[1:v]format=rgba[hud];[game][hud]overlay=0:0:shortest=1[outv]`
    : "[1:v]format=rgba[hud];[0:v][hud]overlay=0:0:shortest=1[outv]";
  const audio = `atrim=duration=${timing.gameplayFrames / fps},asetpts=PTS-STARTPTS,${audioFilter},aresample=48000${enabled ? `,adelay=${Math.round(hold * 1000)}:all=1,apad=whole_dur=${timing.duration}` : ""}`;
  const mix = enabled && outroAudio;
  return [
    // Chromium omits PNG alpha on opaque frames. Keep format changes from resetting the hold clock.
    "-y", ...(sourceStart > 0 ? ["-ss", String(sourceStart)] : []), "-i", gameplay,
    "-f", "image2pipe",
    "-framerate", String(fps), "-reinit_filter", "0", "-i", "pipe:0",
    ...(mix ? ["-i", outroAudio] : []),
    "-filter_complex", video + (mix ? `;[0:a]${audio}[music];[2:a]aresample=48000,adelay=${Math.round((end - outroHold) * 1000)}:all=1[cues];[music][cues]amix=inputs=2:normalize=0,asetpts=N/SR/TB[outa]` : ""),
    "-map", "[outv]", "-map", mix ? "[outa]" : "0:a?",
    ...(mix ? [] : ["-af", audio]),
    "-t", String(timing.duration),
    "-r", String(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-b:a", "320k", output,
  ];
}
