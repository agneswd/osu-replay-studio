import type { CSSProperties, ReactNode } from "react";
import type { LayerBase } from "../types";
export function layerStyle(layer: LayerBase, extra?: CSSProperties): CSSProperties {
    return {
        position: "absolute",
        left: layer.x,
        top: layer.y,
        opacity: layer.opacity ?? 1,
        ...(layer.rotation ? { transform: `rotate(${layer.rotation}deg)` } : {}),
        ...extra,
    };
}
export function Layer({ config, style, children, testId, }: {
    config: LayerBase;
    style?: CSSProperties;
    children?: ReactNode;
    testId?: string;
}) {
    if (!config.visible)
        return null;
    return (<div style={layerStyle(config, style)} data-layer={testId}>
      {children}
    </div>);
}
