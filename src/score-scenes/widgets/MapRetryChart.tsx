import type { RefCallback } from "react";

export function MapRetryChart({ retries, pathRef }: {
  retries?: { fail: number[]; exit: number[] }; pathRef: RefCallback<SVGPathElement>;
}) {
  const length = Math.max(retries?.fail.length ?? 0, retries?.exit.length ?? 0);
  if (length < 2) return <div className="map-retry-chart unavailable">Map retry data unavailable</div>;
  const counts = Array.from({ length }, (_, i) => Math.max(0, (retries?.fail[i] ?? 0) + (retries?.exit[i] ?? 0)));
  const peak = Math.max(1, ...counts);
  const unit = 10 ** Math.floor(Math.log10(peak));
  const max = Math.ceil(peak / unit) * unit;
  const points = counts.map((count, i) => ({ x: 26 + i / (length - 1) * 398, y: 78 - count / max * 63 }));
  const curve = points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const label = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n));
  return <div className="map-retry-chart">
    <div className="map-chart-caption">Fails and exits by map progress</div>
    <svg className="history-svg" viewBox="0 0 430 100" role="img" aria-label="Fail and exit counts across the beatmap">
      {[0, .5, 1].map(fraction => <g key={fraction}>
        <line className="chart-grid-h" x1="26" y1={78 - fraction * 63} x2="424" y2={78 - fraction * 63} />
        <text className="chart-label-axis" x="22" y={81 - fraction * 63} textAnchor="end">{label(max * fraction)}</text>
      </g>)}
      <path className="chart-curve-path" d={curve} ref={pathRef} />
      {[0, 25, 50, 75, 100].map(percent => <text key={percent} className="chart-label-axis" x={26 + percent / 100 * 398} y="96" textAnchor={percent === 0 ? "start" : percent === 100 ? "end" : "middle"}>{percent}%</text>)}
    </svg>
  </div>;
}
