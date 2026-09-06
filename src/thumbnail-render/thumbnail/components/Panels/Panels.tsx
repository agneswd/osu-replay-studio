import type { CSSProperties, ReactNode } from "react";
import { Children } from "react";
import type { BadgeLayerConfig, BadgeRowConfig, PanelLayerConfig, StarNotchConfig } from "../../types";
import { Layer, layerStyle } from "../Layer";
import { fitFontSize } from "../Text/fit";
import { TEXT_SHADOW_3D } from "../../../shared/formatting/color";
import { resolveAssetUrl } from "../../../shared/assets/assetUrl";
export function BadgeLayer({ config, children, testId, variant = "absolute", }: {
    config: BadgeLayerConfig;
    children: string;
    testId?: string;
    variant?: "absolute" | "row";
}) {
    if (!config.visible)
        return null;
    const spineWidth = config.leftAccent?.width ?? 0;
    const horizontalPadding = (config.align === "left" || config.align === "right" ? config.paddingX ?? 0 : 0) +
        (config.align === "right" ? config.paddingX ?? 0 : 0);
    const available = config.autoWidth
        ? 0
        : (config.width ?? 0) - config.borderWidth * 2 - spineWidth - horizontalPadding;
    const fontSize = available > 0 ? fitFontSize(children, config, available, 22) : config.fontSize;
    const inner = (<div data-editor-text style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: config.align === "left" ? "flex-start" : config.align === "right" ? "flex-end" : "center",
            paddingLeft: config.align !== "right" ? config.paddingX : undefined,
            paddingRight: config.align !== "left" ? config.paddingX : undefined,
            fontFamily: config.fontFamily,
            fontSize,
            fontWeight: config.fontWeight,
            letterSpacing: config.letterSpacing,
            color: config.color,
            textTransform: config.textTransform,
            whiteSpace: "pre",
            minWidth: 0,
            overflow: "hidden",
            textShadow: TEXT_SHADOW_3D,
        }}>
      {children}
    </div>);
    const transform = [
        config.centerX ? "translateX(-50%)" : "",
        config.rotation ? `rotate(${config.rotation}deg)` : "",
    ]
        .filter(Boolean)
        .join(" ");
    const shellStyle: CSSProperties = variant === "row"
        ? {
            position: "relative",
            height: "100%",
            width: config.autoWidth ? "max-content" : config.width,
            minWidth: config.autoWidth ? config.width : undefined,
            background: config.background,
            border: `${config.borderWidth}px solid ${config.borderColor}`,
            borderRadius: config.radius,
            display: "flex",
            alignItems: "center",
            flex: "0 1 auto",
            overflow: "hidden",
        }
        : layerStyle(config, {
            width: config.autoWidth ? "max-content" : config.width,
            minWidth: config.autoWidth ? config.width : undefined,
            height: config.height,
            background: config.background,
            border: `${config.borderWidth}px solid ${config.borderColor}`,
            borderRadius: config.radius,
            display: "flex",
            alignItems: "center",
            ...(transform ? { transform } : {}),
        });
    return (<div style={shellStyle} data-layer={testId}>
      {config.leftAccent ? (<div style={{
                width: config.leftAccent.width,
                alignSelf: "stretch",
                borderRadius: `${config.radius}px 0 0 ${config.radius}px`,
                background: config.leftAccent.color,
                flexShrink: 0,
            }}/>) : null}
      {inner}
    </div>);
}
export function StarNotch({ config, beatmapStatus, }: {
    config: StarNotchConfig;
    beatmapStatus?: string;
}) {
    if (!config.visible)
        return null;
    if (config.assets || config.asset) {
        const rawAsset = (beatmapStatus && config.assets?.[beatmapStatus]) ??
            (beatmapStatus && ["graveyard", "grave", "wip", "pending", "unranked", "unknown"].includes(beatmapStatus)
                ? (config.assets?.graveyard ?? config.assets?.grave ?? config.assets?.unranked ?? config.assets?.unknown)
                : config.assets?.ranked) ??
            config.asset;
        const asset = resolveAssetUrl(rawAsset);
        if (asset) {
            return (<div style={layerStyle(config)} data-layer="star-notch">
          <img src={asset} alt="" style={{ width: config.width, height: config.height, objectFit: "fill" }}/>
        </div>);
        }
    }
    const w = config.width;
    const h = config.height;
    const ry = h * 0.58;
    const gradId = "notch-gradient";
    const chevDrop = h * 0.14;
    const bottomHalf = w * 0.26;
    const topHalf = w * 0.21;
    const cy = h * 0.5;
    const stroke = w * 0.085;
    return (<div style={layerStyle(config)} data-layer="star-notch">
      <svg width={w} height={h + 2} viewBox={`0 0 ${w} ${h + 2}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.background}/>
            <stop offset="100%" stopColor={config.bottomColor ?? config.background}/>
          </linearGradient>
        </defs>
        <path d={`M 0 0 H ${w} V ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`} fill={`url(#${gradId})`}/>
        <g stroke={config.iconColor} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" transform={`translate(${w / 2}, ${cy})`}>
          <polyline points={`${-bottomHalf},${chevDrop / 2} 0,${chevDrop / 2 - chevDrop} ${bottomHalf},${chevDrop / 2}`}/>
          <polyline points={`${-topHalf},${-chevDrop / 2} 0,${-chevDrop / 2 - chevDrop} ${topHalf},${-chevDrop / 2}`}/>
        </g>
      </svg>
    </div>);
}
export function PanelLayer({ config, backgroundSrc, }: {
    config: PanelLayerConfig;
    backgroundSrc?: string;
}) {
    if (!config.visible)
        return null;
    const bg = config.backgroundImage;
    return (<div style={layerStyle(config, {
            width: config.width,
            height: config.height,
            background: config.background,
            border: config.borderColor ? `${config.borderWidth ?? 0}px solid ${config.borderColor}` : undefined,
            borderRadius: config.radius,
            backdropFilter: config.backdropBlur ? `blur(${config.backdropBlur}px)` : undefined,
            boxShadow: config.shadow ? `${config.shadow.x}px ${config.shadow.y}px ${config.shadow.blur}px ${config.shadow.color}` : undefined,
            overflow: bg ? "hidden" : undefined,
        })} data-layer="top-panel">
      {bg && backgroundSrc ? (<>
          <img src={resolveAssetUrl(backgroundSrc)} alt="" style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: bg.objectFit,
                objectPosition: bg.objectPosition,
                transform: `scale(${bg.scale})`,
                filter: `blur(${bg.blur}px) brightness(${bg.brightness}) saturate(${bg.saturation})`,
            }}/>
          <div style={{
                position: "absolute",
                inset: 0,
                background: bg.overlayGradient
                    ? `linear-gradient(${bg.overlayGradient})`
                    : bg.overlayColor,
                opacity: bg.overlayGradient ? (bg.overlayGradientOpacity ?? 1) : bg.overlayOpacity,
            }}/>
        </>) : null}
    </div>);
}
export function BadgeRow({ config, children }: {
    config: BadgeRowConfig;
    children: ReactNode;
}) {
    if (!config.visible)
        return null;
    const items = Children.toArray(children);
    return (<div style={layerStyle(config, {
            width: config.width,
            height: config.height,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: config.gap,
        })} data-layer="badge-row">
      {items.map((child, i) => (<div key={i} style={{
                display: "flex",
                justifyContent: i === 0 ? "flex-start" : i === items.length - 1 ? "flex-end" : "center",
                minWidth: 0,
            }}>
          {child}
        </div>))}
    </div>);
}
export { Layer };
