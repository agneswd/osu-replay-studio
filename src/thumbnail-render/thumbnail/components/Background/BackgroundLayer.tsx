import { useState } from "react";
import type { BackgroundConfig } from "../../types";
import { resolveAssetUrl } from "../../../shared/assets/assetUrl";
function BackgroundImage({ config, onAspect, }: {
    config: BackgroundConfig;
    onAspect?: (aspect: number) => void;
}) {
    const urls = [config.source, ...(config.fallbacks ?? [])].filter((u): u is string => Boolean(u));
    const [index, setIndex] = useState(0);
    const current = resolveAssetUrl(urls[index]);
    if (!current)
        return null;
    const overScan = config.scale;
    return (<img src={current} alt="" onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
                onAspect?.(img.naturalWidth / img.naturalHeight);
            }
        }} onError={() => setIndex((i) => i + 1)} style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: config.objectFit ?? "cover",
            objectPosition: config.objectPosition,
            transform: `scale(${overScan})`,
            filter: `blur(${config.blur}px) brightness(${config.brightness}) saturate(${config.saturation})${config.contrast !== undefined ? ` contrast(${config.contrast})` : ""}`,
        }}/>);
}
function Overlay({ config }: {
    config: BackgroundConfig["overlays"][number];
}) {
    if (!config.visible)
        return null;
    return (<div style={{
            position: "absolute",
            inset: 0,
            background: config.boxShadow || config.border
                ? undefined
                : config.kind === "solid"
                    ? config.color
                    : config.kind === "radial-gradient" && config.gradient
                        ? `radial-gradient(${config.gradient})`
                        : config.gradient
                            ? `linear-gradient(${config.gradient})`
                            : undefined,
            boxShadow: config.boxShadow,
            border: config.border,
            opacity: config.opacity,
            mixBlendMode: config.blendMode as never,
            pointerEvents: "none",
        }}/>);
}
export function BackgroundLayer({ config, onAspect, }: {
    config: BackgroundConfig;
    onAspect?: (aspect: number) => void;
}) {
    if (!config.visible)
        return null;
    return (<div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#141414" }} data-layer="background">
      <BackgroundImage config={config} onAspect={onAspect}/>
      {config.overlays.map((overlay, i) => (<Overlay key={i} config={overlay}/>))}
    </div>);
}
