import { useState } from "react";
import { Button, Input, Modal, TextArea } from "@heroui/react";
import type { Timeline } from "../core/types.js";
import { generateYouTubeText, youtubeInputs, youtubeInputErrors, youtubeTextError, type YouTubeInputs, type YouTubeText } from "../core/youtube-metadata.js";

const inputLabels: Record<keyof YouTubeInputs, string> = {
  playerUrl: "Player URL", beatmapUrl: "Beatmap URL", pp: "PP", status: "Play status",
};
const placeholders: Record<keyof YouTubeInputs, string> = {
  playerUrl: "https://osu.ppy.sh/users/123456", beatmapUrl: "https://osu.ppy.sh/beatmaps/123456",
  pp: "Optional", status: "FC, FAIL, 2xMiss, or leave blank",
};

// Keep the component mounted while closed so the current replay retains its edits.
export function YouTubeDetails({ timeline, isOpen, onOpenChange, additionalText, onAdditionalTextChange }: {
  timeline: Timeline; isOpen: boolean; onOpenChange(open: boolean): void;
  additionalText: string; onAdditionalTextChange(text: string): Promise<void>;
}) {
  const [overrides, setOverrides] = useState<Partial<YouTubeInputs>>({});
  const [edits, setEdits] = useState<Partial<YouTubeText>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const automatic = youtubeInputs(timeline);
  const inputs = { ...automatic, ...overrides };
  const missing = (Object.keys(automatic) as (keyof YouTubeInputs)[]).filter(key => !automatic[key]);
  const errors = youtubeInputErrors(inputs);
  const generated = generateYouTubeText(timeline, inputs, additionalText);
  const text = { ...generated, ...edits };
  const edited = edits.title !== undefined || edits.description !== undefined;
  function regenerate() { setEdits({}); setConfirmReset(false); setMessage("Text regenerated."); }
  async function copy(field: keyof YouTubeText) {
    try { await window.studio.copyText(text[field]); setMessage(`${field === "title" ? "Title" : "Description"} copied.`); }
    catch { setMessage("Could not copy. Select the text and copy it manually."); }
  }
  return <Modal.Backdrop isOpen={isOpen} onOpenChange={open => { setConfirmReset(false); setMessage(""); onOpenChange(open); }}>
    <Modal.Container><Modal.Dialog className="sm:max-w-[720px]">
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Heading>YouTube details</Modal.Heading>
        <p className="text-sm text-muted">Edit and copy the text for your upload. Export your thumbnail from the Thumbnail tab.</p>
      </Modal.Header>
      <Modal.Body className="gap-4">
        {(["title", "description"] as const).map(field => {
          const label = field === "title" ? "Title" : "Description";
          const error = youtubeTextError(field, text[field]);
          const inputError = edits[field] === undefined && (field === "description" ? Object.keys(errors).length > 0 : !!errors.pp);
          return <div key={field} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between"><label htmlFor={`youtube-${field}`} className="text-sm font-medium">{label}</label>
              <Button size="sm" variant="ghost" aria-label={`Copy ${field}`} isDisabled={!!error || inputError} onPress={() => void copy(field)}>Copy</Button></div>
            <TextArea id={`youtube-${field}`} aria-label={label} aria-invalid={!!error} aria-describedby={`youtube-${field}-help`}
              className={field === "title" ? "min-h-16" : "min-h-48"} rows={field === "title" ? 2 : 9}
              value={text[field]} onChange={event => { setEdits(old => ({ ...old, [field]: event.target.value })); setMessage(""); setConfirmReset(false); }} />
            <div id={`youtube-${field}-help`} className={`flex justify-between gap-3 text-xs ${error ? "text-danger" : "text-muted"}`}>
              <span>{error ?? (edits[field] !== undefined ? "Manually edited. Regenerate to apply input changes." : "Generated from replay data and the inputs below.")}</span>
              <span className="shrink-0">{field === "title" ? `${Array.from(text[field]).length} / 100` : `${new TextEncoder().encode(text[field]).length} / 5000 bytes`}</span>
            </div>
          </div>;
        })}
        {missing.length > 0 && <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Missing details</legend>
          <p className="text-xs text-muted">These values could not be confirmed. Blank fields are omitted.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{missing.map(key => <div key={key} className="flex flex-col gap-1">
            <label htmlFor={`youtube-${key}`} className="text-sm">{inputLabels[key]}</label>
            <Input id={`youtube-${key}`} aria-label={inputLabels[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `youtube-${key}-error` : undefined}
              inputMode={key === "pp" ? "decimal" : undefined} value={inputs[key]} placeholder={placeholders[key]}
              onChange={event => { setOverrides(old => ({ ...old, [key]: event.target.value })); setMessage(""); }} />
            {errors[key] && <p id={`youtube-${key}-error`} className="text-xs text-danger">{errors[key]}</p>}
          </div>)}</div>
        </fieldset>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="youtube-additional" className="text-sm font-medium">Additional text</label>
          <TextArea id="youtube-additional" aria-label="Additional text" rows={2} maxLength={20000} placeholder="Your usual credits or description footer"
            value={additionalText} onChange={event => {
              setMessage("");
              void onAdditionalTextChange(event.target.value).then(() => setSaveError("")).catch(() => setSaveError("Could not save additional text. Try again."));
            }} />
          <p className="text-xs text-muted">Saved for future replays. Leave blank to omit.</p>
          {saveError && <p role="alert" className="text-xs text-danger">{saveError}</p>}
        </div>
        {confirmReset && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Replace your title and description edits with generated text?</p>
          <div className="flex gap-2"><Button autoFocus size="sm" variant="secondary" onPress={() => setConfirmReset(false)}>Keep edits</Button>
            <Button size="sm" variant="danger-soft" onPress={regenerate}>Replace edits</Button></div>
        </div>}
        <p role="status" className="min-h-4 text-xs text-muted">{message}</p>
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" onPress={() => edited ? setConfirmReset(true) : regenerate()}>Regenerate</Button>
        <Button onPress={() => { setConfirmReset(false); onOpenChange(false); }}>Done</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}
