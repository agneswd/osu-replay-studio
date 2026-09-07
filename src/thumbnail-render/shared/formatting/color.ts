function parseHex(hex: string): [
    number,
    number,
    number
] | null {
    const value = hex.replace("#", "").trim();
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    if (!/^[0-9a-fA-F]{6}$/.test(full))
        return null;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}
export function withAlpha(color: string, alpha: number): string {
    const rgb = parseHex(color);
    if (!rgb)
        return color;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
export function mixColors(a: string, b: string, t: number): string {
    const pa = parseHex(a);
    const pb = parseHex(b);
    if (!pa || !pb)
        return a;
    const to = (x: number, y: number) => Math.round(x + (y - x) * t);
    return `#${[to(pa[0], pb[0]), to(pa[1], pb[1]), to(pa[2], pb[2])]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
}
export const TEXT_SHADOW_3D = "0 4px 0 rgba(0, 0, 0, 0.35), 0 8px 14px rgba(0, 0, 0, 0.28)";
export function softGlow(color: string, blur: number, layers = 3): string {
    const step = layers > 1 ? blur / (layers - 1) : 0;
    return Array.from({ length: layers })
        .map((_, i) => {
        const radius = layers > 1 ? blur * 0.7 + step * i : blur;
        const alpha = 0.55 * Math.pow(0.5, i);
        return `0 0 ${radius.toFixed(1)}px ${withAlpha(color, alpha)}`;
    })
        .join(", ");
}
