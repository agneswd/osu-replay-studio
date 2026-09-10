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
            ...(config.border ? (config.borderMode === "bottom"
              ? { border: "none", borderBottom: `${config.border.width}px solid ${config.border.color}` }
              : { border: `${config.border.width}px solid ${config.border.color}` }) : {}),
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
    const code = countryCode?.toUpperCase();
    if (!config.visible || !code || !/^[A-Z]{2}$/.test(code))
        return null;
    return (<div style={layerStyle(config, {
            width: config.width,
            height: config.height,
            borderRadius: config.radius,
            ...(config.border ? (config.borderMode === "bottom"
              ? { border: "none", borderBottom: `${config.border.width}px solid ${config.border.color}` }
              : { border: `${config.border.width}px solid ${config.border.color}` }) : {}),
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        })} data-layer="country-flag">
      <img src={`../../shared/assets/flags/${code}.svg`} alt={code} onError={event => { event.currentTarget.style.visibility = "hidden"; }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </div>);
}
export function UsernamePanel({ username, config, testId = "username", }: {
    username: string;
    testId?: string;
    config: BadgeLayerConfig;
}) {
    return (<BadgeLayer config={config} testId={testId}>
      {username}
    </BadgeLayer>);
}
