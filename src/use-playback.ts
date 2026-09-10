import { useEffect, useRef, useState } from "react";
import { gameplayClock, presentationSeconds, presentationTiming, introGameplayStart, firstNoteSeconds, endFadeStart, endFadeDuration, outroMusicGain } from "../core/presentation.js";
import type { Timeline } from "../core/types.js";
import type { PreviewEngine } from "./preview-engine.js";

export function usePlayback(timeline: Timeline | undefined, time: number, setTime: (time: number) => void,
  duration: number, fps: number, introOutro: boolean, engine?: PreviewEngine) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(.1);
  const currentVolume = useRef(volume); currentVolume.current = volume;
  const [audioError, setAudioError] = useState("");
  const [command, setCommand] = useState(0);
  const currentTime = useRef(time); currentTime.current = time;
  const source = useRef([timeline, engine, introOutro, fps]);
  const seek = (seconds: number) => {
    const value = Math.max(0, Math.min(duration, seconds));
    setTime(value); setCommand(value => value + 1);
  };
  const toggle = () => {
    if (!timeline || !engine) return;
    if (!playing) seek(time >= duration ? 0 : time);
    setPlaying(value => !value);
  };
  useEffect(() => {
    const next = [timeline, engine, introOutro, fps];
    if (next.every((value, index) => value === source.current[index])) return;
    source.current = next;
    setPlaying(false); setAudioError("");
  }, [timeline, engine, introOutro, fps]);
  useEffect(() => {
    engine?.audio.setSongVolume(volume * .5);
    engine?.audio.setEffectsVolume(volume * .5);
  }, [volume, engine]);
  useEffect(() => {
    if (!playing || !engine || !timeline) { engine?.audio.pause(); return; }
    const timing = presentationTiming(timeline.duration, fps, introOutro, firstNoteSeconds(timeline), introGameplayStart(timeline));
    const beginsAt = currentTime.current;
    const outroStart = introOutro ? timing.gameplayEndFrame / fps : duration;
    let stopped = false;
    let raf = 0;
    let started: number | undefined;
    const position = (elapsed: number) => gameplayClock(timing, beginsAt + elapsed, fps);
    // AudioContext owns every phase, including silence, the ramp, and the song tail.
    void engine.audio.playFrom(position(0).time * 1000, {
      timeAt: elapsed => position(elapsed).time,
      elapsedAt: sourceTime => presentationSeconds(timing, sourceTime, fps) - beginsAt,
      rateAt: elapsed => position(elapsed).rate,
      start: Math.max(0, timing.introFrames / fps - beginsAt),
      rampEnd: (timing.introFrames + timing.introEaseFrames) / fps - beginsAt,
    }).then(() => {
      if (!stopped) started = engine.context.currentTime;
    }).catch(() => {
      if (!stopped) { setAudioError("Could not start preview audio."); setPlaying(false); }
    });
    const tick = () => {
      if (stopped || started === undefined) return;
      const seconds = Math.min(duration, beginsAt + engine.context.currentTime - started);
      const fade = introOutro ? Math.max(0, Math.min(1, 1 - (seconds - timing.outroStartFrame / fps - endFadeStart) / endFadeDuration)) : 1;
      const musicGain = introOutro ? outroMusicGain(seconds - timing.outroStartFrame / fps) : 1;
      engine.audio.setSongVolume(currentVolume.current * .5 * musicGain * fade);
      engine.audio.setEffectsVolume(currentVolume.current * .5 * (seconds >= outroStart ? 0 : 1) * fade);
      currentTime.current = seconds;
      // Audio runs on its own clock. Hidden windows do not need visual updates.
      if (!document.hidden || seconds >= duration) setTime(seconds);
      if (seconds >= duration) { engine.audio.pause(); setPlaying(false); }
    };
    const draw = () => { tick(); if (!stopped) raf = requestAnimationFrame(draw); };
    // Keep intro/outro boundaries active when the window is hidden.
    const timer = window.setInterval(() => { if (document.hidden) tick(); }, 50);
    tick(); raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); clearInterval(timer); engine.audio.pause(); };
  }, [playing, engine, timeline, duration, fps, introOutro, command, setTime]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, button, [role="slider"], [role="dialog"], [role="menu"], [data-layout-editor], [data-thumbnail-workspace], [role="tab"], [contenteditable="true"]')) return;
      if (event.code === "Space") { event.preventDefault(); toggle(); }
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault(); seek(currentTime.current + (event.code === "ArrowRight" ? 5 : -5));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  return { playing, setPlaying, toggle, seek, volume, setVolume, audioError, setAudioError };
}
