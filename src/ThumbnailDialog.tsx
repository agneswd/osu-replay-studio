import { useRef, useState } from "react";
import { Button, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Input, Label, Modal } from "@heroui/react";
import type { ThumbnailTextOptions } from "../core/types.js";

export function ThumbnailDialog({ accent, onClose, onExport }: {
  accent: string;
  onClose(): void;
  onExport(options: ThumbnailTextOptions & { accent: string }): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState(accent);
  const [range, setRange] = useState<ThumbnailTextOptions["accentRange"]>();
  return <Modal.Backdrop isOpen onOpenChange={open => { if (!open) onClose(); }}>
    <Modal.Container>
      <Modal.Dialog className="sm:max-w-[560px]">
        <Modal.CloseTrigger />
        <Modal.Header><Modal.Heading>Export thumbnail</Modal.Heading></Modal.Header>
        <Modal.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="thumbnail-message">Bottom text</Label>
            <Input ref={input} id="thumbnail-message" autoFocus value={text} maxLength={160} placeholder="Leave blank for no bottom text"
              onChange={event => { setText(event.target.value); setRange(undefined); }} />
            <p className="text-sm text-muted">Select text in the field, then choose Accent selection.</p>
          </div>
          <div className="flex items-center gap-3">
            <Label>Thumbnail accent</Label>
            <ColorPicker value={color} onChange={value => setColor(value.toString("hex"))}>
              <ColorPicker.Trigger aria-label="Thumbnail accent"><ColorSwatch /></ColorPicker.Trigger>
              <ColorPicker.Popover className="flex w-64 flex-col gap-3 p-4">
                <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness"><ColorArea.Thumb /></ColorArea>
                <ColorSlider channel="hue" colorSpace="hsb"><ColorSlider.Track><ColorSlider.Thumb /></ColorSlider.Track></ColorSlider>
                <ColorField><Label>Hex color</Label><ColorField.Group><ColorField.Input /></ColorField.Group></ColorField>
              </ColorPicker.Popover>
            </ColorPicker>
            <Button size="sm" variant="secondary" onPress={() => {
              const start = input.current?.selectionStart, end = input.current?.selectionEnd;
              if (start != null && end != null && end > start) setRange({ start, end });
            }}>Accent selection</Button>
            <Button size="sm" variant="ghost" isDisabled={!range} onPress={() => setRange(undefined)}>Clear text accent</Button>
          </div>
          {text && <p aria-label="Bottom text preview" className="break-words text-center text-xl font-bold">
            {range ? <>{text.slice(0, range.start)}<span style={{ color }}>{text.slice(range.start, range.end)}</span>{text.slice(range.end)}</> : text}
          </p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onPress={onClose}>Cancel</Button>
          <Button onPress={() => onExport({ bottomText: text, accentRange: range, accent: color })}>Export PNG</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>;
}
