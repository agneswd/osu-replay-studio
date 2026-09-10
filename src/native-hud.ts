import { displayMods } from "../core/mods.js";
import { normalizeLayout, overlayBounds } from "../core/layout.js";
import { timelineHitWindows } from "../core/hit-timing.js";
import { frameAt } from "../core/timeline.js";
import { normalizeOverlayAccent, type OverlayId, type CounterFrame, type RenderOptions, type Timeline } from "../core/types.js";
import type { HudBatch, HudFrame, HudSprite } from "../core/native-hud.js";

interface Sprite {
  id: number;
  w: number;
  h: number;
}
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};
const white = "#f3f4f6",
  muted = "#a2a2a2";
const gradeLabel = (s: string) =>
  ({ X: "SS", XH: "SS", SSH: "SS", SH: "S" })[s] ?? s;
const gradeColor = (s: string, mods: string) =>
  /^(S|X)/.test(s)
    ? /H$/.test(s) || /HD|FL/.test(mods)
      ? "#d8d8d8"
      : "#ffd700"
    : ({ A: "#91ed95", B: "#2196f3", C: "#9c27b0", D: "#f44336" }[s] ?? muted);
const modNames: Record<string, string> = {
  EZ: "easy",
  NF: "no-fail",
  HT: "half-time",
  HR: "hard-rock",
  SD: "sudden-death",
  PF: "perfect",
  DT: "double-time",
  NC: "nightcore",
  HD: "hidden",
  FL: "flashlight",
  RX: "relax",
  AP: "autopilot",
  SO: "spun-out",
  MR: "mirror",
  FI: "fade-in",
  TD: "touch-device",
  CL: "classic",
  V2: "score-v2",
  DA: "difficulty-adjust",
  AS: "adaptive-speed",
  CS: "constant-speed",
};
const number = (n: number) =>
  Math.round(n).toLocaleString("en-US").replaceAll(",", " ");
const rgb = (hex: string, alpha = 1): HudSprite["color"] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  alpha,
];

// Rasterize reusable artwork once. Export frames contain only sprite positions and colors.
async function create(t: Timeline, o: RenderOptions) {
  const enabled = new Set(o.overlays);
  await document.fonts.load('700 32px "Exo 2 Tabular"');
  let assets: HudBatch["assets"] = [],
    nextId = 0;
  const cache = new Map<string, Sprite>();
  const save = (key: string, c: HTMLCanvasElement): Sprite => {
    const result = { id: nextId++, w: c.width, h: c.height };
    cache.set(key, result);
    assets.push({ id: result.id, png: c.toDataURL("image/png").split(",")[1] });
    return result;
  };
  const art = (
    key: string,
    w: number,
    h: number,
    paint: (c: CanvasRenderingContext2D) => void,
  ) => {
    const old = cache.get(key);
    if (old) return old;
    const c = canvas(w * 2, h * 2),
      x = c.getContext("2d")!;
    x.scale(2, 2);
    paint(x);
    return save(key, c);
  };
  const measure = canvas(1, 1).getContext("2d")!;
  const width = (value: string, size: number) => {
    measure.font = `700 ${size}px "Exo 2 Tabular"`;
    return measure.measureText(value).width;
  };
  const textArt = (value: string, size: number) =>
    art(
      `text:${size}:${value}`,
      width(value, size) + 8,
      size * 1.3 + 8,
      (c) => {
        c.font = `700 ${size}px "Exo 2 Tabular"`;
        c.textBaseline = "top";
        c.fillStyle = "white";
        c.shadowColor = "black";
        c.shadowBlur = 4;
        c.shadowOffsetY = 1;
        c.fillText(value, 4, 4);
      },
    );
  const images = new Map<string, Sprite>();
  async function load(
    url: string | undefined,
    w: number,
    h: number,
    radius = 0,
    background?: string,
    dark = false,
  ) {
    if (!url || images.has(`${url}:${w}:${h}`)) return;
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      return;
    }
    images.set(
      `${url}:${w}:${h}`,
      art(`image:${url}:${w}:${h}`, w, h, (c) => {
        c.beginPath();
        c.roundRect(0, 0, w, h, radius);
        c.clip();
        if (background) {
          c.fillStyle = background;
          c.fillRect(0, 0, w, h);
        }
        if (dark) c.filter = "brightness(0.15)";
        const scale = Math.max(w / image.width, h / image.height);
        c.drawImage(
          image,
          (w - image.width * scale) / 2,
          (h - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
      }),
    );
  }
  await Promise.all([
    ...(enabled.has("player-info") ? [load(t.playerAvatar, 74, 74, 7)] : []),
    ...(enabled.has("leaderboard")
      ? [
          load(t.playerAvatar, 36, 36, 6),
          ...(t.online?.leaderboard ?? []).map((r) =>
            load(r.avatar, 36, 36, 6),
          ),
        ]
      : []),
  ]);
  const country = t.playerCountry?.toUpperCase();
  let flag: string | undefined;
  if (enabled.has("player-info") && country && /^[A-Z]{2}$/.test(country)) {
    flag = `../shared/assets/flags/${country}.svg`;
    await load(flag, 28, 22);
  }
  // Mod artwork is shared with the browser HUD and thumbnail renderer.
  for (const [mod, name] of enabled.has("leaderboard")
    ? Object.entries(modNames)
    : []) {
    const background = /^(EZ|NF|HT|DC)$/.test(mod)
      ? "#99ff4d"
      : mod === "HD"
        ? "#ffcc22"
        : /^(HR|SD|PF|DT|FL)$/.test(mod)
          ? "#ff4d4d"
          : mod === "NC"
            ? "#7a5cff"
            : /^(RX|AP)$/.test(mod)
              ? "#4dc3ff"
              : mod === "FI"
                ? "#ff4d9a"
                : "#8c5cff";
    await load(
      `../shared/assets/mods/mod-${name}.svg`,
      24,
      24,
      4,
      background,
      /^(EZ|NF|HT|DC|HD)$/.test(mod),
    );
  }
  const accent = normalizeOverlayAccent(o.overlayAccent);
  const countryRank = t.playerStats?.countryRank
    ? `#${number(t.playerStats.countryRank)}`
    : "";
  const rank = t.playerRank ? `#${number(t.playerRank)}` : "";
  const left = Math.round(
    Math.max(440, Math.min(540, 560 - width(countryRank, 24) - 6)),
  );
  const right = Math.round(
    Math.min(840, Math.max(740, 724 + width(rank, 24) + 6)),
  );
  const hpPath = new Path2D(
    `M18 12 H${left - 80} C${left - 40} 12 ${left - 40} 54 ${left} 54 H${right} C${right + 40} 54 ${right + 40} 12 ${right + 80} 12 H1262`,
  );
  const hpEnds = [
    `M640 54 H${left} C${left - 40} 54 ${left - 40} 12 ${left - 80} 12 H18`,
    `M640 54 H${right} C${right + 40} 54 ${right + 40} 12 ${right + 80} 12 H1262`,
  ].map((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const length = path.getTotalLength();
    return Array.from(
      { length: 1001 },
      (_, i) => path.getPointAtLength((length * i) / 1000).x,
    );
  });
  const hpEnd = (side: number, hp: number) => {
    const at = hp * 1000,
      index = Math.floor(at),
      points = hpEnds[side];
    return (
      points[index] +
      (points[Math.min(1000, index + 1)] - points[index]) * (at - index)
    );
  };
  const hpTrack = art("hp-track", 1280, 80, (c) => {
    c.strokeStyle = accent;
    c.globalAlpha = 0.44;
    c.lineWidth = 14;
    c.lineCap = "round";
    c.stroke(hpPath);
  });
  const hpUnavailable = art("hp-unavailable", 1280, 80, (c) => {
    c.strokeStyle = accent;
    c.globalAlpha = 0.44;
    c.lineWidth = 14;
    c.lineCap = "round";
    c.setLineDash([4, 8]);
    c.stroke(hpPath);
  });
  const hpInner = art("hp-inner", 1280, 80, (c) => {
    c.strokeStyle = "rgba(0,0,0,.65)";
    c.lineWidth = 6;
    c.lineCap = "round";
    c.stroke(hpPath);
  });
  const density = art("density", 300, 160, (c) => {
    const max = Math.max(1, ...t.strains);
    c.fillStyle = "white";
    c.beginPath();
    c.moveTo(0, 160);
    t.strains.forEach((v, i) =>
      c.lineTo(
        (i / Math.max(1, t.strains.length - 1)) * 300,
        158 - (v / max) * 154,
      ),
    );
    c.lineTo(300, 160);
    c.fill();
  });
  const pixel = art("pixel", 1, 1, (c) => {
    c.fillStyle = "white";
    c.fillRect(0, 0, 1, 1);
  });
  const avatarShadow = art("avatar-shadow", 106, 106, c => {
    c.shadowColor = "rgba(0,0,0,.75)";
    c.shadowOffsetY = 3;
    c.shadowBlur = 12;
    c.fillStyle = "#000";
    c.beginPath(); c.roundRect(16, 16, 74, 74, 7); c.fill();
  });
  const tick = art("tick", 4, 22, (c) => {
    c.fillStyle = "white";
    c.beginPath();
    c.roundRect(0, 0, 4, 22, 1);
    c.fill();
  });
  const tickShadow = art("tick-shadow", 12, 30, (c) => {
    c.fillStyle = "black";
    c.shadowColor = "black";
    c.shadowBlur = 3;
    c.shadowOffsetY = 1;
    c.beginPath();
    c.roundRect(4, 4, 4, 22, 1);
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.globalCompositeOperation = "destination-out";
    c.fill();
  });
  const pointer = art("pointer", 24, 23, (c) => {
    c.fillStyle = "white";
    c.shadowColor = "black";
    c.shadowBlur = 2;
    c.shadowOffsetY = 2;
    c.beginPath();
    c.moveTo(12, 3);
    c.lineTo(4, 18);
    c.lineTo(20, 18);
    c.fill();
  });
  const ring = art("rank-ring", 26, 26, (c) => {
    c.strokeStyle = "white";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(13, 13, 11, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "white";
    c.beginPath();
    c.arc(13, 13, 8, 0, Math.PI * 2);
    c.fill();
  });
  const hitWindows = timelineHitWindows(t);
  const timingScale = 192 / hitWindows.meh;
  const zones = art("zones", 384, 12, (c) => {
    c.beginPath();
    c.roundRect(0, 1, 384, 10, 6);
    c.clip();
    const edges = [0, 192 - hitWindows.ok * timingScale, 192 - hitWindows.great * timingScale, 192 + hitWindows.great * timingScale, 192 + hitWindows.ok * timingScale, 384];
    ["#e7c80b", "#09ec39", "#2499bc", "#09ec39", "#e7c80b"].forEach(
      (color, i) => {
        c.fillStyle = color;
        c.fillRect(edges[i], 1, edges[i + 1] - edges[i], 10);
      },
    );
    c.fillStyle = "#ffffff55";
    c.fillRect(0, 1, 384, 1);
    c.fillStyle = "#0004";
    c.fillRect(0, 9, 384, 2);
  });
  const plate = (w: number, pp: boolean) =>
    art(`plate:${w}:${pp}`, w + 28, 50, (c) => {
      const slant = pp ? 1 : -1;
      c.translate(14, 0);
      c.transform(1, 0, slant * 0.249, 1, -slant * 6, 0);
      c.fillStyle = accent;
      c.globalAlpha = 0.18;
      c.beginPath();
      c.roundRect(slant * 6, 0, w, 50, 9);
      c.fill();
      c.globalAlpha = 0.22;
      c.beginPath();
      c.roundRect(0, 0, w, 50, 9);
      c.fill();
      c.globalAlpha = 0.09;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(2, 2, w - 4, 46, 7);
      c.stroke();
    });
  const layout = normalizeLayout(o.layout);
  const order = Object.keys(overlayBounds) as OverlayId[];
  order.sort((a, b) => layout.overlays[a].z - layout.overlays[b].z);
  let component: OverlayId = "health-bar";
  let layers: { id: OverlayId; sprite: HudSprite }[] = [];
  let frame: HudFrame;
  const sprite = (
    s: Sprite,
    x: number,
    y: number,
    w = s.w / 2,
    h = s.h / 2,
    color = rgb("#ffffff"),
    clip?: HudSprite["clip"],
    ticks = false,
  ) => {
    if (w <= 0 || h <= 0 || color[3] <= 0) return;
    const command: HudSprite = {
      asset: s.id,
      x,
      y,
      w,
      h,
      color,
      clip,
    };
    if (ticks) frame.ticks.push(command);
    else {
      frame.sprites.push(command);
      layers.push({ id: component, sprite: command });
    }
  };
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    a = 1,
    clip?: HudSprite["clip"],
  ) => sprite(pixel, x, y, w, h, rgb(color, a), clip);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = white,
    alpha = 1,
    align: "left" | "right" | "center" = "left",
    clip?: HudSprite["clip"],
  ) => {
    // Glyph reuse keeps changing scores from allocating one texture per value.
    let at =
      x -
      (align === "right"
        ? width(value, size)
        : align === "center"
          ? width(value, size) / 2
          : 0);
    for (const ch of value) {
      const s = textArt(ch, size);
      sprite(s, at - 4, y - 4, undefined, undefined, rgb(color, alpha), clip);
      at += width(ch, size);
    }
  };
  const digits = (
    value: number,
    x: number,
    y: number,
    size: number,
    counter?: CounterFrame,
    color = white,
    decimal = 0,
  ) => {
    const format = (v: number) => (decimal ? v.toFixed(decimal) : number(v)),
      next = format(value),
      old = format(counter?.from ?? value)
        .padStart(next.length, " ")
        .slice(-next.length);
    const p =
        counter?.to === Number(value.toFixed(decimal)) ? counter.progress : 1,
      e = 1 - (1 - p) ** 3;
    let at = x;
    for (let i = 0; i < next.length; i++) {
      const w = /\d/.test(next[i]) ? size * 0.62 : size * 0.25,
        h = size * 1.2,
        clip: [number, number, number, number] = [at, y, w, h];
      if (old[i] !== next[i] && e < 1 && /\d/.test(next[i])) {
        const up = value >= (counter?.from ?? value),
          offset = (up ? e : 1 - e) * h;
        text(
          up ? old[i] : next[i],
          at + w / 2,
          y - offset,
          size,
          color,
          1,
          "center",
          clip,
        );
        text(
          up ? next[i] : old[i],
          at + w / 2,
          y + h - offset,
          size,
          color,
          1,
          "center",
          clip,
        );
      } else text(next[i], at + w / 2, y, size, color, 1, "center", clip);
      at += w;
    }
    return at;
  };
  const digitWidth = (value: number, size: number) =>
    [...number(value)].reduce(
      (w, c) => w + size * (/\d/.test(c) ? 0.62 : 0.25),
      0,
    );
  function applyLayout(frame: HudFrame): HudFrame {
    layers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    frame.sprites = layers.map(({ id, sprite: item }) => {
      const target = layout.overlays[id], [x, y] = overlayBounds[id], scale = target.scale;
      return { ...item, x: target.x + (item.x - x) * scale, y: target.y + (item.y - y) * scale,
        w: item.w * scale, h: item.h * scale,
        clip: item.clip ? [target.x + (item.clip[0] - x) * scale, target.y + (item.clip[1] - y) * scale,
          item.clip[2] * scale, item.clip[3] * scale] : undefined };
    });
    if (frame.ticks.length) {
      const target = layout.overlays["hit-error-bar"];
      frame.tickPlacement = { x: target.x, y: target.y + 52 * target.scale, scale: target.scale,
        after: layers.findLastIndex(layer => layer.id === "hit-error-bar") + 1 };
    }
    return frame;
  }
  function draw(seconds: number): HudFrame {
    const f = frameAt(t, seconds, o.leaderboardSize, o.leaderboardSort),
      g = f.gameplay;
    frame = { sprites: [], ticks: [] };
    layers = [];
    component = "health-bar";
    if (enabled.has("health-bar")) {
      sprite(
        g.hp.normal === null ? hpUnavailable : hpTrack,
        400,
        15.75,
        1120,
        70,
      );
      const hp = Math.max(0, Math.min(1, (g.hp.normal ?? 0) / 100));
      if (hp > 0) {
        const start = hpEnd(0, hp) - 3,
          end = hpEnd(1, hp) + 3;
        sprite(hpInner, 400, 15.75, 1120, 70, rgb("#ffffff"), [
          400 + start * 0.875,
          15.75,
          (end - start) * 0.875,
          70,
        ]);
      }
      if (g.hp.normal === null)
        text("HP unavailable", 1504, 72.625, 10.5, muted, 1, "right");
    }
    component = "player-info";
    if (enabled.has("player-info")) {
      const x = (v: number) => 400 + v * 0.875,
        y = (v: number) => 14 + v * 0.875;
      text(`★ ${t.stars.toFixed(2)}`, x(22), y(37), 21.875);
      text(
        `${Math.round(t.bpm)}bpm`,
        x(left - 86),
        y(37),
        21.875,
        white,
        1,
        "right",
      );
      text(number(g.score), x(right + 86), y(37), 21.875);
      text(countryRank, x(560), y(10), 21, white, 1, "right");
      if (flag && images.has(`${flag}:28:22`))
        sprite(images.get(`${flag}:28:22`)!, x(566), y(9), 24.5, 19.25);
      sprite(avatarShadow, x(603 - 16), y(-16), 92.75, 92.75);
      const avatar = images.get(`${t.playerAvatar}:74:74`);
      if (avatar) sprite(avatar, x(603), y(0), 64.75, 64.75);
      else rect(x(603), y(0), 64.75, 64.75, "#292929");
      if (rank) {
        sprite(ring, x(688), y(10), 22.75, 22.75);
        text(rank, x(724), y(10), 21);
      }
      text(t.player, x(640), y(88), 21.875, white, 1, "center", [
        x(490),
        y(84),
        262.5,
        31,
      ]);
    }
    component = "accuracy-counter";
    if (enabled.has("accuracy-counter")) {
      text(
        gradeLabel(g.grade),
        1498,
        47,
        22.75,
        gradeColor(g.grade, t.mods),
        1,
        "center",
      );
      const size = 21.875,
        value = Number(g.accuracy.toFixed(2)),
        w = [...value.toFixed(2)].reduce(
          (sum, c) => sum + size * (/\d/.test(c) ? 0.62 : 0.25),
          0,
        );
      digits(
        value,
        1475 - width("%", size) - w,
        47,
        size,
        f.counters?.accuracy,
        white,
        2,
      );
      text("%", 1475, 47, size, white, 1, "right");
    }
    component = "combo-counter";
    if (enabled.has("combo-counter")) {
      const w = Math.max(
          92,
          36 + digitWidth(g.combo.current, 30) + width("x", 28),
        ),
        x = 744 - w;
      sprite(plate(w, false), x - 14, 1013);
      const contentWidth = digitWidth(g.combo.current, 30) + width("x", 28);
      const end = digits(g.combo.current, x + (w - contentWidth) / 2, 1025, 30, f.counters?.combo);
      text("x", end, 1027, 28);
    }
    component = "pp-counter";
    if (enabled.has("pp-counter")) {
      const suffix = ` / ${number(g.pp.fc)}pp`,
        w = 36 + digitWidth(g.pp.current, 30) + width(suffix, 28);
      sprite(plate(w, true), 1162, 1013);
      const end = digits(g.pp.current, 1194, 1021, 30, f.counters?.pp);
      text(suffix, end, 1023, 28);
    }
    component = "hit-counts";
    if (enabled.has("hit-counts")) {
      const values = [
        g.hits.sliderBreaks,
        g.hits["0"],
        0,
        g.hits["100"],
        g.hits["50"],
      ];
      const counters = [
        f.counters?.hitSB,
        f.counters?.hitMiss,
        undefined,
        f.counters?.hit100,
        f.counters?.hit50,
      ];
      ["SB", "Miss", "", "Ok", "Meh"].forEach((label, i) => {
        if (!label || !values[i]) return;
        const x = 768 + 76.8 * (i + 0.5),
          color = ["#c5c9d0", "#e56c82", "", "#91df9b", "#e8c45a"][i];
        text(label, x, 976, 14, color, 1, "center");
        const w = Math.max(40, digitWidth(values[i], 26));
        rect(x - w / 2, 996, w, 28, "#000000", 0.28);
        digits(
          values[i],
          x - digitWidth(values[i], 26) / 2,
          996,
          26,
          counters[i],
          color,
        );
      });
    }
    component = "hit-error-bar";
    if (enabled.has("hit-error-bar")) {
      text("UR", 960, 976, 16, white, 1, "center");
      const ur = Math.round(f.play.unstableRate);
      digits(ur, 960 - digitWidth(ur, 32) / 2, 996, 32, f.counters?.ur);
      sprite(zones, 768, 1038);
      rect(959, 1034, 2, 20, "#ffffff", 0.6);
      for (const hit of f.timing?.ticks ?? []) {
        const x = Math.max(2, Math.min(382, 192 + hit.error * timingScale)),
          h = 22 * hit.height;
        if (h <= 0) continue;
        sprite(
          tickShadow,
          768 + x - 6,
          1028 + 16 - h / 2 - 4,
          12,
          h + 8,
          rgb("#ffffff", hit.opacity ** 2),
        );
        sprite(
          tick,
          x - 2,
          16 - h / 2,
          4,
          h,
          rgb(
            (hitWindows.inclusive ? Math.abs(hit.error) <= hitWindows.great : Math.abs(hit.error) < hitWindows.great)
              ? "#45a8c6"
              : (hitWindows.inclusive ? Math.abs(hit.error) <= hitWindows.ok : Math.abs(hit.error) < hitWindows.ok)
                ? "#30e157"
                : "#ebd132",
            hit.opacity,
          ),
          undefined,
          true,
        );
      }
      sprite(
        pointer,
        948 + Math.max(-192, Math.min(192, (f.timing?.average ?? 0) * timingScale)),
        1053,
      );
    }
    component = "progress-graph";
    if (enabled.has("progress-graph")) {
      sprite(density, 8, 214, 300, 160, rgb(accent, 0.32));
      const progress = Math.max(0, Math.min(1, seconds / t.duration));
      sprite(density, 8, 214, 300, 160, rgb(accent, 0.92), [
        8,
        214,
        300 * progress,
        160,
      ]);
      rect(24, 386, 20, 9, accent, 0.85);
      text("Object density", 51, 382, 14);
      const history = f.judgementHistory,
        p = history?.progress ?? 0;
      rect(8, 410, 300 * p, 8, accent, 0.1 * p);
      for (const m of history?.markers ?? [])
        rect(
          8 + m.position * 300 * p,
          414 - 4 * m.progress,
          2,
          8 * m.progress,
          m.grade === "0"
            ? "#e56c82"
            : m.grade === "50"
              ? "#e8c45a"
              : "#91df9b",
          p * m.progress,
        );
    }
    component = "key-overlay";
    if (enabled.has("key-overlay"))
      for (const [i, lane] of (f.keys ?? []).entries()) {
        const y = 398 + i * 54;
        for (const hold of lane.holds)
          rect(
            1694 + 172 * hold.start,
            y,
            172 * Math.max(0.012, hold.end - hold.start),
            38,
            "#ffffff",
            0.14,
          );
        rect(1866, y, 6, 38, "#ffffff", lane.pressed ? 1 : 0.27);
        text(`${lane.bpm}`, 1856 - width("bpm",12), y + 9, 18, white, 1, "right");
        text("bpm", 1856, y + 14, 12, white, 1, "right");
        text(String(lane.count), 1880, y + 3, 15);
        text(`k${i + 1}`, 1880, y + 19, 12, muted);
      }
    component = "leaderboard";
    if (enabled.has("leaderboard")) {
      const rows = f.leaderboard?.rows ?? [],
        pinned = rows.some((r) => r.current && r.slot === 7),
        clip: [number, number, number, number] = [4, 434, 365, 384];
      for (const r of [...rows].sort(
        (a, b) => Number(a.current) - Number(b.current),
      )) {
        const slot = r.slot ?? rows.indexOf(r),
          y = 434 + slot * 48,
          a =
            (r.opacity ?? 1) *
            (r.current ? 1 : 0.52) *
            (pinned && !r.current ? Math.max(0, Math.min(1, 7 - slot)) : 1);
        if (a <= 0) continue;
        rect(4, y, 299, 46, "#080a0e", a * (r.current ? 0.58 : 0.52), clip);
        if (r.current) rect(4, y + 10, 4, 28, accent, 0.8 * a, clip);
        text(String(r.position), 30, y + 14, 15, white, a, "center", clip);
        const avatar = images.get(`${r.avatar}:36:36`);
        if (avatar) sprite(avatar, 51, y + 5, 36, 36, rgb("#ffffff", a), clip);
        text(
          gradeLabel(r.grade),
          88,
          y + 28,
          17,
          gradeColor(r.grade, r.mods),
          a,
          "right",
          clip,
        );
        text(r.name, 94, y + 4, 17, white, a, "left", [
          94,
          Math.max(434, y),
          132,
          Math.max(0, Math.min(818, y + 25) - Math.max(434, y)),
        ]);
        const score =
          r.score >= 1e6
            ? `${(r.score / 1e6).toFixed(2)}M`
            : r.score >= 1000
              ? `${(r.score / 1000).toFixed(2)}K`
              : String(r.score);
        text(score, 94, y + 27, 14, muted, a, "left", clip);
        text(
          `${r.combo}x`,
          r.misses ? 201 : 226,
          y + 27,
          14,
          white,
          a,
          "right",
          clip,
        );
        if (r.misses)
          text(String(r.misses), 226, y + 27, 14, "#e56c82", a, "right", clip);
        text(
          r.pp == null ? "" : `${Math.round(r.pp)}pp`,
          295,
          y + 4,
          19,
          white,
          a,
          "right",
          clip,
        );
        text(
          `${r.accuracy.toFixed(2)}%`,
          295,
          y + 27,
          14,
          muted,
          a,
          "right",
          clip,
        );
        let mx = 312;
        for (const mod of displayMods(r.mods)) {
          const image = images.get(
            `../shared/assets/mods/mod-${modNames[mod]}.svg:24:24`,
          );
          if (image) {
            sprite(image, mx, y + 14, 18, 18, rgb("#ffffff", a), clip);
            frame.sprites.at(-1)!.underlay = true;
            mx += 16;
          }
        }
      }
      text(
        f.leaderboard?.caption ?? "Online scores unavailable",
        166,
        826,
        14,
        muted,
        1,
        "center",
      );
    }
    return frame;
  }
  return {
    batch(start: number, count: number): HudBatch {
      const frames = Array.from({ length: count }, (_, i) =>
        applyLayout(draw((start + i) / o.fps)),
      );
      const fresh = assets;
      assets = [];
      return { frames, assets: fresh };
    },
  };
}
Object.assign(window, { createNativeHud: create });
