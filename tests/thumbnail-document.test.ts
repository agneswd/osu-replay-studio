import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultThumbnail, validateThumbnailDocument } from "../core/thumbnail-document.js";
import { resizeThumbnailLayer } from "../src/thumbnail-geometry.js";

test("thumbnail documents retain supported edits and reject unsafe export sizes and geometry", () => {
  const value = defaultThumbnail();
  value.width = 3840; value.layers['bottom-message'] = { text: 'same same', x: 10, y: -5, scale: 1.2 }; value.accentRange = { start: 5, end: 9 };
  assert.doesNotThrow(() => validateThumbnailDocument(value));
  assert.throws(() => validateThumbnailDocument({ ...value, width: 99999 } as never));
  assert.throws(() => validateThumbnailDocument({ ...value, layers: { pp: { scale: NaN } } }));
  assert.throws(() => validateThumbnailDocument({ ...value, accentRange: { start: 0, end: 100 } }));
});

test("thumbnail resize anchors all four corners despite internal text offsets", () => {
  const box = { x: 80, y: 40, w: 200, h: 80 }, origin = { x: 90, y: 35 }, layer = { x: 10, y: 5, scale: 1.2 };
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    const next = resizeThumbnailLayer(layer, box, origin, corner, 35, 20);
    const ratio = next.scale! / layer.scale;
    const x = origin.x + next.x! - layer.x + (box.x - origin.x) * ratio;
    const y = origin.y + next.y! - layer.y + (box.y - origin.y) * ratio;
    assert.ok(Math.abs((corner.endsWith('w') ? x + box.w * ratio : x) - (corner.endsWith('w') ? box.x + box.w : box.x)) < 1e-8);
    assert.ok(Math.abs((corner.startsWith('n') ? y + box.h * ratio : y) - (corner.startsWith('n') ? box.y + box.h : box.y)) < 1e-8);
  }
});

test("large thumbnail resizes stay within export bounds", () => {
  const value = defaultThumbnail();
  value.layers.panel = resizeThumbnailLayer({}, { x: 0, y: 0, w: 1280, h: 720 }, { x: 0, y: 0 }, "nw", -20000, -20000);
  assert.doesNotThrow(() => validateThumbnailDocument(value));
});


test("thumbnail text overrides preserve the exact text shown during editing", async () => {
  const { withTextOverride } = await import("../src/thumbnail-render/thumbnail/texts.js");
  const { referenceTemplate } = await import("../src/thumbnail-render/thumbnail/templates/reference/template.js");
  for (const pp of ["250 PP", "Personal best", ""]) {
    assert.equal(withTextOverride("pp", { pp: "100PP" }, { ...referenceTemplate, textOverrides: { pp } }), pp);
  }
});

test("custom text glow survives document serialization and rejects invalid effects", () => {
  const value = defaultThumbnail();
  value.customTexts = ["custom-glow"];
  value.layers["custom-glow"] = { text: "Glow", glow: { color: "#ff8800", blur: 18 } };
  assert.doesNotThrow(() => validateThumbnailDocument(JSON.parse(JSON.stringify(value))));
  value.layers["custom-glow"].glow!.blur = 101;
  assert.throws(() => validateThumbnailDocument(value), /glow/);
  value.layers["custom-glow"].glow = null;
  assert.doesNotThrow(() => validateThumbnailDocument(value));
});

test("replay text glow, badge borders, overlay, and drop shadow stay in the document", async () => {
  const value = defaultThumbnail();
  value.layers.grade = { glow: { color: "#ffe680", blur: 22 }, fontWeight: 700, fontFamily: "fredoka", gradient: { from: "#fff4b0", to: "#e7ce56" } };
  value.layers["badge-row"] = { borderMode: "bottom", borderWidth: 3, borderRadius: 24 };
  value.overlayOpacity = .4;
  value.dropShadow = { x: 0, y: 10, blur: 16, color: "#000000" };
  assert.doesNotThrow(() => validateThumbnailDocument(JSON.parse(JSON.stringify(value))));
  const { applyOverrides } = await import("../src/thumbnail-render/thumbnail/overrides.js");
  const { referenceTemplate } = await import("../src/thumbnail-render/thumbnail/templates/reference/template.js");
  const next = applyOverrides(referenceTemplate, { layers: value.layers, overlayOpacity: .4, dropShadow: value.dropShadow });
  assert.equal(next.components.grade.glow?.blur, 22);
  assert.equal(next.components.comboBadge.borderMode, "bottom");
  assert.equal(next.background.overlays.find(overlay => overlay.gradient?.startsWith("180deg"))?.opacity, .4);
  value.overlayOpacity = 2;
  assert.throws(() => validateThumbnailDocument(value), /overlay/);
});
