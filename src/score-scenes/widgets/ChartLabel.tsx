import type { CSSProperties } from "react";

// HTML labels keep a fixed font size when Chromium rescales the animated SVG.
export function ChartLabel({ x, y, children, align = "end", middle = false, className = "" }: {
  x: number; y: number; children: React.ReactNode; align?: "start" | "middle" | "end"; middle?: boolean; className?: string;
}) {
  const textAlign: CSSProperties["textAlign"] = align === "middle" ? "center" : align === "end" ? "right" : "left";
  return <foreignObject x={x - (align === "end" ? 50 : align === "middle" ? 25 : 0)} y={y - (middle ? 8 : 12)} width="50" height="16" className={className}>
    <div className="chart-label-axis" style={{ fontSize: 8.5, lineHeight: "16px", whiteSpace: "nowrap", textAlign }}>{children}</div>
  </foreignObject>;
}
