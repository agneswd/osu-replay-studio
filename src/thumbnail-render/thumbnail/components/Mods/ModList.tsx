import type { NormalizedMod } from "../../../shared/types/thumbnail";
import { modAssetPath } from "../../../shared/mods/mods";
import { resolveAssetUrl } from "../../../shared/assets/assetUrl";
import type { ModListConfig } from "../../types";
export const MOD_CATEGORY_COLORS: Record<string, {
    bg: string;
    fg: "dark" | "light";
}> = {
    EZ: { bg: "#99FF4D", fg: "dark" },
    NF: { bg: "#99FF4D", fg: "dark" },
    HT: { bg: "#99FF4D", fg: "dark" },
    DC: { bg: "#99FF4D", fg: "dark" },
    HR: { bg: "#FF4D4D", fg: "light" },
    SD: { bg: "#FF4D4D", fg: "light" },
    PF: { bg: "#FF4D4D", fg: "light" },
    DT: { bg: "#FF4D4D", fg: "light" },
    NC: { bg: "#FF4D4D", fg: "light" },
    FL: { bg: "#FF4D4D", fg: "light" },
    HD: { bg: "#FF4D4D", fg: "light" },
    RX: { bg: "#4DC3FF", fg: "light" },
    AP: { bg: "#4DC3FF", fg: "light" },
    MR: { bg: "#8C5CFF", fg: "light" },
    V2: { bg: "#8C5CFF", fg: "light" },
    FI: { bg: "#FF4D9A", fg: "light" },
};
const FALLBACK_COLOR = { bg: "#8C5CFF", fg: "light" } as const;
function resolveColor(acronym: string, overrides: ModListConfig["modColors"]): {
    bg: string;
    fg: "dark" | "light";
} {
    return (overrides?.[acronym.toUpperCase()] ??
        MOD_CATEGORY_COLORS[acronym.toUpperCase()] ??
        FALLBACK_COLOR);
}
export function ModIcon({ mod, size, radius, glow, allowFallback, colorOverrides, }: {
    mod: NormalizedMod;
    size: number;
    radius: number;
    glow?: {
        color: string;
        blur: number;
    };
    allowFallback: boolean;
    colorOverrides?: ModListConfig["modColors"];
}) {
    const rawAsset = modAssetPath(mod.acronym);
    const asset = resolveAssetUrl(rawAsset ?? undefined);
    const color = resolveColor(mod.acronym, colorOverrides);
    const imgFilter = color.fg === "dark" ? "brightness(0.15)" : undefined;
    const tileFilter = glow ? `drop-shadow(0 0 ${glow.blur}px ${glow.color})` : undefined;
    if (!asset && !allowFallback)
        return null;
    return (<div style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: color.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: tileFilter,
            ...(asset ? { overflow: "hidden" } : {
                color: color.fg === "dark" ? "#221510" : "#fff",
                fontFamily: "sans-serif",
                fontWeight: 700,
                fontSize: size * 0.34,
            }),
        }} title={asset ? mod.name ?? mod.acronym : mod.acronym}>
      {asset
          ? <img src={asset} alt={mod.acronym} style={{ width: "100%", height: "100%", objectFit: "cover", filter: imgFilter }}/>
          : mod.acronym}
    </div>);
}
export function ModList({ mods, config, }: {
    mods: NormalizedMod[];
    config: ModListConfig;
}) {
    if (!config.visible || mods.length === 0)
        return null;
    return (<div style={{
            position: "absolute",
            left: config.x,
            top: config.y,
            display: "flex",
            opacity: config.opacity ?? 1,
        }} data-layer="mod-list">
      {mods.map((mod, i) => (<div key={`${mod.acronym}-${i}`} style={{ marginLeft: i > 0 ? config.gap : 0, zIndex: i }}>
          <ModIcon mod={mod} size={config.iconSize} radius={config.radius} glow={config.glow} allowFallback={config.fallbackAcronyms} colorOverrides={config.modColors}/>
        </div>))}
    </div>);
}
