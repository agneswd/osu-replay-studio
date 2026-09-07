import { useEffect, useState } from "react";
import { defaultLayout, normalizeLayout, type VideoLayout } from "../core/layout.js";
import { overlayIds, type OverlayId } from "../core/types.js";

function CoordinateInput({ value, label, min, max, step, onCommit }: {
  value: number; label: string; min: number; max: number; step: number; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input aria-label={label} type="number" min={min} max={max} step={step}
    className="w-full rounded-md border border-border bg-default px-2 py-1.5"
    value={draft} onChange={event => setDraft(event.currentTarget.value)}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
    onBlur={() => {
      const next = Number(draft);
      if (draft.trim() && Number.isFinite(next)) {
        const clamped = Math.max(min, Math.min(max, next));
        setDraft(String(clamped)); onCommit(clamped);
      } else setDraft(String(value));
    }} />;
}
interface Props {
  value?: VideoLayout;
  disabled: boolean;
  labels: Record<OverlayId, string>;
  onChange: (layout: VideoLayout) => void;
}
export function LayoutControls({ value, disabled, labels, onChange }: Props) {
  const [selected, setSelected] = useState<OverlayId | "playfield">("playfield");
  const layout = normalizeLayout(value), item = selected === "playfield" ? layout.playfield : layout.overlays[selected];
  const change = (key: "x" | "y" | "scale" | "z", next: number) => {
    const updated = { ...item, [key]: next };
    onChange(normalizeLayout(selected === "playfield" ? { ...layout, playfield: updated }
      : { ...layout, overlays: { ...layout.overlays, [selected]: updated } }));
  };
  const field = (key: "x" | "y" | "scale" | "z", label: string, min: number, max: number, step = 1) => {
    const number = key === "z" ? (selected === "playfield" ? 0 : layout.overlays[selected].z) : item[key];
    return <label className="flex min-w-0 flex-col gap-1 text-sm">{label}
      <CoordinateInput key={`${selected}-${key}`} label={label} min={min} max={max} step={step}
        value={key === "scale" ? Number((number * 100).toFixed(2)) : Number(number.toFixed(2))}
        onCommit={next => change(key, next / (key === "scale" ? 100 : 1))} />
    </label>;
  };
  return <details className="border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium">Layout</summary>
    <fieldset disabled={disabled} className="mt-3 flex min-w-0 flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">Element
        <select aria-label="Layout element" value={selected} className="rounded-md border border-border bg-default px-2 py-2"
          onChange={event => setSelected(event.currentTarget.value as typeof selected)}>
          <option value="playfield">Playfield</option>
          {overlayIds.map(id => <option key={id} value={id}>{labels[id]}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted">Coordinates use a 1920 x 1080 canvas. {selected === "playfield" ? "X and Y set the center. The background fills the canvas independently." : "X and Y set the top-left corner. Higher layers appear in front. Use Overlays above to show or hide elements."}</p>
      <div className="grid grid-cols-2 gap-3">
        {field("x", "X position", selected === "playfield" ? 0 : -1920, 1920, .25)}
        {field("y", "Y position", selected === "playfield" ? 0 : -1080, 1080, .25)}
        {field("scale", "Scale (%)", selected === "playfield" ? 10 : 25, selected === "playfield" ? 200 : 300)}
        {selected !== "playfield" && field("z", "Layer", 0, 99)}
      </div>
      <div className="flex gap-4 text-sm">
        <button type="button" className="underline" onClick={() => {
          const defaults = defaultLayout();
          onChange(selected === "playfield" ? { ...layout, playfield: defaults.playfield }
            : { ...layout, overlays: { ...layout.overlays, [selected]: defaults.overlays[selected] } });
        }}>Reset element</button>
        <button type="button" className="underline" onClick={() => onChange(defaultLayout())}>Reset layout</button>
      </div>
    </fieldset>
  </details>;
}
