import { normalizeOverlayAccent, type RenderOptions, type Timeline } from "../core/types.js";
import type { HudBatch, HudFrame, HudSprite } from "../core/native-hud.js";
import { overlayData, sceneFlags } from "./score-scenes/data.js";
import { introMotion, outroMotion, widgetCloseScale } from "./score-scenes/widgets/motion.js";
import { buildPlaycountSpline } from "./score-scenes/widgets/spline.js";
import { scenePalette } from "./score-scenes/widgets/themes.js";
import { modColor, modAssetPath } from "./mod-badges.js";
const modPath = (mod: string) => modAssetPath(mod)?.replace("../../", "../") ?? "";

interface Sprite { id: number; w: number; h: number; pad: number; canvas?: HTMLCanvasElement }
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};
const rgb = (hex: string, alpha = 1): HudSprite["color"] => {
  const h = hex.startsWith("rgb") ? hex : hex.replace("#", "");
  if (hex.startsWith("rgb")) {
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(hex)!;
    return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, alpha];
  }
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, alpha];
};
const comma = (n: number) => Math.round(n).toLocaleString("en-US");

async function loadImage(url: string) {
  const image = new Image();
  image.src = url;
  try { await image.decode(); return image; } catch { return undefined; }
}

function cover(c: CanvasRenderingContext2D, image: CanvasImageSource, w: number, h: number, iw: number, ih: number, ox = 0.5, oy = 0.38) {
  const scale = Math.max(w / iw, h / ih);
  c.drawImage(image, (w - iw * scale) * ox, (h - ih * scale) * oy, iw * scale, ih * scale);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

const heartPath = "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5";
const starPath = "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";
function drawHeart(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill = "#fff") {
  drawLucide(c, x, y, s, fill, heartPath, true);
}
function drawStar(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill = "#FFB703") {
  drawLucide(c, x - s, y - s, s * 2, fill, starPath, true);
}

// Use the same Lucide paths and stroke geometry as the React widgets.
function drawLucide(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, path: string, fill = false, stroke = 2) {
  c.save();
  c.translate(x, y);
  c.scale(s / 24, s / 24);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = stroke;
  c.lineCap = "round";
  c.lineJoin = "round";
  const shape = new Path2D(path);
  if (fill) c.fill(shape);
  c.stroke(shape);
  c.restore();
}
function drawPlay(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  drawLucide(c, x, y, s, fill, "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z", true);
}
function drawHourglass(c: CanvasRenderingContext2D, x: number, y: number, s: number, stroke: string) {
  drawLucide(c, x, y, s, stroke, "M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2");
}


function formatScoreNumber(val: string | number) {
  const raw = String(val).replace(/\s+/g, "");
  if (!/^\d+$/.test(raw)) return String(val);
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export async function createNativeScenes(timeline: Timeline, options: RenderOptions) {
  await Promise.all([
    document.fonts.load('700 16px "Plus Jakarta Sans"'),
    document.fonts.load('800 24px "Plus Jakarta Sans"'),
    document.fonts.load('500 22px "Plus Jakarta Sans"'),
    document.fonts.load('700 240px Teko'),
    document.fonts.load('500 24px "Scene Tabular"'),
  ]);
  await document.fonts.ready;
  const data = overlayData(timeline);
  const flags = sceneFlags(timeline);
  const spline = buildPlaycountSpline(data.player.monthlyPlaycounts);
  const accent = normalizeOverlayAccent(options.overlayAccent);
  const palette = scenePalette(accent);
  const S = 2;
  const assets = new Map<number, HudBatch["assets"][number]>();
  const sentAssets = { intro: new Set<number>(), outro: new Set<number>() };
  let nextId = 0;
  const cache = new Map<string, Sprite>();
  const save = (key: string, c: HTMLCanvasElement, pad = 0): Sprite => {
    const result = { id: nextId++, w: c.width, h: c.height, pad, canvas: c };
    cache.set(key, result);
    assets.set(result.id, { id: result.id, png: c.toDataURL("image/png").split(",")[1] });
    return result;
  };
  const art = (key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void, pad = 0) => {
    const old = cache.get(key);
    if (old) return old;
    const c = canvas((w + pad * 2) * 2, (h + pad * 2) * 2);
    const x = c.getContext("2d")!;
    x.scale(2, 2);
    x.translate(pad, pad);
    paint(x);
    return save(key, c, pad);
  };
  const measure = canvas(1, 1).getContext("2d")!;
  const widthOf = (value: string, size: number, weight = 700, font = '"Plus Jakarta Sans"') => {
    measure.font = `${weight} ${size}px ${font}`;
    return measure.measureText(value).width;
  };
  const baselines = new Map<string, number>();
  const baseline = (size: number, weight: number, font: string, lineHeight: number) => {
    const key = `${font}:${weight}:${size}:${lineHeight}`;
    let value = baselines.get(key);
    if (value !== undefined) return value;
    const span = document.createElement("span");
    span.style.cssText = `position:absolute;visibility:hidden;display:inline-block;font:${weight} ${size}px ${font};line-height:${lineHeight ? `${lineHeight}px` : "normal"}`;
    span.textContent = "Mg";
    const marker = document.createElement("i");
    marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    span.append(marker);
    document.body.append(span);
    value = marker.getBoundingClientRect().top - span.getBoundingClientRect().top;
    span.remove();
    baselines.set(key, value);
    return value;
  };
  const label = (value: string, size: number, color: string, weight = 700, shadow = true, font = '\"Plus Jakarta Sans\"', lineHeight = 0, spacing = 0) =>
    art(`label:${font}:${weight}:${size}:${color}:${shadow}:${lineHeight}:${spacing}:${value}`, widthOf(value, size, weight, font) + spacing * value.length + 16, size * 1.5 + 16, c => {
      c.font = `${weight} ${size}px ${font}`;
      c.letterSpacing = `${spacing}px`;
      c.textBaseline = "alphabetic";
      c.fillStyle = color;
      if (shadow) {
        c.shadowColor = "rgba(0,0,0,0.75)";
        c.shadowBlur = 8;
        c.shadowOffsetY = 2;
      }
      c.fillText(value, 4, 4 + baseline(size, weight, font, lineHeight));
    });

  const images = new Map<string, HTMLImageElement>();
  await Promise.all([
    data.player.avatar, data.player.banner, data.map.cover, data.map.mapperAvatar,
    ...data.player.badges.slice(0, 5).map(b => b.url),
    ...(data.topScores ?? []).map(p => p.cover ?? ""),
    /^[A-Z]{2}$/.test(data.player.countryCode) ? `../shared/assets/flags/${data.player.countryCode}.svg` : "",
    ...(data.score?.mods ?? []).map(mod => modPath(mod)),
    ...(data.topScores ?? []).flatMap(p => p.mods.map(mod => modPath(mod))),
  ].filter(Boolean).map(async url => {
    if (images.has(url)) return;
    const image = await loadImage(url);
    if (image) images.set(url, image);
  }));

  const bottomH = !flags.history && !flags.onlineMap ? 125 : 228;
  const widgetW = 470, topH = 62, gap = 12, footerH = 18;
  const widgetH = topH + gap + bottomH + gap + footerH - 2;
  const widgetX = 12 + (936 - widgetW) / 2;
  const widgetY = 24 + (492 - widgetH) / 2;
  const overlay = `rgba(${palette.overlayRgb.join(",")},`;

  const cardChrome = (key: string, w: number, h: number, bannerUrl?: string, bannerAlpha = 0.55) =>
    art(key, w, h, c => {
      c.save();
      c.shadowColor = "rgba(0,0,0,0.88)";
      c.shadowBlur = 36;
      c.shadowOffsetY = 24;
      c.fillStyle = "#000";
      roundRect(c, 8, 8, w - 16, h - 16, 6);
      c.fill();
      c.shadowColor = "transparent";
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, palette.top);
      g.addColorStop(1, palette.bottom);
      c.fillStyle = g;
      roundRect(c, 0, 0, w, h, 14);
      c.fill();
      c.restore();
      c.save();
      roundRect(c, 0, 0, w, h, 14);
      c.clip();
      if (bannerUrl && images.has(bannerUrl)) {
        const img = images.get(bannerUrl)!;
        const banner = canvas(w * 2, h * 2);
        const bc = banner.getContext("2d")!;
        bc.scale(2, 2);
        cover(bc, img, w, h, img.width, img.height);
        bc.globalCompositeOperation = "destination-in";
        const alphaMask = bc.createLinearGradient(0, 0, w, 0);
        for (const [at, alpha] of [[0, .92], [.32, .8], [.65, .25], [1, .85]]) alphaMask.addColorStop(at!, `rgba(0,0,0,${alpha})`);
        bc.fillStyle = alphaMask; bc.fillRect(0, 0, w, h);
        c.globalAlpha = bannerAlpha;
        c.drawImage(banner, 0, 0, w, h);
        c.globalAlpha = 1;
        const mask = c.createLinearGradient(0, 0, w, 0);
        mask.addColorStop(0, `${overlay}0.88)`);
        mask.addColorStop(0.3, `${overlay}0.5)`);
        mask.addColorStop(0.6, `${overlay}0.1)`);
        mask.addColorStop(1, `${overlay}0.78)`);
        c.fillStyle = mask;
        c.fillRect(0, 0, w, h);
      }
      c.restore();
      c.strokeStyle = palette.border;
      c.lineWidth = 1;
      roundRect(c, 0.5, 0.5, w - 1, h - 1, 14);
      c.stroke();
      c.save();
      roundRect(c, 1, 1, w - 2, h - 2, 13); c.clip();
      const highlight = c.createLinearGradient(0, 1, 0, 4);
      highlight.addColorStop(0, "rgba(255,255,255,0.35)");
      highlight.addColorStop(1, "transparent");
      c.fillStyle = highlight; c.fillRect(0, 1, w, 3);
      c.restore();
    }, 24);

  const topPlayerChrome = cardChrome("top-player-chrome", widgetW, topH, data.player.banner, 0.55);
  const topMapChrome = cardChrome("top-map-chrome", widgetW, topH, data.map.cover, 0.55);
  const bottomChrome = cardChrome("bottom-chrome", widgetW, bottomH);

  const wipe = (height: number) => art(`wipe-art:${height}`, widgetW - 2, height, c => {
    const g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, palette.wipeLight);
    g.addColorStop(0.12, palette.wipeEdge);
    g.addColorStop(0.48, palette.wipeMiddle);
    g.addColorStop(0.88, palette.wipeEdge);
    g.addColorStop(1, palette.wipeLight);
    c.fillStyle = g;
    c.fillRect(0, 0, widgetW, height);
    const sheen = c.createLinearGradient(0, 0, widgetW, height);
    sheen.addColorStop(0.2, "transparent");
    sheen.addColorStop(0.44, "rgba(225,234,239,0.08)");
    sheen.addColorStop(0.65, "transparent");
    c.fillStyle = sheen;
    c.fillRect(0, 0, widgetW, height);
    c.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 2; y < height; y += 3) c.fillRect(0, y, widgetW, 1);
  });

  const roundedImage = (key: string, url: string, w: number, h: number, r: number) =>
    art(key, w, h, c => {
      roundRect(c, 0, 0, w, h, r);
      c.clip();
      const img = images.get(url);
      if (img) { c.save(); c.translate(1, 1); cover(c, img, w - 2, h - 2, img.width, img.height, 0.5, 0.5); c.restore(); }
      else { c.fillStyle = "#292929"; c.fillRect(0, 0, w, h); }
      c.strokeStyle = "rgba(255,255,255,0.4)";
      c.lineWidth = 1;
      roundRect(c, 0.5, 0.5, w - 1, h - 1, r);
      c.stroke();
    });

  const avatar = roundedImage("avatar", data.player.avatar, 38, 38, 8);
  const coverThumb = roundedImage("cover", data.map.cover, 38, 38, 8);
  const mapper = roundedImage("mapper", data.map.mapperAvatar, 20, 20, 4);
  const flagWidth = /^[A-Z]{2}$/.test(data.player.countryCode) ? 14 : 0;
  const flagUrl = /^[A-Z]{2}$/.test(data.player.countryCode) ? `../shared/assets/flags/${data.player.countryCode}.svg` : "";
  const flag = images.has(flagUrl) ? art("flag", flagWidth, 14, c => { c.drawImage(images.get(flagUrl)!, 0, 0, 14, 14); }) : undefined;
  const outroAvatar = art("outro-avatar", 28, 28, c => {
    roundRect(c, 0, 0, 28, 28, 5); c.clip();
    const img = images.get(data.player.avatar);
    if (img) cover(c, img, 28, 28, img.width, img.height, 0.5, 0.5);
  });

  const heart = art("heart", 21, 12, c => {
    c.fillStyle = "#ff5277";
    c.shadowColor = "rgba(255,82,119,0.5)";
    c.shadowBlur = 4;
    roundRect(c, 0, 0, 21, 12, 6);
    c.fill();
    c.shadowBlur = 0;
    drawHeart(c, 5.5, 1, 10);
  });

  const status = art("status", 28, 28, c => {
    const color = data.map.status === "loved" ? "#ff66ab" : data.map.status === "qualified" || data.map.status === "approved" ? "#8fda8c" : "#7ac9f2";
    const state = data.map.status?.toLowerCase();
    if (state === "loved") drawLucide(c, 1.5, 1.5, 25, color, heartPath, true, 2.4);
    else if (state === "qualified") drawLucide(c, 1.5, 1.5, 25, color, "M18 6 7 17l-5-5 M22 10l-7.5 7.5L13 16", false, 2.4);
    else if (["graveyard", "grave", "pending", "wip", "unranked"].includes(state ?? "")) {
      drawLucide(c, 1.5, 1.5, 25, "#a0b0be", "M22 12a10 10 0 1 0-20 0a10 10 0 1 0 20 0 M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01", false, 2.4);
    } else drawLucide(c, 1.5, 1.5, 25, color, "m17 11-5-5-5 5 m10 7-5-5-5 5", false, 4);
  });

  const chart = art("chart", 430, 140, c => {
    if (!spline.d) return;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 1;
    for (const tick of spline.yTicks) {
      c.beginPath();
      c.moveTo(20, tick.y);
      c.lineTo(425, tick.y);
      c.stroke();
    }
    c.font = '600 8.5px "Plus Jakarta Sans"';
    c.textAlign = "right";
    c.fillStyle = palette.dim;
    for (const tick of spline.yTicks) c.fillText(tick.label, 16, tick.y - 8 + baseline(8.5, 600, '\"Plus Jakarta Sans\"', 16));
  });
  const years = art("chart-years", 430, 140, c => {
    c.font = '600 8.5px "Plus Jakarta Sans"';
    c.fillStyle = palette.dim;
    spline.yearTicks.forEach((tick, i) => {
      c.textAlign = i === spline.yearTicks.length - 1 ? "right" : "center";
      c.fillText(String(tick.year), tick.x, 127 + baseline(8.5, 600, '\"Plus Jakarta Sans\"', 16));
    });
  });
  const chartPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  chartPath.setAttribute("d", spline.d || "M0 0");
  const chartLength = chartPath.getTotalLength();
  const curve = (progress: number) => art(`curve:${progress}`, 430, 140, c => {
    c.strokeStyle = accent;
    c.lineWidth = 1.05;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.shadowColor = palette.glow;
    c.shadowBlur = 4;
    c.setLineDash([chartLength, chartLength]);
    c.lineDashOffset = Math.round(chartLength * (1 - progress));
    c.stroke(new Path2D(spline.d));
  });
  const peakLine = art("peak-line", 405, 2, c => {
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, 1);
    c.lineTo(405, 1);
    c.stroke();
  });
  const peakDot = art("peak-dot", 12, 12, c => {
    c.fillStyle = "#fff";
    c.strokeStyle = accent;
    c.lineWidth = 1.8;
    c.shadowColor = "#fff";
    c.shadowBlur = 4;
    c.beginPath();
    c.arc(6, 6, 2.8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  const retries = data.map.retries;
  const retryCount = Math.max(retries?.fail.length ?? 0, retries?.exit.length ?? 0);
  const retryCounts = Array.from({ length: retryCount }, (_, i) => Math.max(0, (retries?.fail[i] ?? 0) + (retries?.exit[i] ?? 0)));
  const retryPeak = Math.max(1, ...retryCounts);
  const retryUnit = 10 ** Math.floor(Math.log10(retryPeak));
  const retryMax = Math.ceil(retryPeak / retryUnit) * retryUnit;
  const retryPath = retryCounts.map((count, i) => `${i ? "L" : "M"}${(26 + i / (retryCount - 1) * 398).toFixed(2)},${(78 - count / retryMax * 63).toFixed(2)}`).join(" ");
  const retrySvgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  retrySvgPath.setAttribute("d", retryCount >= 2 ? retryPath : "M0 0");
  const retryLength = retrySvgPath.getTotalLength();
  const mapChart = art("map-chart", 430, 100, c => {
    if (retryCount < 2) return;
    c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 1;
    c.font = '600 8.5px "Plus Jakarta Sans"'; c.fillStyle = palette.dim;
    const labelY = baseline(8.5, 600, '\"Plus Jakarta Sans\"', 16);
    const format = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n));
    for (const fraction of [0, 0.5, 1]) {
      const y = 78 - fraction * 63;
      c.beginPath(); c.moveTo(26, y); c.lineTo(424, y); c.stroke();
      c.textAlign = "right"; c.fillText(format(retryMax * fraction), 22, y - 9 + labelY);
    }
    for (const percent of [0, 25, 50, 75, 100]) {
      c.textAlign = percent === 0 ? "left" : percent === 100 ? "right" : "center";
      c.fillText(`${percent}%`, 26 + percent / 100 * 398, 84 + labelY);
    }
  });
  const mapCurve = (progress: number) => art(`map-curve:${progress}`, 430, 100, c => {
    c.strokeStyle = accent; c.lineWidth = 1.05; c.lineCap = "round"; c.lineJoin = "round";
    c.shadowColor = palette.glow; c.shadowBlur = 4;
    c.setLineDash([retryLength, retryLength]); c.lineDashOffset = Math.round(retryLength * (1 - progress));
    c.stroke(new Path2D(retryPath));
  });
  const mapCaption = art("map-caption", 436, 11, c => {
    c.font = 'italic 400 9px "Plus Jakarta Sans"'; c.textAlign = "right"; c.fillStyle = palette.muted;
    c.fillText("Fails and exits by map progress", 436, baseline(9, 400, '\"Plus Jakarta Sans\"', 0));
  });

  const pillTrack = (code: string) => art(`pill:${code}`, 180, 14, c => {
    c.fillStyle = `${overlay}0.85)`;
    roundRect(c, 0, 0, 180, 14, 4);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.12)";
    roundRect(c, 0.5, 0.5, 179, 13, 4);
    c.stroke();
  });
  const fills: Record<string, Sprite> = {
    ar: art("fill-ar", 180, 14, c => { c.fillStyle = "#7ECE75"; roundRect(c, 0, 0, 180, 14, 3); c.fill(); }),
    cs: art("fill-cs", 180, 14, c => { c.fillStyle = "#CF666B"; roundRect(c, 0, 0, 180, 14, 3); c.fill(); }),
    od: art("fill-od", 180, 14, c => { c.fillStyle = "#AF6EF0"; roundRect(c, 0, 0, 180, 14, 3); c.fill(); }),
    hp: art("fill-hp", 180, 14, c => { c.fillStyle = "#667DED"; roundRect(c, 0, 0, 180, 14, 3); c.fill(); }),
  };

  const lens = art("lens", 380, 380, c => {
    c.save();
    c.fillStyle = "#111";
    c.shadowColor = "rgba(0,0,0,0.8)";
    c.shadowBlur = 72;
    c.shadowOffsetY = 16;
    c.beginPath(); c.arc(190, 190, 190, 0, Math.PI * 2); c.fill();
    c.restore();
    c.save();
    c.beginPath();
    c.arc(190, 190, 190, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#111";
    c.fillRect(0, 0, 380, 380);
    const img = images.get(data.map.cover);
    if (img) {
      c.filter = "brightness(0.75) contrast(1.1)";
      c.save();
      c.translate(-28.4, -28.4);
      cover(c, img, 436.8, 436.8, img.width, img.height, 0.5, 0.5);
      c.restore();
      c.filter = "none";
    }
    const dim = c.createRadialGradient(190, 190, 0, 190, 190, 188 * Math.SQRT2);
    dim.addColorStop(0, "rgba(0,0,0,0.15)");
    dim.addColorStop(1, "rgba(0,0,0,0.65)");
    c.fillStyle = dim;
    c.fillRect(0, 0, 380, 380);
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(190, 190, 189, 0, Math.PI * 2);
    c.stroke();
  }, 40);

  const silverGrade = flags.silverGrade && ["S", "SS"].includes(data.score!.rank);
  const gradeColor = silverGrade ? "#edf3fa" : data.score!.rank === "A" ? "#baff9c" : data.score!.rank === "B" ? "#b2e3ff" : data.score!.rank === "C" ? "#dda9f0" : data.score!.rank === "D" ? "#ef9eaa" : "#ffdb79";
  const grade = art("grade", 280, 280, c => {
    c.font = '700 240px Teko';
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = gradeColor;
    const y = 20 + baseline(240, 700, "Teko", 240);
    c.shadowColor = silverGrade ? "rgba(230,237,242,0.6)" : data.score!.rank === "A" ? "rgba(81,207,102,0.6)" : data.score!.rank === "B" ? "rgba(51,154,240,0.6)" : "rgba(226,188,67,0.6)";
    c.shadowBlur = 64;
    c.fillText(data.score!.rank, 140, y);
    c.shadowColor = silverGrade ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.9)";
    c.shadowBlur = 40;
    c.shadowOffsetY = 8;
    c.fillText(data.score!.rank, 140, y);
  });

  const starRibbon = art("star-ribbon", 40, 36, c => {
    c.fillStyle = "#F59F00";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(40, 0);
    c.bezierCurveTo(32, 2, 33, 10, 30, 17);
    c.lineTo(20, 24);
    c.lineTo(10, 17);
    c.bezierCurveTo(7, 10, 8, 2, 0, 0);
    c.fill();
    drawStar(c, 20, 10, 7, "#fff");
  });

  const starValueWidth = widthOf(data.map.sr, 24, 800, '\"Scene Tabular\"') + data.map.sr.length * 0.3;
  const starValue = art("star-value", starValueWidth, 30, c => {
    c.font = '800 24px "Scene Tabular"'; c.letterSpacing = "0.3px";
    c.fillStyle = "#F8D153"; c.shadowColor = "rgba(248,209,83,0.7)"; c.shadowBlur = 32;
    c.fillText(data.map.sr, 0, baseline(24, 800, '\"Scene Tabular\"', 0));
    c.shadowColor = "rgba(0,0,0,0.8)"; c.shadowBlur = 8; c.shadowOffsetY = 4;
    c.fillText(data.map.sr, 0, baseline(24, 800, '\"Scene Tabular\"', 0));
  }, 24);

  const modIcon = (mod: string, size: number, radius: number) => {
    const color = modColor(mod);
    return art(`mod:${mod}:${size}`, size, size, c => {
      c.fillStyle = color.bg;
      roundRect(c, 0, 0, size, size, radius);
      c.fill();
      const img = images.get(modPath(mod));
      if (img) {
        if (color.fg === "dark") c.filter = "brightness(0.15)";
        c.save();
        roundRect(c, 0, 0, size, size, radius);
        c.clip();
        const scale = Math.max(size / img.width, size / img.height);
        c.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
        c.restore();
        c.filter = "none";
      }
    });
  };

  const playRankColor = (rank: string, mods: string[]) => {
    const r = rank.toUpperCase().replace(/H$/, "");
    if (r === "A") return "#51CF66";
    if (r === "B") return "#339AF0";
    if (r === "C") return "#CC5DE8";
    if (r === "D") return "#FF6B6B";
    return mods.some(mod => mod === "HD" || mod === "FL") ? "#edf3fa" : "#ffdb79";
  };

  const skewPaint = (key: string, w: number, h: number, deg: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const rad = deg * Math.PI / 180;
    const extra = Math.ceil(Math.abs(Math.tan(rad)) * h) + 2;
    const sprite = art(key, w + extra * 2, h, c => {
      c.translate(extra + w / 2, h / 2);
      c.transform(1, 0, Math.tan(rad), 1, 0, 0);
      c.translate(-w / 2, -h / 2);
      paint(c, w, h);
    });
    return { sprite, extra, w, h };
  };

  const scoreLabel = skewPaint("score-label", widthOf("Score", 12, 500) + 12, 16, -14, (c, w, h) => {
    c.fillStyle = palette.plateTop;
    roundRect(c, 0, 0, w, h, 3);
    c.fill();
    c.font = '500 12px "Plus Jakarta Sans"';
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("Score", w / 2, h / 2);
  });

  const hitBoxes = [
    { color: "#61C97D", value: String(data.score!.count300), padLeft: 48 },
    { color: "#BAD750", value: String(data.score!.count100), padLeft: 12 },
    ...(data.score!.count50 > 0 ? [{ color: "#E8C547", value: String(data.score!.count50), padLeft: 12 }] : []),
    ...(data.score!.sliderBreaks ? [{ color: "#8B8F98", value: String(data.score!.sliderBreaks), padLeft: 12 }] : []),
    { color: "#DE6984", value: String(data.score!.countMiss), padLeft: 12 },
  ];
  const hitWidths = hitBoxes.map(box => box.padLeft + widthOf(box.value, 19, 500, '"Scene Tabular"') + 12);
  const hitsW = hitWidths.reduce((sum, w) => sum + w, 0);
  const hitsStrip = skewPaint("hits-strip", hitsW, 29, -18, (c, w, h) => {
    roundRect(c, 0, 0, w, h, 3);
    c.clip();
    let x = 0;
    const rad = 18 * Math.PI / 180;
    hitBoxes.forEach((box, i) => {
      const bw = hitWidths[i]!;
      c.fillStyle = box.color;
      c.fillRect(x, 0, bw, h);
      c.save();
      c.translate(x + box.padLeft + (bw - box.padLeft - 12) / 2, h / 2);
      c.transform(1, 0, Math.tan(rad), 1, 0, 0);
      c.font = '500 19px "Scene Tabular"';
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.textBaseline = "alphabetic";
      c.fillText(box.value, 0, baseline(19, 500, '"Plus Jakarta Sans"', 19) - 19 / 2);
      c.restore();
      x += bw;
    });
  });

  const ppText = data.score!.pp.trim().toUpperCase().endsWith("PP") ? data.score!.pp.toUpperCase() : `${data.score!.pp}PP`;
  const ppW = Math.ceil(widthOf(ppText, 22, 500) + ppText.length * 0.4 + 36);
  const ppBadge = art("pp-badge", ppW, 32, c => {
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, palette.plateTop);
    g.addColorStop(1, palette.plateBottom);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(ppW - 12, 0);
    c.lineTo(ppW, 16);
    c.lineTo(ppW - 12, 32);
    c.lineTo(0, 32);
    c.lineTo(9, 16);
    c.closePath();
    c.fill();
  });

  const playerCard = art("player-card", 210, 38, c => {
    c.save();
    c.shadowColor = "rgba(0,0,0,0.5)";
    c.shadowBlur = 14;
    c.shadowOffsetY = 4;
    const g = c.createLinearGradient(0, 0, 0, 38);
    g.addColorStop(0, palette.plateTop);
    g.addColorStop(1, palette.plateBottom);
    c.fillStyle = g;
    roundRect(c, 0, 0, 210, 38, 8);
    c.fill();
    c.restore();
  }, 10);

  let frame: HudFrame;
  type Draw = (s: Sprite, x: number, y: number, w?: number, h?: number, color?: HudSprite["color"], clip?: HudSprite["clip"]) => void;
  const sprite: Draw = (s, x, y, w = s.w / 2 - s.pad * 2, h = s.h / 2 - s.pad * 2, color = rgb("#ffffff"), clip) => {
    if (w <= 0 || h <= 0 || color[3] <= 0) return;
    const px = s.pad * w / (s.w / 2 - s.pad * 2), py = s.pad * h / (s.h / 2 - s.pad * 2);
    frame.sprites.push({ asset: s.id, x: (x - px) * S, y: (y - py) * S, w: (w + px * 2) * S, h: (h + py * 2) * S, color, clip: clip ? [clip[0] * S, clip[1] * S, clip[2] * S, clip[3] * S] : undefined });
  };
  let draw: Draw = sprite;
  const text = (value: string, x: number, y: number, size: number, color: string, alpha = 1, weight = 700, align: "left" | "right" | "center" = "left", shadow = true, style: { lineHeight?: number; spacing?: number; tabular?: boolean; font?: string } = {}) => {
    const { lineHeight = 0, spacing = 0, tabular = false } = style;
    if (!value || alpha <= 0) return;
    const font = style.font ?? (tabular ? '"Scene Tabular"' : '"Plus Jakarta Sans"');
    const s = label(value, size, color, weight, shadow, font, lineHeight, spacing);
    const tw = widthOf(value, size, weight, font) + spacing * value.length;
    const at = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x;
    draw(s, at - 4, y - 4, undefined, undefined, rgb("#ffffff", alpha));
  };

  function drawIntro(t: number): HudFrame {
    frame = { sprites: [], ticks: [] };
    const m = introMotion(t, data, spline);
    const ox = widgetX + m.widget.x, oy = widgetY + m.widget.y;
    const a = m.widget.opacity;
    if (a <= 0) return frame;
    const close = t >= 4.70;
    const layers: { s: Sprite; x: number; y: number; w?: number; h?: number; color?: HudSprite["color"]; clip?: HudSprite["clip"] }[] = [];
    let cardClip: HudSprite["clip"] | undefined;
    const add: Draw = (s, x, y, w, h, color, clip) => {
      if (cardClip) {
        if (clip) {
          const left = Math.max(clip[0], cardClip[0]), top = Math.max(clip[1], cardClip[1]);
          clip = [left, top, Math.max(0, Math.min(clip[0] + clip[2], cardClip[0] + cardClip[2]) - left), Math.max(0, Math.min(clip[1] + clip[3], cardClip[1] + cardClip[3]) - top)];
        } else clip = cardClip;
      }
      layers.push({ s, x, y, w, h, color, clip });
    };
    draw = add;

    if (m.bottomCard.opacity > 0 && (flags.profileStats || t >= 2.7)) {
      const clip: HudSprite["clip"] | undefined = m.bottomCard.clipBottom > 0
        ? [ox, oy + topH + gap + m.bottomCard.y, widgetW, bottomH * (1 - m.bottomCard.clipBottom / 100)]
        : undefined;
      cardClip = clip;
      add(bottomChrome, ox, oy + topH + gap + m.bottomCard.y, widgetW, bottomH, rgb("#ffffff", m.bottomCard.opacity * a), clip);
      if (m.bottomPlayer.opacity > 0 && flags.history) {
        const bx = ox + 17, by = oy + topH + gap + 17 + m.bottomCard.y;
        const count = String(data.player.badgeCount);
        const stackW = Math.max(widthOf(count, 11), widthOf("badges", 7.5));
        if (data.player.badges.length) text(count, bx + stackW / 2, by + 0.75, 11, accent, m.bottomPlayer.opacity * a, 700, "center");
        if (data.player.badges.length) text("badges", bx + stackW / 2, by + 12.25, 7.5, "rgba(255,255,255,0.45)", m.bottomPlayer.opacity * a, 700, "center", false);
        let badgeX = bx + stackW + 8;
        data.player.badges.slice(0, 5).forEach((badge, i) => {
          const img = images.get(badge.url);
          if (!img) return;
          const b = art(`badge:${i}`, 37, 19, c => {
            roundRect(c, 0, 0, 37, 19, 3);
            c.clip();
            const scale = Math.min(35 / img.width, 17 / img.height);
            c.drawImage(img, (37 - img.width * scale) / 2, (19 - img.height * scale) / 2, img.width * scale, img.height * scale);
            c.strokeStyle = "rgba(255,255,255,0.18)";
            c.lineWidth = 1;
            roundRect(c, 0.5, 0.5, 36, 18, 3);
            c.stroke();
          });
          add(b, badgeX, by + 2.5, 37, 19, rgb("#ffffff", m.bottomPlayer.opacity * a));
          badgeX += 41;
        });
        if (data.player.badges.length > 5) {
          const more = `+${data.player.badges.length - 5} more`;
          const mw = widthOf(more, 9) + 12;
          const pill = art(`more:${more}`, mw, 18.6, c => {
            c.strokeStyle = "rgba(255,255,255,0.18)";
            c.lineWidth = 1;
            roundRect(c, 0.5, 0.5, mw - 1, 17.6, 3);
            c.stroke();
          });
          add(pill, badgeX, by + 2.7, mw, 18.6, rgb("#ffffff", m.bottomPlayer.opacity * a));
          text(more, badgeX + 6, by + 5.7, 9, palette.muted, m.bottomPlayer.opacity * a);
        }
        text("Playcount over time", ox + widgetW - 17, by + 0.5, 9.5, palette.muted, m.bottomPlayer.opacity * a, 600, "right", false);
        text(`peak: ${data.player.peakCount} (${data.player.peakMonth})`, ox + widgetW - 17, by + 12.5, 8.5, palette.dim, m.bottomPlayer.opacity * a, 600, "right", false);
        const chartScale = 436 / 430;
        const cx = ox + 17, cy = oy + topH + gap + 47 + (149 - 140 * chartScale) / 2 + m.bottomCard.y;
        const chartA = m.bottomPlayer.opacity * a;
        add(chart, cx, cy, 436, 140 * chartScale, rgb("#ffffff", chartA));
        if (m.peakProgress > 0) {
          add(peakLine, cx + 20 * chartScale, cy + (spline.peakY - 1) * chartScale, 405 * chartScale, 2 * chartScale, rgb("#ffffff", m.peakProgress * chartA));
        }
        if (m.chartProgress > 0) add(curve(m.chartProgress), cx, cy, 436, 140 * chartScale, rgb("#ffffff", chartA));
        add(years, cx, cy, 436, 140 * chartScale, rgb("#ffffff", m.yearProgress * chartA));
        if (m.peakProgress > 0) {
          const size = 12 * chartScale * (0.7 + 0.3 * m.peakProgress);
          add(peakDot, cx + spline.peakX * chartScale - size / 2, cy + spline.peakY * chartScale - size / 2, size, size, rgb("#ffffff", m.peakProgress * chartA));
        }
        const barY = oy + topH + gap + bottomH - 26 + m.bottomCard.y;
        drawIconRow(ox + 17, barY, m.hours, m.playcount, m.bottomPlayer.opacity * a, add);
      }
      if (!flags.history && flags.profileStats && m.bottomPlayer.opacity > 0) {
        drawIconRow(ox + 17, oy + topH + gap + (bottomH - 18) / 2 + 2 + m.bottomCard.y, m.hours, m.playcount, m.bottomPlayer.opacity * a, add, 14);
      }
      if (m.bottomMap.opacity > 0 && flags.mapStats) {
        const mx = ox + 17, my = oy + topH + gap + 26 + m.bottomCard.y;
        ([["AR", "ar", data.map.arMs, data.map.ar.toFixed(2), 11], ["CS", "", "", data.map.cs.toFixed(2), 10], ["OD", "od", data.map.odMs, data.map.od.toFixed(2), 11], ["HP", "", "", data.map.hp.toFixed(2), 10]] as const).forEach((row, i) => {
          const x = mx + (i % 2) * 225, y = my + Math.floor(i / 2) * 20;
          const key = row[0].toLowerCase() as "ar" | "cs" | "od" | "hp";
          text(row[0], x, y + 1, 10, "rgba(255,255,255,0.85)", m.bottomMap.opacity * a, 700, "left", false, { spacing: 0.5 });
          add(pillTrack(key), x + 24, y, 187, 14, rgb("#ffffff", m.bottomMap.opacity * a));
          const fillW = 185 * m.fills[key];
          if (fillW > 0) add(fills[key]!, x + 25, y + 1, fillW, 12, rgb("#ffffff", m.bottomMap.opacity * a), [x + 25, y + 1, fillW, 12]);
          if (row[2]) text(row[2], x + 31, y + 1.5, 9, "#fff", m.bottomMap.opacity * a, 700, "left", true, { spacing: 0.2, tabular: true });
          text(row[3], x + 204, y + 1.5, 9, "#fff", m.bottomMap.opacity * a, 700, "right", true, { spacing: 0.2, tabular: true });
        });
        if (flags.onlineMap && retryCount >= 2) {
          const scale = 436 / 430, y = my + 56.5 + (108 - 100 * scale) / 2;
          add(mapCaption, mx, my + 45.5, 436, 11, rgb("#ffffff", m.bottomMap.opacity * a));
          add(mapChart, mx, y, 436, 100 * scale, rgb("#ffffff", m.bottomMap.opacity * a));
          if (m.mapPath > 0) add(mapCurve(m.mapPath), mx, y, 436, 100 * scale, rgb("#ffffff", m.bottomMap.opacity * a));
        }
        if (flags.onlineMap && Math.max(data.map.retries?.fail.length ?? 0, data.map.retries?.exit.length ?? 0) < 2) {
          text("Map retry data unavailable", ox + widgetW / 2, my + 95, 11, "#fff", m.bottomMap.opacity * a * 0.5, 400, "center", false);
        }
        const barY = oy + topH + gap + bottomH - 33 + m.bottomCard.y;
        const barA = m.bottomMap.opacity * a;
        if (flags.onlineMap) {
          const heartIcon = art("fav-heart", 12, 12, c => drawHeart(c, 0, 0, 12, accent));
          add(heartIcon, ox + 17, barY + 4, 12, 12, rgb("#ffffff", barA));
          text("Favs:", ox + 33, barY + 3.5, 11, "rgba(255,255,255,0.85)", barA, 600, "left", false);
          const favX = ox + 33 + widthOf("Favs:", 11, 600) + 4;
          text(comma(m.favs), favX, barY + 3.5, 11, "rgba(255,255,255,0.85)", barA, 600, "left", false, { tabular: true });
          const playX = favX + widthOf(comma(m.favs), 11, 600, '\"Scene Tabular\"') + 14;
          const playSmall = art("play-icon-sm", 12, 12, c => drawPlay(c, 0, 0, 12, accent));
          add(playSmall, playX, barY + 4, 12, 12, rgb("#ffffff", barA));
          text("Plays:", playX + 16, barY + 3.5, 11, "rgba(255,255,255,0.85)", barA, 600, "left", false);
          text(comma(m.plays), playX + 16 + widthOf("Plays:", 11, 600) + 4, barY + 3.5, 11, "rgba(255,255,255,0.85)", barA, 600, "left", false, { tabular: true });
        }
        const mapperW = Math.max(widthOf(data.map.mapper, 10.5), widthOf("mapper", 8));
        const mapperX = flags.onlineMap ? ox + widgetW - 17 - mapperW : ox + 17;
        if (flags.mapperAvatar) add(mapper, mapperX - 26, barY, 20, 20, rgb("#ffffff", barA));
        text(data.map.mapper, mapperX, barY + 0.25, 10.5, "#fff", barA, 700, "left", false, { lineHeight: 10.5 });
        text("mapper", mapperX, barY + 11.75, 8, palette.muted, barA, 600, "left", false, { lineHeight: 8 });
      }
    }
    if (m.bottomCard.clipBottom > 0 && layers.length) {
      const cardY = oy + topH + gap + m.bottomCard.y;
      const composed = composeLayers(layers, ox, cardY, widgetW, bottomH);
      const c = composed.getContext("2d")!;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "destination-in";
      roundRect(c, 0, 0, widgetW * 2, bottomH * (1 - m.bottomCard.clipBottom / 100) * 2, 28);
      c.fill();
      layers.splice(0, layers.length, { s: save(`reveal:${t}`, composed), x: ox, y: cardY });
    }
    cardClip = undefined;
    if (m.topCard.opacity > 0) {
      const chrome = m.showMap ? topMapChrome : topPlayerChrome;
      add(chrome, ox, oy + m.topCard.y, widgetW, topH, rgb("#ffffff", m.topCard.opacity * a));
      const hy = oy + m.topCard.y;
      if (m.topPlayer.opacity > 0) {
        add(avatar, ox + 15 + m.playerHeaderLeft, hy + 12, 38, 38, rgb("#ffffff", m.topPlayer.opacity * a));
        text(data.player.username, ox + 63 + m.playerHeaderLeft, hy + (flag || data.player.crank ? 14 : 21), 15.5, "#fff", m.topPlayer.opacity * a);
        if (data.player.isSupporter) add(heart, ox + 63 + widthOf(data.player.username, 15.5) + 5 + m.playerHeaderLeft, hy + 17.5, 21, 12, rgb("#ffffff", m.topPlayer.opacity * a));
        if (flag) add(flag, ox + 63 + m.playerHeaderLeft, hy + 34, flagWidth, 14, rgb("#ffffff", m.topPlayer.opacity * a));
        text(data.player.crank, ox + 63 + flagWidth + 4 + m.playerHeaderLeft, hy + 34, 10.5, palette.muted, m.topPlayer.opacity * a, 600);
        text(data.player.grank, ox + widgetW - 15 + m.playerHeaderRight, hy + 12.5, 21, "#fff", m.topPlayer.opacity * a, 800, "right", true, { lineHeight: 21 });
        text(data.player.pp, ox + widgetW - 15 + m.playerHeaderRight, hy + 34.5, 11.5, "rgba(255,255,255,0.85)", m.topPlayer.opacity * a, 600, "right");
      }
      if (m.topMap.opacity > 0) {
        add(coverThumb, ox + 15, hy + 12, 38, 38, rgb("#ffffff", m.topMap.opacity * a));
        text(data.map.title, ox + 73, hy + 15.5, 13.5, "#fff", m.topMap.opacity * a, 700, "left", true, { spacing: -0.1 });
        text(data.map.artist, ox + 73, hy + 33.5, 10.5, palette.muted, m.topMap.opacity * a, 600, "left", false, { spacing: 0.1 });
        if (flags.onlineMap) add(status, ox + widgetW - 42, hy + 17 + m.chevronY, 28, 28, rgb("#ffffff", m.topMap.opacity * a));
      }
    }
    if (m.starFooter.opacity > 0) {
      const fy = oy + topH + gap + bottomH + gap - 2 + m.starFooter.y;
      const star = art("footer-star", 15, 15, c => {
        c.shadowColor = "rgba(255,183,3,0.9)"; c.shadowBlur = 16;
        drawStar(c, 7.5, 7.5, 7.5);
      }, 8);
      const values = [data.map.sr, "•", data.map.bpm];
      const widths = values.map(value => widthOf(value, 14, 700, '\"Scene Tabular\"') - value.length * 0.2);
      let x = ox + (widgetW - 15 - 18 - widths.reduce((a, b) => a + b, 0)) / 2;
      const starSize = 15 * m.starScale;
      add(star, x + (15 - starSize) / 2, fy + (18 - starSize) / 2, starSize, starSize, rgb("#ffffff", m.starFooter.opacity * a));
      x += 21;
      values.forEach((value, i) => {
        text(value, x, fy, 14, "#fff", m.starFooter.opacity * a, 700, "left", true, { spacing: -0.2, tabular: true });
        x += widths[i]! + 6;
      });
    }
    m.wipes.forEach((wipeState, i) => {
      if (!wipeState.visible) return;
      const cardH = i === 0 ? topH : bottomH;
      const h = (cardH - 2) * 1.6;
      // The wipe belongs inside the card's padding box, below its border.
      const clipped = art(`wipe:${i}:${t}`, widgetW, cardH, c => {
        roundRect(c, 1, 1, widgetW - 2, cardH - 2, 13);
        c.clip();
        c.drawImage(wipe(h).canvas!, 1, 1 + h * wipeState.yPercent / 100, widgetW - 2, h);
      });
      add(clipped, ox, i === 0 ? oy : oy + topH + gap, widgetW, cardH, rgb("#ffffff", a));
    });

    draw = sprite;
    if (close) {
      const edge = 24;
      const composed = composeLayers(layers, ox - edge, oy - edge, widgetW + edge * 2, widgetH + 40 + edge * 2);
      const warped = warpClose(composed, t);
      const s = save(`close:${t.toFixed(4)}`, warped.canvas);
      sprite(s, warped.x, warped.y);
      return frame;
    }
    for (const item of layers) sprite(item.s, item.x, item.y, item.w, item.h, item.color, item.clip);
    return frame;
  }

  function drawIconRow(x: number, y: number, hours: number, playcount: number, alpha: number, add: (s: Sprite, x: number, y: number, w?: number, h?: number, color?: HudSprite["color"]) => void, size = 11) {
    const hourIcon = art("hour-icon", 12, 12, c => drawHourglass(c, 0, 0, 12, accent));
    add(hourIcon, x, y + (size === 11 ? 0.5 : 3), 12, 12, rgb("#ffffff", alpha));
    const hoursText = comma(hours);
    text(hoursText, x + 17, y, size, "rgba(255,255,255,0.85)", alpha, 600, "left", false, { tabular: true });
    const hoursEnd = x + 17 + widthOf(hoursText, size, 600, '\"Scene Tabular\"') + 5;
    text("hours", hoursEnd, y, size, "rgba(255,255,255,0.85)", alpha, 600, "left", false);
    const playX = hoursEnd + widthOf("hours", size, 600) + 18;
    const play = art("play-icon", 12, 12, c => drawPlay(c, 0, 0, 12, accent));
    add(play, playX, y + (size === 11 ? 0.5 : 3), 12, 12, rgb("#ffffff", alpha));
    text("Playcount:", playX + 17, y, size, "rgba(255,255,255,0.85)", alpha, 600, "left", false);
    text(comma(playcount), playX + 17 + widthOf("Playcount:", size, 600) + 5, y, size, "rgba(255,255,255,0.85)", alpha, 600, "left", false, { tabular: true });
  }

  function composeLayers(layers: { s: Sprite; x: number; y: number; w?: number; h?: number; color?: HudSprite["color"]; clip?: HudSprite["clip"] }[], ox: number, oy: number, w: number, h: number) {
    const c = canvas(w * 2, h * 2);
    const x = c.getContext("2d")!;
    x.scale(2, 2);
    for (const item of layers) {
      const img = item.s.canvas;
      if (!img) continue;
      x.save();
      x.globalAlpha = item.color?.[3] ?? 1;
      if (item.clip) {
        x.beginPath();
        x.rect(item.clip[0] - ox, item.clip[1] - oy, item.clip[2], item.clip[3]);
        x.clip();
      }
      const dw = item.w ?? item.s.w / 2 - item.s.pad * 2;
      const dh = item.h ?? item.s.h / 2 - item.s.pad * 2;
      const px = item.s.pad * dw / (item.s.w / 2 - item.s.pad * 2), py = item.s.pad * dh / (item.s.h / 2 - item.s.pad * 2);
      x.drawImage(img, item.x - ox - px, item.y - oy - py, dw + px * 2, dh + py * 2);
      x.restore();
    }
    return c;
  }

  function warpClose(src: HTMLCanvasElement, t: number) {
    const { pClose, pull, scaleX, scaleY } = widgetCloseScale(t);
    const perspective = (distance: number) => {
      const matrix = new DOMMatrix();
      matrix.m34 = -1 / distance;
      return matrix;
    };
    // CSS applies scale before rotation, then the widget and stage perspectives.
    // The source includes 24px of shadow padding around the widget.
    const matrix = new DOMMatrix().translate(480, 270)
      .multiply(perspective(1200)).translate(-480, -270)
      .translate(widgetX + widgetW / 2, widgetY + 760 * pull)
      .multiply(perspective(1200 - 900 * pClose))
      .rotateAxisAngle(1, 0, 0, -65 * Math.sin(pClose * Math.PI / 2))
      .scale(scaleX, scaleY).translate(-widgetW / 2 - 24, -24);
    const project = (x: number, y: number) => {
      const point = matrix.transformPoint({ x, y });
      return { x: point.x / point.w, y: point.y / point.w };
    };
    const sw = src.width / 2, sh = src.height / 2;
    const corners = [project(0, 0), project(sw, 0), project(0, sh), project(sw, sh)];
    const x = Math.floor(Math.min(...corners.map(p => p.x)) * 2) / 2;
    const y = Math.floor(Math.min(...corners.map(p => p.y)) * 2) / 2;
    const right = Math.ceil(Math.max(...corners.map(p => p.x)) * 2) / 2;
    const bottom = Math.min(540, Math.ceil(Math.max(...corners.map(p => p.y)) * 2) / 2);
    const out = canvas((right - x) * 2, Math.max(1, (bottom - y) * 2));
    const c = out.getContext("2d")!;
    // Inverse-map destination rows to avoid gaps and overlapping source strips.
    for (let row = 0; row < out.height; row++) {
      const targetY = y + (row + 0.5) / 2;
      const sourceY = (matrix.m42 - targetY * matrix.m44) / (targetY * matrix.m24 - matrix.m22);
      if (sourceY < 0 || sourceY >= sh) continue;
      const left = project(0, sourceY).x, right = project(sw, sourceY).x;
      c.drawImage(src, 0, sourceY * 2 - 0.5, src.width, 1, (left - x) * 2, row, (right - left) * 2, 1);
    }
    return { canvas: out, x, y };
  }

  function drawOutro(t: number): HudFrame {
    frame = { sprites: [], ticks: [] };
    draw = sprite;
    const m = outroMotion(t);
    const a = m.container;
    if (a <= 0) return frame;
    const leftA = m.leftFlyout.opacity * a;
    const leftX = m.leftFlyout.x;
    const rightX = m.rightFlyout.x;
    const emerge = (index: number) => -38 * (1 - m.rightItems[index]!);

    sprite(playerCard, 180 + leftX, 128, 210, 38, rgb("#ffffff", leftA));
    sprite(outroAvatar, 192 + leftX, 133, 28, 28, rgb("#ffffff", leftA));
    const playerNameY = 128 + (38 - 14.75 - (flag ? 14 : data.player.crank ? 12.1 : 0)) / 2;
    text(data.player.username, 228 + leftX, playerNameY, 12.5, "#fff", leftA, 700, "left", true, { lineHeight: 13.75 });
    text(data.player.grank, 230 + leftX + widthOf(`${data.player.username} `, 12.5), playerNameY, 12.5, "#fff", leftA * 0.92, 600, "left", true, { lineHeight: 13.75 });
    if (flag) sprite(flag, 228 + leftX, playerNameY + 14.75, flagWidth, 14, rgb("#ffffff", leftA));
    text(data.player.crank, 228 + (flag ? flagWidth + 4 : 0) + leftX, playerNameY + 14.75 + (flag ? .95 : 0), 11, "rgba(255,255,255,0.9)", leftA * 0.95, 600, "left", true, { lineHeight: 12.1 });

    const rows = [[190, 96], [228, 87], [266, 82], [304, 84], [342, 92], [380, 109]] as const;
    (data.topScores ?? []).forEach((play, i) => {
      const [top, left] = rows[i] ?? rows[5];
      const playCover = art(`play:${i}`, 44, 27, c => {
        roundRect(c, 0, 0, 44, 27, 4); c.clip();
        const img = images.get(play.cover ?? data.map.cover);
        if (img) { c.save(); c.translate(1, 1); cover(c, img, 42, 25, img.width, img.height, 0.5, 0.5); c.restore(); }
        const dim = c.createLinearGradient(0, 0, 44, 0);
        dim.addColorStop(0, "rgba(0,0,0,0.75)"); dim.addColorStop(0.45, "rgba(0,0,0,0.4)"); dim.addColorStop(1, "rgba(0,0,0,0.1)");
        c.fillStyle = dim; c.fillRect(0, 0, 44, 27);
        c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 1;
        roundRect(c, 0.5, 0.5, 43, 26, 4); c.stroke();
      });
      sprite(playCover, left + 2 + leftX, top + 2.5, 44, 27, rgb("#ffffff", leftA));
      const rank = play.rank.toUpperCase().replace(/H$/, "");
      text(rank, left + 8 + leftX, top + 8.5, 15, playRankColor(rank, play.mods), leftA, 800, "left", true, { lineHeight: 15, font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' });
      const chars = Array.from(play.title);
      let title = chars.length > 18 ? `${chars.slice(0, 18).join("").trimEnd()}...` : play.title;
      if (widthOf(title, 11, 600) + title.length * 0.1 > 144) {
        while (title && widthOf(`${title}…`, 11, 600) + (title.length + 1) * 0.1 > 144) title = title.slice(0, -1);
        title += "…";
      }
      text(title, left + 54 + leftX, top + 1, 11, "#fff", leftA, 600, "left", true, { spacing: 0.1 });
      play.mods.forEach((mod, mi) => sprite(modIcon(mod, 14, 2.3), left + 54 + mi * 15.5 + leftX, top + 16.5, 14, 14, rgb("#ffffff", leftA)));
      text(play.timeAgo, left + 54 + Math.max(0, play.mods.length * 15.5 - 1.5) + 6 + leftX, top + 17.5, 10, "rgba(255,255,255,0.65)", leftA, 600);
      text(play.pp, left + 196 + leftX, top + 16, 12, "#fff", leftA, 700, "right", true, { tabular: true });
    });

    const itemX = (index: number, base: number) => base + rightX + emerge(index);
    const itemA = (index: number) => m.rightItems[index]! * a;
    if (itemA(0) > 0) {
      sprite(scoreLabel.sprite, itemX(0, 658) - scoreLabel.extra, 184, undefined, undefined, rgb("#ffffff", itemA(0)));
      text(formatScoreNumber(data.score!.totalScore), itemX(0, 658), 203, 24, "#fff", itemA(0), 500, "left", true, { lineHeight: 24, spacing: 0.5, tabular: true });
    }
    if (itemA(1) > 0) text(`${formatScoreNumber(data.score!.combo)}/${formatScoreNumber(data.score!.maxCombo)}x`, itemX(1, 672), 238, 22, "#a6a6a2", itemA(1), 400, "left", true, { lineHeight: 22, spacing: 0.3, tabular: true });
    if (itemA(2) > 0) {
      sprite(ppBadge, itemX(2, 672), 276, ppW, 32, rgb("#ffffff", itemA(2)));
      text(ppText, itemX(2, 672) + ppW / 2, 281, 22, "#fff", itemA(2), 500, "center", true, { lineHeight: 22, spacing: 0.4 });
    }
    if (itemA(3) > 0) text(data.score!.accuracy, itemX(3, 672), 324, 22, "#a6a6a2", itemA(3), 400, "left", true, { lineHeight: 22, spacing: 0.3, tabular: true });
    if (itemA(4) > 0) sprite(hitsStrip.sprite, itemX(4, 624) - hitsStrip.extra, 358, undefined, undefined, rgb("#ffffff", itemA(4)));

    const ls = m.lens.scale;
    const lensA = m.lens.opacity * a;
    const cx = 480, cy = 290 + m.lens.y;
    sprite(lens, cx - 190 * ls, cy - 190 * ls, 380 * ls, 380 * ls, rgb("#ffffff", lensA));
    const gs = ls * m.grade.scale;
    sprite(grade, cx - 140 * gs, cy - 140 * gs + m.grade.y * ls, 280 * gs, 280 * gs, rgb("#ffffff", m.grade.opacity * lensA));
    const mods = data.score?.mods ?? [];
    const modSize = 32 * ls, modGap = 2 * ls;
    let mx = cx - (mods.length * modSize + Math.max(0, mods.length - 1) * modGap) / 2;
    mods.forEach(mod => {
      sprite(modIcon(mod, 32, 5.3), mx, cy + 140 * ls, modSize, modSize, rgb("#ffffff", lensA));
      mx += modSize + modGap;
    });

    const barY = 28.5 + m.topBar.y;
    const barA = m.topBar.opacity * a;
    const srW = Math.max(40, widthOf(data.map.sr, 24, 800, '"Scene Tabular"') + data.map.sr.length * 0.3);
    const groupW = 214;
    const totalW = groupW + 28 + srW + 28 + groupW;
    let gx = (960 - totalW) / 2;
    const gauge = (x: number, fill: string, amount: number, name: string, value: string) => {
      const track = art(`gauge:${fill}`, 96, 6, c => {
        c.fillStyle = "rgba(255,255,255,0.14)";
        roundRect(c, 0, 0, 96, 6, 3);
        c.fill();
        c.fillStyle = fill;
        roundRect(c, 0, 0, 96 * amount, 6, 3);
        c.fill();
      });
      sprite(track, x, barY, 96, 6, rgb("#ffffff", barA));
      text(`${name}:`, x, barY + 10, 13, "rgba(255,255,255,0.85)", barA, 600, "left", true, { spacing: 0.2 });
      text(value, x + 96, barY + 10, 13.5, "#fff", barA, 700, "right", true, { spacing: 0.2, tabular: true });
    };
    gauge(gx, "#FA5252", Math.min(1, data.map.cs / 10), "CS", data.map.cs.toFixed(2));
    gauge(gx + 118, "#40C057", Math.min(1, data.map.ar / 11), "AR", data.map.ar.toFixed(2));
    const starX = gx + groupW + 28 + (srW - 40) / 2;
    sprite(starRibbon, starX, m.topBar.y, 40, 36, rgb("#ffffff", barA));
    sprite(starValue, gx + groupW + 28 + (srW - starValueWidth) / 2, 26 + m.topBar.y, undefined, undefined, rgb("#ffffff", barA));
    gx += groupW + 28 + srW + 28;
    gauge(gx, "#B197FC", Math.min(1, data.map.od / 11), "OD", data.map.od.toFixed(2));
    gauge(gx + 118, "#748FFC", Math.min(1, data.map.hp / 10), "HP", data.map.hp.toFixed(2));

    if (data.score?.playedAtAgo) text(data.score.playedAtAgo, 480, 509, 12, "rgba(255,255,255,0.6)", m.bottomTime * a, 600, "center", true, { spacing: 0.3 });
    return frame;
  }

  const fps = options.fps;
  return {
    batch(kind: "intro" | "outro", start: number, count: number): HudBatch {
      const frames = Array.from({ length: count }, (_, i) => kind === "intro" ? drawIntro((start + i) / fps) : drawOutro((start + i) / fps));
      // Each scene file is self-contained, including sprites cached by the other scene.
      const required = new Set(frames.flatMap(frame => frame.sprites.map(sprite => sprite.asset)));
      const fresh = [...required].filter(id => !sentAssets[kind].has(id)).map(id => assets.get(id)!);
      fresh.forEach(asset => sentAssets[kind].add(asset.id));
      return { frames, assets: fresh };
    },
  };
}

Object.assign(window, { createNativeScenes });
