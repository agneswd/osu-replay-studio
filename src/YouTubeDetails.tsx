import { useState } from "react";
import { Button, Disclosure, Input, Label, ListBox, Modal, NumberField, Select, TextArea } from "@heroui/react";
import type { Timeline } from "../core/types.js";
import { generateYouTubeText, youtubeInputs, youtubeInputErrors, youtubeTextError, type YouTubeInputs, type YouTubeText } from "../core/youtube-metadata.js";

const inputLabels: Record<keyof YouTubeInputs, string> = {
  playerUrl: "Player URL", beatmapUrl: "Beatmap URL", pp: "Score PP", status: "Play status",
  youtubeUrl: "YouTube", twitchUrl: "Twitch", twitterUrl: "Twitter", skinUrl: "Skin URL", mapperUrl: "Mapper URL",
  totalPlayed: "Total played", playcount: "Playcount", rank: "Rank", joined: "Join date", playerPP: "Player PP",
};
const placeholders: Partial<Record<keyof YouTubeInputs, string>> = {
  playerUrl: "https://osu.ppy.sh/users/123456", beatmapUrl: "https://osu.ppy.sh/beatmaps/123456",
  youtubeUrl: "https://www.youtube.com/@player", twitchUrl: "https://www.twitch.tv/player",
  totalPlayed: "120h", joined: "2021-01-01",
};

// Keep the component mounted while closed so the current replay retains its edits.
export function YouTubeDetails({ timeline, files, isOpen, onOpenChange, additionalText, onAdditionalTextChange }: {
  timeline: Timeline; isOpen: boolean; onOpenChange(open: boolean): void;
  files: { video?: string; thumbnail?: string };
  additionalText: string; onAdditionalTextChange(text: string): Promise<void>;
}) {
  const [overrides, setOverrides] = useState<Partial<YouTubeInputs>>({});
  const [edits, setEdits] = useState<Partial<YouTubeText>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const automatic = youtubeInputs(timeline);
  const inputs = { ...automatic, ...overrides };
  const errors = youtubeInputErrors(inputs);
  const generated = generateYouTubeText(timeline, inputs, additionalText);
  const text = { ...generated, ...edits };
  const edited = edits.title !== undefined || edits.description !== undefined;
  function update(key: keyof YouTubeInputs, value: string) {
    setOverrides(old => ({ ...old, [key]: value })); setMessage("");
  }
  function inputField(key: keyof YouTubeInputs) {
    return <div key={key} className="flex flex-col gap-1">
      <Label htmlFor={`youtube-${key}`} className="text-sm">{inputLabels[key]}</Label>
      <Input variant="secondary" id={`youtube-${key}`} aria-label={inputLabels[key]} aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `youtube-${key}-error` : undefined}
        inputMode={key === "pp" ? "decimal" : undefined} value={inputs[key]} placeholder={placeholders[key] ?? "Optional"}
        onChange={event => update(key, event.target.value)} />
      {errors[key] && <p id={`youtube-${key}-error`} className="text-xs text-danger">{errors[key]}</p>}
    </div>;
  }
  function regenerate() { setEdits({}); setConfirmReset(false); setMessage("Text regenerated."); }
  async function copy(field: keyof YouTubeText) {
    try { await window.studio.copyText(text[field]); setMessage(`${field === "title" ? "Title" : "Description"} copied.`); }
    catch { setMessage("Could not copy. Select the text and copy it manually."); }
  }
  async function fileAction(action: () => Promise<void>, success = "") {
    try { await action(); setMessage(success); }
    catch (error) { setMessage((error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")); }
  }
  return <Modal.Backdrop isOpen={isOpen} onOpenChange={open => { setConfirmReset(false); setMessage(""); onOpenChange(open); }}>
    <Modal.Container><Modal.Dialog className="sm:max-w-[1120px]">
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Heading>{files.video && files.thumbnail ? "Ready to upload" : "YouTube details"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
        {(["title", "description"] as const).map(field => {
          const label = field === "title" ? "Title" : "Description";
          const error = youtubeTextError(field, text[field]);
          const inputError = edits[field] === undefined && (field === "description" ? Object.keys(errors).length > 0 : !!errors.pp || !!errors.status);
          return <div key={field} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between"><Label htmlFor={`youtube-${field}`} className="text-sm font-medium">{label}</Label>
              <Button size="sm" variant="ghost" aria-label={`Copy ${field}`} isDisabled={!!error || inputError} onPress={() => void copy(field)}>Copy</Button></div>
            <TextArea variant="secondary" id={`youtube-${field}`} aria-label={label} aria-invalid={!!error} aria-describedby={`youtube-${field}-help`}
              className={field === "title" ? "min-h-20" : "min-h-80"} rows={field === "title" ? 3 : 14}
              value={text[field]} onChange={event => { setEdits(old => ({ ...old, [field]: event.target.value })); setMessage(""); setConfirmReset(false); }} />
            <div id={`youtube-${field}-help`} className={`flex justify-between gap-3 text-xs ${error ? "text-danger" : "text-muted"}`}>
              <span>{error ?? (edits[field] !== undefined ? "Edited" : "")}</span>
              <span className="shrink-0">{field === "title" ? `${Array.from(text[field]).length} / 100` : `${new TextEncoder().encode(text[field]).length} / 5000 bytes`}</span>
            </div>
          </div>;
        })}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
        <Disclosure key={`${files.video ?? ""}:${files.thumbnail ?? ""}`} defaultExpanded={!!files.video || !!files.thumbnail}>
          <Disclosure.Heading><Disclosure.Trigger className="flex w-full items-center gap-2 py-0 text-sm">Exported files<Disclosure.Indicator /></Disclosure.Trigger></Disclosure.Heading>
          <Disclosure.Content><Disclosure.Body>
          {(["video", "thumbnail"] as const).map(kind => {
            const file = files[kind], label = kind === "video" ? "Video" : "Thumbnail";
            return <div key={kind} className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                {file && <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Copy ${kind} path`} onPress={() => void fileAction(() => window.studio.copyText(file), `${label} path copied.`)}>Copy path</Button>
                  <Button size="sm" variant="secondary" aria-label={`Show ${kind} file`} onPress={() => void fileAction(() => window.studio.revealExport(file), `${label} shown in your file manager.`)}>Show file</Button>
                </div>}
              </div>
              <p className="select-text break-all text-xs text-muted">{file ?? (kind === "video" ? "Render a video to add it here." : "Export a PNG from the Thumbnail tab.")}</p>
            </div>;
          })}
          </Disclosure.Body></Disclosure.Content>
        </Disclosure>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {inputField("pp")}
          <div className="flex flex-col gap-1">
            <Select aria-label="Play status" variant="secondary"
              value={inputs.status.endsWith("xMiss") ? "miss" : inputs.status.endsWith("xSB") ? "sb" : inputs.status || "omit"}
              onChange={key => update("status", key === "miss" ? `${Math.max(1, timeline.sceneInfo?.score.hits["0"] ?? 1)}xMiss`
                : key === "sb" ? `${Math.max(1, timeline.sceneInfo?.playStatus?.sliderBreaks ?? 1)}xSB` : key === "omit" ? "" : String(key))}>
              <Label>Play status</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover><ListBox>
                {[["omit", "Omit"], ["FC", "Full combo (FC)"], ["FAIL", "Fail"], ["miss", "Misses"], ["sb", "Slider breaks"]].map(([id, label]) =>
                  <ListBox.Item key={id} id={id} textValue={label}>{label}<ListBox.ItemIndicator /></ListBox.Item>)}
              </ListBox></Select.Popover>
            </Select>
            {/x(Miss|SB)$/.test(inputs.status) && <NumberField variant="secondary"
              aria-label={inputs.status.endsWith("xMiss") ? "Miss count" : "Slider break count"} minValue={1} step={1}
              value={parseInt(inputs.status, 10)} isInvalid={!!errors.status}
              onChange={value => update("status", `${Number.isNaN(value) ? "" : value}x${inputs.status.endsWith("xMiss") ? "Miss" : "SB"}`)}>
              <NumberField.Group><NumberField.DecrementButton /><NumberField.Input id="youtube-status-count" /><NumberField.IncrementButton /></NumberField.Group>
            </NumberField>}
            {errors.status && <p className="text-xs text-danger">{errors.status}</p>}
          </div>
          {(["youtubeUrl", "twitchUrl"] as const).map(inputField)}
        </div>
        <Disclosure>
          <Disclosure.Heading><Disclosure.Trigger className="flex w-full items-center gap-2 py-0 text-sm">Player and map details<Disclosure.Indicator /></Disclosure.Trigger></Disclosure.Heading>
          <Disclosure.Content><Disclosure.Body><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["playerUrl", "beatmapUrl", "mapperUrl", "skinUrl", "twitterUrl", "totalPlayed", "playcount", "rank", "joined", "playerPP"] as const).map(inputField)}
          </div></Disclosure.Body></Disclosure.Content>
        </Disclosure>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="youtube-additional" className="text-sm font-medium">Additional text</Label>
          <TextArea variant="secondary" id="youtube-additional" aria-label="Additional text" rows={2} maxLength={20000} placeholder="Your usual credits or description footer"
            value={additionalText} onChange={event => {
              setMessage("");
              void onAdditionalTextChange(event.target.value).then(() => setSaveError("")).catch(() => setSaveError("Could not save additional text. Try again."));
            }} />
          {saveError && <p role="alert" className="text-xs text-danger">{saveError}</p>}
        </div>
        </div>
        </div>
        {confirmReset && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Replace your title and description edits with generated text?</p>
          <div className="flex gap-2"><Button autoFocus size="sm" variant="secondary" onPress={() => setConfirmReset(false)}>Keep edits</Button>
            <Button size="sm" variant="danger-soft" onPress={regenerate}>Replace edits</Button></div>
        </div>}
      </Modal.Body>
      <Modal.Footer className="flex-wrap"><p role="status" className="min-h-4 basis-full text-xs text-muted">{message}</p>
        <Button variant="secondary" onPress={() => edited ? setConfirmReset(true) : regenerate()}>Regenerate</Button>
        <Button variant="secondary" onPress={() => void fileAction(() => window.studio.openYouTubeStudio(), "YouTube Studio opened in your browser.")}>Open YouTube Studio</Button>
        <Button onPress={() => { setConfirmReset(false); onOpenChange(false); }}>Done</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}
