import type { UpdateStatus } from "../electron/updates.js";
import { defaultVideo } from "../core/video-options.js";
import type { PreviewData } from "../core/preview.js";
import { defaultOverlayAccent, defaultOverlayIds, type AnalyzeInput, type Progress, type RenderOptions, type SavedSettings, type StudioDefaults, type ThumbnailOptions, type Timeline } from "../core/types.js";
import type { SkinChoice } from "../core/skins.js";
import type { PpEngineStatus } from "../core/pp.js";

export type ChooseKind = "replay" | "beatmap" | "songs" | "danser" | "outputDir" | "skin";

declare global {
  interface Window {
    studio: {
      osuStatus(): Promise<{ clientId: string; configured: boolean }>;
      saveOsuCredentials(value: { clientId: string; clientSecret: string }): Promise<{ clientId: string; configured: boolean }>;
      clearOsuCredentials(): Promise<{ clientId: string; configured: boolean }>;
      openOsuSettings(): Promise<void>;
      updateStatus(): Promise<UpdateStatus>;
      checkUpdates(): Promise<UpdateStatus>;
      downloadUpdate(): Promise<UpdateStatus>;
      installUpdate(): Promise<void>;
      defaults(): Promise<StudioDefaults>;
      ppEngineStatus(): Promise<PpEngineStatus>;
      skins(songs: string): Promise<SkinChoice[]>;
      previewData(): Promise<PreviewData>;
      previewSkin(folder: string): Promise<Uint8Array>;
      choose(kind: ChooseKind): Promise<string | null>;
      saveSettings(patch: SavedSettings): Promise<SavedSettings>;
      uniqueOutput(input: {
        dir: string;
        player: string;
        title: string;
      }): Promise<string>;
      analyze(input: AnalyzeInput): Promise<Timeline>;
      exportThumbnail(input: ThumbnailOptions): Promise<string>;
      render(input: RenderOptions): Promise<string>;
      cancel(): Promise<void>;
      reveal(): Promise<void>;
      onProgress(callback: (p: Progress) => void): () => void;
    };
  }
}

export function installBrowserStudio() {
  if (window.studio) return;
  window.studio = {
    osuStatus: async () => ({ clientId: "", configured: false }),
    saveOsuCredentials: async () => { throw new Error("Connect osu! in the desktop app."); },
    clearOsuCredentials: async () => ({ clientId: "", configured: false }),
    openOsuSettings: async () => { window.open("https://osu.ppy.sh/home/account/edit#oauth", "_blank", "noopener"); },
    updateStatus: async () => ({ state: "disabled", version: "0.1.1" }),
    checkUpdates: async () => ({ state: "disabled", version: "0.1.1" }),
    downloadUpdate: async () => ({ state: "disabled", version: "0.1.1" }),
    installUpdate: async () => {},
    defaults: async () => ({
      skinPath: "",
      replay: "",
      beatmap: "",
      songs: "",
      songsFound: false,
      danser: "",
      danserFound: false,
      outputDir: "renders",
      ...defaultVideo,
      overlays: [...defaultOverlayIds],
      overlayAccent: defaultOverlayAccent,
      introOutro: false,
      leaderboardSize: 50,
      leaderboardSort: "pp",
    }),
    choose: async () => null,
    ppEngineStatus: async () => ({ version: "Desktop only" }),
    skins: async () => [],
    previewData: async () => { throw new Error("Open the desktop app."); },
    previewSkin: async () => new Uint8Array(),
    saveSettings: async (patch) => patch,
    uniqueOutput: async ({ player, title }) =>
      `${player || "Unknown player"} - ${title || "unknown map"}.mp4`,
    analyze: async () => {
      throw new Error("Inspect and render need the Electron app.");
    },
    exportThumbnail: async () => { throw new Error("Export thumbnails in the desktop app."); },
    render: async () => {
      throw new Error("Inspect and render need the Electron app.");
    },
    cancel: async () => {},
    reveal: async () => {},
    onProgress: () => () => {},
  };
}
