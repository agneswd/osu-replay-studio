import { introExitStart, sceneDuration } from "../../../core/presentation.js";
import type { OverlayData } from "./types";
import type { OverlayNode } from "./OverlayWidget";
import type { ShowcaseNode } from "./ShowcaseIntroWidget";
export { easeMotionDecel, OVERLAY_TOTAL_CYCLE, SHOWCASE_INTRO_TOTAL_CYCLE } from "./motion";
import { easeMotionDecel, clampProgress, easeOutCubic, outroMotion } from "./motion";

export interface OverlayNodeSource {
    get(name: OverlayNode): Element | null;
}

function styled(nodes: OverlayNodeSource, name: OverlayNode): HTMLElement | SVGElement | null {
    return nodes.get(name) as HTMLElement | SVGElement | null;
}

function paintLayer(
    nodes: OverlayNodeSource,
    name: OverlayNode,
    progress: number,
    translateX = 0,
    translateY = 0
): void {
    const el = styled(nodes, name);
    if (!el) return;
    const clamped = clampProgress(progress);
    el.classList.toggle("visible", clamped > 0);
    el.style.opacity = String(clamped);
    if (translateX !== 0 || translateY !== 0) {
        el.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px)`;
    } else {
        el.style.transform = "";
    }
}

function setBanners(nodes: OverlayNodeSource, data: OverlayData, playerOpacity: number, mapOpacity: number): void {
    const playerBanner = styled(nodes, "topBanner") as HTMLElement | null;
    if (playerBanner) {
        playerBanner.style.backgroundImage = `url("${data.player.banner}")`;
        playerBanner.style.opacity = String(playerOpacity);
    }
    const mapBanner = styled(nodes, "topBannerMap") as HTMLElement | null;
    if (mapBanner) {
        mapBanner.style.backgroundImage = `url("${data.map.cover}")`;
        mapBanner.style.opacity = String(mapOpacity);
    }
}

function setCounter(node: Element | null, value: number): void {
    if (node) {
        node.textContent = value.toLocaleString();
    }
}

const dashLengths = new WeakMap<Element, { d: string | null; length: number }>();
function measuredDash(el: Element): number {
    const current = typeof el.getAttribute === "function" ? el.getAttribute("d") : null;
    const known = dashLengths.get(el);
    if (known && known.d === current) return known.length;
    let length = 1200;
    try {
        const measured = (el as unknown as SVGPathElement).getTotalLength?.();
        if (typeof measured === "number" && measured > 0) length = measured;
    } catch {
        // Fallback default
    }
    dashLengths.set(el, { d: current, length });
    return length;
}

function hidePath(nodes: OverlayNodeSource, name: OverlayNode): void {
    const el = styled(nodes, name);
    if (!el) return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(length);
}

function drawPath(nodes: OverlayNodeSource, name: OverlayNode, progress: number): void {
    const el = styled(nodes, name);
    if (!el) return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(Math.round(length * (1 - clampProgress(progress))));
}

function clearMapSide(nodes: OverlayNodeSource): void {
    const fills: OverlayNode[] = ["fillAr", "fillCs", "fillOd", "fillHp"];
    for (const name of fills) {
        const el = styled(nodes, name);
        if (el) el.style.width = "0%";
    }
    hidePath(nodes, "svgMapPath");
    const favs = nodes.get("mFavs");
    if (favs) favs.textContent = "0";
    const plays = nodes.get("mPlays");
    if (plays) plays.textContent = "0";

}

function parseCount(value: string): number {
    return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function paintPeak(nodes: OverlayNodeSource, progress: number): void {
    const dot = styled(nodes, "pPeakDot");
    const line = styled(nodes, "pPeakLine");
    const dotEl = nodes.get("pPeakDot");
    const cx = dotEl && typeof dotEl.getAttribute === "function" ? Number(dotEl.getAttribute("cx")) || 134 : 134;
    const peakThreshold = Math.max(0.08, Math.min(0.92, (cx - 20) / 405));

    if (progress < peakThreshold) {
        if (dot) {
            dot.style.opacity = "0";
            dot.style.transform = "scale(0)";
        }
        if (line) {
            line.style.opacity = "0";
        }
    } else {
        const p = clampProgress((progress - peakThreshold) / 0.15);
        const pEase = easeMotionDecel(p);
        if (dot) {
            dot.style.opacity = String(pEase);
            const cy = dotEl && typeof dotEl.getAttribute === "function" ? Number(dotEl.getAttribute("cy")) || 25 : 25;
            dot.style.transformOrigin = `${cx}px ${cy}px`;
            dot.style.transform = `scale(${(0.7 + 0.3 * pEase).toFixed(2)})`;
        }
        if (line) {
            line.style.opacity = String(pEase);
        }
    }
}

function paintLoopingIcons(nodes: OverlayNodeSource, t: number): void {
    const chevron = styled(nodes, "mapChevron");
    if (chevron) {
        chevron.style.transform = `translateY(${-1.5 + 1.5 * Math.cos((t * Math.PI * 2) / 1.8)}px)`;
    }
    const star = styled(nodes, "starIcon");
    if (star) {
        star.style.transform = `scale(${1.075 - 0.075 * Math.cos((t * Math.PI * 2) / 2.5)})`;
    }
}

function setYearsOpacity(nodes: OverlayNodeSource, progress: number): void {
    const group = nodes.get("chartYearsGroup");
    if (!group || typeof group.querySelectorAll !== "function") return;
    const labels = group.querySelectorAll(".chart-label-x");
    labels.forEach((node, idx) => {
        const threshold = idx * 0.08;
        const p = clampProgress((progress - threshold) / 0.35);
        (node as HTMLElement).style.opacity = String(p);
    });
}

export function seekOverlay(t: number, nodes: OverlayNodeSource, data: OverlayData): void {
    paintLoopingIcons(nodes, t);

    const widget = styled(nodes, "widget");
    if (widget) { widget.style.filter = ""; widget.style.transformOrigin = "center center"; }
    const topCard = styled(nodes, "topCard");
    const bottomCard = styled(nodes, "bottomCard");
    const playerHeaderLeft = styled(nodes, "playerHeaderLeft");
    const playerHeaderRight = styled(nodes, "playerHeaderRight");
    const pHours = nodes.get("pHours");
    const pPlaycount = nodes.get("pPlaycount");
    const fillAr = styled(nodes, "fillAr");
    const fillCs = styled(nodes, "fillCs");
    const fillOd = styled(nodes, "fillOd");
    const fillHp = styled(nodes, "fillHp");
    // Reset every seek so scrubbing and exported frames use the same state.
    for (const name of ["topWipe", "bottomWipe"] as const) {
        const wipe = styled(nodes, name);
        if (wipe) {
            wipe.style.transform = "translateY(-101%)";
            wipe.style.visibility = "hidden";
        }
    }
    for (const card of [topCard, bottomCard]) {
        if (!card) continue;
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
        card.style.clipPath = "";
    }

    if (t >= 0.50 && t < introExitStart && widget) {
        widget.style.opacity = "1";
        widget.style.transform = "scale(1)";
    }
    if ((t >= 0.50 && t < 2.30) || (t >= 3.06 && t < introExitStart)) {
        for (const card of [topCard, bottomCard]) {
            if (!card) continue;
            card.style.opacity = "1";
            card.style.transform = "scale(1)";
            card.style.boxShadow = "";
        }
        if (bottomCard) bottomCard.style.clipPath = "";
        if (playerHeaderLeft) playerHeaderLeft.style.transform = "translateX(0)";
        if (playerHeaderRight) playerHeaderRight.style.transform = "translateX(0)";
    }

    // Opening, 0.00-0.50s.
    if (t < 0.50) {
        const stageOpacity = clampProgress(t / 0.08);
        if (widget) {
            widget.style.opacity = String(stageOpacity);
            widget.style.transform = "scale(1)";
        }

        // Container A (Profile Header) - 350ms duration
        const pA = easeMotionDecel(clampProgress(t / 0.35));
        if (topCard) {
            topCard.style.opacity = String(pA);
            topCard.style.transform = `translateY(${(40 * (1 - pA)).toFixed(2)}px)`;
        }
        if (playerHeaderLeft) {
            playerHeaderLeft.style.transform = `translateX(${(-5 * (1 - pA)).toFixed(2)}px)`;
        }
        if (playerHeaderRight) {
            playerHeaderRight.style.transform = `translateX(${(5 * (1 - pA)).toFixed(2)}px)`;
        }
        paintLayer(nodes, "topPlayer", pA);
        paintLayer(nodes, "topMap", 0);
        setBanners(nodes, data, 0.55 * pA, 0);

        // Container B (Graph Panel) - Delayed entrance (+100ms delay, 350ms duration)
        if (t < 0.10) {
            if (bottomCard) {
                bottomCard.style.clipPath = "inset(0 0 100% 0 round 14px)";
                bottomCard.style.opacity = "0";
                bottomCard.style.transform = "scale(1)";
            }
            paintLayer(nodes, "bottomPlayer", 0);
            hidePath(nodes, "svgPlayerPath");
            paintPeak(nodes, 0);
            setYearsOpacity(nodes, 0);
            setCounter(pHours, 0);
            setCounter(pPlaycount, 0);
        } else {
            const pB = easeMotionDecel(clampProgress((t - 0.10) / 0.35));
            const curtainPercent = Math.max(0, (1 - pB) * 100).toFixed(1);
            if (bottomCard) {
                bottomCard.style.clipPath = `inset(0 0 ${curtainPercent}% 0 round 14px)`;
                bottomCard.style.opacity = String(pB);
                bottomCard.style.transform = `translateY(${(28 * (1 - pB)).toFixed(2)}px)`;
            }
            paintLayer(nodes, "bottomPlayer", pB);

            // Graph line starts completely blank until curtain opens at t = 0.25s,
            // then smoothly draws from 0% all the way to 100% (NO snap-back or resets)
            if (t < 0.25) {
                hidePath(nodes, "svgPlayerPath");
                paintPeak(nodes, 0);
                setYearsOpacity(nodes, 0);
                setCounter(pHours, 0);
                setCounter(pPlaycount, 0);
            } else {
                const lineProgress = easeMotionDecel(clampProgress((t - 0.25) / 1.35));
                drawPath(nodes, "svgPlayerPath", lineProgress);
                paintPeak(nodes, lineProgress);

                // Year labels fade in sequentially along bottom
                const yearProgress = clampProgress((t - 0.20) / 0.35);
                setYearsOpacity(nodes, yearProgress);

                // Numbers count up in tandem
                const countProgress = easeMotionDecel(clampProgress((t - 0.25) / 1.20));
                setCounter(pHours, Math.round(data.player.hours * countProgress));
                setCounter(pPlaycount, Math.round(data.player.playcount * countProgress));
            }
        }

        paintLayer(nodes, "bottomMap", 0);
        paintLayer(nodes, "starFooter", 0);
        clearMapSide(nodes);
    }
    // Player view, 0.50-2.30s.
    else if (t < 2.30) {

        paintLayer(nodes, "topPlayer", 1);
        paintLayer(nodes, "bottomPlayer", 1);
        paintLayer(nodes, "topMap", 0);
        paintLayer(nodes, "bottomMap", 0);
        paintLayer(nodes, "starFooter", 0);

        setBanners(nodes, data, 0.55, 0);

        // Graph line smoothly completes the full graph line from 0% to 100%
        const lineDrawP = clampProgress((t - 0.25) / 1.35);
        const lineEase = easeMotionDecel(lineDrawP);
        drawPath(nodes, "svgPlayerPath", lineEase);
        paintPeak(nodes, lineEase);
        setYearsOpacity(nodes, 1);

        const countProgress = clampProgress((t - 0.25) / 1.20);
        const countEase = easeMotionDecel(countProgress);
        setCounter(pHours, Math.round(data.player.hours * countEase));
        setCounter(pPlaycount, Math.round(data.player.playcount * countEase));
        clearMapSide(nodes);
    }
    // Player-to-map transition, 2.30-3.06s.
    else if (t < 3.06) {

        // The oversized wipe keeps moving while it fully covers the content swap.
        const showMap = t >= 2.68;
        for (const [name, delay] of [["topWipe", 0.04], ["bottomWipe", 0]] as const) {
            const wipe = styled(nodes, name);
            if (!wipe) continue;
            const progress = clampProgress((t - 2.30 - delay) / 0.72);
            const eased = (1 - Math.cos(Math.PI * progress)) / 2;
            wipe.style.visibility = progress > 0 && progress < 1 ? "visible" : "hidden";
            // A 160%-height wipe travels from above the card to below it.
            wipe.style.transform = `translateY(${(-101 + 164 * eased).toFixed(3)}%)`;
        }
        paintLayer(nodes, "topPlayer", showMap ? 0 : 1);
        paintLayer(nodes, "bottomPlayer", showMap ? 0 : 1);
        paintLayer(nodes, "topMap", showMap ? 1 : 0);
        paintLayer(nodes, "bottomMap", showMap ? 1 : 0);
        paintLayer(nodes, "starFooter", 0);
        setBanners(nodes, data, showMap ? 0 : 0.55, showMap ? 0.55 : 0);
        drawPath(nodes, "svgPlayerPath", 1);
        setCounter(pHours, data.player.hours);
        setCounter(pPlaycount, data.player.playcount);

        clearMapSide(nodes);
    }
    // Map view, 3.06s until the closing fade.
    else if (t < introExitStart) {

        paintLayer(nodes, "topPlayer", 0);
        paintLayer(nodes, "bottomPlayer", 0);

        // topMap is fully landed and remains completely solid and visible (NO BLINKING)
        paintLayer(nodes, "topMap", 1, 0);

        // bottomMap and starFooter glide in together
        const detailsP = clampProgress((t - 3.06) / 0.28);
        const detailsEase = easeMotionDecel(detailsP);
        paintLayer(nodes, "bottomMap", 1);
        paintLayer(nodes, "starFooter", detailsEase, 0, (1 - detailsEase) * 6);

        setBanners(nodes, data, 0, 0.55);


    }
    // Fade the card while revealing the held gameplay frame.
    else {
        const pClose = clampProgress((t - introExitStart) / (sceneDuration - introExitStart));
        paintLayer(nodes, "topPlayer", 0);
        paintLayer(nodes, "bottomPlayer", 0);
        paintLayer(nodes, "topMap", 1);
        paintLayer(nodes, "bottomMap", 1);
        paintLayer(nodes, "starFooter", 1);
        if (widget) {
            const pull = pClose * pClose * (3 - 2 * pClose);
            widget.style.transformOrigin = "center top";
            widget.style.transform = `translateY(${48 * pull}px)`;
            widget.style.opacity = String(1 - pull);
        }


    }
    // Start each animation as the downward wipe exposes that part of the map card.
    if (t >= 2.68) {
        const statsProgress = easeOutCubic(clampProgress((t - 2.72) / 0.85));
        if (fillAr) fillAr.style.width = `${statsProgress * Math.min(100, (data.map.ar / 11) * 100)}%`;
        if (fillCs) fillCs.style.width = `${statsProgress * Math.min(100, (data.map.cs / 10) * 100)}%`;
        if (fillOd) fillOd.style.width = `${statsProgress * Math.min(100, (data.map.od / 11) * 100)}%`;
        if (fillHp) fillHp.style.width = `${statsProgress * Math.min(100, (data.map.hp / 10) * 100)}%`;
        drawPath(nodes, "svgMapPath", easeOutCubic(clampProgress((t - 2.80) / 0.90)));
        const countProgress = easeOutCubic(clampProgress((t - 2.94) / 0.85));
        setCounter(nodes.get("mFavs"), Math.round(parseCount(data.map.favs) * countProgress));
        setCounter(nodes.get("mPlays"), Math.round(parseCount(data.map.plays) * countProgress));
    }

}

export interface ShowcaseNodeSource {
    get(name: ShowcaseNode): Element | null;
}

export function seekShowcaseIntro(t: number, nodes: ShowcaseNodeSource): void {
    const motion = outroMotion(t);
    const set = (name: ShowcaseNode, opacity: number, transform?: string) => {
        const element = nodes.get(name) as HTMLElement | null;
        if (!element) return;
        element.style.opacity = String(opacity);
        if (transform) element.style.transform = transform;
    };
    set("topBar", motion.topBar.opacity, `translateY(${motion.topBar.y}px)`);
    set("lensWrap", motion.lens.opacity, `translate(-50%, calc(-50% + ${motion.lens.y}px)) scale(${motion.lens.scale})`);
    set("gradeRank", motion.grade.opacity, `translateY(${motion.grade.y}px) scale(${motion.grade.scale})`);
    set("leftFlyout", 1, "none");
    const player = nodes.get("leftFlyout")?.querySelector<HTMLElement>(".showcase-player-card");
    if (player) {
        player.style.opacity = String(motion.leftFlyout.opacity);
        player.style.transform = `translateX(${motion.leftFlyout.x}px)`;
    }
    nodes.get("leftFlyout")?.querySelectorAll<HTMLElement>(".showcase-play-item").forEach((element, index) => {
        const progress = motion.leftItems[index] ?? 1;
        element.style.transform = `translateX(${90 * (1 - progress)}px)`;
        element.style.opacity = String(progress);
    });
    set("rightFlyout", motion.rightFlyout.opacity, `translateX(${motion.rightFlyout.x}px)`);
    nodes.get("rightFlyout")?.querySelectorAll<HTMLElement>(".showcase-right-item").forEach((element, index) => {
        const progress = motion.rightItems[index] ?? 1;
        element.style.translate = `${-38 * (1 - progress)}px 0`;
        element.style.opacity = String(progress);
    });
    set("bottomTime", motion.bottomTime);
    set("container", motion.container);
}
