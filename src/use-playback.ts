import { useEffect, useRef, useState } from "react";
import { outroSampleRate, outroSamples } from "../shared/outro-audio.js";
import { presentationTiming, firstNoteSeconds, endFadeStart, endFadeDuration, outroMusicGain } from "../core/presentation.js";
import type { Timeline } from "../core/types.js";
import type { PreviewEngine } from "./preview-engine.js";

export function usePlayback(timeline: Timeline | undefined, time: number, setTime: (time: number) => void,
  duration: number, fps: number, introOutro: boolean, engine?: PreviewEngine) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(.1);
  const currentVolume = useRef(volume); currentVolume.current = volume;
  const [audioError, setAudioError] = useState("");
  const [command, setCommand] = useState(0);
  const clock = useRef({ seconds: time, started: performance.now() });
  const currentTime = useRef(time); currentTime.current = time;
  const sceneGain = useRef<GainNode | null>(null);
  const source = useRef([timeline, engine, introOutro, fps]);
  const seek = (seconds: number) => {
    const value = Math.max(0, Math.min(duration, seconds));
    clock.current = { seconds: value, started: performance.now() };
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
    clock.current = { seconds: currentTime.current, started: performance.now() };
  }, [timeline, engine, introOutro, fps]);
  useEffect(() => {
    engine?.audio.setSongVolume(volume * .5);
    engine?.audio.setEffectsVolume(volume * .5);
    if (sceneGain.current) sceneGain.current.gain.value = volume * .5;
  }, [volume, engine]);
  useEffect(() => {
    if (!playing || !engine || !timeline) { engine?.audio.pause(); return; }
    const timing = presentationTiming(timeline.duration, fps, introOutro, firstNoteSeconds(timeline));
    const audioOrigin = (timing.introFrames - timing.startFrame) / fps;
    const start = Math.max(timing.introFrames / fps, audioOrigin);
    const end = introOutro ? duration : (timing.introFrames + timing.gameplayFrames) / fps;
    let phase = "";
    let stopped = false;
    let raf = 0;
    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      const seconds = Math.min(duration, phase === "gameplay" && engine.audio.isPlaying
        ? audioOrigin + engine.audio.currentTimeMs / 1000
        : clock.current.seconds + (now - clock.current.started) / 1000);
      const next = seconds < start ? "intro" : seconds < end ? "gameplay" : "outro";
      if (next !== phase) {
        clock.current = { seconds, started: now };
        phase = next;
        if (next === "gameplay") void engine.audio.playFrom((seconds - audioOrigin) * 1000).catch(() => {
          if (!stopped) { setAudioError("Could not start preview audio."); setPlaying(false); }
        });
        else engine.audio.pause();
      }
      const fade = introOutro ? Math.max(0, Math.min(1, 1 - (seconds - timing.outroStartFrame / fps - endFadeStart) / endFadeDuration)) : 1;
      const musicGain = introOutro ? outroMusicGain(seconds - timing.outroStartFrame / fps) : 1;
      engine.audio.setSongVolume(currentVolume.current * .5 * musicGain * fade);
      if (sceneGain.current) sceneGain.current.gain.value = currentVolume.current * .5 * fade;
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
    if (!playing || !engine || !timeline || !introOutro) return;
    const timing = presentationTiming(timeline.duration, fps, true, firstNoteSeconds(timeline));
    const begins = timing.outroStartFrame / fps;
    const offset = currentTime.current - begins;
    if (offset >= 2) return;
    const context = engine.context;
    const gain = context.createGain();
    gain.gain.value = volume * .5;
    sceneGain.current = gain;
    gain.connect(context.destination);
    const buffer = context.createBuffer(1, outroSampleRate * 2, outroSampleRate);
    buffer.copyToChannel(outroSamples(), 0);
    const sound = context.createBufferSource();
    sound.buffer = buffer; sound.connect(gain);
    let stopped = false;
    void context.resume().then(() => {
      if (!stopped) sound.start(context.currentTime + Math.max(0, -offset), Math.max(0, offset));
    }).catch(() => { if (!stopped) setAudioError("Could not start outro audio."); });
    return () => {
      stopped = true;
      try { sound.stop(); } catch { /* The audio context can close during replay replacement. */ }
      sound.disconnect(); gain.disconnect();
      if (sceneGain.current === gain) sceneGain.current = null;
    };
  }, [playing, engine, timeline, fps, introOutro, command]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, button, [role="slider"], [role="dialog"], [contenteditable="true"]')) return;
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
