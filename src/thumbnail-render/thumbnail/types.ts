export interface LayerBase {
    visible: boolean;
    x: number;
    y: number;
    opacity?: number;
    rotation?: number;
}
export interface TextEffect {
    shadow?: {
        offsetX: number;
        offsetY: number;
        blur: number;
        color: string;
    };
    glow?: {
        color?: string;
        blur: number;
        layers?: number;
    };
    gradient?: string;
    stroke?: {
        width: number;
        color: string;
    };
    extrusion?: {
        depth: number;
        color?: string;
        offsetX?: number;
        offsetY?: number;
    };
}
export interface TextLayerConfig extends LayerBase, TextEffect {
    width?: number;
    height?: number;
    maxWidth?: number;
    maxLines?: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing?: number;
    lineHeight?: number;
    textTransform?: "none" | "uppercase";
    color: string;
    align?: "left" | "center" | "right";
    valign?: "top" | "center" | "bottom";
    transform?: string;
    background?: string;
    border?: string;
    borderRadius?: number | string;
    padding?: string;
    boxShadow?: string;
}
export interface CustomTextLayerConfig extends TextLayerConfig {
    id: string;
    text: string;
}
export interface BadgeLayerConfig extends TextLayerConfig {
    background: string;
    borderColor: string;
    borderWidth: number;
    radius: number | string;
    paddingX?: number;
    autoWidth?: boolean;
    maxWidth?: number;
    centerX?: boolean;
    leftAccent?: {
        color: string;
        width: number;
    };
}
export interface PanelLayerConfig extends LayerBase {
    width: number;
    height: number;
    background: string;
    borderColor?: string;
    borderWidth?: number;
    radius: number;
    backdropBlur?: number;
    backgroundImage?: {
        blur: number;
        brightness: number;
        saturation: number;
        scale: number;
        objectFit: "cover" | "contain";
        objectPosition: string;
        overlayColor: string;
        overlayOpacity: number;
        overlayGradient?: string;
        overlayGradientOpacity?: number;
    };
    shadow?: {
        x: number;
        y: number;
        blur: number;
        color: string;
    };
}
export interface OverlayConfig {
    visible: boolean;
    kind?: "solid" | "linear-gradient" | "radial-gradient";
    color?: string;
    gradient?: string;
    opacity: number;
    blendMode?: string;
    boxShadow?: string;
    border?: string;
}
export interface BackgroundConfig {
    visible: boolean;
    source?: string;
    fallbacks?: string[];
    blur: number;
    brightness: number;
    saturation: number;
    contrast?: number;
    scale: number;
    objectFit: "cover" | "contain";
    objectPosition: string;
    overlays: OverlayConfig[];
}
export interface AvatarConfig extends LayerBase {
    width: number;
    height: number;
    radius: number;
    border?: {
        color: string;
        width: number;
    };
    shadow?: {
        x: number;
        y: number;
        blur: number;
        color: string;
    };
    objectFit: "cover" | "contain";
}
export interface CountryFlagConfig extends LayerBase {
    width: number;
    height: number;
    radius: number;
    border?: {
        color: string;
        width: number;
    };
}
export interface ModListConfig extends LayerBase {
    iconSize: number;
    gap: number;
    radius: number;
    opacity?: number;
    glow?: {
        color: string;
        blur: number;
    };
    fallbackAcronyms: boolean;
    modColors?: Record<string, {
        bg: string;
        fg: "dark" | "light";
    }>;
}
export interface TwitchLogoConfig extends LayerBase {
    asset: string;
    size: number;
    radius: number;
    background: string;
    tint?: string;
}
export interface BottomMessageConfig extends LayerBase {
    width?: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    prefixColor: string;
    highlightedColor: string;
    highlightedGlow?: {
        color?: string;
        blur: number;
        layers?: number;
    };
    letterSpacing?: number;
}
export interface StarNotchConfig extends LayerBase {
    assets?: Partial<Record<string, string>>;
    statusColors?: Partial<Record<string, string>>;
    asset?: string;
    statusFilters?: Partial<Record<string, string>>;
    width: number;
    height: number;
    background: string;
    bottomColor?: string;
    radius: number;
    tailColor: string;
    iconColor: string;
}
export interface ThemeColors {
    panel: string;
    panelBorder: string;
    fc: string;
    starRating: string;
    pp: string;
    accent: string;
    leaderboard: string;
    text: string;
    muted: string;
    badgeBorder: string;
    badgeBackground: string;
    namePanel: string;
    twitch: string;
    grade: string;
}
export interface TemplateDataOptions {
    mapNameFormat: "title" | "artist-title";
    fcText: string;
    missText: string;
    sbText: string;
    highStarThreshold?: number;
    highStarColor?: string;
    maxLeaderboardPosition?: number;
    gradeColors: Record<string, string>;
    bottomPrefix: string;
}
export interface BadgeRowConfig extends LayerBase {
    width: number;
    height: number;
    gap: number;
}
export interface ReferenceTemplateComponents {
    topPanel: PanelLayerConfig;
    badgeRow: BadgeRowConfig;
    status: TextLayerConfig;
    statusMiss: TextLayerConfig;
    statusSB: TextLayerConfig;
    starNotch: StarNotchConfig;
    starRating: TextLayerConfig;
    pp: TextLayerConfig;
    comboBadge: BadgeLayerConfig;
    difficultyBadge: BadgeLayerConfig;
    bpmBadge: BadgeLayerConfig;
    mapArtist?: TextLayerConfig;
    mapTitle: TextLayerConfig;
    grade: TextLayerConfig;
    accuracy: TextLayerConfig;
    leaderboard: TextLayerConfig;
    avatar: AvatarConfig;
    countryFlag: CountryFlagConfig;
    usernamePanel: BadgeLayerConfig;
    modList: ModListConfig;
    twitchLogo: TwitchLogoConfig;
    bottomMessage: BottomMessageConfig;
    sparkles?: LayerBase & {
        color?: string;
        count?: number;
    };
    innerBorder?: LayerBase & {
        inset?: number;
        border?: string;
        borderRadius?: number;
    };
}
export interface ThumbnailTemplate {
    id: string;
    name: string;
    canvas: {
        width: number;
        height: number;
    };
    theme: ThemeColors;
    background: BackgroundConfig;
    dataOptions: TemplateDataOptions;
    components: ReferenceTemplateComponents;
    bottomHighlightOverride?: string;
    textOverrides?: Record<string, string>;
    positionOverrides?: Record<string, {
        x: number;
        y: number;
    }>;
    sizeOverrides?: Record<string, Record<string, number>>;
    colorOverrides?: Record<string, string>;
    fontSizeOverrides?: Record<string, number>;
    customTexts?: CustomTextLayerConfig[];
}
export const RESOLUTION_PRESETS = {
    "1280x720": { width: 1280, height: 720 },
    "1920x1080": { width: 1920, height: 1080 },
    "2560x1440": { width: 2560, height: 1440 },
    "3840x2160": { width: 3840, height: 2160 },
} as const;
export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;
