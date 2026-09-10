import type { CSSProperties } from "react";
import type { TextEffect } from "../../types";
import { softGlow, TEXT_SHADOW_3D } from "../../../shared/formatting/color";

export function textEffects(config: TextEffect, color: string): CSSProperties {
  const shadow = config.shadow ? `${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color}` : TEXT_SHADOW_3D;
  const glow = config.glow ? softGlow(config.glow.color ?? color, config.glow.blur, config.glow.layers ?? 2) : "";
  const filter = [config.shadow ? `drop-shadow(${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color})` : "",
    config.glow ? `drop-shadow(0 0 ${config.glow.blur}px ${config.glow.color ?? color})` : ""].filter(Boolean).join(" ");
  return config.gradient ? {
    backgroundImage: config.gradient, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    textShadow: "none", filter: filter || undefined,
  } : { textShadow: [shadow, glow].filter(Boolean).join(", ") };
}
