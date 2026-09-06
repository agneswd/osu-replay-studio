import { contextBridge, ipcRenderer } from "electron";
import type {
  AnalyzeInput,
  Progress,
  RenderOptions,
  SavedSettings,
} from "../core/types.js";
contextBridge.exposeInMainWorld("studio", {
  osuStatus: () => ipcRenderer.invoke("osuStatus"),
  saveOsuCredentials: (value: { clientId: string; clientSecret: string }) => ipcRenderer.invoke("saveOsuCredentials", value),
  clearOsuCredentials: () => ipcRenderer.invoke("clearOsuCredentials"),
  openOsuSettings: () => ipcRenderer.invoke("openOsuSettings"),
  updateStatus: () => ipcRenderer.invoke("updateStatus"),
  checkUpdates: () => ipcRenderer.invoke("checkUpdates"),
  defaults: () => ipcRenderer.invoke("defaults"),
  ppEngineStatus: () => ipcRenderer.invoke("ppEngineStatus"),
  skins: (songs: string) => ipcRenderer.invoke("skins", songs),
  previewData: () => ipcRenderer.invoke("previewData"),
  previewSkin: (folder: string) => ipcRenderer.invoke("previewSkin", folder),
  choose: (kind: string) => ipcRenderer.invoke("choose", kind),
  saveSettings: (patch: SavedSettings) =>
    ipcRenderer.invoke("saveSettings", patch),
  uniqueOutput: (input: { dir: string; player: string; title: string }) =>
    ipcRenderer.invoke("uniqueOutput", input),
  analyze: (input: AnalyzeInput) => ipcRenderer.invoke("analyze", input),
  render: (input: RenderOptions) => ipcRenderer.invoke("render", input),
  cancel: () => ipcRenderer.invoke("cancel"),
  reveal: () => ipcRenderer.invoke("reveal"),
  onProgress: (callback: (progress: Progress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: Progress) =>
      callback(progress);
    ipcRenderer.on("progress", listener);
    return () => ipcRenderer.removeListener("progress", listener);
  },
});
