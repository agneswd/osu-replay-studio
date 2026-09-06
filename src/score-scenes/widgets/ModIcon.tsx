import { modAssetPath, modColor } from "../../mod-badges.js";
export function ModIcon({ mod, size, radius }: {
  mod: { acronym: string }; size: number; radius: number; allowFallback?: boolean; colorOverrides?: unknown;
}) {
  const color = modColor(mod.acronym);
  const asset = modAssetPath(mod.acronym);
  return <div title={mod.acronym} style={{ width: size, height: size, borderRadius: radius, background: color.bg, overflow: "hidden", flexShrink: 0, display: "grid", placeItems: "center" }}>
    {asset ? <img alt={mod.acronym} src={asset} style={{ width: "100%", height: "100%", objectFit: "cover", filter: color.fg === "dark" ? "brightness(.15)" : undefined }} /> : mod.acronym}
  </div>;
}
