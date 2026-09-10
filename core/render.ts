import { nativeFrameWindow, nativeSceneArgs, nativeSceneBackgroundArgs, nativeSceneMotionArgs, nativeAudioArgs, type PrepareHud, type CompositeNativeScene } from "./native-hud.js";
import { resolutions, frameRates } from "./video-options.js";
import { constants, createWriteStream } from "node:fs";
import {
  access,
  stat,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline, finished } from "node:stream/promises";
import type { OsuClient } from "./online.js";
import { analyze } from "./analyze.js";
import { compositeArgs, gameplayOutputArgs, gameplayPaceArgs, presentationTiming, introGameplayStart, firstNoteSeconds } from "./presentation.js";
import { runtimeTool } from "./runtime.js";
import { exportLoudness, measuredAudioFilter, outroMusicArgs, entranceSamples, entranceAudioArgs } from "./audio.js";
import {
  overlayIds,
  type Timeline,
  type Capture,
  type Progress,
  type RenderOptions,
} from "./types.js";
import { danserPlayfield, validateLayout } from "./layout.js";

export function validateOptions(o: RenderOptions) {
  validateLayout(o?.layout);
  if (
    !o ||
    typeof o.danser !== "string" ||
    typeof o.output !== "string" ||
    typeof o.replay !== "string" ||
    typeof o.songs !== "string"
  )
    throw new Error("Missing required render paths.");
  if ((o.backgroundDim !== undefined && (!Number.isFinite(o.backgroundDim) || o.backgroundDim < 0 || o.backgroundDim > 1)) ||
      (o.cursorSize !== undefined && (!Number.isFinite(o.cursorSize) || o.cursorSize < .5 || o.cursorSize > 2)))
    throw new Error("Background dim or cursor size is outside the supported range.");
  if (!o.output.toLowerCase().endsWith(".mp4")) throw new Error("Choose an MP4 output file.");
  if (o.skinPath !== undefined && typeof o.skinPath !== "string") throw new Error("Invalid skin folder.");
  if (
    !frameRates.some(fps => fps === o.fps) ||
    !resolutions.some(([w, h]) => o.width === w && o.height === h)
  )
    throw new Error("Choose a supported resolution and frame rate.");
  if (
    !Array.isArray(o.overlays) ||
    o.overlays.some((id) => !overlayIds.includes(id)) ||
    new Set(o.overlays).size !== o.overlays.length
  )
    throw new Error("Invalid overlay selection.");
  if (
    o.duration !== undefined &&
    (!Number.isFinite(o.duration) || o.duration <= 0 || o.duration > 3600)
  )
    throw new Error("Duration must be between 0 and 3600 seconds.");
  if (o.leaderboardSort !== undefined && !["pp", "score"].includes(o.leaderboardSort))
    throw new Error("Leaderboard order must be PP or score.");
  if (o.leaderboardSize !== undefined && o.leaderboardSize !== 50 && o.leaderboardSize !== 100)
    throw new Error("Leaderboard size must be 50 or 100.");
  if (o.introOutro !== undefined && typeof o.introOutro !== "boolean")
    throw new Error("introOutro must be a boolean.");
  if (
    o.overlayAccent !== undefined &&
    (typeof o.overlayAccent !== "string" ||
      !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.overlayAccent))
  )
    throw new Error("overlayAccent must be a hex color.");
}

// Each tool owns a process group, including any FFmpeg process started by Danser.
export async function run(
  command: string,
  args: string[],
  signal: AbortSignal,
  log: (line: string) => void,
  cwd?: string,
  input?: AsyncIterable<Uint8Array>,
  env?: NodeJS.ProcessEnv,
) {
  signal.throwIfAborted();
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== "win32",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: env ?? process.env,
  });
  let tail = "";
  const output = (data: Buffer) => {
    const text = data.toString();
    tail = (tail + text).slice(-8000);
    log(text);
  };
  child.stdout.on("data", output);
  child.stderr.on("data", output);
  let pipeError: Error | null = null;
  let timer: NodeJS.Timeout | undefined;
  const abort = () => {
    if (process.platform === "win32") {
      if (child.pid) spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      return;
    }
    try {
      if (child.pid) process.kill(-child.pid, "SIGTERM");
    } catch {}
    timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
    }, 4000);
  };
  signal.addEventListener("abort", abort, { once: true });
  // Pipeline handles backpressure and closes the capture iterator when the encoder exits.
  const inputDone = input ? pipeline(input, child.stdin, { signal }).catch(error => {
    pipeError = error;
    if (child.exitCode === null && !signal.aborted) abort();
  }) : Promise.resolve();
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    await inputDone;
    signal.throwIfAborted();
    if (pipeError && code === null) throw pipeError;
    if (code !== 0)
      throw new Error(
        `${path.basename(command)} exited with ${code}.\n${tail}`,
      );
    if (pipeError) throw pipeError;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    child.stdin.destroy();
    await inputDone;
    signal.removeEventListener("abort", abort);
    if (timer) clearTimeout(timer);
  }
}

export async function render(
  options: RenderOptions,
  capture: Capture,
  signal: AbortSignal,
  onProgress: (p: Progress) => void,
  onlineClient?: OsuClient,
  thumbnail?: (timeline: Timeline) => Promise<void>,
  prepareHud?: PrepareHud,
  compositeScene?: CompositeNativeScene,
): Promise<string> {
  const started = performance.now();
  const stages: { stage: string; seconds: number }[] = [];
  const progress = (value: Progress) => {
    const stage = value.stage === "Overlay" ? "Composite" : value.stage;
    if (stages.at(-1)?.stage !== stage) stages.push({ stage, seconds: (performance.now() - started) / 1000 });
    onProgress(value);
  };
  validateOptions(options);
  const o = {
    ...options,
    output: path.resolve(options.output),
    danser: path.resolve(options.danser),
  };
  try {
    await access(o.output);
    throw new Error("Output already exists. Select a new filename.");
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  if (o.thumbnail) {
    try { await access(o.output.replace(/\.mp4$/i, ".png")); throw new Error("Thumbnail already exists. Select a new filename."); }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  }
  await mkdir(path.dirname(o.output), { recursive: true });
  const log = createWriteStream(`${o.output}.render.log`);
  const logDone = finished(log).catch(error => console.error("Could not save render log:", error));
  let work: string | undefined;
  let videoComplete = false;
  let failure: string | undefined;
  let overlayFrames = 0;
  let native = false;
  try {
    await access(o.danser, constants.X_OK);
    await run(runtimeTool("ffmpeg"), ["-version"], signal, () => {});
    progress({ stage: "Analyze", message: "Resolve beatmap and analyze replay" });
    const timeline = await analyze(o, signal, onlineClient);
    const duration = Math.min(o.duration ?? timeline.duration, timeline.duration);
    const timing = presentationTiming(duration, o.fps, o.introOutro, firstNoteSeconds(timeline), introGameplayStart(timeline));
    const { frames } = timing;
    work = await mkdtemp(
      path.join(path.dirname(o.output), ".replay-studio-"),
    );

    await writeFile(path.join(work, "timeline.json"), JSON.stringify(timeline));
    await writeFile(path.join(work, "job.json"), JSON.stringify(o, null, 2));
    const runtime = path.join(work, "danser");
    await mkdir(path.join(runtime, "settings"), { recursive: true });
    await mkdir(path.join(runtime, "Songs"));
    await mkdir(path.join(runtime, "Skins"));
    if (o.skinPath) {
      if (!(await stat(o.skinPath)).isDirectory()) throw new Error("The selected skin folder is unavailable.");
      await symlink(path.resolve(o.skinPath), path.join(runtime, "Skins", "studio"), process.platform === "win32" ? "junction" : "dir");
    }
    await symlink(
      path.dirname(timeline.beatmap),
      path.join(runtime, "Songs", "map"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const entry of await readdir(path.dirname(o.danser))) {
      if (/\.(so|dpak|dll)$/.test(entry))
        await copyFile(
          path.join(path.dirname(o.danser), entry),
          path.join(runtime, entry),
        );
    }
    // Copy the small launcher so Danser keeps its database and settings inside this job.
    const danserName = process.platform === "win32" ? "danser-cli.exe" : "danser-cli";
    await copyFile(o.danser, path.join(runtime, danserName));
    if (process.platform === "win32")
      await cp(path.join(path.dirname(o.danser), "ffmpeg"), path.join(runtime, "ffmpeg"), { recursive: true });
    const hidden = Object.fromEntries(
      [
        "HitErrorMeter",
        "AimErrorMeter",
        "Score",
        "HpBar",
        "ComboCounter",
        "PPCounter",
        "HitCounter",
        "StrainGraph",
        "KeyOverlay",
        "ScoreBoard",
        "Mods",
      ].map((key) => [key, { Show: false }]),
    );
    await writeFile(
      path.join(runtime, "settings", "studio.json"),
      JSON.stringify({
        General: {
          OsuSongsDir: path.join(runtime, "Songs"),
          OsuSkinsDir: path.join(runtime, "Skins"),
          DiscordPresenceOn: false,
          UnpackOszFiles: false,
        },
        Graphics: { ShowFPS: false, Fullscreen: false },
        Skin: {
          CurrentSkin: o.skinPath ? "studio" : "default", FallbackSkin: "default",
          UseColorsFromSkin: true, UseBeatmapColors: false,
          Cursor: { UseSkinCursor: true, Scale: o.cursorSize ?? 1, TrailScale: 1, ForceLongTrail: false },
        },
        Cursor: { EnableTrailGlow: false, TrailMaxLength: 80, CursorRipples: false, SmokeEnabled: false, AdditiveBlending: false },
        Recording: {
          FrameWidth: o.width,
          FrameHeight: o.height,
          FPS: o.fps,
          Encoder: "libx264",
          Container: "mp4",
          OutputDir: work,
          MotionBlur: { Enabled: false },
          libx264: { CRF: 18, Preset: "fast" },
        },
        Playfield: {
          ...danserPlayfield(o.layout),
          LeadInTime: o.introOutro ? 2 : 0,
          LeadInHold: 0,
          FadeOutTime: Math.max(1.1, (duration - (timeline.gameplayFadeStart ?? duration)) * timeline.speed),
          SeizureWarning: { Enabled: false },
          Logo: { Enabled: false },
          Background: {
            LoadStoryboards: false, LoadVideos: false, FlashToTheBeat: false,
            Dim: { Intro: o.backgroundDim ?? .95, Normal: o.backgroundDim ?? .95, Breaks: o.backgroundDim ?? .95 },
            Parallax: { Enabled: false }, Blur: { Enabled: false },
          },
        },
        Gameplay: {
          ...hidden,
          ShowResultsScreen: false,
          IgnoreFailsInReplays: true,
          Boundaries: { Enabled: false },
        },
        Audio: { GeneralVolume: .5, MusicVolume: .5, SampleVolume: .5, Offset: 0, OnlineOffset: false },
      }),
    );
    const danserEnv: NodeJS.ProcessEnv = {
      ...process.env,
      STUDIO_NATIVE_PROBE: "1",
      STUDIO_CURSOR_LEAD_IN: o.introOutro ? "1" : "",
      STUDIO_NATIVE_HUD: "",
      STUDIO_NATIVE_FRAME_LIMIT: "",
      PATH: [path.dirname(runtimeTool("ffmpeg")), process.env.PATH].filter(Boolean).join(path.delimiter),
    };
    let version = "";
    await run(
      path.join(runtime, danserName),
      ["-help"],
      signal,
      (line) => {
        version += line;
      },
      runtime,
      undefined,
      danserEnv,
    );
    if (!/danser-go version: 0\.11\.0(?:\s|$)/.test(version))
      throw new Error(
        "This render clock requires Danser 0.11.0.",
      );
    const leadIn = (o.introOutro && version.includes("STUDIO_CURSOR_LEAD_IN 1") ? 2 : 1) + timeline.preempt / 1000 / timeline.speed;
    native = !!prepareHud && version.includes("STUDIO_NATIVE_HUD 1") && (!o.layout || version.includes("STUDIO_LAYOUT 1"));
    if (native) {
      const window = nativeFrameWindow(leadIn, timing.startFrame, timing.gameplayFrames, o.fps);
      const settingsFile = path.join(runtime, "settings", "studio.json");
      const settings = JSON.parse(await readFile(settingsFile, "utf8"));
      settings.Recording.libx264 = { CRF: 16, Preset: "fast", AdditionalOptions: "-video_track_timescale 90000" };
      settings.Recording.Filters = window.filter + `,tpad=stop_mode=clone:stop=-1,trim=end_frame=${timing.gameplayFrames}`;
      await writeFile(settingsFile, JSON.stringify(settings));
      danserEnv.STUDIO_NATIVE_FRAME_LIMIT = String(window.end);
      if (o.overlays.length || o.introOutro) {
        progress({ stage: "HUD", message: o.overlays.length ? "Prepare native HUD artwork and animation" : "Prepare native scene artwork" });
        const hud = await prepareHud!(o, timeline, work, signal);
        if (o.overlays.length) danserEnv.STUDIO_NATIVE_HUD = hud;
      }
    }
    log.write(`Renderer: ${native ? "native HUD and scenes, one gameplay encode" : "browser HUD"}\n`);
    progress({ stage: "Gameplay", message: "Render gameplay with Danser" });
    await run(
      path.join(runtime, danserName),
      [
        "-r",
        timeline.replay,
        "-settings=studio",
        "-record",
        "-out=gameplay",
        "-noupdatecheck",
        "-preciseprogress",
        ...(o.duration ? [`-end=${duration * timeline.speed}`] : []),
      ],
      signal,
      (line) => {
        log.write(line);
        if (line.trim()) console.log("[danser] " + line.trim());
        const match = line.match(/Progress: (\d+)%/);
        if (match)
          progress({
            stage: "Gameplay",
            fraction: Number(match[1]) / 100,
            message: `Render gameplay (${match[1]}%)`,
          });
      },
      runtime,
      undefined,
      danserEnv,
    );
    progress({ stage: "Audio", message: "Normalize video audio" });
    const gameplay = path.join(work, "gameplay.mp4");
    let musicAudio: string | undefined;
    if (o.introOutro) {
      const sourceAudio = path.join(work, "music-source.wav");
      const sourceSeconds = (timing.gameplayFrames + timing.outroPauseFrames + timing.sceneFrames) / o.fps;
      if (timeline.audioPath) await run(runtimeTool("ffmpeg"), outroMusicArgs(gameplay, timeline.audioPath, sourceAudio,
        timing.startFrame / o.fps, leadIn, Math.min(duration, timeline.gameplayFadeStart ?? duration),
        sourceSeconds, timeline.speed, timeline.preservesPitch), signal, line => log.write(line));
      else await run(runtimeTool("ffmpeg"), ["-y", "-ss", String(Math.max(0, leadIn + timing.startFrame / o.fps)),
        "-i", gameplay, "-vn", "-af", `apad=whole_dur=${sourceSeconds}`, "-t", String(sourceSeconds), sourceAudio], signal, line => log.write(line));
      const ease = timing.introEaseFrames / o.fps;
      const pcm = path.join(work, "entrance-source.f32"), ramp = path.join(work, "entrance.f32");
      await run(runtimeTool("ffmpeg"), ["-y", "-i", sourceAudio, "-t", String(ease / 2 + 1 / 48000),
        "-ar", "48000", "-ac", "2", "-f", "f32le", pcm], signal, line => log.write(line));
      const bytes = await readFile(pcm);
      const input = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      await writeFile(ramp, Buffer.from(entranceSamples(input, 48000, 2, ease).buffer));
      musicAudio = path.join(work, "music.wav");
      await run(runtimeTool("ffmpeg"), entranceAudioArgs(sourceAudio, ramp, musicAudio, ease), signal, line => log.write(line));
    }
    let audioLog = "";
    await run(runtimeTool("ffmpeg"), [...(musicAudio ? [] : ["-ss", String(Math.max(0, leadIn + timing.startFrame / o.fps))]), "-i", musicAudio ?? gameplay,
      "-t", String(musicAudio ? timing.duration - timing.introFrames / o.fps : timing.gameplayFrames / o.fps), "-vn", "-af", `${exportLoudness}:print_format=json`, "-f", "null", "-"],
      signal, line => { audioLog = (audioLog + line).slice(-8000); });
    const audioFilter = measuredAudioFilter(audioLog);
    const needsComposition = !native && (o.overlays.length > 0 || o.introOutro === true);
    if (needsComposition) progress({
      stage: "Overlay",
      fraction: 0,
      message: "Capture overlay frames",
    });

    async function* trackCapture() {
      for await (const chunk of capture(o, timeline, frames, signal)) {
        overlayFrames++;
        if (overlayFrames % o.fps === 0)
          progress({
            stage: "Overlay",
            fraction: overlayFrames / frames,
            message: `Capture overlay frames (${Math.round((overlayFrames / frames) * 100)}%)`,
          });
        yield chunk;
      }
    }
    const overlayPipe = needsComposition ? trackCapture() : undefined;
    progress({
      stage: "Composite",
      message: "Multiplex gameplay, overlay and audio",
    });
    if (native) {
      const audio = path.join(work, "final-audio.m4a");
      await run(runtimeTool("ffmpeg"), nativeAudioArgs(gameplay, audio, timing, o.fps, leadIn, audioFilter, musicAudio), signal, line => log.write(line));
      let video = gameplay;
      if (o.introOutro) {
        if (!compositeScene || !work) throw new Error("Native scene compositing is unavailable.");
        const compose: CompositeNativeScene = compositeScene;
        const workDir: string = work;
        // The last intro frames already contain moving gameplay under the fading card.
        await run(runtimeTool("ffmpeg"), nativeSceneMotionArgs(gameplay, workDir, timing, o.fps), signal, line => log.write(line));
        const backdrop = timeline.bgImage ? path.join(workDir, "outro-background") : undefined;
        if (backdrop) await writeFile(backdrop, Buffer.from(timeline.bgImage!.split(",")[1], "base64"));
        for (const kind of ["intro", "outro"] as const) {
          const outputFrames = timing.sceneFrames + (kind === "outro" ? timing.outroPauseFrames : 0);
          progress({ stage: "Scenes", message: `Render ${kind}` });
          const clear = path.join(workDir, `${kind}-clear.png`), soft = path.join(workDir, `${kind}-soft.png`);
          await run(runtimeTool("ffmpeg"), nativeSceneBackgroundArgs(gameplay, clear, soft, kind, timing.gameplayFrames, o.fps, kind === "outro" && backdrop ? { file: backdrop, width: o.width, height: o.height, dim: o.backgroundDim ?? .95 } : undefined), signal, line => log.write(line));
          const sceneFile = path.join(workDir, `scene-${kind}.json`);
          async function* sceneCapture() {
            for await (const chunk of compose(sceneFile, { clear, soft, motion: kind === "intro" ? { directory: workDir, start: timing.introFrames } : undefined }, kind, outputFrames, o.fps, o.width, o.height, signal)) {
              overlayFrames++;
              if (overlayFrames % o.fps === 0) progress({ stage: "Scenes", fraction: overlayFrames / (timing.sceneFrames * 2), message: `Render ${kind}` });
              yield chunk;
            }
          }
          await run(runtimeTool("ffmpeg"), nativeSceneArgs(path.join(workDir, `${kind}.mp4`), outputFrames, o.fps, o.width, o.height, true), signal, line => log.write(line), workDir, sceneCapture());
        }
        await run(runtimeTool("ffmpeg"), gameplayPaceArgs(gameplay, path.join(work, "gameplay-video.mp4"), timing, o.fps, timing.sceneFrames), signal, line => log.write(line));
        // Relative fixed names keep the concat file independent of user path quoting.
        await writeFile(path.join(work, "segments.txt"), "file 'intro.mp4'\nfile 'gameplay-video.mp4'\nfile 'outro.mp4'\n");
        video = path.join(work, "video.mp4");
        await run(runtimeTool("ffmpeg"), ["-y", "-f", "concat", "-safe", "0", "-i", path.join(work, "segments.txt"), "-map", "0:v:0", "-an", "-c:v", "copy", video], signal, line => log.write(line), work);
      }
      await run(runtimeTool("ffmpeg"), ["-y", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", o.output], signal, line => log.write(line));
    } else await run(
      runtimeTool("ffmpeg"),
      needsComposition
        ? compositeArgs(gameplay, o.output, duration, o.fps, o.introOutro, leadIn, firstNoteSeconds(timeline), audioFilter, musicAudio, introGameplayStart(timeline))
        : gameplayOutputArgs(gameplay, o.output, frames / o.fps, o.fps, leadIn, audioFilter),
      signal,
      (line) => log.write(line),
      work,
      overlayPipe,
    );
    videoComplete = true;
    if (thumbnail) {
      progress({ stage: "Thumbnail", message: "Render thumbnail" });
      await thumbnail(timeline);
    }
    progress({
      stage: "Complete",
      fraction: 1,
      message: `Rendered ${path.basename(o.output)}`,
    });
    return o.output;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    log.write(`\n${signal.aborted ? "Cancelled" : "Failed"}: ${failure}\n`);
    if (signal.aborted || !videoComplete) await rm(o.output, { force: true });
    if (signal.aborted && o.thumbnail) await rm(o.output.replace(/\.mp4$/i, ".png"), { force: true });
    throw error;
  } finally {
    log.end();
    await logDone;
    const seconds = (performance.now() - started) / 1000;
    await writeFile(`${o.output}.render.json`, JSON.stringify({
      status: failure !== undefined ? signal.aborted ? "cancelled" : "failed" : "complete", error: failure,
      seconds, overlayFrames, renderer: native ? "native" : "browser", settings: o, encoder: { name: "libx264", preset: "fast", gameplayCRF: native ? 16 : 18, finalCRF: 16 },
      stages: stages.map((mark, index) => ({ stage: mark.stage, seconds: (stages[index + 1]?.seconds ?? seconds) - mark.seconds })),
    }, null, 2)).catch(error => console.error("Could not save render diagnostics:", error));
    if (work) await rm(work, { recursive: true, force: true });
  }
}
