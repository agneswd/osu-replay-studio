import { useEditingText } from "../editable-text.js";
import { useEffect, cloneElement } from "react";
import type { ThumbnailData } from "../shared/types/thumbnail";
import type { ThumbnailTemplate } from "./types";
import { computeTexts, withTextOverride } from "./texts";
import { BackgroundLayer } from "./components/Background/BackgroundLayer";
import { BadgeRow, BadgeLayer, PanelLayer, StarNotch } from "./components/Panels/Panels";
import { TextLayer } from "./components/Text/TextLayer";
import { ModList } from "./components/Mods/ModList";
import { Avatar, CountryFlag, UsernamePanel } from "./components/Player/PlayerSection";
import { BottomMessage, TwitchLogo } from "./components/Branding/Branding";
import { CuteSparkles } from "./components/Decorations/CuteSparkles";
declare global {
    interface Window {
        __THUMBNAIL_READY?: boolean;
    }
}
function gradeColor(data: ThumbnailData, template: ThumbnailTemplate): string {
    if (template.components.grade.color !== template.theme.grade) {
        return template.components.grade.color;
    }
    if (data.grade === "S" || data.grade === "SS") {
        const hd = data.mods.some((m) => m.acronym === "HD" || m.acronym === "FL");
        return hd ? "#A5A4A6" : "#E7CE56";
    }
    return template.dataOptions.gradeColors[data.grade] ?? template.components.grade.color;
}
export function leaderboardColor(data: ThumbnailData, template: ThumbnailTemplate): string {
    if (template.components.leaderboard.color !== template.theme.leaderboard)
        return template.components.leaderboard.color;
    if (data.leaderboardPosition === 1)
        return "#E7CE56";
    if (data.leaderboardPosition === 2)
        return "#A5A4A6";
    if (data.leaderboardPosition === 3)
        return "#CD7F32";
    return "#63E564";
}
function starColor(data: ThumbnailData, template: ThumbnailTemplate): string {
    if (template.components.starRating.color !== template.theme.starRating) {
        return template.components.starRating.color;
    }
    const colors = template.components.starNotch.statusColors;
    const status = data.beatmapStatus;
    if (colors) {
        if (status && colors[status])
            return colors[status];
        if (status &&
            ["graveyard", "grave", "wip", "pending", "unranked", "unknown"].includes(status) &&
            (colors.graveyard || colors.grave || colors.unranked || colors.unknown)) {
            return colors.graveyard ?? colors.grave ?? colors.unranked ?? colors.unknown ?? template.components.starRating.color;
        }
        if (colors.ranked)
            return colors.ranked;
    }
    return template.components.starRating.color;
}
export function Thumbnail({ data, template, scale = 1, markReady = false, accentRange, onlyLayer, layerId, }: {
    onlyLayer?: string;
    layerId?: string;
    data: ThumbnailData;
    template: ThumbnailTemplate;
    scale?: number;
    markReady?: boolean;
    accentRange?: { start: number; end: number };
}) {
    const { canvas, components: c } = template;
    const texts = computeTexts(data, template);
    const text = (key: string) => withTextOverride(key, texts, template);
    const grade = data.grade === "SS"
        ? template.id === "reference"
            ? {
            ...c.grade,
            x: template.positionOverrides?.grade?.x ?? 48,
            width: template.sizeOverrides?.grade?.width ?? 260,
            maxWidth: template.sizeOverrides?.grade?.maxWidth ?? 260,
            fontSize: template.fontSizeOverrides?.grade ?? 310,
            }
            : template.id === "cute"
                ? {
                    ...c.grade,
                    y: template.positionOverrides?.grade?.y ?? c.grade.y,
                    height: template.sizeOverrides?.grade?.height ?? c.grade.height,
                    valign: c.grade.valign,
                    fontSize: template.fontSizeOverrides?.grade ?? 165,
                }
                : c.grade
        : c.grade;
    const rawMapText = template.id === "cute" && template.textOverrides?.["map-title"] === undefined
        ? data.title
        : text("map-title");
    const mapText = rawMapText;
    const rawArtist = text("map-artist");
    const mapArtist = template.id === "cute" && template.textOverrides?.["map-artist"] === undefined && rawArtist.length > 34
        ? `${rawArtist.slice(0, 33).trimEnd()}…`
        : rawArtist;
    const difficultyText = text("difficulty");
    const visibleDifficulty = template.id === "cute" && template.textOverrides?.difficulty === undefined && difficultyText.length > 25
        ? `${difficultyText.slice(0, 24).trimEnd()}…`
        : difficultyText;
    const bgSrc = data.backgroundUrl ?? data.backgroundFallbacks?.[0];
    const editingMiss = useEditingText("status-miss"), editingSB = useEditingText("status-sb");
    const hasMisses = editingMiss || text("status") !== "";
    const hasSliderBreaks = editingSB || text("status-sb") !== "";
    const splitStatus = hasMisses && hasSliderBreaks;
    const isSbPosOverridden = Boolean(template.positionOverrides?.["status-sb"] || template.positionOverrides?.["statusSB"]);
    const isSbSizeOverridden = Boolean(template.fontSizeOverrides?.["status-sb"] || template.fontSizeOverrides?.["statusSB"] || template.sizeOverrides?.["status-sb"]);
    const isMissSizeOverridden = Boolean(template.fontSizeOverrides?.["status-miss"] || template.fontSizeOverrides?.["status"]);
    const statusMiss = {
        ...c.statusMiss,
        fontSize: !isMissSizeOverridden && splitStatus ? c.statusMiss.fontSize * .75 : c.statusMiss.fontSize,
        ...(template.id === "reference" && splitStatus ? { y: 8, height: 145 } : {}),
        ...(template.id === "cute" && splitStatus
            ? { y: 230, height: 110, valign: "center" as const }
            : {}),
    };
    const statusSB = {
        ...c.statusSB,
        ...(template.id === "reference" && !hasMisses ? { height: 205 } : {}),
        fontSize: isSbSizeOverridden
            ? c.statusSB.fontSize
            : template.id === "cute"
                ? (splitStatus ? 58 : c.statusSB.fontSize)
            : splitStatus
                ? c.statusSB.fontSize
                : !hasMisses
                    ? c.statusMiss.fontSize
                    : c.statusSB.fontSize,
        x: isSbPosOverridden
            ? c.statusSB.x
            : template.id === "cute"
                ? c.statusSB.x
            : !hasMisses
                ? c.statusMiss.x
                : c.statusSB.x,
        y: isSbPosOverridden
            ? c.statusSB.y
            : template.id === "cute"
                ? (splitStatus ? 345 : c.statusSB.y)
            : !hasMisses
                ? c.statusMiss.y
                : c.statusSB.y,
        ...(template.id === "cute" && splitStatus
            ? { height: 70, valign: "center" as const }
            : {}),
    };
    useEffect(() => {
        if (!markReady)
            return;
        let cancelled = false;
        const check = () => {
            if (cancelled)
                return;
            const root = document.getElementById("thumbnail-root");
            const images = root ? Array.from(root.querySelectorAll("img")) : [];
            const fontsReady = document.fonts.status === "loaded";
            const imagesReady = images.every((img) => img.complete);
            if (fontsReady && imagesReady) {
                window.__THUMBNAIL_READY = true;
                document.documentElement.setAttribute("data-render-ready", "true");
                return;
            }
            requestAnimationFrame(check);
        };
        void document.fonts.ready.then(check);
        return () => {
            cancelled = true;
        };
    }, [markReady, data, template]);
    const elements = {
      "top-panel": <PanelLayer config={c.topPanel} backgroundSrc={bgSrc} />,
      "star-notch": <StarNotch config={c.starNotch} beatmapStatus={data.beatmapStatus} />,
      status: data.status.kind === "fc" && !hasSliderBreaks ? <TextLayer config={c.status} testId="status">{text("status")}</TextLayer> : null,
      "status-miss": data.status.kind !== "fc" && hasMisses ? <TextLayer config={statusMiss} testId="status-miss">{text("status")}</TextLayer> : null,
      "status-sb": hasSliderBreaks ? <TextLayer config={statusSB} testId="status-sb">{text("status-sb")}</TextLayer> : null,
      "star-rating": <TextLayer config={{ ...c.starRating, color: starColor(data, template) }} testId="star-rating">{text("star-rating")}</TextLayer>,
      pp: <TextLayer config={c.pp} testId="pp">{text("pp")}</TextLayer>,
      combo: <BadgeLayer config={c.comboBadge} testId="combo" variant="row">{text("combo")}</BadgeLayer>,
      difficulty: <BadgeLayer config={c.difficultyBadge} testId="difficulty" variant="row">{visibleDifficulty}</BadgeLayer>,
      bpm: <BadgeLayer config={c.bpmBadge} testId="bpm" variant="row">{text("bpm")}</BadgeLayer>,
      "map-artist": c.mapArtist ? <TextLayer config={c.mapArtist} testId="map-artist">{mapArtist}</TextLayer> : null,
      "map-title": <TextLayer config={c.mapTitle} testId="map-title">{mapText}</TextLayer>,
      grade: <TextLayer config={{ ...grade, color: gradeColor(data, template) }} testId="grade">{text("grade")}</TextLayer>,
      accuracy: <TextLayer config={c.accuracy} testId="accuracy">{text("accuracy")}</TextLayer>,
      leaderboard: <TextLayer config={{ ...c.leaderboard, color: leaderboardColor(data, template) }} testId="leaderboard">{text("leaderboard")}</TextLayer>,
      avatar: <Avatar url={data.avatarUrl} config={c.avatar} />,
      "country-flag": <CountryFlag countryCode={data.countryCode} config={c.countryFlag} />,
      username: <UsernamePanel username={text("username")} config={c.usernamePanel} testId={layerId} />,
      "mod-list": <ModList mods={data.mods} config={c.modList} />,
      "twitch-logo": <TwitchLogo config={c.twitchLogo} />,
      sparkles: c.sparkles?.visible ? <CuteSparkles config={c.sparkles} color={template.theme.accent} /> : null,
      "bottom-message": c.bottomMessage?.visible ? <BottomMessage text={text("bottom-text")} accentRange={accentRange} config={c.bottomMessage} testId={layerId} /> : null,
    };
    const badges = <BadgeRow config={c.badgeRow}>{elements.combo}{elements.difficulty}{elements.bpm}</BadgeRow>;
    if (onlyLayer) {
      if (onlyLayer === "badge-row") return badges;
      const element = elements[onlyLayer as keyof typeof elements];
      if (!element) return null;
      return "testId" in element.props ? cloneElement(element, { testId: layerId }) : element;
    }
    return <div id="thumbnail-root" style={{ position: "relative", width: canvas.width, height: canvas.height,
      transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top left", overflow: "hidden",
      background: "#141414", fontFamily: c.mapTitle.fontFamily }}>
      <BackgroundLayer config={{ ...template.background, source: data.backgroundUrl ?? template.background.source, fallbacks: data.backgroundFallbacks ?? template.background.fallbacks }} />
      {Object.entries(elements).filter(([id]) => !["combo", "difficulty", "bpm"].includes(id)).map(([id, element]) => element && cloneElement(element, { key: id }))}
      {badges}
      {c.innerBorder?.visible && <div data-layer="inner-border" style={{ position: "absolute", inset: c.innerBorder.inset ?? 18,
        border: c.innerBorder.border ?? "2px solid rgba(255,255,255,.35)", borderRadius: c.innerBorder.borderRadius ?? 20,
        boxShadow: "0 0 16px rgba(255,255,255,.12)", pointerEvents: "none", zIndex: 15 }} />}
    </div>;
}
