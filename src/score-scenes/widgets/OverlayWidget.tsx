import type { RefCallback } from "react";
import { CheckCheck, ChevronsUp, CircleHelp, Heart, Hourglass, Play, Star } from "lucide-react";
import type { OverlayData } from "./types";
import { MapRetryChart } from "./MapRetryChart";
import type { PlaycountSpline } from "./spline";

function MapStatusIcon({ status }: { status?: string }) {
    const s = (status || "ranked").toLowerCase();
    if (s === "loved") {
        return <Heart size={15} fill="currentColor" strokeWidth={2.4} />;
    }
    if (s === "qualified") {
        return <CheckCheck size={16} strokeWidth={2.4} />;
    }
    if (s === "graveyard" || s === "grave" || s === "pending" || s === "wip" || s === "unranked") {
        return <CircleHelp size={16} strokeWidth={2.4} />;
    }
    return <ChevronsUp size={25} strokeWidth={4} />;
}
export type OverlayNode = "widget" | "topCard" | "bottomCard" | "topBanner" | "topBannerMap" | "topPlayer" | "playerHeaderLeft" | "playerHeaderRight" | "topMap" | "mapHeaderLeft" | "bottomPlayer" | "bottomMap" | "starFooter" | "starIcon" | "mapChevron" | "topWipe" | "bottomWipe" | "svgPlayerPath" | "pPeakDot" | "pPeakLine" | "pHours" | "pPlaycount" | "fillAr" | "fillCs" | "fillOd" | "fillHp" | "mFavs" | "mPlays" | "svgMapPath" | "chartYearsGroup";
export type OverlayRefSetter = (name: OverlayNode) => RefCallback<Element>;
const MAX_BADGES = 5;
function StatPill({ code, fill, fillId, node, left, right, setRef, }: {
    code: string;
    fill: string;
    fillId: string;
    node: OverlayNode;
    left?: string;
    right: string;
    setRef: OverlayRefSetter;
}) {
    return (<div className="stat-pill-row">
      <span className="stat-code-label">{code}</span>
      <div className="stat-pill-track">
        <div className={`stat-pill-fill ${fill}`} id={fillId} ref={setRef(node) as RefCallback<HTMLDivElement>}/>
        {left ? <span className="stat-pill-left-text">{left}</span> : <span/>}
        <span className="stat-pill-right-text">{right}</span>
      </div>
    </div>);
}
export function OverlayWidget({ data, spline, setRef, }: {
    data: OverlayData;
    spline: PlaycountSpline;
    setRef: OverlayRefSetter;
}) {
    const visibleBadges = data.player.badges.slice(0, MAX_BADGES);
    const extraBadges = data.player.badges.length - visibleBadges.length;
    return (<div className="overlay-widget-wrap" id="overlay-widget" ref={setRef("widget") as RefCallback<HTMLDivElement>}>
      <div className="beveled-card top-header-card" id="top-card" ref={setRef("topCard") as RefCallback<HTMLDivElement>}>
        <div className="top-banner-bg player-banner-bg" id="top-banner" ref={setRef("topBanner") as RefCallback<HTMLDivElement>}/>
        <div className="top-banner-bg map-banner-bg" id="top-banner-map" ref={setRef("topBannerMap") as RefCallback<HTMLDivElement>}/>
        <div className="top-banner-overlay"/>
        <div className="card-wipe" ref={setRef("topWipe")} />

        <div className="top-view-layer" id="layer-top-player" ref={setRef("topPlayer") as RefCallback<HTMLDivElement>}>
          <div className="player-header-left" id="player-header-left" ref={setRef("playerHeaderLeft") as RefCallback<HTMLDivElement>}>
            <img className="player-avatar-thumb" src={data.player.avatar} alt="Avatar"/>
            <div className="player-title-col">
              <div className="player-name-line">
                <span className="player-username-text">{data.player.username}</span>
                {data.player.isSupporter ? <span className="heart-pill"><Heart size={10} color="#fff" fill="#fff"/></span> : null}
              </div>
              <div className="player-country-line">
                <span>{data.player.flag}</span>
                <span>{data.player.crank}</span>
              </div>
            </div>
          </div>
          <div className="player-header-right" id="player-header-right" ref={setRef("playerHeaderRight") as RefCallback<HTMLDivElement>}>
            <div className="rank-big-num">{data.player.grank}</div>
            <div className="pp-sub-num">{data.player.pp}</div>
          </div>
        </div>

        <div className="top-view-layer" id="layer-top-map" ref={setRef("topMap") as RefCallback<HTMLDivElement>}>
          <div className="map-header-left" id="map-header-left" ref={setRef("mapHeaderLeft") as RefCallback<HTMLDivElement>}>
            <img className="map-cover-thumb" src={data.map.cover} alt="Cover"/>
            <div className="map-title-col">
              <div className="map-name-text">{data.map.title}</div>
              <div className="map-artist-text">{data.map.artist}</div>
            </div>
          </div>
          <div className="map-chevron-icon" ref={setRef("mapChevron") as RefCallback<HTMLDivElement>}>
            <div className={`map-status-badge status-${(data.map.status || "ranked").toLowerCase()}`} title={`Status: ${(data.map.status || "Ranked").toUpperCase()}`}>
              <MapStatusIcon status={data.map.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="beveled-card bottom-details-card" id="bottom-card" ref={setRef("bottomCard") as RefCallback<HTMLDivElement>}>
        <div className="bottom-card-top-lip" />
        <div className="card-wipe" ref={setRef("bottomWipe")} />

        <div className="bottom-view-layer" id="layer-bottom-player" ref={setRef("bottomPlayer") as RefCallback<HTMLDivElement>}>
          <div className="player-badges-strip">
            {data.player.badges.length === 0 ? null : (
            <div className="badges-left-group">
              <div className="badge-label-stack">
                <span>{data.player.badgeCount}</span>
                <br />
                <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>badges</span>
              </div>
              <div className="badges-image-row">
                {visibleBadges.map((b) => (<img key={b.url} className="badge-item-img" src={b.url} alt={b.title} title={b.title} onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                }}/>))}
                {extraBadges > 0 ? (<span className="badge-more-pill" title={data.player.badges.slice(MAX_BADGES).map((b) => b.title).join(", ")}>
                    +{extraBadges} more
                  </span>) : null}
              </div>
            </div>)}
          <div className="badges-right-meta playcount-meta-row">
            <div className="playcount-over-time-lbl">Playcount over time</div>
            <div className="playcount-peak-lbl">
              peak: {data.player.peakCount} ({data.player.peakMonth})
            </div>
          </div>

          </div>

          <div className="history-chart-wrap">
            <svg className="history-svg" viewBox="0 0 430 140">
              {spline.yTicks.map((tick) => (<g key={tick.y}>
                <line className="chart-grid-h" x1="20" y1={tick.y} x2="425" y2={tick.y}/>
                <text className="chart-label-axis chart-label-y" x="16" y={tick.y}>{tick.label}</text>
              </g>))}
              <line id="p-peak-line" x1="20" y1={spline.peakY} x2="425" y2={spline.peakY} stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" ref={setRef("pPeakLine") as RefCallback<SVGLineElement>}/>
              <path id="svg-player-path" className="chart-curve-path" d={spline.d} ref={setRef("svgPlayerPath") as RefCallback<SVGPathElement>}/>
              <circle className="peak-dot-static" id="p-peak-dot" cx={spline.peakX} cy={spline.peakY} r="2.8" ref={setRef("pPeakDot") as RefCallback<SVGCircleElement>}/>
              <g id="chart-years-group" ref={setRef("chartYearsGroup") as RefCallback<SVGGElement>}>
                {spline.yearTicks.map(({ year, x }, index) => (
                  <text key={year} className="chart-label-axis chart-label-x" data-year-index={index} x={x} y="139">{year}</text>
                ))}
              </g>
            </svg>
          </div>

          <div className="player-info-bottom-bar">
            <span>
              <strong className="cyan-icon"><Hourglass size={12}/></strong>{" "}
              <span ref={setRef("pHours") as RefCallback<HTMLSpanElement>}>
                {data.player.hours.toLocaleString()}
              </span>{" "}
              hours
            </span>
            <span>
              <strong className="cyan-icon"><Play size={12} fill="currentColor"/></strong> Playcount:{" "}
              <span ref={setRef("pPlaycount") as RefCallback<HTMLSpanElement>}>
                {data.player.playcount.toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        <div className="bottom-view-layer" id="layer-bottom-map" ref={setRef("bottomMap") as RefCallback<HTMLDivElement>}>
          <div className="map-stat-bars-2x2">
            <StatPill code="AR" fill="ar" fillId="fill-ar" node="fillAr" left={data.map.arMs} right={data.map.ar.toFixed(2)} setRef={setRef}/>
            <StatPill code="CS" fill="cs" fillId="fill-cs" node="fillCs" right={data.map.cs.toFixed(2)} setRef={setRef}/>
            <StatPill code="OD" fill="od" fillId="fill-od" node="fillOd" left={data.map.odMs} right={data.map.od.toFixed(2)} setRef={setRef}/>
            <StatPill code="HP" fill="hp" fillId="fill-hp" node="fillHp" right={data.map.hp.toFixed(2)} setRef={setRef}/>
          </div>

          <MapRetryChart retries={data.map.retries} pathRef={setRef("svgMapPath") as RefCallback<SVGPathElement>} />

          <div className="map-info-bottom-bar">
            <div className="map-stats-counts">
              <span><strong className="cyan-icon"><Heart size={12} fill="currentColor"/></strong> Favs: <span ref={setRef("mFavs") as RefCallback<HTMLSpanElement>}>{data.map.favs}</span></span>
              <span><strong className="cyan-icon"><Play size={12} fill="currentColor"/></strong> Plays: <span ref={setRef("mPlays") as RefCallback<HTMLSpanElement>}>{data.map.plays}</span></span>
            </div>
            <div className="mapper-pill-card">
              <img className="mapper-avatar-mini" src={data.map.mapperAvatar} alt="Mapper"/>
              <div className="mapper-text-col">
                <span className="mapper-name-title">{data.map.mapper}</span>
                <span className="mapper-sub-role">mapper</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="floating-star-footer" id="star-footer" ref={setRef("starFooter") as RefCallback<HTMLDivElement>}>
        <span className="star-gold-icon" ref={setRef("starIcon") as RefCallback<HTMLSpanElement>}><Star size={15} fill="currentColor"/></span>
        <span>{data.map.sr}</span>
        <span>•</span>
        <span>{data.map.bpm}</span>
      </div>
    </div>);
}
