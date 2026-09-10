import { referenceTemplate } from "./thumbnail-render/thumbnail/templates/reference/template.js";
import { cuteTemplate } from "./thumbnail-render/thumbnail/templates/cute/template.js";
import { COMPONENT_BY_LAYER } from "./thumbnail-render/thumbnail/overrides.js";
import { TextEditingContext } from "./thumbnail-render/editable-text.js";
import { createPortal } from "react-dom";
import { resizeThumbnailLayer } from "./thumbnail-geometry.js";
import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Button, Checkbox, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Dropdown, Input, Label, ListBox, Select, Slider } from "@heroui/react";
import { Undo2, Redo2, Plus, Copy, ZoomIn, ZoomOut } from "lucide-react";
import type { Timeline } from "../core/types.js";
import { defaultThumbnail, validateThumbnailDocument, type ThumbnailDocument, type ThumbnailLayer } from "../core/thumbnail-document.js";
import { ThumbnailScene, layerName, textLayers } from "./thumbnail-render/scene.js";
import { sampleImagePalette } from "./thumbnail-render/thumbnail/color-sampler.js";

type Box = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
const corners: Corner[] = ["nw", "ne", "sw", "se"];
const storagePrefix = "studio-thumbnail-v1:";
const excluded = new Set(["background", "inner-border"]);
const borderIds = new Set(["badge-row", "combo", "difficulty", "bpm", "top-panel", "avatar", "username", "country-flag", "mod-list", "twitch-logo"]);
function load(key: string, fallback: ThumbnailDocument) {
  try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); validateThumbnailDocument(value); return value as ThumbnailDocument; } catch { return fallback; }
}
function Choice({ label, value, items, onChange }: { label: string; value: string; items: [string, string][]; onChange(value: string): void }) {
  return <Select aria-label={label} selectedKey={value} onSelectionChange={key => key !== null && onChange(String(key))}>
    <Label>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{items.map(([id, name]) => <ListBox.Item key={id} id={id} textValue={name}>{name}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <div className="flex items-center justify-between gap-2"><Label>{label}</Label><ColorPicker value={value} onChange={c => onChange(c.toString("hex"))}>
    <ColorPicker.Trigger aria-label={label}><ColorSwatch /></ColorPicker.Trigger>
    <ColorPicker.Popover className="flex w-64 flex-col gap-3 p-4">
      <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness"><ColorArea.Thumb /></ColorArea>
      <ColorSlider channel="hue" colorSpace="hsb"><ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track></ColorSlider>
      <ColorField><Label>Hex color</Label><ColorField.Group className="bg-default border border-border"><ColorField.Input /></ColorField.Group></ColorField>
    </ColorPicker.Popover>
  </ColorPicker></div>;
}

export const ThumbnailWorkspace = memo(function ThumbnailWorkspace({ timeline, accent, onAccentChange, busy, onExport, exportTarget, onOpenReplay }: { exportTarget: HTMLDivElement | null; timeline: Timeline | undefined; onOpenReplay(): void; accent: string; onAccentChange(accent: string): void; busy: boolean; onExport(value: ThumbnailDocument): void }) {
  const key = timeline ? storagePrefix + timeline.replay : null;
  const [history, setHistory] = useState(() => ({ past: [] as ThumbnailDocument[], current: key ? load(key, defaultThumbnail(accent)) : defaultThumbnail(accent), future: [] as ThumbnailDocument[] }));
  const [draft, setDraft] = useState<ThumbnailDocument>();
  const value = { ...(draft ?? history.current), accent };
  const latest = useRef(value); latest.current = value;
  const [selected, select] = useState<string | null>(null), [hovered, hover] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const textSession = useRef<{ id: string; start: ThumbnailDocument } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [fit, setFit] = useState(1), [zoom, setZoom] = useState(1);
  const scale = fit * zoom;
  const view = useRef({ scale, zoom }); view.current = { scale, zoom };
  const pan = useRef({ x: 0, y: 0 });
  const zoomAnchor = useRef<{ x: number; y: number; designX: number; designY: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null), editor = useRef<HTMLDivElement>(null), textInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; box: Box; origin: { x: number; y: number }; start: ThumbnailDocument; corner?: Corner; pointer: number } | null>(null);
  const raf = useRef<number | null>(null), pending = useRef<ThumbnailDocument | null>(null);
  const [message, setMessage] = useState("");
  const [presets, setPresets] = useState<Record<string, ThumbnailDocument>>(() => {
    try { const stored = JSON.parse(localStorage.getItem(storagePrefix + "presets") ?? "{}"); for (const item of Object.values(stored)) validateThumbnailDocument(item as ThumbnailDocument); return stored; } catch { return {}; }
  });
  const [presetName, setPresetName] = useState("");
  useEffect(() => { if (!key) return; try { localStorage.setItem(key, JSON.stringify({ ...history.current, accent })); } catch { setMessage("Could not save thumbnail edits. Storage is full."); } }, [key, history.current, accent]);
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);
  const commit = (next: ThumbnailDocument) => {
    if (next.accent !== accent) onAccentChange(next.accent);
    setDraft(undefined);
    setHistory(old => JSON.stringify(old.current) === JSON.stringify(next) ? old : { past: [...old.past.slice(-49), old.current], current: next, future: [] });
  };
  const undo = () => { setDraft(undefined); setHistory(h => h.past.length ? { past: h.past.slice(0, -1), current: h.past.at(-1)!, future: [h.current, ...h.future] } : h); };
  const redo = () => { setDraft(undefined); setHistory(h => h.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h); };
  const patch = (id: string, changes: ThumbnailLayer, base = latest.current) => ({ ...base, layers: { ...base.layers, [id]: { ...base.layers[id], ...changes } } });
  useLayoutEffect(() => {
    const measure = () => { const r = viewport.current?.getBoundingClientRect(); if (r && r.width > 48 && r.height > 48) setFit(Math.min((r.width - 48) / 1280, (r.height - 48) / 720, 1)); };
    const observer = new ResizeObserver(measure); if (viewport.current) observer.observe(viewport.current); measure(); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const wheel = (event: WheelEvent) => {
      const rect = canvas.current?.getBoundingClientRect(); if (!rect) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      const next = Math.max(.5, Math.min(4, view.current.zoom * Math.exp(-delta * .002)));
      if (next === view.current.zoom) return;
      zoomAnchor.current = { x: event.clientX, y: event.clientY, designX: (event.clientX - rect.x) / view.current.scale, designY: (event.clientY - rect.y) / view.current.scale };
      view.current.zoom = next; setZoom(next);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current, rect = canvas.current?.getBoundingClientRect(), el = viewport.current;
    if (!anchor || !rect || !el) return;
    moveView(pan.current.x + anchor.x - rect.x - anchor.designX * scale, pan.current.y + anchor.y - rect.y - anchor.designY * scale);
    zoomAnchor.current = null;
  }, [scale]);
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const root = canvas.current; if (!root || cancelled) return;
      const origin = root.getBoundingClientRect(), next: Record<string, Box> = {};
      for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-layer]"))) {
        const id = element.dataset.layer!; if (excluded.has(id)) continue;
        const r = element.getBoundingClientRect();
        if (r.width && r.height) next[id] = { x: (r.x - origin.x) / scale, y: (r.y - origin.y) / scale, w: r.width / scale, h: r.height / scale };
      }
      setBoxes(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => { cancelled = true; };
  }, [value, scale, history]);
  function moveView(x: number, y: number) {
    pan.current = { x, y };
    const stage = canvas.current?.parentElement;
    if (stage) stage.style.translate = `${x}px ${y}px`;
  }
  const point = (x: number, y: number) => { const r = canvas.current!.getBoundingClientRect(); return { x: (x - r.x) / scale, y: (y - r.y) / scale }; };
  const hit = (p: { x: number; y: number }, cycle = false) => {
    const ids = Object.keys(boxes).filter(id => !value.layers[id]?.hidden && p.x >= boxes[id].x && p.y >= boxes[id].y && p.x <= boxes[id].x + boxes[id].w && p.y <= boxes[id].y + boxes[id].h)
      .sort((a, b) => (value.layers[b]?.z ?? Object.keys(boxes).indexOf(b)) - (value.layers[a]?.z ?? Object.keys(boxes).indexOf(a)));
    if (!cycle && selected && ids.includes(selected)) return selected;
    return ids[cycle ? (ids.indexOf(selected!) + 1) % ids.length : 0] ?? null;
  };
  const preview = (next: ThumbnailDocument) => {
    pending.current = next;
    if (raf.current === null) raf.current = requestAnimationFrame(() => { raf.current = null; if (pending.current) { latest.current = pending.current; setDraft(pending.current); pending.current = null; } });
  };
  function finish(cancel = false) {
    const active = drag.current; if (!active) return;
    drag.current = null;
    if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null;
    const next = pending.current ?? latest.current; pending.current = null;
    if (cancel) setDraft(undefined); else commit(next);
    if (editor.current?.hasPointerCapture(active.pointer)) editor.current.releasePointerCapture(active.pointer);
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (busy || editing || event.button !== 0 || (event.target as Element).closest("[data-layout-menu]")) return;
    const p = point(event.clientX, event.clientY), corner = (event.target as HTMLElement).dataset.corner as Corner | undefined;
    const id = corner ? selected : hit(p, event.altKey); select(id); setMenu(null); editor.current?.focus();
    if (!id) return;
    event.preventDefault();
    const element = canvas.current?.querySelector<HTMLElement>(`[data-layer="${id}"]`);
    const origin = { x: value.layers[id]?.x ?? 0, y: value.layers[id]?.y ?? 0 };
    for (let current = element; current && !current.classList.contains("thumbnail-scene"); current = current.offsetParent as HTMLElement | null) { origin.x += current.offsetLeft; origin.y += current.offsetTop; }
    drag.current = { id, ...p, box: boxes[id], origin, start: value, corner, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function beginText(id: string) {
    const source = latest.current.layers[id]?.source ?? id;
    if (!textLayers.has(source) && !source.startsWith("custom-")) return;
    textSession.current = { id, start: latest.current };
    select(id); setEditing(id); setMenu(null);
  }
  function changeText(text: string) {
    const session = textSession.current; if (!session) return;
    const next = patch(session.id, { text });
    if (session.id === "bottom-message") next.accentRange = undefined;
    latest.current = next; setDraft(next);
  }
  function finishText(cancel = false, focus = false) {
    const session = textSession.current; if (!session) return;
    textSession.current = null;
    if (cancel) { latest.current = session.start; setDraft(undefined); }
    else commit(latest.current);
    setEditing(null);
    if (focus) requestAnimationFrame(() => editor.current?.focus({ preventScroll: true }));
  }
  function action(key: string) {
    if (key === "reset-all") { commit({ ...defaultThumbnail(value.accent), template: value.template, width: value.width }); select(null); return; }
    if (!selected) return;
    if (key === "edit") { beginText(selected); return; }
    if (key === "duplicate") {
      if (value.customTexts.length >= 30) return;
      const id = `custom-${crypto.randomUUID()}`;
      const source = value.layers[selected] ?? {};
      const builtIn = source.source ?? (selected.startsWith("custom-") ? undefined : selected);
      const text = textLayers.has(builtIn ?? "") || !builtIn ? source.text ?? style?.textContent ?? "Your text" : undefined;
      const box = boxes[selected];
      commit({ ...value, customTexts: [...value.customTexts, id], layers: { ...value.layers, [id]: { ...source,
        source: builtIn, hidden: false, x: builtIn ? (box?.x ?? 0) + 24 : (source.x ?? 0) + 24,
        y: builtIn ? (box?.y ?? 0) + 24 : (source.y ?? 0) + 24, text } } });
      select(id);
      return;
    }
    if (key === "reset") { const next = structuredClone(value); delete next.layers[selected]; if (selected === "bottom-message") next.accentRange = undefined; commit(next); }
    else if (key === "remove") { const next = structuredClone(value); delete next.layers[selected]; next.customTexts = next.customTexts.filter(id => id !== selected); commit(next); select(null); }
    else if (key === "hide") commit(patch(selected, { hidden: !value.layers[selected]?.hidden }));
    else if (key === "front" || key === "back") {
      const ids = Object.keys(boxes).sort((a, b) => (value.layers[a]?.z ?? Object.keys(boxes).indexOf(a)) - (value.layers[b]?.z ?? Object.keys(boxes).indexOf(b))).filter(id => id !== selected);
      if (key === "front") ids.push(selected); else ids.unshift(selected);
      let next = value; ids.forEach((id, z) => { next = patch(id, { z: z + 1 }, next); }); commit(next);
    }
  }
  const selectedBox = selected ? boxes[selected] : undefined;
  const displayBox = selectedBox;
  const layer = selected ? value.layers[selected] ?? {} : {};
  const style = selected ? canvas.current?.querySelector<HTMLElement>(`[data-layer="${selected}"]`) : null;
  const selectedSource = layer.source ?? selected;
  const editableText = selected && (textLayers.has(selectedSource!) || (selected.startsWith("custom-") && !layer.source));
  const textStyle = style?.querySelector<HTMLElement>("[data-editor-text]") ?? (style?.hasAttribute("data-duplicate") ? style.firstElementChild as HTMLElement : null) ?? style;
  const computed = textStyle ? getComputedStyle(textStyle) : undefined;
  const components = (value.template === "cute" ? cuteTemplate : referenceTemplate).components;
  const config = components[COMPONENT_BY_LAYER[selectedSource!]];
  const baseGlow = config && "glow" in config ? config.glow : undefined;
  const rgb = computed?.color.match(/\d+/g)?.slice(0, 3);
  const color = layer.color ?? (rgb?.length === 3 ? "#" + rgb.map(n => Number(n).toString(16).padStart(2, "0")).join("") : "#ffffff");
  const glow = layer.glow === undefined && baseGlow ? { color: baseGlow.color ?? color, blur: baseGlow.blur } : layer.glow;
  return <div className="flex min-h-0 min-w-0 w-full flex-1" data-thumbnail-workspace onKeyDown={event => {
    if ((event.target as HTMLElement).closest('input, textarea, [contenteditable], [role="menu"]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); if (selected) action("duplicate"); }
  }}>
    {exportTarget && createPortal(<Button isDisabled={busy || !timeline} isPending={busy && !!timeline} onPress={() => onExport(value)}>Export PNG</Button>, exportTarget)}
    <section className="flex min-w-0 flex-1 flex-col">
      <div ref={viewport} className="thumbnail-viewport" onPointerDown={event => {
        if (event.button !== 1) return;
        event.preventDefault(); const target = event.currentTarget, x = event.clientX, y = event.clientY, origin = pan.current;
        target.setPointerCapture(event.pointerId);
        const move = (e: globalThis.PointerEvent) => { moveView(origin.x + e.clientX - x, origin.y + e.clientY - y); };
        const end = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end); };
        target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); target.addEventListener("pointercancel", end);
      }}>
        {!timeline ? <div aria-label="Thumbnail empty state" className="thumbnail-stage thumbnail-empty-state flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ width: 1280 * scale, height: 720 * scale }}>
          <h2 className="text-base font-medium">Create a thumbnail</h2>
          <p className="max-w-sm text-sm text-muted">Open a replay to create and edit a thumbnail with its player, beatmap, and score.</p>
          <Button isDisabled={busy} isPending={busy} onPress={onOpenReplay}>{busy ? "Importing replay..." : "Open replay"}</Button>
        </div> : <div className="thumbnail-stage" style={{ width: 1280 * scale, height: 720 * scale, translate: `${pan.current.x}px ${pan.current.y}px` }}>
          <div ref={canvas}><TextEditingContext.Provider value={editing ? { id: editing, change: changeText, finish: finishText } : null}><ThumbnailScene timeline={timeline} value={value} scale={scale} /></TextEditingContext.Provider></div>
          <div ref={editor} className="layout-editor" style={editing ? { pointerEvents: "none" } : undefined} data-layout-editor tabIndex={0} role="group" aria-label="Thumbnail layout editor"
            onPointerDown={start} onPointerMove={event => {
              const active = drag.current, p = point(event.clientX, event.clientY);
              if (!active) { hover(hit(p)); return; }
              const dx = p.x - active.x, dy = p.y - active.y, original = active.start.layers[active.id] ?? {};
              let changes: ThumbnailLayer = { x: Math.max(-8000, Math.min(8000, (original.x ?? 0) + dx)), y: Math.max(-8000, Math.min(8000, (original.y ?? 0) + dy)) };
              if (active.corner) changes = resizeThumbnailLayer(original, active.box, active.origin, active.corner, dx, dy);
              preview(patch(active.id, changes, active.start));
            }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)}
            onDoubleClick={event => { const id = hit(point(event.clientX, event.clientY)); if (id) beginText(id); }}
            onContextMenu={event => { event.preventDefault(); const p = point(event.clientX, event.clientY); select(hit(p)); setMenu(p); }}
            onKeyDown={event => {
              if (editing || menu) return;
              if (event.key === "Escape") { event.preventDefault(); if (drag.current) finish(true); else select(null); }
              if (event.shiftKey && event.key === "F10") { event.preventDefault(); setMenu({ x: selectedBox?.x ?? 20, y: selectedBox?.y ?? 20 }); }
              if (!selected) return;
              if (event.key === "Enter") { event.preventDefault(); beginText(selected); }
              const step = event.shiftKey ? 10 : 1, dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
              if (dx || dy) { event.preventDefault(); commit(patch(selected, { x: Math.max(-8000, Math.min(8000, (layer.x ?? 0) + dx)), y: Math.max(-8000, Math.min(8000, (layer.y ?? 0) + dy)) })); }
            }}>
            {hovered && hovered !== selected && boxes[hovered] && !editing && <div className="layout-guide layout-guide-hover" style={{ left: boxes[hovered].x * scale, top: boxes[hovered].y * scale, width: boxes[hovered].w * scale, height: boxes[hovered].h * scale }} />}
            {displayBox && !editing && <div className="layout-selection" data-element={selected} style={{ left: displayBox.x * scale, top: displayBox.y * scale, width: displayBox.w * scale, height: displayBox.h * scale }}>
              <span className="layout-selection-label" style={displayBox.y < 40 ? { top: "100%" } : undefined}>{layerName(selected!)}</span>
              {corners.map(c => <div key={c} data-corner={c} className={`layout-handle layout-handle-${c}`} />)}
            </div>}
            <div data-layout-menu style={{ position: "absolute", left: (menu?.x ?? 20) * scale, top: (menu?.y ?? 20) * scale }}>
              <Dropdown isOpen={menu !== null} onOpenChange={open => { if (!open) { setMenu(null); editor.current?.focus(); } }}>
                <Dropdown.Trigger className="layout-menu-anchor" aria-label="Thumbnail actions" />
                <Dropdown.Popover placement="bottom start"><Dropdown.Menu aria-label="Thumbnail actions" onAction={key => action(String(key))}>
                  <Dropdown.Item id="edit" isDisabled={!editableText}><Label>Edit text</Label></Dropdown.Item>
                  <Dropdown.Item id="duplicate" isDisabled={!selected || value.customTexts.length >= 30}><Label>Duplicate</Label></Dropdown.Item>
                  <Dropdown.Item id="reset" isDisabled={!selected}><Label>Reset {selected ? layerName(selected).toLowerCase() : "element"}</Label></Dropdown.Item>
                  <Dropdown.Item id="front" isDisabled={!selected}><Label>Bring to front</Label></Dropdown.Item>
                  <Dropdown.Item id="back" isDisabled={!selected}><Label>Send to back</Label></Dropdown.Item>
                  <Dropdown.Item id="hide" isDisabled={!selected}><Label>{layer.hidden ? "Show element" : "Hide element"}</Label></Dropdown.Item>
                  <Dropdown.Item id="remove" isDisabled={!selected?.startsWith("custom-")}><Label>Remove element</Label></Dropdown.Item>
                  <Dropdown.Item id="reset-all"><Label>Reset thumbnail</Label></Dropdown.Item>
                  <Dropdown.SubmenuTrigger><Dropdown.Item><Label>Select element</Label><Dropdown.SubmenuIndicator /></Dropdown.Item><Dropdown.Popover><Dropdown.Menu aria-label="Select thumbnail element">
                    {Object.keys(boxes).map(id => <Dropdown.Item id={id} key={id} onAction={() => select(id)}><Label>{layerName(id)}</Label></Dropdown.Item>)}
                  </Dropdown.Menu></Dropdown.Popover></Dropdown.SubmenuTrigger>
                </Dropdown.Menu></Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </div>}
      </div>
      <div data-thumbnail-controls className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3 sm:px-6">
        <Button size="sm" variant="ghost" aria-label="Undo thumbnail edit" isDisabled={!history.past.length || busy} onPress={undo}><Undo2 size={18} /></Button>
        <Button size="sm" variant="ghost" aria-label="Redo thumbnail edit" isDisabled={!history.future.length || busy} onPress={redo}><Redo2 size={18} /></Button>
        <Button size="sm" variant="secondary" isDisabled={!timeline || busy || value.customTexts.length >= 30} onPress={() => { const id = `custom-${crypto.randomUUID()}`; commit({ ...value, customTexts: [...value.customTexts, id], layers: { ...value.layers, [id]: { text: "Your text" } } }); select(id); }}><Plus size={16} />Add text</Button>
        <Button size="sm" variant="ghost" isDisabled={!timeline || busy || !selected || value.customTexts.length >= 30} onPress={() => action("duplicate")}><Copy size={16} />Duplicate</Button>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" aria-label="Zoom out" isDisabled={!timeline} onPress={() => setZoom(z => Math.max(.5, z / 1.25))}><ZoomOut size={18} /></Button>
        <Button size="sm" variant="ghost" isDisabled={!timeline} onPress={() => { zoomAnchor.current = null; moveView(0, 0); setZoom(1); viewport.current?.scrollTo(0, 0); }}>Fit</Button>
        <Button size="sm" variant="ghost" aria-label="Zoom in" isDisabled={!timeline} onPress={() => setZoom(z => Math.min(4, z * 1.25))}><ZoomIn size={18} /></Button>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted">Drag to move. Drag a corner to resize. Double-click text to edit. Scroll to zoom. Middle-drag to pan. Right-click for reset and layers.</p>
    </section>
    <aside aria-label="Thumbnail options" className="workspace-options shrink-0 overflow-y-auto border-l border-border p-4">
      <fieldset disabled={!timeline} inert={!timeline} className="flex min-w-0 flex-col gap-4 disabled:opacity-50">
      <Choice label="Template" value={value.template} items={[["reference", "CPOL"], ["cute", "Clean"]]} onChange={template => { commit({ ...value, template: template as ThumbnailDocument["template"], layers: {}, customTexts: [], accentRange: undefined }); select(null); }} />
      <Choice label="PNG resolution" value={String(value.width)} items={[1280, 1920, 2560, 3840].map(w => [String(w), `${w} × ${w * 9 / 16}`])} onChange={width => commit({ ...value, width: Number(width) as ThumbnailDocument["width"] })} />
      <Color label="Thumbnail accent" value={value.accent} onChange={accent => commit({ ...value, accent })} />
      <Button size="sm" variant="ghost" onPress={async () => { if (!timeline?.bgImage) return; const image = new Image(); image.src = timeline.bgImage; await image.decode(); const colors = sampleImagePalette(image); commit({ ...latest.current, accent: colors.accentColor }); }}>Use background color</Button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Checkbox isSelected={value.twitch} onChange={twitch => commit({ ...value, twitch })}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Twitch logo</Checkbox.Content></Checkbox>
      {(timeline?.replayFormat === "stable" || /CL/.test(timeline?.mods ?? "")) && <Checkbox isSelected={value.classic} onChange={classic => commit({ ...value, classic })}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Classic mod</Checkbox.Content></Checkbox>}
      </div>
      <Choice label="Play status" value={value.status} items={[["auto", "From replay"], ["fc", "FC override"], ["counts", "Custom hit counts"]]} onChange={status => commit({ ...value, status: status as ThumbnailDocument["status"] })} />
      {timeline && value.status === "auto" && <p className="text-xs text-muted">{timeline.sceneInfo?.playStatus?.completed === false ? "Incomplete replay. FC is not assumed." : timeline.sceneInfo?.playStatus?.verified ? `${timeline.sceneInfo.score.hits["0"]} misses, ${timeline.sceneInfo.score.hits.sliderBreaks} slider breaks` : "Replay analysis is not verified. FC is not assumed."}</p>}
      {value.status === "counts" && <div className="flex gap-2">{([['misses', 'Misses'], ['sliderBreaks', 'Slider breaks']] as const).map(([field, label]) => <div key={field} className="min-w-0"><Label>{label}</Label><Input aria-label={label} type="number" min={0} max={100000} value={String(value[field] ?? (field === "misses" ? timeline?.sceneInfo?.score.hits["0"] : timeline?.sceneInfo?.score.hits.sliderBreaks) ?? 0)} onChange={e => commit({ ...value, [field]: Math.max(0, Math.min(100000, Math.round(Number(e.target.value)))) })} /></div>)}</div>}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <Slider aria-label="Background shading" minValue={0} maxValue={100} step={1}
          value={Math.round((value.overlayOpacity ?? 1) * 100)}
          onChange={next => commit({ ...value, overlayOpacity: (typeof next === "number" ? next : next[0]) / 100 })}>
          <div className="flex items-center justify-between gap-2"><Label>Background shading</Label><Slider.Output /></div>
          <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
        </Slider>
        <Checkbox isSelected={!!value.dropShadow} onChange={enabled => commit({ ...value, dropShadow: enabled ? { x: 0, y: 8, blur: 18, color: "#000000" } : null })}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Drop shadow</Checkbox.Content></Checkbox>
        {value.dropShadow && <>
          <Color label="Shadow color" value={value.dropShadow.color} onChange={color => commit({ ...value, dropShadow: { ...value.dropShadow!, color } })} />
          <div className="grid grid-cols-2 gap-3">
            {([["x", "Horizontal offset"], ["y", "Vertical offset"]] as const).map(([field, label]) => <div key={field} className="flex min-w-0 flex-col gap-1">
              <Label>{label}</Label><Input aria-label={label} type="number" min={-80} max={80} value={String(value.dropShadow![field])}
                onChange={e => commit({ ...value, dropShadow: { ...value.dropShadow!, [field]: Math.max(-80, Math.min(80, Number(e.target.value))) } })} />
            </div>)}
          </div>
          <Slider aria-label="Shadow blur" minValue={0} maxValue={80} step={1} value={value.dropShadow.blur}
            onChange={next => commit({ ...value, dropShadow: { ...value.dropShadow!, blur: typeof next === "number" ? next : next[0] } })}>
            <div className="flex items-center justify-between gap-2"><Label>Shadow blur</Label><Slider.Output /></div>
            <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
          </Slider>
        </>}

      </div>
      {selected && <div className="flex flex-col gap-3 border-t border-border pt-4">
        <Label>{layerName(selected)}</Label>
        {editableText && <>
          <Input aria-label="Selected element text" value={layer.text ?? style?.textContent ?? ""} maxLength={500} onChange={e => { const next = patch(selected, { text: e.target.value }); if (selected === "bottom-message") next.accentRange = undefined; commit(next); }}
            onSelect={e => { const el = e.currentTarget; if (selected === "bottom-message" && el.selectionEnd! > el.selectionStart!) textInput.current = el; }} />
          <Label>Font size</Label><Input aria-label="Font size" type="number" min={8} max={600} value={String(layer.fontSize ?? Math.round(parseFloat(computed?.fontSize ?? "54")))} onChange={e => commit(patch(selected, { fontSize: Math.max(8, Math.min(600, Number(e.target.value))) }))} />
          <Choice label="Font" value={layer.fontFamily ?? (value.template === "cute" ? "fredoka" : "baloo")} items={[["baloo", "Baloo 2"], ["fredoka", "Fredoka"], ["montserrat", "Montserrat"]]} onChange={fontFamily => commit(patch(selected, { fontFamily: fontFamily as ThumbnailLayer["fontFamily"] }))} />
          <Choice label="Weight" value={String(layer.fontWeight ?? Number(computed?.fontWeight ?? 700))} items={[["400", "Regular"], ["600", "Semibold"], ["700", "Bold"]]} onChange={weight => commit(patch(selected, { fontWeight: Number(weight) }))} />
          <Color label="Text color" value={color} onChange={color => commit(patch(selected, { color }))} />
          <Checkbox isSelected={!!layer.gradient} onChange={enabled => commit(patch(selected, { gradient: enabled ? { from: color, to: value.accent } : null }))}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Gradient fill</Checkbox.Content></Checkbox>
          {layer.gradient && <>
            <Color label="Gradient start" value={layer.gradient.from} onChange={from => commit(patch(selected, { gradient: { ...layer.gradient!, from } }))} />
            <Color label="Gradient end" value={layer.gradient.to} onChange={to => commit(patch(selected, { gradient: { ...layer.gradient!, to } }))} />
          </>}
          <Checkbox isSelected={!!glow} onChange={enabled => commit(patch(selected, { glow: enabled ? { color, blur: 12 } : null }))}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Text glow</Checkbox.Content></Checkbox>
          {glow && <>
            <Color label="Glow color" value={glow.color} onChange={color => commit(patch(selected, { glow: { ...glow!, color } }))} />
            <Label>Glow blur</Label><Input aria-label="Glow blur" type="number" min={0} max={100} value={String(glow.blur)} onChange={e => commit(patch(selected, { glow: { ...glow!, blur: Math.max(0, Math.min(100, Number(e.target.value))) } }))} />
          </>}
          {selected === "bottom-message" && <Button size="sm" variant="secondary" onPress={() => { const el = textInput.current; if (el && el.selectionEnd! > el.selectionStart!) commit({ ...patch(selected, { text: el.value }), accentRange: { start: el.selectionStart!, end: el.selectionEnd! } }); }}>Accent selection</Button>}
          {selected === "bottom-message" && <Button size="sm" variant="ghost" isDisabled={!value.accentRange} onPress={() => commit({ ...value, accentRange: undefined })}>Clear text accent</Button>}
        </>}
        {selected && borderIds.has(selectedSource!) && <>
          <Choice label="Border" value={layer.borderMode ?? (selectedSource === "top-panel" && value.template === "reference" ? "bottom" : "all")} items={[["all", "All sides"], ["bottom", "Bottom only"]]} onChange={borderMode => commit(patch(selected, { borderMode: borderMode as "all" | "bottom" }))} />
          <Label>Border thickness</Label><Input aria-label="Border thickness" type="number" min={0} max={40} value={String(layer.borderWidth ?? (config && "borderWidth" in config ? config.borderWidth : config && "border" in config && typeof config.border === "object" ? config.border.width : 0) ?? 0)} onChange={e => commit(patch(selected, { borderWidth: Math.max(0, Math.min(40, Number(e.target.value))) }))} />
          <Label>Corner radius</Label><Input aria-label="Corner radius" type="number" min={0} max={400} value={String(layer.borderRadius ?? (config && "radius" in config ? parseFloat(String(config.radius)) : 0))} onChange={e => commit(patch(selected, { borderRadius: Math.max(0, Math.min(400, Number(e.target.value))) }))} />
        </>}
        <Checkbox isSelected={!!layer.shadow} onChange={enabled => commit(patch(selected, { shadow: enabled ? { x: 0, y: 8, blur: 18, color: "#000000" } : null }))}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Element shadow</Checkbox.Content></Checkbox>
        {layer.shadow && <>
          <Color label="Element shadow color" value={layer.shadow.color} onChange={color => commit(patch(selected, { shadow: { ...layer.shadow!, color } }))} />
          {(["x", "y", "blur"] as const).map(field => <div key={field}><Label>Shadow {field}</Label><Input aria-label={`Element shadow ${field}`} type="number" min={field === "blur" ? 0 : -80} max={80} value={String(layer.shadow![field])} onChange={e => commit(patch(selected, { shadow: { ...layer.shadow!, [field]: Math.max(field === "blur" ? 0 : -80, Math.min(80, Number(e.target.value))) } }))} /></div>)}
        </>}
        <Button size="sm" variant="ghost" onPress={() => action("reset")}>Reset element</Button>
      </div>}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Choice label="Saved style" value="" items={[["", "Choose a style"], ...Object.keys(presets).map(name => [name, name] as [string, string])]} onChange={name => { if (presets[name]) { commit(structuredClone(presets[name])); select(null); } }} />
        <Input aria-label="Style name" placeholder="Style name" maxLength={60} value={presetName} onChange={e => setPresetName(e.target.value)} />
        <Button size="sm" variant="secondary" isDisabled={!presetName.trim()} onPress={() => {
          const saved = structuredClone(value); saved.status = "auto"; delete saved.misses; delete saved.sliderBreaks; delete saved.accentRange;
          for (const layer of Object.values(saved.layers)) delete layer.text;
          const next = { ...presets, [presetName.trim()]: saved };
          try { localStorage.setItem(storagePrefix + "presets", JSON.stringify(next)); setPresets(next); setMessage("Style saved without replay text or status overrides."); } catch { setMessage("Could not save style. Storage is full."); }
        }}>Save style</Button>
      </div>
      {message && <p role="status" className="text-xs text-muted">{message}</p>}
      </fieldset>
    </aside>
  </div>;
});
