let ctx: CanvasRenderingContext2D | null | undefined;
function measureWidth(text: string, font: string, letterSpacing: number): number {
    if (ctx === undefined) {
        ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    }
    if (!ctx)
        return 0;
    ctx.font = font;
    return ctx.measureText(text).width + letterSpacing * Math.max(0, text.length - 1);
}
export interface FitSpec {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    letterSpacing?: number;
}
export function fitFontSize(text: string, spec: FitSpec, maxWidth: number, minSize = 20): number {
    if (maxWidth <= 0 || typeof document === "undefined" || text === "")
        return spec.fontSize;
    const width = measureWidth(text, `${spec.fontWeight} ${spec.fontSize}px ${spec.fontFamily}`, spec.letterSpacing ?? 0);
    if (width <= maxWidth)
        return spec.fontSize;
    const scaled = Math.floor((spec.fontSize * maxWidth) / Math.max(1, width));
    return Math.max(minSize, scaled);
}
