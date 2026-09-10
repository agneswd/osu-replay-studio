const layout = window.studioLayout.overlayBounds;
const stage = document.getElementById("stage");
const frames = new Map();
const endFade = document.createElement("div");
endFade.style.cssText = "position:absolute;inset:0;background:black;z-index:101;pointer-events:none;opacity:0";
stage.append(endFade);
const outroBackground = document.createElement("img");
outroBackground.alt = "";
outroBackground.style.cssText = "position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;display:none;pointer-events:none";
stage.append(outroBackground);
const requestedOverlays = new URLSearchParams(location.search).get("overlays")?.split(",");
window.overlayReady = Promise.all(
  Object.entries(layout).filter(([id]) => !requestedOverlays || requestedOverlays.includes(id)).map(
    ([id, [x, y, w, h]]) =>
      new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.title = id;
        iframe.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform-origin:top left`;
        iframe.onload = async () => {
          await iframe.contentDocument.fonts.ready;
          resolve();
        };
        iframe.src = `${id}/index.html`;
        frames.set(id, iframe);
        stage.append(iframe);
      }),
  ),
);
function resize() {
  stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
}
addEventListener("resize", resize);
resize();
function applyTheme(accent) {
  if (!accent || typeof window.applyOverlayAccent !== "function") return;
  if (accent === lastAccent) return;
  lastAccent = accent;
  window.applyOverlayAccent(accent);
  sceneFrame?.contentWindow?.setSceneAccent?.(accent);
  for (const iframe of frames.values()) {
    iframe.contentWindow?.applyOverlayAccent?.(accent);
  }
}
window.setOverlayTheme = applyTheme;
let heldBackground;
window.setSceneBackground = ({ clear, soft }) => {
  const base = document.createElement("img"), blurred = document.createElement("img");
  base.src = clear; blurred.src = soft;
  for (const image of [base, blurred]) image.style.cssText = "position:absolute;inset:0;width:1920px;height:1080px;pointer-events:none";
  stage.prepend(base, blurred);
  heldBackground = blurred;
};
let lastAccent;
let sceneFrame;
let sceneReady;
window.prepareScenes = (timeline) => {
  outroBackground.src = timeline.bgImage || "";
  if (!sceneFrame) {
    sceneFrame = document.createElement("iframe");
    sceneFrame.title = "Score intro and outro";
    sceneFrame.style.cssText = "left:0;top:0;width:960px;height:540px;transform:scale(2);transform-origin:top left;display:none;z-index:100";
    sceneReady = new Promise((resolve, reject) => {
      sceneFrame.onload = () => { lastAccent = undefined; resolve(); };
      sceneFrame.onerror = () => reject(new Error("Could not load score animations."));
    });
    sceneFrame.src = "score-scenes/index.html";
    stage.append(sceneFrame);
  }
  return sceneReady.then(() => sceneFrame.contentWindow.prepareScenes(timeline));
};
window.setReplayFrame = async (data, enabled, theme) => {
  await window.overlayReady;
  if (theme?.accent) applyTheme(theme.accent);
  const scene = theme?.scene;
  const transition = theme?.outroTransition ?? (scene?.kind === "outro" ? 1 : 0);
  const eased = transition * transition * (3 - 2 * transition);
  const introProgress = scene?.kind === "intro" ? Math.max(0, Math.min(1, (5.4 - scene.time) / 1.3)) : 0;
  const strength = scene?.kind === "intro" ? introProgress * introProgress * (3 - 2 * introProgress) : eased;
  if (heldBackground) heldBackground.style.opacity = String(strength);
  const hide = eased;
  const dim = theme?.backgroundDim ?? .95;
  outroBackground.style.display = !heldBackground && transition > 0 && outroBackground.getAttribute("src") ? "block" : "none";
  outroBackground.style.opacity = String(eased);
  outroBackground.style.filter = `blur(8px) brightness(${(1 - dim) * .55})`;
  endFade.style.opacity = String(scene?.kind === "outro" ? Math.max(0, Math.min(1, (scene.time - 4.65) / .6)) : 0);
  const hideEase = hide;
  if (sceneFrame) {
    sceneFrame.style.display = theme?.scene ? "block" : "none";
    if (theme?.scene) sceneFrame.contentWindow.seekScene(theme.scene.kind, theme.scene.time);
  }
  const custom = window.studioLayout.normalizeLayout(theme?.layout);
  for (const [id, iframe] of frames) {
    const persistent = id === "leaderboard" || id === "progress-graph";
    iframe.style.display = enabled.includes(id) && (persistent || hide < 1) ? "block" : "none";
    iframe.style.opacity = String(persistent ? 1 : 1 - hideEase);
    const [x, y, , , baseScale] = layout[id];
    const item = custom.overlays[id], scale = baseScale * item.scale;
    iframe.style.left = `${item.x}px`;
    iframe.style.top = `${item.y}px`;
    iframe.style.zIndex = String(item.z);
    iframe.style.transform = `scale(${scale})`;
    iframe.style.filter = persistent && transition > 0 ? "none" : `blur(${strength * 2.5}px) brightness(${1 - strength * .75})`;
    if (enabled.includes(id) && (persistent || hide < 1)) iframe.contentWindow.renderReplayFrame(data);
    if (id === "leaderboard") for (const mods of iframe.contentDocument.querySelectorAll(".mods"))
      mods.style.opacity = String(theme?.gameplayUnderlay ? eased : 1);
  }
};
let scenePreparation = Promise.resolve();
let messageNumber = 0;
addEventListener("message", async (event) => {
  if (event.source !== parent) return;
  if (event.data?.type === "prepare-scenes") {
    window.replayTimeline = event.data.timeline;
    scenePreparation = event.data.scenes ? window.prepareScenes(event.data.timeline) : Promise.resolve();
    return;
  }
  // Playback can send a frame while a development reload is still preparing the overlay.
  if (event.data?.type !== "replay-frame" || (!event.data.frame && !window.replayTimeline)) return;
  const number = ++messageNumber;
  if (event.data?.scene) await scenePreparation;
  if (number !== messageNumber) return;
  if (event.source === parent && event.data?.type === "replay-frame")
    window.setReplayFrame(event.data.frame ?? window.sampleReplayFrame(window.replayTimeline, event.data.time, event.data.leaderboardSize, event.data.leaderboardSort), event.data.enabled, {
      layout: event.data.layout,
      accent: event.data.accent,
      scene: event.data.scene,
      outroTransition: event.data.outroTransition,
      gameplayUnderlay: event.data.gameplayUnderlay,
      backgroundDim: event.data.backgroundDim,
    });
});
