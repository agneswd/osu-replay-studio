import type { OverlayMonthlyCount } from "./types";
export interface SplineTick {
    label: string;
    y: number;
}
export interface SplineYearTick {
    year: number;
    x: number;
}
export interface PlaycountSpline {
    d: string;
    peakX: number;
    peakY: number;
    yTicks: SplineTick[];
    yearTicks: SplineYearTick[];
}
export const SPLINE_X0 = 20;
export const SPLINE_X1 = 425;
export const SPLINE_TOP = 8;
export const SPLINE_BOTTOM = 126;
function monthTime(date: string): number {
    const match = /^(\d{4})-(\d{2})/.exec(date);
    if (!match)
        return Number.NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
}
function formatTick(value: number): string {
    return value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;
}
export function buildPlaycountSpline(counts: OverlayMonthlyCount[] | undefined): PlaycountSpline {
    const yTicks = (max: number): SplineTick[] => [1, 0.75, 0.5, 0.25].map((part) => ({
        label: formatTick(max * part),
        y: SPLINE_BOTTOM - (SPLINE_BOTTOM - SPLINE_TOP) * part,
    }));
    if (!counts || counts.length < 2) {
        return {
            d: "", peakX: 0, peakY: 0, yTicks: [], yearTicks: [],
        };
    }
    const dated = counts
        .map((count) => ({ ...count, time: monthTime(count.date) }))
        .filter((count) => Number.isFinite(count.time))
        .sort((a, b) => a.time - b.time);
    if (dated.length < 2)
        return buildPlaycountSpline(undefined);
    const start = dated[0]!.time;
    const end = dated[dated.length - 1]!.time;
    const position = (time: number) => SPLINE_X0 + ((time - start) / (end - start)) * (SPLINE_X1 - SPLINE_X0);
    const firstYear = new Date(start).getUTCFullYear();
    const lastYear = new Date(end).getUTCFullYear();
    const allYears = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
    const yearStep = Math.max(1, Math.ceil(allYears.length / 9));
    const visibleYears = allYears.filter((_, i) => i % yearStep === 0);
    if (visibleYears.at(-1) !== lastYear)
        visibleYears.push(lastYear);
    const yearTicks = visibleYears.map((year) => ({
        year,
        x: Number(Math.min(SPLINE_X1, Math.max(SPLINE_X0, position(Date.UTC(year, 0, 1)))).toFixed(1)),
    }));
    let maxCount = 0;
    dated.forEach((c) => {
        if (c.count > maxCount)
            maxCount = c.count;
    });
    const step = 10 ** Math.floor(Math.log10(Math.max(1, maxCount)));
    const maxCap = Math.max(1, Math.ceil(maxCount * 1.05 / step) * step);
    const pts = dated.map((m) => {
        const x = position(m.time);
        const y = SPLINE_BOTTOM - (Math.min(maxCap, m.count) / maxCap) * (SPLINE_BOTTOM - SPLINE_TOP);
        return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), count: m.count };
    });
    let peak = pts[0]!;
    pts.forEach((p) => {
        if (p.count > peak.count)
            peak = p;
    });
    let d = `M ${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]!;
        const p1 = pts[i]!;
        const p2 = pts[i + 1]!;
        const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
        const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
        const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
        const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
        const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return { d, peakX: peak.x, peakY: peak.y, yTicks: yTicks(maxCap), yearTicks };
}
