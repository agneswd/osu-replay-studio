import type { CSSProperties } from "react";
import type { LayerBase } from "../../types";
export interface CuteSparklesConfig extends LayerBase {
    color?: string;
    count?: number;
}
export function CuteSparkles({ config, color = "#FF6584", }: {
    config?: CuteSparklesConfig;
    color?: string;
}) {
    if (!config || !config.visible)
        return null;
    const accent = config.color ?? color;
    const containerStyle: CSSProperties = {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 18,
        mixBlendMode: "screen",
        opacity: config.opacity ?? 0.85,
    };
    return (<div style={containerStyle} data-layer="sparkles">
      <svg width="100%" height="100%" viewBox="0 0 1280 720" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="cute-sparkle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
          <g id="sparkle-star">
            <path d="M12 0 C12 6.6 6.6 12 0 12 C6.6 12 12 17.4 12 24 C12 17.4 17.4 12 24 12 C17.4 12 12 6.6 12 0 Z" fill="currentColor"/>
          </g>
        </defs>


        <g color="#FFFDF9">
          <use href="#sparkle-star" x="80" y="85" transform="scale(1.2)" filter="url(#cute-sparkle-glow)" opacity="0.9"/>
          <use href="#sparkle-star" x="80" y="85" transform="scale(1.2)" opacity="1"/>
        </g>
        <g color={accent}>
          <use href="#sparkle-star" x="140" y="150" transform="scale(0.85)" opacity="0.85"/>
          <use href="#sparkle-star" x="220" y="60" transform="scale(0.7)" opacity="0.75"/>
        </g>
        <g color="#FFEAA7">
          <use href="#sparkle-star" x="420" y="110" transform="scale(0.9)" opacity="0.8"/>
          <use href="#sparkle-star" x="850" y="70" transform="scale(1.1)" filter="url(#cute-sparkle-glow)" opacity="0.85"/>
          <use href="#sparkle-star" x="850" y="70" transform="scale(1.1)" opacity="1"/>
        </g>
        <g color="#A29BFE">
          <use href="#sparkle-star" x="1140" y="140" transform="scale(1.3)" filter="url(#cute-sparkle-glow)" opacity="0.9"/>
          <use href="#sparkle-star" x="1140" y="140" transform="scale(1.3)" opacity="1"/>
          <use href="#sparkle-star" x="1060" y="240" transform="scale(0.75)" opacity="0.75"/>
        </g>


        <g color="#FFFDF9">
          <use href="#sparkle-star" x="65" y="470" transform="scale(0.9)" opacity="0.9"/>
          <use href="#sparkle-star" x="520" y="520" transform="scale(0.8)" opacity="0.85"/>
        </g>
        <g color={accent}>
          <use href="#sparkle-star" x="560" y="430" transform="scale(1.0)" filter="url(#cute-sparkle-glow)" opacity="0.85"/>
          <use href="#sparkle-star" x="560" y="430" transform="scale(1.0)" opacity="1"/>
          <use href="#sparkle-star" x="1180" y="580" transform="scale(0.8)" opacity="0.7"/>
        </g>


        <circle cx="110" cy="280" r="4.5" fill="#FFFFFF" opacity="0.75"/>
        <circle cx="180" cy="340" r="3" fill={accent} opacity="0.8"/>
        <circle cx="340" cy="90" r="2.5" fill="#FFEAA7" opacity="0.7"/>
        <circle cx="980" cy="180" r="5" fill="#A29BFE" opacity="0.65"/>
        <circle cx="1200" cy="310" r="3.5" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="1110" cy="460" r="4" fill={accent} opacity="0.7"/>
        <circle cx="490" cy="620" r="3" fill="#FFEAA7" opacity="0.85"/>
      </svg>
    </div>);
}
