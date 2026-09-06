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
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import type { OsuClient } from "./online.js";
import { analyze } from "./analyze.js";
import { compositeArgs, presentationTiming, firstNoteSeconds } from "./presentation.js";
import { runtimeTool } from "./runtime.js";
import { exportLoudness, measuredAudioFilter, outroWave } from "./audio.js";
import {
  overlayIds,
  type Timeline,
  type Capture,
  type Progress,
  type RenderOptions,
} from "./types.js";

export function validateOptions(o: RenderOptions) {
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
  progress: (p: Progress) => void,
  onlineClient?: OsuClient,
  thumbnail?: (timeline: Timeline) => Promise<void>,
): Promise<string> {
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
  await access(o.danser, constants.X_OK);
  await run(runtimeTool("ffmpeg"), ["-version"], signal, () => {});
  progress({ stage: "Analyze", message: "Resolve beatmap and analyze replay" });
  const timeline = await analyze(o, signal, onlineClient);
  const duration = Math.min(o.duration ?? timeline.duration, timeline.duration);
  const timing = presentationTiming(duration, o.fps, o.introOutro, firstNoteSeconds(timeline));
  const { frames } = timing;
  await mkdir(path.dirname(o.output), { recursive: true });
  const work = await mkdtemp(
    path.join(path.dirname(o.output), ".replay-studio-"),
  );
  const log = createWriteStream(path.join(work, "render.log"));
  let videoComplete = false;
  try {
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
          LeadInTime: 0,
          LeadInHold: 0,
          FadeOutTime: 1,
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
        Audio: { Offset: 0, OnlineOffset: false },
      }),
    );
    const danserEnv: NodeJS.ProcessEnv = {
      ...process.env,
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
    const leadIn = 1 + timeline.preempt / 1000 / timeline.speed;
    let audioLog = "";
    await run(runtimeTool("ffmpeg"), ["-ss", String(Math.max(0, leadIn + timing.startFrame / o.fps)), "-i", gameplay,
      "-t", String(timing.gameplayFrames / o.fps), "-vn", "-af", `${exportLoudness}:print_format=json`, "-f", "null", "-"],
      signal, line => { audioLog = (audioLog + line).slice(-8000); });
    const audioFilter = measuredAudioFilter(audioLog);
    const outroAudio = o.introOutro ? path.join(work, "outro.wav") : undefined;
    if (outroAudio) await writeFile(outroAudio, outroWave());
    progress({
      stage: "Overlay",
      fraction: 0,
      message: "Capture overlay frames",
    });
    let overlayFrames = 0;
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
    const overlayPipe = trackCapture();
    progress({
      stage: "Composite",
      message: "Multiplex gameplay, overlay and audio",
    });
    await run(
      runtimeTool("ffmpeg"),
      compositeArgs(gameplay, o.output, duration, o.fps, o.introOutro, leadIn, firstNoteSeconds(timeline), audioFilter, outroAudio),
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
    if (signal.aborted || !videoComplete) await rm(o.output, { force: true });
    if (signal.aborted && o.thumbnail) await rm(o.output.replace(/\.mp4$/i, ".png"), { force: true });
    throw error;
  } finally {
    log.end();
    await rm(work, { recursive: true, force: true });
  }
}
