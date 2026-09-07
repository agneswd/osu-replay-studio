import { normalizeLayout } from "../core/layout.js";
import { prepareNativeHud } from "./native-hud.js";
import { startUpdates } from "./updates.js";
import { captureThumbnail } from "./thumbnail.js";
import { videoSettings } from "../core/video-options.js";
import { previewData, previewSkin } from "../core/preview.js";
import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { mkdir, readFile, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../core/analyze.js";
import {
  danserCandidates,
  firstExistingDir,
  firstExistingFile,
  outputStem,
  songsCandidates,
  uniqueOutputPath,
} from "../core/paths.js";
import { render } from "../core/render.js";
import {
  defaultOverlayIds,
  overlayIds,
  normalizeOverlayAccent,
  type AnalyzeInput,
  type RenderOptions,
  type SavedSettings,
  type StudioDefaults,
  type ThumbnailOptions,
} from "../core/types.js";
import { Credentials } from "./credentials.js";
import { registerMedia } from "./media.js";
import { captureWithWorker, nativeSceneWithWorker } from "./capture-process.js";
import { listSkins } from "../core/skins.js";
import { ppEngineStatus } from "../core/pp.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
app.commandLine.appendSwitch("force-device-scale-factor", "1");
// Chromium does not recognise every window manager. Secret Service also works under Niri, Sway, and Hyprland.
if (process.platform === "linux" && !app.commandLine.hasSwitch("password-store") &&
    !/kde/i.test(process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? ""))
  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
const captureIndex = process.argv.indexOf("--capture-worker");
if (captureIndex >= 0) app.setPath("userData", process.argv[captureIndex + 1]);
const cliIndex = process.argv.indexOf("--render");
const devUrl = !app.isPackaged && process.env.STUDIO_DEV === "1" && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(process.env.STUDIO_DEV_URL ?? "")
  ? process.env.STUDIO_DEV_URL : undefined;
let active: AbortController | undefined;
let completed: string | undefined;
let main: BrowserWindow | undefined;
const primary = captureIndex >= 0 || cliIndex >= 0 || app.requestSingleInstanceLock();
if (!primary) app.quit();
app.on("second-instance", () => {
  if (main?.isMinimized()) main.restore();
  main?.show();
  main?.focus();
});
app
  .whenReady()
  .then(async () => {
    if (!primary) return;
    if (captureIndex >= 0) {
      await (await import("./capture-worker.js")).runCaptureWorker(root);
      return;
    }
    const credentials = new Credentials();
    await credentials.load();
    const mediaUrl = registerMedia();
    session.defaultSession.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => callback({ cancel: !devUrl || !details.url.replace(/^ws:/, "http:").startsWith(devUrl) }),
    );

    if (cliIndex >= 0) {
      try {
        const file = process.argv[cliIndex + 1];
        if (!file)
          throw new Error("Usage: bun run render -- /absolute/path/job.json");
        const options = JSON.parse(
          await readFile(file, "utf8"),
        ) as RenderOptions;
        active = new AbortController();
        process.once("SIGINT", () => active?.abort());
        process.once("SIGTERM", () => active?.abort());
        await render(options, captureWithWorker(root), active.signal, (p) =>
          console.log(JSON.stringify(p)), credentials.getClient(), options.thumbnail ? timeline => captureThumbnail(root, timeline, options.output.replace(/\.mp4$/i, ".png"), options.overlayAccent ?? "#d4d7de", active!.signal) : undefined, prepareNativeHud(root), nativeSceneWithWorker(root),
        );
        app.exit(0);
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        app.exit(1);
      }
    } else {
      const updates = startUpdates();
      main = new BrowserWindow({
        width: 1320,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: "#141619",
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(root, "dist/electron/preload.cjs"),
          backgroundThrottling: false,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      main.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
        const direction = ["+", "="].includes(input.key) ? 1 : ["-", "_"].includes(input.key) ? -1 : 0;
        if (!direction && input.key !== "0") return;
        event.preventDefault();
        const content = main!.webContents;
        content.setZoomFactor(direction ? Math.max(.75, Math.min(1.75, Math.round((content.getZoomFactor() + direction * .1) * 100) / 100)) : 1);
      });
      main.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      main.webContents.on("will-navigate", (event) => event.preventDefault());
      const trusted = (event: Electron.IpcMainInvokeEvent) => {
        if (
          event.sender !== main?.webContents ||
          event.senderFrame !== main.webContents.mainFrame
        )
          throw new Error("Untrusted IPC sender.");
      };
      const settingsFile = path.join(app.getPath("userData"), "settings.json");
      async function loadSettings(): Promise<SavedSettings> {
        try {
          return JSON.parse(await readFile(settingsFile, "utf8")) as SavedSettings;
        } catch {
          return {};
        }
      }
      let settingsWrite: Promise<unknown> = Promise.resolve();
      function writeSettings(patch: SavedSettings): Promise<SavedSettings> {
        const write = settingsWrite.catch(() => {}).then(async () => {
          const next = { ...(await loadSettings()), ...patch };
          if (patch.layout !== undefined) next.layout = normalizeLayout(patch.layout);
          await mkdir(path.dirname(settingsFile), { recursive: true });
          await writeFile(`${settingsFile}.tmp`, JSON.stringify(next, null, 2));
          await rename(`${settingsFile}.tmp`, settingsFile);
          return next;
        });
        settingsWrite = write;
        return write;
      }
      async function isDir(dir: string) {
        try {
          return (await stat(dir)).isDirectory();
        } catch {
          return false;
        }
      }
      async function isFile(file: string) {
        try {
          return (await stat(file)).isFile();
        } catch {
          return false;
        }
      }
      async function studioDefaults(): Promise<StudioDefaults> {
        const saved = await loadSettings();
        const home = app.getPath("home");
        const songs =
          (saved.songs && (await isDir(saved.songs)) && saved.songs) ||
          (await firstExistingDir(
            songsCandidates(home, process.platform, process.env),
          )) ||
          "";
        const danser =
          (saved.danser && (await isFile(saved.danser)) && saved.danser) ||
          (await firstExistingFile(
            danserCandidates(root, process.platform),
          )) ||
          "";
        const outputDir =
          (saved.outputDir &&
            (await isDir(saved.outputDir)) &&
            saved.outputDir) ||
          path.join(app.getPath("videos"), "osu! Replay Studio");

        return {
          skinPath: saved.skinPath || "",
          replay: "",
          beatmap: "",
          songs,
          songsFound: Boolean(songs),
          danser,
          danserFound: Boolean(danser),
          outputDir,
          ...videoSettings(saved),
          layout: normalizeLayout(saved.layout),
          overlays: Array.isArray(saved.overlays)
            ? saved.overlays.filter((id) => overlayIds.includes(id))
            : [...defaultOverlayIds],
          overlayAccent: normalizeOverlayAccent(saved.overlayAccent),
          introOutro: saved.introOutro === true,
          leaderboardSort: saved.leaderboardSort === "score" ? "score" : "pp",
          leaderboardSize: saved.leaderboardSize === 100 ? 100 : 50,
        };
      }
      ipcMain.handle("updateStatus", event => { trusted(event); return updates.status(); });
      ipcMain.handle("checkUpdates", event => { trusted(event); return updates.check(); });
      ipcMain.handle("downloadUpdate", event => { trusted(event); return updates.download(); });
      ipcMain.handle("installUpdate", event => {
        trusted(event);
        if (active) throw new Error("Wait for the current task to finish before restarting.");
        updates.install();
      });
      ipcMain.handle("defaults", (event) => {
        trusted(event);
        return studioDefaults();
      });
      ipcMain.handle("skins", (event, songs: string) => { trusted(event); return listSkins(songs); });
      ipcMain.handle("ppEngineStatus", event => { trusted(event); return ppEngineStatus(); });
      let previewFiles: { beatmap: string; replay: string } | undefined;
      ipcMain.handle("previewData", event => {
        trusted(event);
        if (!previewFiles) throw new Error("Open a replay first.");
        return previewData(previewFiles.beatmap, previewFiles.replay);
      });
      ipcMain.handle("previewSkin", (event, folder: string) => { trusted(event); return previewSkin(folder); });
      ipcMain.handle("osuStatus", (event) => { trusted(event); return credentials.status(); });
      ipcMain.handle("saveOsuCredentials", async (event, value) => { trusted(event); return credentials.save(value); });
      ipcMain.handle("clearOsuCredentials", async (event) => { trusted(event); return credentials.clear(); });
      ipcMain.handle("openOsuSettings", (event) => { trusted(event); return shell.openExternal("https://osu.ppy.sh/home/account/edit#oauth"); });
      ipcMain.handle("saveSettings", (event, patch: SavedSettings) => {
        trusted(event);
        return writeSettings(patch);
      });
      ipcMain.handle(
        "uniqueOutput",
        async (
          event,
          input: { dir: string; player: string; title: string },
        ) => {
          trusted(event);
          if (!input?.dir) throw new Error("Missing output folder.");
          await mkdir(input.dir, { recursive: true });
          return uniqueOutputPath(
            input.dir,
            outputStem(input.player, input.title),
          );
        },
      );
      ipcMain.handle("choose", async (event, kind: string) => {
        trusted(event);
        if (kind === "songs" || kind === "outputDir" || kind === "skin") {
          const saved = await loadSettings();
          const songs = saved.songs || await firstExistingDir(songsCandidates(app.getPath("home"), process.platform, process.env));
          const defaultPath = kind === "skin"
            ? await firstExistingDir([songs ? path.join(path.dirname(songs), "Skins") : "", saved.skinPath ? path.dirname(saved.skinPath) : ""].filter(Boolean))
            : kind === "songs" ? songs : saved.outputDir;
          const result = await dialog.showOpenDialog(main!, {
            title: kind === "songs" ? "Select Songs folder" : kind === "skin" ? "Select skin folder" : "Select output folder",
            properties: ["openDirectory"],
            defaultPath: defaultPath || undefined,
          });
          return result.canceled ? null : result.filePaths[0];
        }
        if (!["replay", "beatmap", "danser"].includes(kind))
          throw new Error("Unknown file selection.");
        const result = await dialog.showOpenDialog(main!, {
          title: `Select ${kind}`,
          properties: ["openFile"],
          filters:
            kind === "replay"
              ? [{ name: "osu! replay", extensions: ["osr"] }]
              : kind === "beatmap"
                ? [{ name: "osu! beatmap", extensions: ["osu"] }]
                : [],
        });
        return result.canceled ? null : result.filePaths[0];
      });
      async function job<T>(action: (signal: AbortSignal) => Promise<T>) {
        if (active) throw new Error("A job is already running.");
        active = new AbortController();
        try {
          return await action(active.signal);
        } finally {
          active = undefined;
          if (!main) app.quit();
        }
      }
      ipcMain.handle("analyze", (event, input: AnalyzeInput) => {
        trusted(event);
        return job(async signal => {
          const timeline = await analyze(input, signal, credentials.getClient());
          previewFiles = { beatmap: timeline.beatmap, replay: timeline.replay };
          if (timeline.audioPath) timeline.audioUrl = mediaUrl(timeline.audioPath);
          return timeline;
        });
      });
      ipcMain.handle("exportThumbnail", (event, input: ThumbnailOptions) => {
        trusted(event);
        return job(async signal => {
          if (!input?.dir) throw new Error("Missing output folder.");
          await mkdir(input.dir, { recursive: true });
          const file = await uniqueOutputPath(input.dir, outputStem(input.timeline.player, input.timeline.title), "png");
          await captureThumbnail(root, input.timeline, file, input.accent, signal, { bottomText: input.bottomText, accentRange: input.accentRange });
          completed = file;
          return file;
        });
      });
      ipcMain.handle("render", (event, input: RenderOptions) => {
        trusted(event);
        return job(async (signal) => {
          completed = await render(input, captureWithWorker(root), signal, (p) => {
            if (!main?.isDestroyed()) main?.webContents.send("progress", p);
          }, credentials.getClient(), input.thumbnail ? async timeline => {
            const file = input.output.replace(/\.mp4$/i, ".png");
            await captureThumbnail(root, timeline, file, input.overlayAccent ?? "#d4d7de", signal);
          } : undefined, prepareNativeHud(root), nativeSceneWithWorker(root));
          return completed;
        });
      });
      ipcMain.handle("cancel", (event) => {
        trusted(event);
        active?.abort();
      });
      ipcMain.handle("reveal", (event) => {
        trusted(event);
        if (completed) shell.showItemInFolder(completed);
      });
      if (devUrl) await main.loadURL(devUrl);
      else await main.loadFile(path.join(root, "dist/ui/index.html"));
      main.on("closed", () => {
        main = undefined;
        active?.abort();
      });
    }
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
app.on("window-all-closed", () => {
  if (cliIndex < 0 && captureIndex < 0) {
    active?.abort();
    if (!active) app.quit();
  }
});
