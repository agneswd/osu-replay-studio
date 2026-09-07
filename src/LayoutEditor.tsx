import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { Dropdown, Label } from "@heroui/react";
import { defaultLayout, normalizeLayout, overlayBounds, type VideoLayout } from "../core/layout.js";
import type { OverlayId } from "../core/types.js";
import { editingGroup, groupMembers, moveElement, placedBox, resizeElement, type Corner, type LayoutBox, type LayoutElement } from "./layout-geometry.js";

interface Props {
  value?: VideoLayout;
  enabled: OverlayId[];
  preview: RefObject<HTMLIFrameElement | null>;
  labels: Record<OverlayId, string>;
  onPreview: (value: VideoLayout) => void;
  onCommit: (value: VideoLayout) => void;
}
interface Drag {
  id: LayoutElement; pointer: number; x: number; y: number; layout: VideoLayout; box: LayoutBox; corner?: Corner;
}
const corners: Corner[] = ["nw", "ne", "sw", "se"];
const playfieldBox = { x: -540, y: -405, w: 1080, h: 810 };

export function LayoutEditor({ value, enabled, preview, labels, onPreview, onCommit }: Props) {
  const root = useRef<HTMLDivElement>(null), drag = useRef<Drag | null>(null);
  const [selected, select] = useState<LayoutElement | null>(null);
  const [hovered, hover] = useState<LayoutElement | null>(null);
  const [bounds, setBounds] = useState<Partial<Record<OverlayId, LayoutBox[]>>>({});
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const scheduled = useRef<number | null>(null), pending = useRef<VideoLayout | null>(null);
  useEffect(() => () => { if (scheduled.current !== null) cancelAnimationFrame(scheduled.current); }, []);
  const layout = normalizeLayout(value), latest = useRef(layout);
  latest.current = layout;
  const ids: LayoutElement[] = ["playfield", ...new Set(enabled.map(editingGroup))];
  const name = (id: LayoutElement) => id === "playfield" ? "Playfield" : labels[id];
  const memberBox = (id: OverlayId): LayoutBox => {
    const [, , w, h, scale] = overlayBounds[id];
    const regions = bounds[id];
    if (!regions?.length) return { x: 0, y: 0, w: w * scale, h: h * scale };
    const x = Math.min(...regions.map(b => b.x)), y = Math.min(...regions.map(b => b.y));
    return { x, y, w: Math.max(...regions.map(b => b.x + b.w)) - x, h: Math.max(...regions.map(b => b.y + b.h)) - y };
  };
  // Express every visible member in the group's coordinate system.
  const regionsFor = (id: LayoutElement): LayoutBox[] => {
    if (id === "playfield") return [playfieldBox];
    const origin = layout.overlays[id];
    return groupMembers(id).filter(member => enabled.includes(member)).flatMap(member =>
      (bounds[member] ?? [memberBox(member)]).map(region => {
        const box = placedBox(layout, member, region);
        return { x: (box.x - origin.x) / origin.scale, y: (box.y - origin.y) / origin.scale, w: box.w / origin.scale, h: box.h / origin.scale };
      }));
  };
  const localBox = (id: LayoutElement): LayoutBox => {
    const regions = regionsFor(id);
    if (!regions.length) return id === "playfield" ? playfieldBox : memberBox(id);
    const x = Math.min(...regions.map(b => b.x)), y = Math.min(...regions.map(b => b.y));
    return { x, y, w: Math.max(...regions.map(b => b.x + b.w)) - x, h: Math.max(...regions.map(b => b.y + b.h)) - y };
  };
  const layer = (id: LayoutElement) => id === "playfield" ? -1 : Math.max(...groupMembers(id).filter(member => enabled.includes(member)).map(member => layout.overlays[member].z));
  useEffect(() => {
    // Measure rendered content so a short combo counter gets a tight selection box.
    const measure = () => {
      if (drag.current) return;
      const next: Partial<Record<OverlayId, LayoutBox[]>> = {};
      const document = preview.current?.contentDocument;
      for (const id of enabled) {
        const frame = document?.querySelector<HTMLIFrameElement>(`iframe[title="${id}"]`);
        const body = frame?.contentDocument?.body;
        if (!body) continue;
        const selector = id === "player-info" ? ".map-stats, .identity > *, .player > .score"
          : id === "hit-error-bar" ? ".ur > *, #barContainer, .pointer" : ":scope > :not(script):not(style)";
        const scale = overlayBounds[id][4];
        const regions = Array.from(body.querySelectorAll(selector), content => {
          const rect = content.getBoundingClientRect();
          return { x: rect.x * scale, y: rect.y * scale, w: rect.width * scale, h: rect.height * scale };
        }).filter(rect => rect.w > 0 && rect.h > 0);
        if (regions.length) next[id] = regions;
      }
      setBounds(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    measure();
    const timer = window.setInterval(measure, 250);
    return () => clearInterval(timer);
  }, [enabled, preview]);
  const point = (clientX: number, clientY: number) => {
    const rect = root.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) * 1920 / rect.width, y: (clientY - rect.top) * 1080 / rect.height };
  };
  const hit = (x: number, y: number, cycle = false) => {
    const candidates = ids.filter(id => {
      const regions = id === selected ? [localBox(id)] : regionsFor(id);
      return regions.some(region => {
        const box = placedBox(layout, id, region);
        return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
      });
    }).sort((a, b) => layer(b) - layer(a));
    if (!cycle && selected && candidates.includes(selected)) return selected;
    return candidates[cycle ? (candidates.indexOf(selected!) + 1) % candidates.length : 0] ?? null;
  };
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.target as Node) || event.button !== 0 || (event.target as Element).closest("[data-layout-menu]")) return;
    const p = point(event.clientX, event.clientY);
    const corner = (event.target as HTMLElement).dataset.corner as Corner | undefined;
    const id = corner ? selected : hit(p.x, p.y, event.altKey);
    select(id); setMenu(null); root.current?.focus();
    if (!id) return;
    event.preventDefault();
    drag.current = { id, pointer: event.pointerId, ...p, layout, box: localBox(id), corner };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function finish(cancel = false) {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (scheduled.current !== null) cancelAnimationFrame(scheduled.current);
    scheduled.current = null;
    if (pending.current && !cancel) { latest.current = pending.current; onPreview(pending.current); }
    pending.current = null;
    if (cancel) onPreview(active.layout);
    else if (JSON.stringify(active.layout) !== JSON.stringify(latest.current)) onCommit(latest.current);
    if (root.current?.hasPointerCapture(active.pointer)) root.current.releasePointerCapture(active.pointer);
  }
  function action(key: string) {
    if (key.startsWith("select:")) { select(key.slice(7) as LayoutElement); return; }
    let next = structuredClone(layout);
    if (key === "reset-all") next = defaultLayout();
    else if (selected && key === "reset") {
      const defaults = defaultLayout();
      if (selected === "playfield") next.playfield = defaults.playfield;
      else for (const member of groupMembers(selected)) next.overlays[member] = defaults.overlays[member];
    } else if (selected && selected !== "playfield") {
      const members = groupMembers(selected).sort((a, b) => next.overlays[a].z - next.overlays[b].z);
      const order = (Object.keys(next.overlays) as OverlayId[]).sort((a, b) => next.overlays[a].z - next.overlays[b].z).filter(id => !members.includes(id));
      if (key === "front") order.push(...members); else order.unshift(...members);
      order.forEach((id, z) => { next.overlays[id].z = z; });
    } else return;
    onPreview(next); onCommit(next);
  }
  const box = selected && ids.includes(selected) ? placedBox(layout, selected, localBox(selected)) : null;
  return <div ref={root} data-layout-editor className="layout-editor" tabIndex={0} role="group" aria-label="Visual layout editor"
    onPointerDown={start} onPointerMove={event => {
      const active = drag.current;
      if (!active) { const p = point(event.clientX, event.clientY); hover(hit(p.x, p.y, event.altKey)); return; }
      if (event.pointerId !== active.pointer) return;
      const p = point(event.clientX, event.clientY), dx = p.x - active.x, dy = p.y - active.y;
      const next = active.corner ? resizeElement(active.layout, active.id, active.box, active.corner, dx, dy) : moveElement(active.layout, active.id, dx, dy);
      pending.current = next;
      if (scheduled.current === null) scheduled.current = requestAnimationFrame(() => {
        scheduled.current = null;
        if (pending.current) { latest.current = pending.current; onPreview(pending.current); pending.current = null; }
      });
    }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)}
    onContextMenu={event => {
      event.preventDefault(); const p = point(event.clientX, event.clientY);
      select(hit(p.x, p.y)); setMenu(p);
    }} onKeyDown={event => {
      if (menu || !event.currentTarget.contains(event.target as Node)) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const box = selected ? placedBox(layout, selected, localBox(selected)) : { x: 20, y: 20 };
        setMenu({ x: box.x, y: box.y });
      }
      if (event.key === "Escape") { event.preventDefault(); if (drag.current) finish(true); else select(null); }
      const vectors: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (selected && vectors[event.key]) {
        event.preventDefault(); const [x, y] = vectors[event.key], step = event.shiftKey ? 10 : 1;
        const next = moveElement(layout, selected, x * step, y * step); onPreview(next); onCommit(next);
      }
    }}>
    {ids.map(id => {
      const b = placedBox(layout, id, localBox(id));
      return <div key={id} className={`layout-guide${hovered === id ? " layout-guide-hover" : ""}`} data-element={id} style={{ left: `${b.x / 19.2}%`, top: `${b.y / 10.8}%`, width: `${b.w / 19.2}%`, height: `${b.h / 10.8}%` }} />;
    })}
    {box && <div className="layout-selection" style={{ left: `${box.x / 19.2}%`, top: `${box.y / 10.8}%`, width: `${box.w / 19.2}%`, height: `${box.h / 10.8}%` }}>
      <span className="layout-selection-label" style={box.y < 40 ? { top: "100%" } : undefined}>{name(selected!)}</span>
      {corners.map(corner => <div key={corner} data-corner={corner} className={`layout-handle layout-handle-${corner}`} />)}
    </div>}
    <div data-layout-menu style={{ position: "absolute", left: `${(menu?.x ?? 20) / 19.2}%`, top: `${(menu?.y ?? 20) / 10.8}%` }}>
      <Dropdown isOpen={menu !== null} onOpenChange={open => { if (!open) { setMenu(null); root.current?.focus(); } }}>
        <Dropdown.Trigger aria-label="Layout actions" className="layout-menu-anchor" onPress={() => setMenu({ x: 20, y: 20 })} />
        <Dropdown.Popover placement="bottom start">
          <Dropdown.Menu aria-label="Layout actions" onAction={key => action(String(key))}>
            <Dropdown.Item id="reset" isDisabled={!selected}><Label>Reset {selected ? name(selected).toLowerCase() : "element"}</Label></Dropdown.Item>
            <Dropdown.Item id="front" isDisabled={!selected || selected === "playfield"}><Label>Bring to front</Label></Dropdown.Item>
            <Dropdown.Item id="back" isDisabled={!selected || selected === "playfield"}><Label>Send to back</Label></Dropdown.Item>
            <Dropdown.Item id="reset-all"><Label>Reset layout</Label></Dropdown.Item>
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item><Label>Select element</Label><Dropdown.SubmenuIndicator /></Dropdown.Item>
              <Dropdown.Popover><Dropdown.Menu aria-label="Select element">
                {ids.map(id => <Dropdown.Item key={id} id={`select:${id}`} onAction={() => select(id)}><Label>{name(id)}</Label></Dropdown.Item>)}
              </Dropdown.Menu></Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  </div>;
}
