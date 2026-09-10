import { textEffects } from "./effects";
import { EditableText, useEditingText } from "../../../editable-text.js";
import type { CSSProperties } from "react";
import type { TextLayerConfig } from "../../types";
import { fitFontSize } from "./fit";
export function TextLayer({ config, children, testId, }: {
    config: TextLayerConfig;
    children: string;
    testId?: string;
}) {
    const editing = useEditingText(testId);
    if (!config.visible || (children === "" && !editing))
        return null;
    const fitWidth = config.maxWidth ?? config.width;
    const fitText = config.maxLines
        ? children.split("\n").reduce((longest, line) => line.length > longest.length ? line : longest, "")
        : children;
    const fontSize = fitWidth !== undefined
        ? fitFontSize(fitText, config, fitWidth, config.maxLines ? 32 : 20)
        : config.fontSize;
    const strokeStyle = config.stroke
        ? `${config.stroke.width}px ${config.stroke.color}`
        : undefined;
    const extrusionFilters = config.extrusion
        ? Array.from({ length: config.extrusion.depth }, (_, i) => {
            const step = i + 1;
            const ox = (config.extrusion?.offsetX ?? 1) * step;
            const oy = (config.extrusion?.offsetY ?? 1) * step;
            const col = config.extrusion?.color ?? config.stroke?.color ?? "var(--shadow-color, #06070C)";
            return `drop-shadow(${ox}px ${oy}px 0px ${col})`;
        }).join(" ")
        : "";
    const effect = textEffects(config, config.color);
    const style: CSSProperties = {
        position: "absolute",
        left: config.x,
        top: config.y,
        width: config.width,
        height: config.height,
        fontFamily: config.fontFamily,
        fontSize,
        fontWeight: config.fontWeight,
        letterSpacing: config.letterSpacing,
        lineHeight: config.lineHeight ?? 1.1,
        color: config.color,
        background: config.background,
        WebkitTextStroke: strokeStyle,
        paintOrder: "stroke fill",
        transform: config.transform,
        transformOrigin: "left center",
        border: config.border,
        borderRadius: config.borderRadius,
        padding: config.padding,
        boxShadow: config.boxShadow,
        textAlign: config.align ?? "left",
        textTransform: config.textTransform ?? "none",
        ...effect,
        filter: [extrusionFilters, effect.filter].filter(Boolean).join(" ") || undefined,
        whiteSpace: config.maxLines ? "pre-line" : "pre",
        overflow: config.maxLines ? "hidden" : undefined,
        WebkitBoxOrient: config.maxLines ? "vertical" : undefined,
        WebkitLineClamp: config.maxLines,
        display: config.maxLines ? "-webkit-box" : undefined,
        ...(config.valign === "center" && config.height
            ? { display: "flex", alignItems: "center", justifyContent: config.align === "center" ? "center" : config.align === "right" ? "flex-end" : "flex-start" }
            : {}),
    };
    return (<EditableText id={testId} style={style} data-layer={testId}>
      {children}
    </EditableText>);
}
