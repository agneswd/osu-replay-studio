import type { ThumbnailDocument } from "../core/thumbnail-document.js";
import { YouTubeDetails } from "./YouTubeDetails.js";
import { UpdateDialog } from "./UpdateDialog.js";
import type { VideoLayout } from "../core/layout.js";
import { LayoutEditor } from "./LayoutEditor.js";
import { ThumbnailWorkspace } from "./ThumbnailWorkspace.js";
import type { ThumbnailTextOptions } from "../core/types.js";
import type { UpdateStatus } from "../electron/updates.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Tabs,
  Alert,
  Button,
  Checkbox,
  Chip,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Input,
  Label,
  ListBox,
  Modal,
  ProgressBar,
  Select,
  Slider,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { presentationAt, presentationTiming, firstNoteSeconds, sceneDuration } from "../core/presentation.js";
import {
  defaultOverlayAccent,
  overlayIds,
  type OverlayId,
  type Progress,
  type SavedSettings,
  type StudioDefaults,
  type Timeline,
} from "../core/types.js";
import { ModBadgeList } from "./mod-badges.js";
import { usePlayback } from "./use-playback.js";
import type { PreviewEngine } from "./preview-engine.js";
import appLogo from "../build/icon.svg";
import { Play, Pause, RotateCcw, Volume2, X, Settings, FolderOpen } from "lucide-react";
import { resolutions, frameRates } from "../core/video-options.js";
import type { SkinChoice } from "../core/skins.js";
import { installBrowserStudio, type ChooseKind } from "./studio-api.js";

const labels: Record<OverlayId, string> = {
  "player-info": "Player info",
  "pp-counter": "PP counter",
  "accuracy-counter": "Accuracy",
  "combo-counter": "Combo",
  "health-bar": "Health",
  "hit-counts": "Hit counts",
  "hit-error-bar": "Hit error",
  leaderboard: "Map leaderboard",
  "progress-graph": "Map graph",
  "key-overlay": "Key presses",
};

function Hint({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dismiss = () => { clearTimeout(timer.current); timer.current = undefined; setOpen(false); };
  const schedule = () => {
    if (timer.current === undefined) timer.current = setTimeout(() => { timer.current = undefined; setOpen(true); }, 800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Tooltip isOpen={open} delay={0} closeDelay={0} onOpenChange={next => { if (!next) dismiss(); }}>
    <Tooltip.Trigger role="group" className="block" tabIndex={-1} onPointerEnter={schedule} onPointerLeave={dismiss}
      onPointerDown={dismiss} onFocusCapture={event => { if (event.target.matches(":focus-visible")) schedule(); }} onBlurCapture={dismiss}>{children}</Tooltip.Trigger>
    <Tooltip.Content className="setting-tooltip max-w-64 text-sm">{text}</Tooltip.Content></Tooltip>;
}

const overlaySrc = import.meta.env.DEV
  ? "/overlays/index.html"
  : "../../overlays/index.html";

type PromptKind = "songs" | "beatmap" | "danser";

const promptCopy: Record<PromptKind, { title: string; body: string; action: string }> =
  {
    songs: {
      title: "Songs folder needed",
      body: "The app could not find your osu! Songs folder. Choose it once. The app stores the path.",
      action: "Choose Songs folder",
    },
    beatmap: {
      title: "Beatmap not found",
      body: "Choose a downloaded .osz archive or export the map from lazer. Studio will find the matching difficulty. You can also select an .osu file with its audio.",
      action: "Choose beatmap archive",
    },
    danser: {
      title: "Danser not found",
      body: "The app could not find the bundled Danser binary. Choose danser-cli.",
      action: "Choose Danser",
    },
  };

function fileName(value: string) {
  if (!value) return "";
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

function PathRow({
  label,
  value,
  found,
  placeholder,
  busy,
  onBrowse,
}: {
  label: string;
  value: string;
  found?: boolean;
  placeholder: string;
  busy: boolean;
  onBrowse: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {found !== undefined && (
          <Chip
            size="sm"
            color={found ? "success" : "warning"}
            variant="soft"
          >
            {found ? "Found" : "Not found"}
          </Chip>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          variant="secondary"
          className="min-w-0 flex-1"
          value={value}
          readOnly
          placeholder={placeholder}
          title={value}
        />
        <Button variant="secondary" isDisabled={busy} onPress={onBrowse}>
          Browse
        </Button>
      </div>
    </div>
  );
}

export function App() {
  const [options, setOptions] = useState<StudioDefaults>();
  const [timeline, setTimeline] = useState<Timeline>();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"import" | "render" | "thumbnail">("import");
  const [error, setError] = useState("");
  const cancelRequested = useRef(false);
  const [notice, setNotice] = useState("");
  const [output, setOutput] = useState("");
  const [progress, setProgress] = useState<Progress>({
    stage: "Ready",
    message: "Open a replay to begin.",
  });
  const [time, setTime] = useState(0);
  const [osuStatus, setOsuStatus] = useState({ clientId: "", configured: false });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [update, setUpdate] = useState<UpdateStatus>();
  const [dismissedUpdate, setDismissedUpdate] = useState<string>();
  const updateKey = `${update?.state}:${update?.nextVersion}`;
  const [workspace, setWorkspace] = useState("video");
  const [thumbnailExportTarget, setThumbnailExportTarget] = useState<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionPromptOpen, setConnectionPromptOpen] = useState(false);
  const [skins, setSkins] = useState<SkinChoice[]>([]);
  const [ppStatus, setPpStatus] = useState<{ version: string; latest?: string }>();
  const [engine, setEngine] = useState<PreviewEngine>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [pending, setPending] = useState<"inspect" | "render" | null>(null);
  const preview = useRef<HTMLIFrameElement>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeFiles, setYoutubeFiles] = useState<{ video?: string; thumbnail?: string }>({});
  const [editingLayout, setEditingLayout] = useState(false);
  const [draftLayout, setDraftLayout] = useState<VideoLayout>();
  const liveLayout = draftLayout ?? options?.layout;
  useEffect(() => { setDraftLayout(undefined); setEditingLayout(false); }, [timeline]);
  const playfieldRef = useRef<HTMLCanvasElement>(null);
  const engineResource = useRef<{ timeline: Timeline; skin: string; canvas: HTMLCanvasElement; value: Promise<PreviewEngine>; release?: ReturnType<typeof setTimeout> }>(undefined);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    installBrowserStudio();
    window.studio
      .defaults()
      .then(setOptions)
      .catch((e) => setError(String(e)));
    void window.studio.osuStatus().then(status => {
      setOsuStatus(status);
      setClientId(status.clientId);
      setConnectionPromptOpen(!status.configured);
    });
    void window.studio.ppEngineStatus().then(setPpStatus).catch(() => {});
    return window.studio.onProgress(setProgress);
  }, []);

  useEffect(() => {
    let current = true;
    const read = () => void window.studio.updateStatus().then(next => {
      if (current) setUpdate(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    }).catch(() => {});
    read();
    const timer = setInterval(read, 1000);
    return () => { current = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (options) void window.studio.skins(options.songs).then(setSkins).catch(() => setSkins([]));
  }, [options?.songs]);
  useEffect(() => {
    if (!timeline || !playfieldRef.current) { setEngine(undefined); return; }
    let current = true;
    const canvas = playfieldRef.current;
    const skin = options?.skinPath ?? "";
    let resource = engineResource.current;
    if (!resource || resource.timeline !== timeline || resource.skin !== skin || resource.canvas !== canvas) {
      setEngine(undefined); setPreviewError(""); setPreviewLoading(true);
      resource = { timeline, skin, canvas, value: import("./preview-engine.js").then(({ PreviewEngine }) => PreviewEngine.create(canvas, timeline, skin)) };
      engineResource.current = resource;
    }
    clearTimeout(resource.release);
    const retained = resource;
    void retained.value.then(value => {
      if (current) { setEngine(value); setPreviewLoading(false); }
    }).catch(error => { if (current) { setPreviewError(String(error)); setPreviewLoading(false); } });
    // Fast Refresh reruns effects. Let the replacement effect retain the same preview resources.
    return () => {
      current = false;
      retained.release = setTimeout(() => {
        if (engineResource.current === retained) engineResource.current = undefined;
        void retained.value.then(value => value.destroy()).catch(() => {});
      }, 0);
    };
  }, [timeline, options?.skinPath]);
  useEffect(() => {
    if (engine) {
      engine.cursorSize(options?.cursorSize ?? 1);
      engine.draw(position?.gameplayTime ?? time, timeline?.speed ?? 1, options?.backgroundDim ?? .95);
    }
  }, [engine, options?.cursorSize]);

  const position = timeline && options ? presentationAt(timeline, time, options.fps, options.introOutro) : null;
  const sceneBlur = position?.scene ? Math.min(1, position.scene.kind === "intro" ? 1 : position.scene.time / .25, Math.max(0, (5.4 - position.scene.time) / .45)) : 0;
  const previewDuration = timeline && options ? presentationTiming(timeline.duration, options.fps, options.introOutro, firstNoteSeconds(timeline)).duration : 0;
  const playback = usePlayback(timeline, time, setTime, previewDuration, options?.fps ?? 60, options?.introOutro ?? false, engine);
  async function connectOsu() {
    setConnecting(true); setConnectionMessage("");
    try {
      const status = await window.studio.saveOsuCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
      setOsuStatus(status); setClientSecret(""); setConnectionMessage("");
      if (timeline) await inspect();
    } catch (error) { setConnectionMessage((error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")); }
    finally { setConnecting(false); }
  }
  const prepareScenes = () => {
    if (timeline)
      preview.current?.contentWindow?.postMessage({ type: "prepare-scenes", timeline, scenes: options?.introOutro }, "*");
  };
  useEffect(prepareScenes, [timeline, options?.introOutro]);
  useEffect(() => {
    const refresh = () => {
      if (preview.current) preview.current.src = `${overlaySrc}?update=${Date.now()}`;
    };
    import.meta.hot?.on("studio:overlay", refresh);
    return () => import.meta.hot?.off("studio:overlay", refresh);
  }, []);
  useEffect(() => setTime(current => Math.min(current, previewDuration)), [previewDuration]);
  const sendFrame = () => {
    if (timeline && options)
      preview.current?.contentWindow?.postMessage(
        {
          type: "replay-frame",
          time: position?.gameplayTime ?? time,
          leaderboardSort: options.leaderboardSort,
          leaderboardSize: options.leaderboardSize,
          backgroundDim: options.backgroundDim,
          layout: liveLayout,
          scene: position?.scene,
          enabled: options.overlays,
          accent: options.overlayAccent || defaultOverlayAccent,
        },
        "*",
      );
  };
  useEffect(sendFrame, [timeline, time, options?.overlays, options?.overlayAccent, options?.introOutro, options?.fps, options?.leaderboardSize, options?.leaderboardSort, options?.backgroundDim, liveLayout]);
  useEffect(() => {
    if (engine && timeline) {
      engine.layout(liveLayout);
      engine.draw(position?.gameplayTime ?? time, timeline.speed, options?.backgroundDim ?? .95);
    }
  }, [time, timeline, engine, options?.introOutro, options?.fps, options?.backgroundDim, liveLayout]);

  function patch(next: Partial<StudioDefaults>) {
    setOptions((old) => old && { ...old, ...next });
  }

  async function persist(next: Partial<StudioDefaults>) {
    patch(next);
    const saved: SavedSettings = {};
    if (next.layout !== undefined) saved.layout = next.layout;
    if (next.backgroundDim !== undefined) saved.backgroundDim = next.backgroundDim;
    if (next.cursorSize !== undefined) saved.cursorSize = next.cursorSize;
    if (next.skinPath !== undefined) saved.skinPath = next.skinPath;
    if (next.songs !== undefined) saved.songs = next.songs;
    if (next.danser !== undefined) saved.danser = next.danser;
    if (next.outputDir !== undefined) saved.outputDir = next.outputDir;
    if (next.width !== undefined) saved.width = next.width;
    if (next.height !== undefined) saved.height = next.height;
    if (next.fps !== undefined) saved.fps = next.fps;
    if (next.leaderboardSort !== undefined) saved.leaderboardSort = next.leaderboardSort;
    if (next.leaderboardSize !== undefined) saved.leaderboardSize = next.leaderboardSize;
    if (next.introOutro !== undefined) saved.introOutro = next.introOutro;
    if (next.overlays !== undefined) saved.overlays = next.overlays;
    if (next.overlayAccent !== undefined) saved.overlayAccent = next.overlayAccent;
    if (!Object.keys(saved).length) return;
    try {
      await window.studio.saveSettings(saved);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
    }
  }

  async function choose(kind: ChooseKind) {
    try {
      const value = await window.studio.choose(kind);
      if (!value) return null;
      if (kind === "replay") {
        setYoutubeFiles({});
        patch({ replay: value, beatmap: "" });
        setTimeline(undefined);
        setTime(0);
        setOutput("");
      } else if (kind === "songs") {
        await persist({ songs: value, songsFound: true });
      } else if (kind === "danser") {
        await persist({ danser: value, danserFound: true });
      } else if (kind === "outputDir") {
        await persist({ outputDir: value });
      } else if (kind === "skin") {
        await persist({ skinPath: value });
      } else if (kind === "beatmap") {
        setYoutubeFiles({});
        patch({ beatmap: value });
        setTimeline(undefined);
        setTime(0);
      }
      return value;
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
      return null;
    }
  }

  async function inspect(current = options) {
    if (!current?.replay) return;
    if (!current.songs && !current.beatmap) {
      setPending("inspect");
      setPrompt("beatmap");
      return;
    }
    playback.setPlaying(false);
    cancelRequested.current = false;
    setBusyAction("import");
    setProgress({ stage: "Importing...", message: "Load replay data" });
    setBusy(true);
    setNotice("");
    setError("");
    setOutput("");
    try {
      const next = await window.studio.analyze({
        replay: current.replay,
        songs: current.songs,
        beatmap: current.beatmap || undefined,
      });
      setTimeline(next);
      setTime(0);
      patch({ beatmap: next.beatmap });
      setProgress({
        stage: "Ready",
        message: `Loaded ${next.title} (${next.player})`,
      });
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
      if (cancelRequested.current) setNotice("Replay loading cancelled");
      else if (/Beatmap not found/i.test(message)) {
        setPending("inspect");
        setPrompt("beatmap");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
      cancelRequested.current = false;
    }
  }

  async function exportThumbnail(customization: ThumbnailTextOptions & { accent: string }) {
    if (!options || !timeline) return;
    cancelRequested.current = false;

    setBusyAction("thumbnail");
    setProgress({ stage: "Exporting thumbnail", message: "Save thumbnail" });
    setBusy(true); setNotice(""); setError(""); setOutput("");
    try {
      const file = await window.studio.exportThumbnail({ timeline, dir: options.outputDir, ...customization });
      setOutput(file);
      setYoutubeFiles(old => ({ ...old, thumbnail: file }));
    } catch (e) {
      if (cancelRequested.current) setNotice("Thumbnail export cancelled");
      else setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
    } finally {
      setBusy(false);
      cancelRequested.current = false;
    }
  }

  const exportEditedThumbnail = useCallback((document: ThumbnailDocument) => { void exportThumbnail({ document, accent: document.accent }); }, [timeline, options?.outputDir]);

  async function startRender(current = options) {
    if (!current || !timeline) return;
    if (!current.danser) {
      setPending("render");
      setPrompt("danser");
      return;
    }
    playback.setPlaying(false);
    cancelRequested.current = false;
    setBusyAction("render");
    setProgress({ stage: "Preparing render", message: "Prepare video output" });
    setBusy(true);
    setNotice("");
    setError("");
    setOutput("");
    try {
      const target = await window.studio.uniqueOutput({
        dir: current.outputDir,
        player: timeline.player,
        title: timeline.title,
      });
      if (cancelRequested.current) { setNotice("Render cancelled"); return; }
      const result = await window.studio.render({
        replay: current.replay,
        songs: current.songs,
        beatmap: current.beatmap || undefined,
        danser: current.danser,
        skinPath: current.skinPath,
        backgroundDim: current.backgroundDim,
        cursorSize: current.cursorSize,
        layout: current.layout,
        output: target,
        width: current.width,
        height: current.height,
        fps: current.fps,
        overlays: current.overlays,
        overlayAccent: current.overlayAccent,
        introOutro: current.introOutro,
        leaderboardSort: current.leaderboardSort,
        leaderboardSize: current.leaderboardSize,
      });
      setOutput(result);
      setYoutubeFiles(old => ({ ...old, video: result }));
    } catch (e) {
      if (cancelRequested.current) setNotice("Render cancelled");
      else setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
    } finally {
      setBusy(false);
      cancelRequested.current = false;
    }
  }

  async function openReplay() {
    const replay = await choose("replay");
    if (!replay || !options) return;
    await inspect({ ...options, replay, beatmap: "" });
  }

  async function resolvePrompt() {
    if (!prompt) return;
    const kind =
      prompt === "songs" ? "songs" : prompt === "danser" ? "danser" : "beatmap";
    const value = await choose(kind);
    if (!value || !options) return;
    setPrompt(null);
    const next = {
      ...options,
      ...(kind === "songs"
        ? { songs: value, songsFound: true }
        : kind === "danser"
          ? { danser: value, danserFound: true }
          : { beatmap: value }),
    };
    const action = pending;
    setPending(null);
    if (action === "inspect") await inspect(next);
    if (action === "render") await startRender(next);
  }

  function toggleOverlay(id: OverlayId) {
    if (!options) return;
    const overlays = options.overlays.includes(id)
      ? options.overlays.filter((item) => item !== id)
      : [...options.overlays, id];
    void persist({ overlays });
  }

  const videoOptions = useMemo(() => options ? (
      <aside aria-label="Video options" className="workspace-options flex shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <Hint text="Use this skin for preview gameplay, hit sounds, and the exported video."><Select aria-label="Gameplay skin" value={options.skinPath || "default"} isDisabled={busy}
                    onChange={key => void persist({ skinPath: key === "default" ? "" : String(key) })}>
                    <Label>Gameplay skin</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover><ListBox>
                      <ListBox.Item id="default" textValue="Default osu! skin">Default osu! skin<ListBox.ItemIndicator /></ListBox.Item>
                      {options.skinPath && !skins.some(skin => skin.path === options.skinPath) && <ListBox.Item id={options.skinPath} textValue={fileName(options.skinPath)}>{fileName(options.skinPath)}<ListBox.ItemIndicator /></ListBox.Item>}
                      {skins.map(skin => <ListBox.Item key={skin.path} id={skin.path} textValue={skin.name}>{skin.name}<ListBox.ItemIndicator /></ListBox.Item>)}
                    </ListBox></Select.Popover>
                  </Select></Hint>
                  <Hint text="Choose a skin folder."><Button isIconOnly aria-label="Browse skins" variant="secondary" isDisabled={busy} onPress={() => void choose("skin")}><FolderOpen size={18} /></Button></Hint>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <Hint text="Darken the beatmap background in the preview and video. 100% is black."><Slider aria-label="Background dim" minValue={0} maxValue={100} step={1} value={Math.round(options.backgroundDim * 100)}
                  onChange={value => void persist({ backgroundDim: Number(value) / 100 })}>
                  <div className="flex justify-between gap-2 text-sm"><Label className="whitespace-nowrap">Background dim</Label><Slider.Output>{() => `${Math.round(options.backgroundDim * 100)}%`}</Slider.Output></div>
                  <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
                </Slider></Hint>
                <Hint text="Set the cursor size in the preview and exported video."><Slider aria-label="Cursor size" minValue={.5} maxValue={2} step={.05} value={options.cursorSize}
                  onChange={value => void persist({ cursorSize: Number(value) })}>
                  <div className="flex justify-between gap-2 text-sm"><Label>Cursor size</Label><Slider.Output>{() => `${options.cursorSize.toFixed(2)}×`}</Slider.Output></div>
                  <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
                </Slider></Hint>
                </div>
                <div className="grid grid-cols-[1.2fr_1fr] gap-3">
                <Hint text="Set the video resolution. Higher resolutions take longer to render."><Select
                  className="w-full"
                  value={`${options.width}x${options.height}`}
                  onChange={(key) => {
                    const [width, height] = String(key).split("x").map(Number);
                    void persist({ width, height });
                  }}
                >
                  <Label>Resolution</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {resolutions.map(([w, h]) => <ListBox.Item key={w} id={`${w}x${h}`} textValue={`${w} × ${h}`}>{w} × {h}<ListBox.ItemIndicator /></ListBox.Item>)}
                    </ListBox>
                  </Select.Popover>
                </Select></Hint>
                <Hint text="Set frames per second. Higher frame rates take longer to render."><Select
                  className="w-full"
                  value={String(options.fps)}
                  onChange={(key) => void persist({ fps: Number(key) })}
                >
                  <Label>Frame rate</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {frameRates.map(fps => <ListBox.Item key={fps} id={String(fps)} textValue={`${fps} fps`}>{fps} fps<ListBox.ItemIndicator /></ListBox.Item>)}
                    </ListBox>
                  </Select.Popover>
                </Select></Hint>
                </div>
                <div>
                  <Hint text="Add score animations before and after gameplay."><Checkbox isSelected={options.introOutro} isDisabled={busy}
                    onChange={(introOutro) => void persist({ introOutro })}>
                    <Checkbox.Content>
                      <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                      Intro and outro
                    </Checkbox.Content>
                  </Checkbox></Hint>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Overlay accent</p>
                  <Hint text="Set the shared accent color for video overlays and thumbnails."><ColorPicker value={options.overlayAccent || defaultOverlayAccent} onChange={color => void persist({ overlayAccent: color.toString("hex") })}>
                    <ColorPicker.Trigger aria-label="Overlay accent" isDisabled={busy}><ColorSwatch /></ColorPicker.Trigger>
                    <ColorPicker.Popover className="flex w-64 flex-col gap-3 p-4">
                      <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness"><ColorArea.Thumb /></ColorArea>
                      <ColorSlider channel="hue" colorSpace="hsb"><ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track></ColorSlider>
                      <ColorField><Label>Hex color</Label><ColorField.Group><ColorField.Input /></ColorField.Group></ColorField>
                    </ColorPicker.Popover>
                  </ColorPicker></Hint>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Overlays</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {overlayIds.map((id) => (
                    <Hint key={id} text={labels[id] + " in the preview and exported video."}><Checkbox
                      isSelected={options.overlays.includes(id)}
                      isDisabled={busy}
                      onChange={() => toggleOverlay(id)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        {labels[id]}
                      </Checkbox.Content>
                    </Checkbox></Hint>
                  ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                <Hint text="Choose the online score pool. The overlay follows your replay through this score pool."><Select value={String(options.leaderboardSize)} onChange={key => void persist({ leaderboardSize: key === "100" ? 100 : 50 })}>
                  <Label>Score pool</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover><ListBox>
                    <ListBox.Item id="50" textValue="Top 50 scores">Top 50 scores<ListBox.ItemIndicator /></ListBox.Item>
                    <ListBox.Item id="100" textValue="Top 100 scores">Top 100 scores<ListBox.ItemIndicator /></ListBox.Item>
                  </ListBox></Select.Popover>
                </Select></Hint>
                <Hint text="PP is the default. Score uses stable totals for stable replays and standardized totals for lazer.">
                  <Select aria-label="Leaderboard order" value={options.leaderboardSort} onChange={key => void persist({ leaderboardSort: key === "score" ? "score" : "pp" })}>
                    <Label>Order</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover><ListBox>
                      <ListBox.Item id="pp" textValue="Sort by PP">Sort by PP<ListBox.ItemIndicator /></ListBox.Item>
                      <ListBox.Item id="score" textValue="Sort by score">Sort by score<ListBox.ItemIndicator /></ListBox.Item>
                    </ListBox></Select.Popover>
                  </Select>
                </Hint>
                </div>
      </aside>
  ) : null, [options, busy, skins]);

  if (!options) {
    return (
      <main className="flex h-full items-center justify-center gap-3 text-muted">
        <Spinner size="sm" />
        Loading
      </main>
    );
  }

  return (
    <div className="workspace-shell relative flex h-full flex-col bg-background text-foreground">
      <header className="workspace-header shrink-0 gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
        <img src={appLogo} alt="" width={36} height={36} className="shrink-0" />
        <div className={`app-heading relative h-11 min-w-0 flex-1${timeline ? " has-replay" : ""}`}>
          <h1 className="app-title text-base font-semibold">osu! Replay Studio</h1>
          <p className="app-subtitle absolute bottom-0 h-5 w-full truncate text-sm text-muted">
            {timeline ? `${timeline.player} · ${timeline.title}` : ""}
          </p>
        </div>
        </div>
        <Tabs variant="secondary" selectedKey={workspace} onSelectionChange={key => { setWorkspace(String(key)); playback.setPlaying(false); setEditingLayout(false); }} className="workspace-tabs shrink-0">
          <Tabs.ListContainer><Tabs.List aria-label="Workspace"><Tabs.Tab id="video">Video<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="thumbnail">Thumbnail<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer>
        </Tabs>
        <div className="flex items-center justify-end gap-3">
        <Button isDisabled={busy} onPress={openReplay}>
          Open replay
        </Button>
        <Button variant="ghost" onPress={() => setSettingsOpen(true)}>
          <Settings size={18} aria-hidden="true" />
          Settings
        </Button>
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1" style={{ display: workspace === "thumbnail" ? "flex" : "none" }}>
        <ThumbnailWorkspace key={timeline?.replay ?? "empty"} timeline={timeline} onOpenReplay={openReplay} accent={options.overlayAccent ?? defaultOverlayAccent} onAccentChange={accent => void persist({ overlayAccent: accent })} busy={busy} onExport={exportEditedThumbnail} exportTarget={thumbnailExportTarget} />
      </div>
      <div className="min-h-0 min-w-0 flex-1" style={{ display: workspace === "video" ? "flex" : "none" }}>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="preview-area flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
          <div className="preview-box">
      {(busy || previewLoading) && (
        <div className="absolute left-1/2 top-1/2 z-20 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-4 shadow-lg">
          <ProgressBar
            aria-label="Render progress"
            className="w-full"
            value={(progress.fraction ?? 0) * 100}
            isIndeterminate={progress.fraction === undefined}
          >
            <Label>{busy && busyAction === "import" ? "Importing..." : previewLoading ? "Loading preview" : progress.stage}</Label>
            <ProgressBar.Output />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>

        </div>
      )}


            {timeline ? (
              <>
                <div className="preview-gameplay" style={{ filter: `blur(${sceneBlur * 8}px) brightness(${1 - sceneBlur * .45})` }}>
                {timeline.bgImage && (
                  <img src={timeline.bgImage} alt="" style={{ filter: `brightness(${1 - options.backgroundDim})` }} />
                )}
                <canvas
                  ref={playfieldRef}
                  width={1280}
                  height={720}
                />
                </div>
                <iframe
                  ref={preview}
                  title="Combined overlay preview"
                  src={overlaySrc}
                  onLoad={() => { prepareScenes(); sendFrame(); }}
                />
                {editingLayout && !busy && !previewLoading && !position?.scene && <LayoutEditor value={liveLayout} enabled={options.overlays} preview={preview} labels={labels}
                  onPreview={setDraftLayout} onCommit={layout => { void persist({ layout }); setDraftLayout(undefined); }} />}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-base font-medium">No replay loaded</p>
                <p className="max-w-sm text-sm text-muted">
                  Open an .osr file to start.
                </p>
                <Button isDisabled={busy} isPending={busy && busyAction === "import"} onPress={openReplay}>{busy ? "Importing replay..." : "Open replay"}</Button>
              </div>
            )}
          </div>
        </div>


        <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
          <p className="mb-2 text-xs text-muted">{editingLayout ? "Drag to move. Drag a corner to resize. Right-click for reset and layers. Alt-click selects overlapping elements." : "Gameplay preview - exported video may differ."}</p>
          <div className="mb-3 flex items-center gap-3">
            <Button isIconOnly aria-label={playback.playing ? "Pause" : "Play"} size="sm" variant="ghost" isDisabled={!engine || busy} onPress={() => { setEditingLayout(false); playback.toggle(); }}>{playback.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</Button>
            <Button isIconOnly aria-label="Restart" size="sm" variant="ghost" isDisabled={!engine} onPress={() => playback.seek(0)}><RotateCcw size={18} /></Button>
            <Button size="sm" variant={editingLayout ? "primary" : "secondary"} isDisabled={!engine || busy} aria-pressed={editingLayout} onPress={() => {
              if (!editingLayout) {
                playback.setPlaying(false);
                if (position?.scene) playback.seek(options.introOutro ? sceneDuration + Math.min(.5, timeline!.duration) : 0);
              }
              setEditingLayout(!editingLayout);
            }}>{editingLayout ? "Done editing" : "Edit layout"}</Button>
            <Volume2 className="ml-auto" size={18} aria-hidden="true" /><Slider aria-label="Preview volume" className="w-28" minValue={0} maxValue={100} step={1}
              value={Math.round(playback.volume * 100)} onChange={value => playback.setVolume((typeof value === "number" ? value : value[0]) / 100)}>

              <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
            </Slider>
          </div>

          <Slider
            aria-label="Replay time"
            className="w-full"
            minValue={0}
            maxValue={previewDuration || 1}
            step={1 / options.fps}
            value={time}
            isDisabled={!timeline}
            onChange={(value) => playback.seek(typeof value === "number" ? value : value[0])}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <Label>Timeline</Label>
              <Slider.Output>
                {() =>
                  `${time.toFixed(1)} / ${previewDuration.toFixed(1)} s`
                }
              </Slider.Output>
            </div>
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <div className="mt-2 flex h-8 items-center gap-x-3 overflow-hidden text-sm text-muted">
          {timeline && (
            <>
              <ModBadgeList modStr={timeline.mods} />
              {!timeline.online && <Button size="sm" variant="ghost" onPress={() => setSettingsOpen(true)}>Connect osu!</Button>}
              <span>{timeline.stars.toFixed(2)} stars</span>
              <span>{Math.round(timeline.bpm)} bpm</span>
              <span>{Math.round(timeline.maxPP)} pp</span>
            </>
          )}
          </div>
        </div>
      </section>
      {videoOptions}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-4 py-3 sm:px-6">
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm text-muted">
          {notice || (workspace === "thumbnail" ? "Thumbnail editor" : `${options.width} × ${options.height} · ${options.fps} fps${output ? ` · ${fileName(output)}` : ""}`)}
        </p>
        {busy && (
          <Button variant="danger-soft" onPress={() => { cancelRequested.current = true; void window.studio.cancel(); }}>
            Cancel
          </Button>
        )}
        {output && (
          <Button variant="secondary" onPress={() => window.studio.reveal()}>
            Show in folder
          </Button>
        )}
        <div ref={setThumbnailExportTarget} className={workspace === "thumbnail" ? "contents" : "hidden"} />
        <Button variant="secondary" isDisabled={!timeline} onPress={() => setYoutubeOpen(true)}>YouTube details</Button>
        {workspace === "video" && <Button
          isDisabled={busy || !timeline}
          isPending={busy && busyAction === "render"}
          onPress={() => startRender()}
        >
          {busy && busyAction !== "thumbnail" ? busyAction === "import" ? "Importing..." : "Rendering" : "Render video"}
        </Button>}
      </footer>

      {timeline && <YouTubeDetails key={timeline.replay} timeline={timeline} files={youtubeFiles} isOpen={youtubeOpen} onOpenChange={setYoutubeOpen}
        additionalText={options.youtubeAdditionalText ?? ""} onAdditionalTextChange={async text => {
          setOptions(old => old ? { ...old, youtubeAdditionalText: text } : old);
          await window.studio.saveSettings({ youtubeAdditionalText: text });
        }} />}

      {!busy && !editingLayout && workspace === "video" && !connectionPromptOpen && update?.nextVersion && ["available", "downloading", "ready", "error"].includes(update.state) && dismissedUpdate !== updateKey &&
        <UpdateDialog status={update} onDismiss={() => setDismissedUpdate(updateKey)}
          onDownload={() => {
            setUpdate({ ...update, state: "downloading", percent: 0 });
            void window.studio.downloadUpdate().then(setUpdate).catch(e => { setUpdate({ ...update, state: "error" }); setError(String(e)); });
          }}
          onInstall={() => { void window.studio.installUpdate().catch(e => setError(String(e))); }} />}
      {(error || previewError || playback.audioError) && (
        <div className="absolute bottom-20 left-6 z-30 max-w-lg">
          <Alert status="danger">
            <Button isIconOnly size="sm" variant="ghost" aria-label="Dismiss error" onPress={() => { setError(""); setPreviewError(""); playback.setAudioError(""); }}><X size={16} /></Button>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Could not complete that action</Alert.Title>
              <Alert.Description>{error || previewError || playback.audioError}</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}


      <Modal.Backdrop isOpen={connectionPromptOpen} onOpenChange={setConnectionPromptOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Connect osu!</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>Connect an osu! OAuth client to load player history, mapper portraits, and map leaderboards.</p>
              <p className="text-sm text-muted">You can continue without it and connect later in Settings.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" onPress={() => setConnectionPromptOpen(false)}>
                Not now
              </Button>
              <Button onPress={() => {
                setConnectionPromptOpen(false);
                setSettingsOpen(true);
                void window.studio.openOsuSettings();
              }}>
                Set up osu! OAuth
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>


        <Modal.Backdrop isOpen={settingsOpen} onOpenChange={setSettingsOpen}>
          <Modal.Container>
            <Modal.Dialog className="settings-dialog sm:max-w-[560px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Settings</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <p className="text-sm">Replay Studio {update?.version}</p>
                  <p className="text-sm text-muted">{update?.state === "ready" ? `Update ${update.nextVersion} is ready to install.` : update?.state === "available" ? `Version ${update.nextVersion} is available.` : update?.state === "downloading" ? `Downloading update ${Math.round(update.percent ?? 0)}%` : update?.state === "checking" ? "Checking for updates" : update?.state === "error" ? "Could not check for updates." : update?.state === "disabled" ? "Updates are available in GitHub release builds." : "Up to date"}</p>
                  <Button size="sm" variant="secondary" isDisabled={!update || ["disabled", "checking", "downloading"].includes(update.state)} onPress={() => {
                    setDismissedUpdate(undefined);
                    if (["available", "ready"].includes(update!.state)) { setSettingsOpen(false); setWorkspace("video"); }
                    else void window.studio.checkUpdates().then(setUpdate);
                  }}>{update?.state === "ready" ? "Install update" : update?.state === "available" ? "View update" : "Check for updates"}</Button>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">osu! calculator {ppStatus?.version ?? ""}</p>

                  {ppStatus?.latest && ppStatus.latest.localeCompare(ppStatus.version, "en", { numeric: true }) > 0 && <p className="text-sm text-warning">osu! calculator {ppStatus.latest} is available upstream. Calculator updates are included in app releases.</p>}
                  {!ppStatus?.latest && <p className="text-sm text-muted">Update status unavailable.</p>}
                </div>
                {timeline?.warnings.filter(message => message.startsWith("Local PP")).map(message => <p key={message} className="text-xs text-muted">{message}</p>)}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">osu! connection</p>
                  <Input variant="secondary" aria-label="osu! client ID" placeholder="Client ID" value={clientId} onChange={event => setClientId(event.target.value)} autoComplete="off" />
                  <Input variant="secondary" aria-label="osu! client secret" type="password" placeholder={osuStatus.configured ? "Secret saved securely" : "Client secret"} value={clientSecret} onChange={event => setClientSecret(event.target.value)} autoComplete="new-password" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" isDisabled={connecting || !clientId || !clientSecret} onPress={() => void connectOsu()}>{connecting ? "Connecting" : osuStatus.configured && !clientSecret ? "Connected" : "Connect"}</Button>
                    <Button size="sm" variant="ghost" onPress={() => void window.studio.openOsuSettings()}>Create osu! client</Button>
                    {osuStatus.configured && <Button size="sm" variant="ghost" onPress={() => { void window.studio.clearOsuCredentials().then(setOsuStatus); setClientId(""); setConnectionMessage(""); }}>Disconnect</Button>}
                  </div>
                  {timeline && <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void inspect()}>Refresh replay data</Button>}
                  {(connectionMessage || !osuStatus.configured) && <p className="text-sm text-muted">{connectionMessage || "Not connected"}</p>}
                </div>
                <PathRow
                  label="Songs folder"
                  value={options.songs}
                  found={options.songsFound}
                  placeholder="Auto-detect on launch"
                  busy={busy}
                  onBrowse={() => choose("songs")}
                />
                <PathRow
                  label="Danser binary"
                  value={options.danser}
                  found={options.danserFound}
                  placeholder="Bundled danser-cli"
                  busy={busy}
                  onBrowse={() => choose("danser")}
                />
                <PathRow
                  label="Output folder"
                  value={options.outputDir}
                  placeholder="renders"
                  busy={busy}
                  onBrowse={() => choose("outputDir")}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={prompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPrompt(null);
            setPending(null);
          }
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {prompt ? promptCopy[prompt].title : ""}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{prompt ? promptCopy[prompt].body : ""}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                slot="close"
                variant="secondary"
                onPress={() => {
                  setPrompt(null);
                  setPending(null);
                }}
              >
                Cancel
              </Button>
              <Button onPress={() => void resolvePrompt()}>
                {prompt ? promptCopy[prompt].action : "Choose"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
