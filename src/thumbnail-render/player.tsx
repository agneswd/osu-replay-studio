import { leaderboardAt } from "../../core/leaderboard.js";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Timeline } from "../../core/types.js";
import type { ThumbnailData } from "./shared/types/thumbnail.js";
import { referenceTemplate } from "./thumbnail/templates/reference/template.js";
import { computeTexts } from "./thumbnail/texts.js";
import { BackgroundLayer } from "./thumbnail/components/Background/BackgroundLayer.js";
import { PanelLayer, StarNotch, BadgeRow, BadgeLayer } from "./thumbnail/components/Panels/Panels.js";
import { TextLayer } from "./thumbnail/components/Text/TextLayer.js";
import { Avatar, CountryFlag, UsernamePanel } from "./thumbnail/components/Player/PlayerSection.js";
import { ModList } from "./thumbnail/components/Mods/ModList.js";
import { BottomMessage } from "./thumbnail/components/Branding/Branding.js";

import "./style.css";

function Thumbnail({ timeline, accent }: { timeline: Timeline; accent: string }) {
  const score = timeline.sceneInfo!.score;
  const info = timeline.sceneInfo!;
  const difficulty = timeline.title.match(/\[([^\]]+)\]$/)?.[1] ?? "";
  const fullCombo = score.maxCombo >= info.maxCombo && score.hits["0"] === 0;
  const rank = leaderboardAt(timeline, score, 100).rows.find(row => row.current)?.position;
  const data: ThumbnailData = { scoreId: timeline.replayId ?? "0", ruleset: "osu", username: timeline.player,
    userId: timeline.online?.playerId ?? 0, avatarUrl: timeline.playerAvatar, countryCode: timeline.playerCountry ?? undefined,
    leaderboardPosition: rank || undefined,
    pp: score.pp, accuracy: score.accuracy / 100, grade: score.grade.replace("SSH", "SS").replace("SH", "S"), maxCombo: score.maxCombo,
    status: fullCombo ? { kind: "fc" } : score.hits["0"] ? { kind: "miss", count: score.hits["0"] } : { kind: "unknown" },
    missCount: score.hits["0"], sbCount: fullCombo ? 0 : score.hits.sliderBreaks, isFullCombo: fullCombo,
    mods: (timeline.mods.match(/.{1,2}/g) ?? []).filter(mod => mod !== "NM" && !(mod === "DT" && timeline.mods.includes("NC"))).map(acronym => ({ acronym })), statistics: {}, beatmapId: timeline.online?.map.id ?? 0, beatmapsetId: 0,
    beatmapStatus: timeline.online?.map.status, artist: info.artist, title: info.title.replace(/\s*\[[^\]]+\]$/, ""),
    difficultyName: difficulty, baseBpm: timeline.bpm / timeline.speed, effectiveBpm: timeline.bpm, clockRate: timeline.speed,
    moddedStarRating: timeline.stars, backgroundUrl: timeline.bgImage };
  const template = structuredClone(referenceTemplate);
  const c = template.components;
  c.topPanel.borderColor = accent;
  for (const badge of [c.comboBadge, c.difficultyBadge, c.bpmBadge]) badge.borderColor = accent;
  c.usernamePanel.background = `${accent}33`;
  if (c.usernamePanel.leftAccent) c.usernamePanel.leftAccent.color = accent;
  c.bottomMessage.highlightedColor = accent;
  const text = computeTexts(data, template);
  const grade = { ...c.grade, color: ["S", "SS"].includes(data.grade) ? /HD|FL/.test(timeline.mods) ? "#BEBEBE" : "#E7CE56" : template.dataOptions.gradeColors[data.grade] ?? c.grade.color,
    ...(data.grade === "SS" ? { x: 48, width: 260, maxWidth: 260, fontSize: 310 } : {}) };
  return <div id="thumbnail-root">
    <BackgroundLayer config={{ ...template.background, source: data.backgroundUrl }} />
    <PanelLayer config={c.topPanel} backgroundSrc={data.backgroundUrl} />
    <StarNotch config={c.starNotch} beatmapStatus={data.beatmapStatus} />
    <TextLayer config={fullCombo ? c.status : c.statusMiss}>{text.status}</TextLayer>
    <TextLayer config={c.statusSB}>{text["status-sb"]}</TextLayer>
    <TextLayer config={c.starRating}>{text["star-rating"]}</TextLayer>
    <TextLayer config={c.pp}>{text.pp}</TextLayer>
    <BadgeRow config={c.badgeRow}>
      <BadgeLayer config={c.comboBadge} variant="row">{text.combo}</BadgeLayer>
      <BadgeLayer config={c.difficultyBadge} variant="row">{text.difficulty}</BadgeLayer>
      <BadgeLayer config={c.bpmBadge} variant="row">{text.bpm}</BadgeLayer>
    </BadgeRow>
    <TextLayer config={c.mapTitle}>{text["map-title"]}</TextLayer>
    <TextLayer config={grade}>{text.grade}</TextLayer>
    <TextLayer config={c.accuracy}>{text.accuracy}</TextLayer>
    <TextLayer config={{ ...c.leaderboard, color: rank === 1 ? "#E7CE56" : rank === 2 ? "#A5A4A6" : rank === 3 ? "#CD7F32" : "#63E564" }}>{text.leaderboard}</TextLayer>
    <Avatar url={data.avatarUrl} config={c.avatar} /><CountryFlag countryCode={data.countryCode} config={c.countryFlag} />
    <UsernamePanel username={data.username} config={c.usernamePanel} /><ModList mods={data.mods} config={c.modList} />
    <BottomMessage text={text["bottom-text"]} config={c.bottomMessage} />
  </div>;
}
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { async renderThumbnail(timeline: Timeline, accent: string) {
  await document.fonts.load('700 72px "Baloo 2"');
  flushSync(() => root.render(<Thumbnail timeline={timeline} accent={accent} />));
  await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
  await document.fonts.ready;
  await new Promise(requestAnimationFrame);
} });
