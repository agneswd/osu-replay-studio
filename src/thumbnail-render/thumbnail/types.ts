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
    bottomMessage: BottomMessageConfig;

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
}
