import type { RefCallback } from "react";
import { Star } from "lucide-react";
import { type OverlayData } from "./types";
import { ModIcon } from "./ModIcon";

import "./showcase-intro.css";

export type ShowcaseNode =
    | "container"
    | "topBar"
    | "lensWrap"
    | "gradeRank"
    | "leftFlyout"
    | "rightFlyout"
    | "bottomTime";

export type ShowcaseRefSetter = (name: ShowcaseNode) => RefCallback<Element>;

function formatScoreNumber(val: string | number): string {
    const raw = String(val).replace(/\s+/g, "");
    if (!/^\d+$/.test(raw)) return String(val);
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPpValue(pp: string): string {
    const cleaned = pp.trim();
    if (!cleaned) return "0PP";
    return cleaned.toUpperCase().endsWith("PP") ? cleaned.toUpperCase() : `${cleaned}PP`;
}

function getPlayRankClass(rank: string): string {
    const r = rank.toUpperCase().replace(/H$/, "");
    if (r === "SS" || r === "X") return "rank-s";
    if (r === "S") return "rank-s";
    if (r === "A") return "rank-a";
    if (r === "B") return "rank-b";
    if (r === "C") return "rank-c";
    return "rank-d";
}

export function ShowcaseIntroWidget({
    data,
    setRef,
}: {
    data: OverlayData;
    setRef: ShowcaseRefSetter;
}) {
    const score = data.score!;

    const topScores = data.topScores ?? [];

    const rankLetter = (score.rank || "S").toUpperCase().replace(/H$/, "");
    const rankClass = rankLetter === "SS" || rankLetter === "X"
        ? "rank-silver"
        : rankLetter === "A"
        ? "rank-a"
        : rankLetter === "B"
        ? "rank-b"
        : "";

    return (
        <div className="showcase-intro-container" ref={setRef("container")}>
            {/* Top Map Attributes & Star Rating Bar */}
            <header className="showcase-top-bar" ref={setRef("topBar")}>
                <div className="showcase-gauge-group">
                    {(["cs", "ar"] as const).map((stat) => (
                        <div className="showcase-gauge-item" key={stat}>
                            <div className="showcase-gauge-track">
                                <div className={`showcase-gauge-fill ${stat}`} style={{ width: `${Math.min(100, Math.max(0, (data.map[stat] / (stat === "cs" ? 10 : 11)) * 100))}%` }} />
                            </div>
                            <div className="showcase-gauge-labels">
                                <span className="showcase-gauge-name">{`${stat.toUpperCase()}:`}</span>
                                <span className="showcase-gauge-val">{data.map[stat].toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Center Star Ribbon & Star Rating Value */}
                <div className="showcase-star-badge">
                    <div className="showcase-star-ribbon">
                        <Star className="showcase-star-icon" />
                    </div>
                    <div className="showcase-sr-value">{data.map.sr}</div>
                </div>

                <div className="showcase-gauge-group">
                    {(["od", "hp"] as const).map((stat) => (
                        <div className="showcase-gauge-item" key={stat}>
                            <div className="showcase-gauge-track">
                                <div className={`showcase-gauge-fill ${stat}`} style={{ width: `${Math.min(100, Math.max(0, (data.map[stat] / (stat === "hp" ? 10 : 11)) * 100))}%` }} />
                            </div>
                            <div className="showcase-gauge-labels">
                                <span className="showcase-gauge-name">{`${stat.toUpperCase()}:`}</span>
                                <span className="showcase-gauge-val">{data.map[stat].toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>

            </header>

            {/* Center Circular Lens */}
            <div className="showcase-lens-wrap" ref={setRef("lensWrap")}>
                <div
                    className="showcase-lens-artwork"
                    style={{ backgroundImage: `url(${data.map.cover})` }}
                />
                <div className="showcase-lens-dim" />
                <div
                    className={`showcase-grade-rank ${rankClass}`}
                    ref={setRef("gradeRank")}
                >
                    {rankLetter}
                </div>
                <div className="showcase-score-mods">
                    {score.mods.map((mod, index) => (
                        <ModIcon key={`${mod}-${index}`} mod={{ acronym: mod }} size={32} radius={5.3}
                            allowFallback={true}
                            colorOverrides={undefined} />
                    ))}
                </div>
            </div>

            {/* Left Flyout: Player Card & Top Plays Stack Curved Along Lens */}
            <aside className="showcase-left-flyout" ref={setRef("leftFlyout")}>
                <div className="showcase-player-card">
                    <img
                        className="showcase-player-avatar"
                        src={data.player.avatar}
                        alt={data.player.username}
                        loading="eager"
                        onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            if (!el.dataset.fallback) {
                                el.dataset.fallback = "1";
                                el.src = data.map.cover;
                            }
                        }}
                    />
                    <div className="showcase-player-meta">
                        <div className="showcase-player-name">
                            {data.player.username} <span className="showcase-player-grank">{data.player.grank}</span>
                        </div>
                        <div className="showcase-player-sub">
                            <span className="showcase-player-flag">{data.player.flag}</span>
                            <span className="showcase-player-crank">{data.player.crank}</span>
                        </div>
                    </div>
                </div>

                <div className="showcase-top-plays-list">
                    {topScores.map((play, idx) => {
                        const title = Array.from(play.title);
                        return (
                            <div key={`${play.title}-${idx}`} className={`showcase-play-item showcase-play-row-${idx + 1}`}>
                                <div className="showcase-play-thumb-wrap">
                                    <img
                                        className="showcase-play-thumb"
                                        src={play.cover || data.map.cover}
                                        alt={play.title}
                                        loading="eager"
                                        onError={(e) => {
                                            const el = e.target as HTMLImageElement;
                                            if (!el.dataset.fallback) {
                                                el.dataset.fallback = "1";
                                                el.src = data.map.cover;
                                            }
                                        }}
                                    />
                                    <div className="showcase-play-thumb-dim" />
                                    <div className={`showcase-play-rank-badge ${getPlayRankClass(play.rank)} ${play.mods?.some(mod => mod === "HD" || mod === "FL") ? "silver" : "gold"}`}>
                                        {play.rank.toUpperCase().replace(/H$/, "")}
                                    </div>
                                </div>

                                <div className="showcase-play-body">
                                    <div className="showcase-play-title" title={play.title}>
                                        {title.length > 18 ? `${title.slice(0, 18).join("").trimEnd()}...` : play.title}
                                    </div>
                                    <div className="showcase-play-meta">
                                        {play.mods && play.mods.length > 0 && (
                                            <div className="showcase-mod-combo">
                                                {play.mods.map((mod, index) => (
                                                    <ModIcon key={`${mod}-${index}`} mod={{ acronym: mod }} size={14} radius={2.3}
                                                        allowFallback={true}
                                                        colorOverrides={undefined} />
                                                ))}
                                            </div>
                                        )}
                                        <span className="showcase-play-time">{play.timeAgo}</span>
                                        <span className="showcase-play-pp">{play.pp}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* Right Flyout: Score, Combo, PP Badge, Accuracy, Hit Judgments Curved Along Lens */}
            <aside className="showcase-right-flyout" ref={setRef("rightFlyout")}>
                <div className="showcase-right-item showcase-score-row">
                    <span className="showcase-score-label">Score</span>
                    <span className="showcase-score-val">{formatScoreNumber(score.totalScore)}</span>
                </div>

                <div className="showcase-right-item showcase-combo-row">
                    {formatScoreNumber(score.combo)}/{formatScoreNumber(score.maxCombo)}x
                </div>

                <div className="showcase-right-item showcase-pp-badge">
                    <span className="showcase-pp-text">{formatPpValue(score.pp)}</span>
                </div>

                <div className="showcase-right-item showcase-acc-row">
                    {score.accuracy}
                </div>

                <div className="showcase-right-item showcase-hits-strip">
                    <div className="showcase-hit-box h300">
                        <span>{score.count300}</span>
                    </div>
                    <div className="showcase-hit-box h100">
                        <span>{score.count100}</span>
                    </div>
                    {score.count50 > 0 && <div className="showcase-hit-box h50"><span>{score.count50}</span></div>}
                    <div className="showcase-hit-box h0">
                        <span>{score.countMiss}</span>
                    </div>
                </div>
            </aside>

            {/* Bottom Timestamp */}
            <footer className="showcase-bottom-time" ref={setRef("bottomTime")}>
                {score.playedAtAgo}
            </footer>
        </div>
    );
}
