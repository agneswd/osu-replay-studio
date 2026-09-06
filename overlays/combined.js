const layout = {
  "health-bar": [400, 15.75, 1280, 72, .875],
  "player-info": [400, 14, 1280, 120, .875],
  "pp-counter": [1166, 1008, 380, 60],
  "accuracy-counter": [1362.5, 42.875, 180, 38, .875],
  "combo-counter": [404, 1008, 350, 60],
  "hit-counts": [768, 976, 384, 52],
  "hit-error-bar": [768, 976, 384, 98],
  leaderboard: [4, 434, 365, 414],
  "key-overlay": [1694, 394, 226, 110],
  "progress-graph": [8, 214, 300, 206],
};
const stage = document.getElementById("stage");
const frames = new Map();
const endFade = document.createElement("div");
endFade.style.cssText = "position:absolute;inset:0;background:black;z-index:100;pointer-events:none;opacity:0";
stage.append(endFade);
const outroBackground = document.createElement("img");
outroBackground.alt = "";
outroBackground.style.cssText = "position:absolute;inset:-20px;width:1960px;height:1120px;object-fit:cover;display:none;pointer-events:none";
stage.append(outroBackground);
window.overlayReady = Promise.all(
  Object.entries(layout).map(
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
let lastAccent;
let sceneFrame;
let sceneReady;
window.prepareScenes = (timeline) => {
  outroBackground.src = timeline.bgImage || "";
  if (!sceneFrame) {
    sceneFrame = document.createElement("iframe");
    sceneFrame.title = "Score intro and outro";
    sceneFrame.style.cssText = "left:0;top:0;width:960px;height:540px;transform:scale(2);transform-origin:top left;display:none";
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
  const strength = scene ? Math.min(1, scene.kind === "intro" ? 1 : scene.time / .25, Math.max(0, (5.4 - scene.time) / .45)) : 0;
  const hide = scene?.kind === "outro" ? Math.min(1, scene.time / .3) : 0;
  const dim = theme?.backgroundDim ?? .95;
  outroBackground.style.display = scene && outroBackground.getAttribute("src") ? "block" : "none";
  outroBackground.style.opacity = String(scene?.kind === "intro" ? strength * Math.max(0, (dim - .72) / .28) : 1);
  outroBackground.style.filter = `blur(${strength * 8}px) brightness(${scene?.kind === "intro" ? .12 : 1 - Math.min(.85, dim)})`;
  endFade.style.opacity = String(scene?.kind === "outro" ? Math.max(0, Math.min(1, (scene.time - 4.65) / .6)) : 0);
  const hideEase = 1 - (1 - hide) ** 3;
  if (sceneFrame) {
    sceneFrame.style.display = theme?.scene ? "block" : "none";
    if (theme?.scene) sceneFrame.contentWindow.seekScene(theme.scene.kind, theme.scene.time);
  }
  for (const [id, iframe] of frames) {
    iframe.style.display = enabled.includes(id) && hide < 1 ? "block" : "none";
    iframe.style.opacity = String(1 - hideEase);
    const [x, y, , , scale = 1] = layout[id];
    iframe.style.transform = `translate(${x < 320 ? -hideEase * 35 : 0}px,${y > 900 ? hideEase * 25 : x >= 320 ? -hideEase * 25 : 0}px) scale(${scale})`;
    iframe.style.filter = `blur(${strength * 2.5}px) brightness(${1 - strength * .75})`;
    if (enabled.includes(id) && hide < 1) iframe.contentWindow.renderReplayFrame(data);
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
      accent: event.data.accent,
      scene: event.data.scene,
      backgroundDim: event.data.backgroundDim,
    });
});
