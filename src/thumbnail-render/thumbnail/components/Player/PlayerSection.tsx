import type { AvatarConfig, CountryFlagConfig, BadgeLayerConfig } from "../../types";
import { BadgeLayer } from "../Panels/Panels";
import { layerStyle } from "../Layer";
import { resolveAssetUrl } from "../../../shared/assets/assetUrl";
export function Avatar({ url, config, }: {
    url?: string;
    config: AvatarConfig;
}) {
    if (!config.visible)
        return null;
    const src = resolveAssetUrl(url);
    return (<div style={layerStyle(config, {
            width: config.width,
            height: config.height,
            borderRadius: config.radius,
            border: config.border ? `${config.border.width}px solid ${config.border.color}` : undefined,
            boxShadow: config.shadow
                ? `${config.shadow.x}px ${config.shadow.y}px ${config.shadow.blur}px ${config.shadow.color}`
                : undefined,
            overflow: "hidden",
            background: "rgba(255,255,255,0.06)",
        })} data-layer="avatar">
      {src ? (<img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: config.objectFit }}/>) : null}
    </div>);
}
export function CountryFlag({ countryCode, config, }: {
    countryCode?: string;
    config: CountryFlagConfig;
}) {
    if (!config.visible || !countryCode)
        return null;
    return (<div style={layerStyle(config, {
            width: config.width,
            height: config.height,
            borderRadius: config.radius,
            border: config.border ? `${config.border.width}px solid ${config.border.color}` : undefined,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        })} data-layer="country-flag">
      <span style={{ display: "block", textAlign: "center", fontSize: 36 }}>{countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))}</span>
    </div>);
}
export function UsernamePanel({ username, config, }: {
    username: string;
    config: BadgeLayerConfig;
}) {
    return (<BadgeLayer config={config} testId="username">
      {username}
    </BadgeLayer>);
}
