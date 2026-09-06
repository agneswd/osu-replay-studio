export interface OverlayTheme {
    accent: string;
    top: string;
    bottom: string;
    lip: string;
}
export function applyOverlayPalette(accent: string, top: string, bottom: string, lip: string): void {
    const root = document.documentElement.style;
    root.setProperty("--wipe-light", mixHex(accent, "#ffffff", 0.48));
    root.setProperty("--wipe-edge", mixHex(accent, "#121619", 0.62));
    root.setProperty("--wipe-middle", mixHex(accent, "#090c0f", 0.76));
    root.setProperty("--scene-plate-top", mixHex(accent, "#70777b", 0.38));
    root.setProperty("--scene-plate-bottom", mixHex(accent, "#30383c", 0.52));
    root.setProperty("--cyan-accent", accent);
    root.setProperty("--card-teal-top", top);
    root.setProperty("--card-teal-bottom", bottom);
    root.setProperty("--bottom-lip-color", lip);
    root.setProperty("--card-border", `${accent}55`);
    root.setProperty("--card-shadow-glow", `${accent}28`);
    const { muted, dim } = accentTextColors(accent);
    root.setProperty("--text-muted", muted);
    root.setProperty("--text-dim", dim);
    root.setProperty("--card-overlay-rgb", hexToRgb(bottom).join(", "));
}
function hexToRgb(hex: string): [number, number, number] {
    const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(hex);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}
function channelMix(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}
export function accentTextColors(accent: string): { muted: string; dim: string } {
    const [r, g, b] = hexToRgb(accent);
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const base = [r, g, b].map((c) => Math.round(c * 0.4 + luma * 0.6)) as [number, number, number];
    const [br, bg, bb] = base;
    const toHex = (c: number) => c.toString(16).padStart(2, "0");
    const muted = [channelMix(br, 255, 0.25), channelMix(bg, 255, 0.25), channelMix(bb, 255, 0.25)];
    const dim = [channelMix(br, 0, 0.35), channelMix(bg, 0, 0.35), channelMix(bb, 0, 0.35)];
    return {
        muted: `#${muted.map(toHex).join("")}`,
        dim: `#${dim.map(toHex).join("")}`,
    };
}
function mixHex(a: string, b: string, amount: number): string {
    const left = hexToRgb(a), right = hexToRgb(b);
    return "#" + left.map((channel, i) => Math.round(channel * (1 - amount) + right[i]! * amount).toString(16).padStart(2, "0")).join("");
}
export function customAccentPalette(color: string): OverlayTheme {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return {
        accent: color,
        top: `rgb(${Math.round(r * 0.18 + 5)}, ${Math.round(g * 0.18 + 8)}, ${Math.round(b * 0.18 + 12)})`,
        bottom: `rgb(${Math.round(r * 0.08 + 2)}, ${Math.round(g * 0.08 + 4)}, ${Math.round(b * 0.08 + 6)})`,
        lip: `rgb(${Math.round(r * 0.28 + 8)}, ${Math.round(g * 0.28 + 12)}, ${Math.round(b * 0.28 + 18)})`,
    };
}
