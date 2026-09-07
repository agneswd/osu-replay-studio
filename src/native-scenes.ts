import { normalizeOverlayAccent, type RenderOptions, type Timeline } from "../core/types.js";
import type { HudBatch, HudFrame, HudSprite } from "../core/native-hud.js";
import { overlayData, sceneFlags } from "./score-scenes/data.js";
import { introMotion, outroMotion, widgetCloseScale } from "./score-scenes/widgets/motion.js";
import { buildPlaycountSpline } from "./score-scenes/widgets/spline.js";
import { scenePalette } from "./score-scenes/widgets/themes.js";
import { modColor } from "./mod-badges.js";
const modPath = (mod: string) => {
  const name = { EZ: "easy", NF: "no-fail", HT: "half-time", HR: "hard-rock", SD: "sudden-death", PF: "perfect", DT: "double-time", NC: "nightcore", HD: "hidden", FL: "flashlight", RX: "relax", AP: "autopilot", SO: "spun-out", MR: "mirror", FI: "fade-in", TD: "touch-device", CL: "classic", V2: "score-v2", DA: "difficulty-adjust", AS: "adaptive-speed", CS: "constant-speed" }[mod];
  return name ? `../shared/assets/mods/mod-${name}.svg` : "";
};

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

function drawHeart(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill = "#fff") {
  c.save();
  c.translate(x, y);
  c.scale(s / 24, s / 24);
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(12, 21);
  c.bezierCurveTo(10, 19.2, 2.5, 13.4, 2.5, 8.5);
  c.bezierCurveTo(2.5, 5.4, 4.9, 3, 8, 3);
  c.bezierCurveTo(9.7, 3, 11.2, 3.8, 12, 5);
  c.bezierCurveTo(12.8, 3.8, 14.3, 3, 16, 3);
  c.bezierCurveTo(19.1, 3, 21.5, 5.4, 21.5, 8.5);
  c.bezierCurveTo(21.5, 13.4, 14, 19.2, 12, 21);
  c.fill();
  c.restore();
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill = "#FFB703") {
  c.save();
  c.translate(x, y);
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const b = a + Math.PI / 5;
    c.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    c.lineTo(Math.cos(b) * s * 0.4, Math.sin(b) * s * 0.4);
  }
  c.closePath();
  c.fill();
  c.restore();
}

function drawPlay(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + s, y + s / 2);
  c.lineTo(x, y + s);
  c.closePath();
  c.fill();
}

function drawHourglass(c: CanvasRenderingContext2D, x: number, y: number, s: number, stroke: string) {
  c.strokeStyle = stroke;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + s, y);
  c.lineTo(x, y + s);
  c.lineTo(x + s, y + s);
  c.closePath();
  c.stroke();
}

function chevrons(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const oy of [-4, 4]) {
    c.beginPath();
    c.moveTo(x - 7, y + oy + 6);
    c.lineTo(x, y + oy);
    c.lineTo(x + 7, y + oy + 6);
    c.stroke();
  }
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
  ]);
  await document.fonts.ready;
  const data = overlayData(timeline);
  const flags = sceneFlags(timeline);
  const spline = buildPlaycountSpline(data.player.monthlyPlaycounts);
  const accent = normalizeOverlayAccent(options.overlayAccent);
  const palette = scenePalette(accent);
  const S = 2;
  let assets: HudBatch["assets"] = [];
  let nextId = 0;
  const cache = new Map<string, Sprite>();
  const save = (key: string, c: HTMLCanvasElement, pad = 0): Sprite => {
    const result = { id: nextId++, w: c.width, h: c.height, pad, canvas: c };
    cache.set(key, result);
    assets.push({ id: result.id, png: c.toDataURL("image/png").split(",")[1] });
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
  const label = (value: string, size: number, color: string, weight = 700, shadow = true, font = '"Plus Jakarta Sans"') =>
    art(`label:${font}:${weight}:${size}:${color}:${shadow}:${value}`, widthOf(value, size, weight, font) + 8, size * 1.35 + 8, c => {
      c.font = `${weight} ${size}px ${font}`;
      c.textBaseline = "top";
      c.fillStyle = color;
      if (shadow) {
        c.shadowColor = "rgba(0,0,0,0.75)";
        c.shadowBlur = 4;
        c.shadowOffsetY = 1;
      }
      c.fillText(value, 4, 4);
    });

  const images = new Map<string, HTMLImageElement>();
  await Promise.all([
    data.player.avatar, data.player.banner, data.map.cover, data.map.mapperAvatar,
    ...data.player.badges.slice(0, 5).map(b => b.url),
    ...(data.topScores ?? []).map(p => p.cover ?? ""),
    flags.profileStats && /^[A-Z]{2}$/.test(data.player.countryCode) ? `../shared/assets/flags/${data.player.countryCode}.svg` : "",
    ...(data.score?.mods ?? []).map(mod => modPath(mod)),
    ...(data.topScores ?? []).flatMap(p => p.mods.map(mod => modPath(mod))),
  ].filter(Boolean).map(async url => {
    if (images.has(url)) return;
    const image = await loadImage(url);
    if (image) images.set(url, image);
  }));

  const bottomH = !flags.history && !flags.onlineMap ? 125 : 228;
  const widgetW = 470, topH = 62, gap = 12, footerH = 22;
  const widgetH = topH + gap + bottomH + gap + footerH;
  const widgetX = 12 + (936 - widgetW) / 2;
  const widgetY = 24 + (492 - widgetH) / 2;
  const overlay = `rgba(${palette.overlayRgb.join(",")},`;

  const cardChrome = (key: string, w: number, h: number, bannerUrl?: string, bannerAlpha = 0.55) =>
    art(key, w, h, c => {
      c.save();
      c.shadowColor = "rgba(0,0,0,0.88)";
      c.shadowBlur = 18;
      c.shadowOffsetY = 8;
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
        c.globalAlpha = bannerAlpha;
        cover(c, img, w, h, img.width, img.height);
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
      c.lineWidth = 1.5;
      roundRect(c, 0.75, 0.75, w - 1.5, h - 1.5, 14);
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.35)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(1, 1, w - 2, h - 2, 13);
      c.stroke();
    }, 16);

  const topPlayerChrome = cardChrome("top-player-chrome", widgetW, topH, data.player.banner, 0.55);
  const topMapChrome = cardChrome("top-map-chrome", widgetW, topH, data.map.cover, 0.55);
  const bottomChrome = cardChrome("bottom-chrome", widgetW, bottomH);

  const wipe = art("wipe", widgetW, bottomH * 1.6, c => {
    const g = c.createLinearGradient(0, 0, 0, bottomH * 1.6);
    g.addColorStop(0, palette.wipeLight);
    g.addColorStop(0.12, palette.wipeEdge);
    g.addColorStop(0.48, palette.wipeMiddle);
    g.addColorStop(0.88, palette.wipeEdge);
    g.addColorStop(1, palette.wipeLight);
    c.fillStyle = g;
    c.fillRect(0, 0, widgetW, bottomH * 1.6);
    const sheen = c.createLinearGradient(0, 0, widgetW, bottomH * 1.6);
    sheen.addColorStop(0.2, "transparent");
    sheen.addColorStop(0.44, "rgba(225,234,239,0.08)");
    sheen.addColorStop(0.65, "transparent");
    c.fillStyle = sheen;
    c.fillRect(0, 0, widgetW, bottomH * 1.6);
    c.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 2; y < bottomH * 1.6; y += 3) c.fillRect(0, y, widgetW, 1);
  });

  const roundedImage = (key: string, url: string, w: number, h: number, r: number) =>
    art(key, w, h, c => {
      roundRect(c, 0, 0, w, h, r);
      c.clip();
      const img = images.get(url);
      if (img) cover(c, img, w, h, img.width, img.height, 0.5, 0.5);
      else { c.fillStyle = "#292929"; c.fillRect(0, 0, w, h); }
      c.strokeStyle = "rgba(255,255,255,0.4)";
      c.lineWidth = 1.5;
      roundRect(c, 0.75, 0.75, w - 1.5, h - 1.5, r);
      c.stroke();
    });

  const avatar = roundedImage("avatar", data.player.avatar, 38, 38, 8);
  const coverThumb = roundedImage("cover", data.map.cover, 38, 38, 8);
  const mapper = roundedImage("mapper", data.map.mapperAvatar, 20, 20, 4);
  const flag = /^[A-Z]{2}$/.test(data.player.countryCode)
    ? art("flag", 16, 11, c => {
        const img = images.get(`../shared/assets/flags/${data.player.countryCode}.svg`);
        if (img) c.drawImage(img, 0, 0, 16, 11);
      })
    : undefined;

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
    chevrons(c, 14, 8, color);
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
    c.strokeStyle = accent;
    c.lineWidth = 1.05;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.shadowColor = palette.glow;
    c.shadowBlur = 2;
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

  const mapChart = art("map-chart", 430, 100, c => {
    const retries = data.map.retries;
    const length = Math.max(retries?.fail.length ?? 0, retries?.exit.length ?? 0);
    if (length < 2) return;
    const counts = Array.from({ length }, (_, i) => Math.max(0, (retries?.fail[i] ?? 0) + (retries?.exit[i] ?? 0)));
    const peak = Math.max(1, ...counts);
    const unit = 10 ** Math.floor(Math.log10(peak));
    const max = Math.ceil(peak / unit) * unit;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 1;
    for (const fraction of [0, 0.5, 1]) {
      const y = 78 - fraction * 63;
      c.beginPath();
      c.moveTo(26, y);
      c.lineTo(424, y);
      c.stroke();
    }
    c.strokeStyle = accent;
    c.lineWidth = 1.05;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    counts.forEach((count, i) => {
      const x = 26 + i / (length - 1) * 398;
      const y = 78 - count / max * 63;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    });
    c.stroke();
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
    c.beginPath();
    c.arc(190, 190, 190, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#111";
    c.fillRect(0, 0, 380, 380);
    const img = images.get(data.map.cover);
    if (img) {
      c.filter = "brightness(0.75) contrast(1.1)";
      cover(c, img, 380, 380, img.width, img.height, 0.5, 0.5);
      c.filter = "none";
    }
    const dim = c.createRadialGradient(190, 190, 20, 190, 190, 190);
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
  }, 8);

  const gradeColor = flags.silverGrade ? "#edf3fa" : data.score!.rank === "A" ? "#baff9c" : data.score!.rank === "B" ? "#b2e3ff" : data.score!.rank === "C" ? "#dda9f0" : data.score!.rank === "D" ? "#ef9eaa" : "#ffdb79";
  const grade = art("grade", 280, 280, c => {
    c.font = '700 240px Teko';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = gradeColor;
    c.shadowColor = "rgba(0,0,0,0.9)";
    c.shadowBlur = 20;
    c.shadowOffsetY = 4;
    c.fillText(data.score!.rank, 140, 132);
    c.shadowColor = gradeColor;
    c.shadowBlur = 32;
    c.shadowOffsetY = 0;
    c.globalAlpha = 0.7;
    c.fillText(data.score!.rank, 140, 132);
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

  const modIcon = (mod: string, size: number, radius: number) => {
    const color = modColor(mod);
    return art(`mod:${mod}:${size}`, size, size, c => {
      c.fillStyle = color.bg;
      roundRect(c, 0, 0, size, size, radius);
      c.fill();
      const img = images.get(modPath(mod));
      if (img) {
        if (color.fg === "dark") c.filter = "brightness(0.15)";
        const scale = Math.min(size / img.width, size / img.height);
        c.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
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
    ...(data.score!.count50 > 0 ? [{ color: "#65b9df", value: String(data.score!.count50), padLeft: 12 }] : []),
    { color: "#DE6984", value: String(data.score!.countMiss), padLeft: 12 },
  ];
  const hitWidths = hitBoxes.map(box => box.padLeft + widthOf(box.value, 19, 500) + 12);
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
      c.translate(x + bw / 2, h / 2);
      c.transform(1, 0, Math.tan(rad), 1, 0, 0);
      c.font = '500 19px "Plus Jakarta Sans"';
      c.fillStyle = "#fff";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(box.value, 0, 0);
      c.restore();
      x += bw;
    });
  });

  const ppText = data.score!.pp.trim().toUpperCase().endsWith("PP") ? data.score!.pp.toUpperCase() : `${data.score!.pp}PP`;
  const ppW = Math.ceil(widthOf(ppText, 22, 500) + 48);
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

  const baseAssets = assets.slice();
  let frame: HudFrame;
  type Draw = (s: Sprite, x: number, y: number, w?: number, h?: number, color?: HudSprite["color"], clip?: HudSprite["clip"]) => void;
  const sprite: Draw = (s, x, y, w = s.w / 2 - s.pad * 2, h = s.h / 2 - s.pad * 2, color = rgb("#ffffff"), clip) => {
    if (w <= 0 || h <= 0 || color[3] <= 0) return;
    frame.sprites.push({ asset: s.id, x: (x - s.pad) * S, y: (y - s.pad) * S, w: (w + s.pad * 2) * S, h: (h + s.pad * 2) * S, color, clip: clip ? [clip[0] * S, clip[1] * S, clip[2] * S, clip[3] * S] : undefined });
  };
  let draw: Draw = sprite;
  const text = (value: string, x: number, y: number, size: number, color: string, alpha = 1, weight = 700, align: "left" | "right" | "center" = "left", shadow = true) => {
    if (!value || alpha <= 0) return;
    const s = label(value, size, color, weight, shadow);
    const tw = widthOf(value, size, weight);
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
    const add: Draw = (s, x, y, w, h, color, clip) => layers.push({ s, x, y, w, h, color, clip });
    draw = add;

    if (m.bottomCard.opacity > 0) {
      const clip: HudSprite["clip"] | undefined = m.bottomCard.clipBottom > 0
        ? [ox, oy + topH + gap, widgetW, bottomH * (1 - m.bottomCard.clipBottom / 100)]
        : undefined;
      add(bottomChrome, ox, oy + topH + gap + m.bottomCard.y, widgetW, bottomH, rgb("#ffffff", m.bottomCard.opacity * a), clip);
      if (m.bottomPlayer.opacity > 0 && flags.history) {
        const bx = ox + 16, by = oy + topH + gap + 16 + m.bottomCard.y;
        const count = String(data.player.badgeCount);
        const stackW = Math.max(widthOf(count, 11), widthOf("badges", 7.5));
        text(count, bx + stackW / 2, by, 11, accent, m.bottomPlayer.opacity * a, 700, "center");
        text("badges", bx + stackW / 2, by + 11, 7.5, "rgba(255,255,255,0.45)", m.bottomPlayer.opacity * a, 700, "center", false);
        let badgeX = bx + stackW + 10;
        data.player.badges.slice(0, 5).forEach((badge, i) => {
          const img = images.get(badge.url);
          if (!img) return;
          const b = art(`badge:${i}`, 37, 19, c => {
            const scale = Math.min(37 / img.width, 19 / img.height);
            c.drawImage(img, (37 - img.width * scale) / 2, (19 - img.height * scale) / 2, img.width * scale, img.height * scale);
          });
          add(b, badgeX, by + 2, 37, 19, rgb("#ffffff", m.bottomPlayer.opacity * a));
          badgeX += 41;
        });
        if (data.player.badges.length > 5) {
          const more = `+${data.player.badges.length - 5} more`;
          const mw = widthOf(more, 9) + 10;
          const pill = art(`more:${more}`, mw, 16, c => {
            c.strokeStyle = "rgba(255,255,255,0.18)";
            c.lineWidth = 1;
            roundRect(c, 0.5, 0.5, mw - 1, 15, 3);
            c.stroke();
          });
          add(pill, badgeX + 2, by + 2, mw, 16, rgb("#ffffff", m.bottomPlayer.opacity * a));
          text(more, badgeX + 7, by + 4, 9, palette.muted, m.bottomPlayer.opacity * a);
        }
        text("Playcount over time", ox + widgetW - 16, by, 9.5, palette.muted, m.bottomPlayer.opacity * a, 600, "right", false);
        text(`peak: ${data.player.peakCount} (${data.player.peakMonth})`, ox + widgetW - 16, by + 12, 8.5, palette.dim, m.bottomPlayer.opacity * a, 600, "right", false);
        const cx = ox + 20, cy = by + 38;
        add(chart, cx, cy, 430, 140, rgb("#ffffff", m.bottomPlayer.opacity * a), [cx, cy, 430 * Math.max(0.02, m.chartProgress), 140]);
        spline.yTicks.forEach(tick => text(tick.label, cx + 16, cy + tick.y - 6, 8.5, palette.dim, m.bottomPlayer.opacity * a, 600, "right", false));
        spline.yearTicks.forEach((tick, i) => text(String(tick.year), cx + tick.x, cy + 128, 8.5, palette.dim, m.yearProgress * m.bottomPlayer.opacity * a, 600, i === spline.yearTicks.length - 1 ? "right" : "center", false));
        if (m.peakProgress > 0) {
          add(peakLine, cx + 20, cy + spline.peakY, 405, 2, rgb("#ffffff", m.peakProgress * a));
          add(peakDot, cx + spline.peakX - 6, cy + spline.peakY - 6, 12, 12, rgb("#ffffff", m.peakProgress * a));
        }
        const barY = oy + topH + gap + bottomH - 20 + m.bottomCard.y;
        drawIconRow(ox + 16, barY, m.hours, m.playcount, m.bottomPlayer.opacity * a, add);
      }
      if (m.bottomMap.opacity > 0 && flags.mapStats) {
        const mx = ox + 16, my = oy + topH + gap + 28 + m.bottomCard.y;
        ([["AR", "ar", data.map.arMs, data.map.ar.toFixed(2), 11], ["CS", "", "", data.map.cs.toFixed(2), 10], ["OD", "od", data.map.odMs, data.map.od.toFixed(2), 11], ["HP", "", "", data.map.hp.toFixed(2), 10]] as const).forEach((row, i) => {
          const x = mx + (i % 2) * 220, y = my + Math.floor(i / 2) * 20;
          const key = row[0].toLowerCase() as "ar" | "cs" | "od" | "hp";
          text(row[0], x, y, 10, "rgba(255,255,255,0.85)", m.bottomMap.opacity * a);
          add(pillTrack(key), x + 22, y, 180, 14, rgb("#ffffff", m.bottomMap.opacity * a));
          const fillW = 180 * m.fills[key];
          if (fillW > 0) add(fills[key]!, x + 22, y, fillW, 14, rgb("#ffffff", m.bottomMap.opacity * a), [x + 22, y, fillW, 14]);
          if (row[2]) text(row[2], x + 28, y + 1, 9, "#fff", m.bottomMap.opacity * a);
          text(row[3], x + 196, y + 1, 9, "#fff", m.bottomMap.opacity * a, 700, "right");
        });
        if (flags.onlineMap && data.map.retries) {
          add(mapChart, mx, my + 54, 430, 100, rgb("#ffffff", m.bottomMap.opacity * a), [mx, my + 54, 430 * Math.max(0.02, m.mapPath), 100]);
          text("Fails and exits by map progress", ox + widgetW - 16, my + 44, 9, palette.muted, m.bottomMap.opacity * a, 600, "right", false);
          const retries = data.map.retries;
          const length = Math.max(retries.fail.length, retries.exit.length);
          const peak = Math.max(1, ...Array.from({ length }, (_, i) => (retries.fail[i] ?? 0) + (retries.exit[i] ?? 0)));
          const unit = 10 ** Math.floor(Math.log10(peak));
          const max = Math.ceil(peak / unit) * unit;
          const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n));
          for (const fraction of [0, 0.5, 1]) text(fmt(max * fraction), mx + 22, my + 54 + 78 - fraction * 63 - 6, 8.5, palette.dim, m.bottomMap.opacity * a, 600, "right", false);
          for (const percent of [0, 25, 50, 75, 100]) text(`${percent}%`, mx + 26 + percent / 100 * 398, my + 54 + 88, 8.5, palette.dim, m.bottomMap.opacity * a, 600, percent === 0 ? "left" : percent === 100 ? "right" : "center", false);
        }
        const barY = oy + topH + gap + bottomH - 20 + m.bottomCard.y;
        const heartIcon = art("fav-heart", 12, 12, c => drawHeart(c, 1, 1, 10, accent));
        add(heartIcon, ox + 16, barY + 1, 12, 12, rgb("#ffffff", m.bottomMap.opacity * a));
        text(`Favs: ${comma(m.favs)}`, ox + 32, barY, 11, "rgba(255,255,255,0.85)", m.bottomMap.opacity * a);
        const playSmall = art("play-icon-sm", 12, 12, c => drawPlay(c, 2, 1, 10, accent));
        add(playSmall, ox + 128, barY + 1, 12, 12, rgb("#ffffff", m.bottomMap.opacity * a));
        text(`Plays: ${comma(m.plays)}`, ox + 144, barY, 11, "rgba(255,255,255,0.85)", m.bottomMap.opacity * a);
        if (flags.mapperAvatar) {
          add(mapper, ox + widgetW - 110, barY - 2);
          text(data.map.mapper, ox + widgetW - 86, barY - 2, 10.5, "#fff", m.bottomMap.opacity * a);
          text("mapper", ox + widgetW - 86, barY + 10, 8, palette.muted, m.bottomMap.opacity * a, 600, "left", false);
        }
      }
    }
    if (m.topCard.opacity > 0) {
      const chrome = m.showMap ? topMapChrome : topPlayerChrome;
      add(chrome, ox, oy + m.topCard.y, widgetW, topH, rgb("#ffffff", m.topCard.opacity * a));
      const hy = oy + m.topCard.y;
      if (m.topPlayer.opacity > 0) {
        add(avatar, ox + 14 + m.playerHeaderLeft, hy + 12, 38, 38, rgb("#ffffff", m.topPlayer.opacity * a));
        text(data.player.username, ox + 62 + m.playerHeaderLeft, hy + 16, 15.5, "#fff", m.topPlayer.opacity * a);
        if (data.player.isSupporter) add(heart, ox + 62 + widthOf(data.player.username, 15.5) + 6 + m.playerHeaderLeft, hy + 18, 21, 12, rgb("#ffffff", m.topPlayer.opacity * a));
        if (flag) add(flag, ox + 62 + m.playerHeaderLeft, hy + 36, 16, 11, rgb("#ffffff", m.topPlayer.opacity * a));
        text(data.player.crank, ox + 82 + m.playerHeaderLeft, hy + 34, 10.5, palette.muted, m.topPlayer.opacity * a, 600);
        text(data.player.grank, ox + widgetW - 14 + m.playerHeaderRight, hy + 14, 21, "#fff", m.topPlayer.opacity * a, 800, "right");
        text(data.player.pp, ox + widgetW - 14 + m.playerHeaderRight, hy + 37, 11.5, "rgba(255,255,255,0.85)", m.topPlayer.opacity * a, 600, "right");
      }
      if (m.topMap.opacity > 0) {
        add(coverThumb, ox + 14, hy + 12, 38, 38, rgb("#ffffff", m.topMap.opacity * a));
        text(data.map.title, ox + 62, hy + 16, 13.5, "#fff", m.topMap.opacity * a);
        text(data.map.artist, ox + 62, hy + 35, 10.5, palette.muted, m.topMap.opacity * a, 600);
        add(status, ox + widgetW - 42, hy + 17 + m.chevronY, 28, 28, rgb("#ffffff", m.topMap.opacity * a));
      }
    }
    if (m.starFooter.opacity > 0) {
      const fy = oy + topH + gap + bottomH + gap + m.starFooter.y;
      const star = art("footer-star", 18, 18, c => drawStar(c, 9, 9, 7.5));
      add(star, ox + widgetW / 2 - 70, fy, 15 * m.starScale, 15 * m.starScale, rgb("#ffffff", m.starFooter.opacity * a));
      text(`${data.map.sr}  •  ${data.map.bpm}`, ox + widgetW / 2 + 8, fy, 14, "#fff", m.starFooter.opacity * a, 700, "center");
    }
    m.wipes.forEach((wipeState, i) => {
      if (!wipeState.visible) return;
      const h = (i === 0 ? topH : bottomH) * 1.6;
      const y = (i === 0 ? oy : oy + topH + gap) + h * (wipeState.yPercent / 100);
      add(wipe, ox, y, widgetW, h, rgb("#ffffff", a), [ox, i === 0 ? oy : oy + topH + gap, widgetW, i === 0 ? topH : bottomH]);
    });

    draw = sprite;
    if (close) {
      const edge = 24;
      const composed = composeLayers(layers, ox - edge, oy - edge, widgetW + edge * 2, widgetH + 40 + edge * 2);
      const warped = warpClose(composed, t);
      const s = save(`close:${t.toFixed(4)}`, warped);
      sprite(s, ox - edge - s.pad, oy - edge - s.pad, s.w / 2 - s.pad * 2, s.h / 2 - s.pad * 2, rgb("#ffffff", a));
      return frame;
    }
    for (const item of layers) sprite(item.s, item.x, item.y, item.w, item.h, item.color, item.clip);
    return frame;
  }

  function drawIconRow(x: number, y: number, hours: number, playcount: number, alpha: number, add: (s: Sprite, x: number, y: number, w?: number, h?: number, color?: HudSprite["color"]) => void) {
    const hourIcon = art("hour-icon", 12, 12, c => drawHourglass(c, 1, 1, 10, accent));
    add(hourIcon, x, y + 2, 12, 12, rgb("#ffffff", alpha));
    const hoursText = `${comma(hours)} hours`;
    text(hoursText, x + 16, y, 11, "rgba(255,255,255,0.85)", alpha, 600);
    const playX = x + 16 + widthOf(hoursText, 11, 600) + 18;
    const play = art("play-icon", 12, 12, c => drawPlay(c, 2, 1, 10, accent));
    add(play, playX, y + 2, 12, 12, rgb("#ffffff", alpha));
    text(`Playcount: ${comma(playcount)}`, playX + 16, y, 11, "rgba(255,255,255,0.85)", alpha, 600);
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
      x.drawImage(img, item.x - ox - item.s.pad, item.y - oy - item.s.pad, dw + item.s.pad * 2, dh + item.s.pad * 2);
      x.restore();
    }
    return c;
  }

  function warpClose(src: HTMLCanvasElement, t: number) {
    const { pClose, pull, scaleX, scaleY } = widgetCloseScale(t);
    const rotate = -65 * Math.sin(pClose * Math.PI / 2) * Math.PI / 180;
    const persp = 1200 - 900 * pClose;
    const w = src.width, h = src.height;
    const outH = Math.ceil(h * 1.2 + 760 * pull * 2);
    const out = canvas(w, outH);
    const c = out.getContext("2d")!;
    const rows = src.height;
    for (let y = 0; y < rows; y++) {
      const dist = y / 2;
      const z = dist * Math.sin(-rotate);
      const scale = persp / (persp + Math.max(0, z));
      const outY = dist * Math.cos(rotate) * scale * scaleY;
      const outW = (w / 2) * scale * scaleX;
      const outX = (w / 2 - outW) / 2;
      c.drawImage(src, 0, y, w, 1, outX * 2, outY * 2, outW * 2, scaleY * 2);
    }
    return out;
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
    sprite(avatar, 192 + leftX, 133, 28, 28, rgb("#ffffff", leftA));
    text(`${data.player.username} ${data.player.grank}`, 228 + leftX, 131, 12.5, "#fff", leftA);
    if (flag) sprite(flag, 228 + leftX, 147, 16, 11, rgb("#ffffff", leftA));
    text(data.player.crank, 248 + leftX, 145, 11, "rgba(255,255,255,0.9)", leftA, 600);

    const rows = [[190, 96], [228, 87], [266, 82], [304, 84], [342, 92], [380, 109]] as const;
    (data.topScores ?? []).forEach((play, i) => {
      const [top, left] = rows[i] ?? rows[5];
      const cover = play.cover && images.has(play.cover) ? roundedImage(`play:${i}`, play.cover, 44, 27, 4) : coverThumb;
      sprite(cover, left + leftX, top, 44, 27, rgb("#ffffff", leftA));
      const rank = play.rank.toUpperCase().replace(/H$/, "");
      text(rank, left + 8 + leftX, top + 5, 15, playRankColor(rank, play.mods), leftA, 800);
      const title = Array.from(play.title);
      text(title.length > 18 ? `${title.slice(0, 18).join("").trimEnd()}...` : play.title, left + 54 + leftX, top, 11, "#fff", leftA, 600);
      play.mods.forEach((mod, mi) => sprite(modIcon(mod, 14, 2.3), left + 54 + mi * 16 + leftX, top + 15, 14, 14, rgb("#ffffff", leftA)));
      text(play.timeAgo, left + 54 + play.mods.length * 16 + 6 + leftX, top + 15, 10, "rgba(255,255,255,0.65)", leftA, 600);
      text(play.pp, left + 198 + leftX, top + 12, 12, "#fff", leftA, 700, "right");
    });

    const itemX = (index: number, base: number) => base + rightX + emerge(index);
    const itemA = (index: number) => m.rightItems[index]! * a;
    if (itemA(0) > 0) {
      sprite(scoreLabel.sprite, itemX(0, 658) - scoreLabel.extra, 184, undefined, undefined, rgb("#ffffff", itemA(0)));
      text(formatScoreNumber(data.score!.totalScore), itemX(0, 658), 202, 24, "#fff", itemA(0), 500);
    }
    if (itemA(1) > 0) text(`${formatScoreNumber(data.score!.combo)}/${formatScoreNumber(data.score!.maxCombo)}x`, itemX(1, 672), 238, 22, "#a6a6a2", itemA(1), 400);
    if (itemA(2) > 0) {
      sprite(ppBadge, itemX(2, 672), 276, ppW, 32, rgb("#ffffff", itemA(2)));
      text(ppText, itemX(2, 672) + ppW / 2, 280, 22, "#fff", itemA(2), 500, "center");
    }
    if (itemA(3) > 0) text(data.score!.accuracy, itemX(3, 672), 324, 22, "#a6a6a2", itemA(3), 400);
    if (itemA(4) > 0) sprite(hitsStrip.sprite, itemX(4, 624) - hitsStrip.extra, 358, undefined, undefined, rgb("#ffffff", itemA(4)));

    const ls = m.lens.scale;
    const lensA = m.lens.opacity * a;
    const cx = 480, cy = 290 + m.lens.y;
    sprite(lens, cx - 190 * ls, cy - 190 * ls, 380 * ls, 380 * ls, rgb("#ffffff", lensA));
    const gs = ls * m.grade.scale;
    sprite(grade, cx - 140 * gs, cy - 148 * gs, 280 * gs, 280 * gs, rgb("#ffffff", m.grade.opacity * lensA));
    const mods = data.score?.mods ?? [];
    const modSize = 32 * ls, modGap = 2 * ls;
    let mx = cx - (mods.length * modSize + Math.max(0, mods.length - 1) * modGap) / 2;
    mods.forEach(mod => {
      sprite(modIcon(mod, 32, 5.3), mx, cy + 142 * ls, modSize, modSize, rgb("#ffffff", lensA));
      mx += modSize + modGap;
    });

    const barY = 18 + m.topBar.y;
    const barA = m.topBar.opacity * a;
    const srW = Math.max(40, widthOf(data.map.sr, 24, 800));
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
      text(`${name}:`, x, barY + 10, 13, "rgba(255,255,255,0.85)", barA, 600);
      text(value, x + 96, barY + 10, 13.5, "#fff", barA, 700, "right");
    };
    gauge(gx, "#FA5252", Math.min(1, data.map.cs / 10), "CS", data.map.cs.toFixed(2));
    gauge(gx + 118, "#40C057", Math.min(1, data.map.ar / 11), "AR", data.map.ar.toFixed(2));
    const starX = gx + groupW + 28 + (srW - 40) / 2;
    sprite(starRibbon, starX, barY - 14, 40, 36, rgb("#ffffff", barA));
    text(data.map.sr, gx + groupW + 28 + srW / 2, barY + 12, 24, "#F8D153", barA, 800, "center");
    gx += groupW + 28 + srW + 28;
    gauge(gx, "#B197FC", Math.min(1, data.map.od / 11), "OD", data.map.od.toFixed(2));
    gauge(gx + 118, "#748FFC", Math.min(1, data.map.hp / 10), "HP", data.map.hp.toFixed(2));

    if (data.score?.playedAtAgo) text(data.score.playedAtAgo, 480, 512, 12, "rgba(255,255,255,0.6)", m.bottomTime * a, 600, "center");
    return frame;
  }

  const fps = options.fps;
  return {
    batch(kind: "intro" | "outro", start: number, count: number): HudBatch {
      const frames = Array.from({ length: count }, (_, i) => kind === "intro" ? drawIntro((start + i) / fps) : drawOutro((start + i) / fps));
      const fresh = assets;
      assets = [];
      const shared = start === 0 ? baseAssets.filter(asset => !fresh.some(item => item.id === asset.id)) : [];
      return { frames, assets: [...shared, ...fresh] };
    },
  };
}

Object.assign(window, { createNativeScenes });
