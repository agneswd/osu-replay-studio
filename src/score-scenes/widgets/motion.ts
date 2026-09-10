import type { OverlayData } from "./types";
import type { PlaycountSpline } from "./spline";

export const OVERLAY_TOTAL_CYCLE = 5.4;
export const SHOWCASE_INTRO_TOTAL_CYCLE = 5.4;

export function easeMotionDecel(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let s = t;
  for (let i = 0; i < 5; i++) {
    const s2 = s * s;
    const s3 = s2 * s;
    const oneMinus = 1 - s;
    const currentX = 3 * oneMinus * oneMinus * s * 0.16 + 3 * oneMinus * s2 * 0.3 + s3;
    const dx = 3 * oneMinus * oneMinus * 0.16 + 6 * oneMinus * s * (0.3 - 0.16) + 3 * s2 * (1 - 0.3);
    if (Math.abs(dx) < 1e-6) break;
    s -= (currentX - t) / dx;
    s = clampProgress(s);
  }
  const oneMinusS = 1 - s;
  return 1 - oneMinusS * oneMinusS * oneMinusS;
}

export const clampProgress = (value: number): number => Math.min(1, Math.max(0, value));
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

export type LayerMotion = { opacity: number; x: number; y: number; scale: number };
export type IntroMotion = {
  widget: LayerMotion & { rotateX: number; perspective: number; originTop: boolean };
  topCard: LayerMotion;
  bottomCard: LayerMotion & { clipBottom: number };
  playerHeaderLeft: number;
  playerHeaderRight: number;
  topPlayer: LayerMotion;
  topMap: LayerMotion;
  bottomPlayer: LayerMotion;
  bottomMap: LayerMotion;
  starFooter: LayerMotion;
  bannerPlayer: number;
  bannerMap: number;
  wipes: { visible: boolean; yPercent: number }[];
  chartProgress: number;
  peakProgress: number;
  yearProgress: number;
  hours: number;
  playcount: number;
  fills: { ar: number; cs: number; od: number; hp: number };
  mapPath: number;
  favs: number;
  plays: number;
  chevronY: number;
  starScale: number;
  showMap: boolean;
};
export type OutroMotion = {
  topBar: LayerMotion;
  lens: { opacity: number; y: number; scale: number };
  grade: LayerMotion;
  leftFlyout: LayerMotion;
  rightFlyout: LayerMotion;
  rightItems: number[];
  leftItems: number[];
  bottomTime: number;
  container: number;
};

const layer = (opacity = 1, x = 0, y = 0, scale = 1): LayerMotion => ({ opacity, x, y, scale });

function parseCount(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

export function introMotion(t: number, data: OverlayData, spline?: PlaycountSpline): IntroMotion {
  const peakX = spline?.peakX ?? 134;
  const peakThreshold = Math.max(0.08, Math.min(0.92, (peakX - 20) / 405));
  const motion: IntroMotion = {
    widget: { ...layer(1), rotateX: 0, perspective: 1200, originTop: false },
    topCard: layer(1),
    bottomCard: { ...layer(1), clipBottom: 0 },
    playerHeaderLeft: 0,
    playerHeaderRight: 0,
    topPlayer: layer(0),
    topMap: layer(0),
    bottomPlayer: layer(0),
    bottomMap: layer(0),
    starFooter: layer(0),
    bannerPlayer: 0,
    bannerMap: 0,
    wipes: [{ visible: false, yPercent: -101 }, { visible: false, yPercent: -101 }],
    chartProgress: 0,
    peakProgress: 0,
    yearProgress: 0,
    hours: 0,
    playcount: 0,
    fills: { ar: 0, cs: 0, od: 0, hp: 0 },
    mapPath: 0,
    favs: 0,
    plays: 0,
    chevronY: -1.5 + 1.5 * Math.cos((t * Math.PI * 2) / 1.8),
    starScale: 1.075 - 0.075 * Math.cos((t * Math.PI * 2) / 2.5),
    showMap: t >= 2.68,
  };

  if (t < 0.50) {
    motion.widget.opacity = clampProgress(t / 0.08);
    const pA = easeMotionDecel(clampProgress(t / 0.35));
    motion.topCard = layer(pA, 0, 40 * (1 - pA));
    motion.playerHeaderLeft = -5 * (1 - pA);
    motion.playerHeaderRight = 5 * (1 - pA);
    motion.topPlayer = layer(pA);
    motion.bannerPlayer = 0.55 * pA;
    if (t < 0.10) {
      motion.bottomCard = { ...layer(0), clipBottom: 100 };
    } else {
      const pB = easeMotionDecel(clampProgress((t - 0.10) / 0.35));
      motion.bottomCard = { ...layer(pB, 0, 28 * (1 - pB)), clipBottom: Math.max(0, (1 - pB) * 100) };
      motion.bottomPlayer = layer(pB);
      if (t >= 0.25) {
        motion.chartProgress = easeMotionDecel(clampProgress((t - 0.25) / 1.35));
        motion.peakProgress = motion.chartProgress;
        motion.yearProgress = clampProgress((t - 0.20) / 0.35);
        const countEase = easeMotionDecel(clampProgress((t - 0.25) / 1.20));
        motion.hours = Math.round(data.player.hours * countEase);
        motion.playcount = Math.round(data.player.playcount * countEase);
      }
    }
  } else if (t < 2.30) {
    motion.topPlayer = layer(1);
    motion.bottomPlayer = layer(1);
    motion.bannerPlayer = 0.55;
    motion.chartProgress = easeMotionDecel(clampProgress((t - 0.25) / 1.35));
    motion.peakProgress = motion.chartProgress;
    motion.yearProgress = 1;
    const countEase = easeMotionDecel(clampProgress((t - 0.25) / 1.20));
    motion.hours = Math.round(data.player.hours * countEase);
    motion.playcount = Math.round(data.player.playcount * countEase);
  } else if (t < 3.06) {
    const showMap = t >= 2.68;
    motion.wipes = ([["top", 0.04], ["bottom", 0]] as const).map(([, delay]) => {
      const progress = clampProgress((t - 2.30 - delay) / 0.72);
      const eased = (1 - Math.cos(Math.PI * progress)) / 2;
      return { visible: progress > 0 && progress < 1, yPercent: -101 + 164 * eased };
    });
    motion.topPlayer = layer(showMap ? 0 : 1);
    motion.bottomPlayer = layer(showMap ? 0 : 1);
    motion.topMap = layer(showMap ? 1 : 0);
    motion.bottomMap = layer(showMap ? 1 : 0);
    motion.bannerPlayer = showMap ? 0 : 0.55;
    motion.bannerMap = showMap ? 0.55 : 0;
    motion.chartProgress = 1;
    motion.peakProgress = 1;
    motion.yearProgress = 1;
    motion.hours = data.player.hours;
    motion.playcount = data.player.playcount;
  } else if (t < 4.70) {
    motion.topMap = layer(1);
    motion.bottomMap = layer(1);
    const detailsEase = easeMotionDecel(clampProgress((t - 3.06) / 0.28));
    motion.starFooter = layer(detailsEase, 0, (1 - detailsEase) * 6);
    motion.bannerMap = 0.55;
  } else {
    motion.topMap = layer(1);
    motion.bottomMap = layer(1);
    motion.starFooter = layer(1);
    const { pClose, pull } = widgetCloseScale(t);
    motion.widget = {
      opacity: 1 - clampProgress((pClose - .82) / .18),
      x: 0,
      y: 760 * pull,
      scale: 1,
      rotateX: -65 * Math.sin(pClose * Math.PI / 2),
      perspective: 1200 - 900 * pClose,
      originTop: true,
    };
  }

  if (t >= 2.68) {
    const statsProgress = easeOutCubic(clampProgress((t - 2.72) / 0.85));
    motion.fills = {
      ar: statsProgress * Math.min(1, data.map.ar / 11),
      cs: statsProgress * Math.min(1, data.map.cs / 10),
      od: statsProgress * Math.min(1, data.map.od / 11),
      hp: statsProgress * Math.min(1, data.map.hp / 10),
    };
    motion.mapPath = easeOutCubic(clampProgress((t - 2.80) / 0.90));
    const countProgress = easeOutCubic(clampProgress((t - 2.94) / 0.85));
    motion.favs = Math.round(parseCount(data.map.favs) * countProgress);
    motion.plays = Math.round(parseCount(data.map.plays) * countProgress);
  }

  if (motion.peakProgress < peakThreshold) motion.peakProgress = 0;
  else motion.peakProgress = easeMotionDecel(clampProgress((motion.peakProgress - peakThreshold) / 0.15));
  return motion;
}

export function widgetCloseScale(t: number) {
  const pClose = clampProgress((t - 4.85) / .55);
  const pull = pClose * pClose;
  return {
    pClose,
    pull,
    scaleX: 1 - .98 * pull,
    scaleY: 1 + .8 * Math.sin(pClose * Math.PI),
  };
}

export function outroMotion(t: number): OutroMotion {
  const flyout = (begin: number, end: number, offset: number): LayerMotion => {
    if (t < begin) return layer(0, offset);
    if (t < end) {
      const p = easeMotionDecel(t - begin);
      return layer(p, offset * (1 - p));
    }
    return layer(1);
  };
  let topBar = layer(1);
  if (t <= 0) topBar = layer(0, 0, -24);
  else if (t < 0.7) {
    const p = easeMotionDecel(t / 0.7);
    topBar = layer(p, 0, -24 * (1 - p));
  }
  let lens = { opacity: 1, y: 0, scale: 1 };
  if (t < 0.15) lens = { opacity: 0, y: 240, scale: 0.4 };
  else if (t < 1.15) {
    const p = easeMotionDecel((t - 0.15) / 1.0);
    lens = { opacity: Math.min(1, p * 3), y: 240 * (1 - p), scale: 0.4 + 0.6 * p };
  }
  let grade = layer(1, 0, -4);
  if (t < 0.75) grade = layer(0, 0, -4, 0.65);
  else if (t < 1.55) {
    const p = easeMotionDecel((t - 0.75) / 0.8);
    grade = layer(p, 0, -4, 0.65 + 0.35 * p);
  }
  return {
    topBar,
    lens,
    grade,
    leftFlyout: flyout(1.10, 2.10, 90),
    rightFlyout: flyout(1.15, 2.15, -90),
    leftItems: [0, 1, 2, 3, 4, 5].map(index => easeMotionDecel(clampProgress((t - 1.10 - index * .12) / .55))),
    rightItems: [0, 1, 2, 3, 4].map(index => easeMotionDecel(clampProgress((t - 1.15 - index * .07) / .55))),
    bottomTime: t < 1.80 ? 0 : t < 2.50 ? clampProgress((t - 1.80) / 0.70) : 1,
    container: t >= 5.10 ? Math.max(0, 1 - (t - 5.10) / 0.30) : 1,
  };
}


