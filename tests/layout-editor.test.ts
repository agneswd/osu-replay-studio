import test from "node:test";
import assert from "node:assert/strict";
import { defaultLayout } from "../core/layout.js";
import { editingGroup, groupMembers, moveElement, placedBox, resizeElement, type Corner } from "../src/layout-geometry.js";

test("resizing holds the opposite visible corner for padded counters and centered playfields", () => {
  for (const id of ["combo-counter", "playfield"] as const) {
    const local = id === "playfield" ? { x: -540, y: -405, w: 1080, h: 810 } : { x: 210, y: 5, w: 130, h: 50 };
    const layout = defaultLayout(), before = placedBox(layout, id, local);
    for (const corner of ["nw", "ne", "sw", "se"] as Corner[]) {
      const after = placedBox(resizeElement(layout, id, local, corner, 30, 20), id, local);
      const anchor = (box: typeof before) => [box.x + (corner.endsWith("w") ? box.w : 0), box.y + (corner.startsWith("n") ? box.h : 0)];
      anchor(after).forEach((value, i) => assert.ok(Math.abs(value - anchor(before)[i]) < 1e-8));
      assert.ok(Math.abs(after.w / after.h - before.w / before.h) < 1e-8);
    }
  }
});
test("dragging keeps independent layout values and enforces supported limits", () => {
  const original = defaultLayout(), changed = moveElement(original, "combo-counter", 120, -50);
  assert.equal(changed.overlays["combo-counter"].x, 524);
  assert.deepEqual(changed.playfield, original.playfield);
  assert.equal(original.overlays["combo-counter"].x, 404);
  assert.equal(resizeElement(original, "playfield", { x: -540, y: -405, w: 1080, h: 810 }, "se", -9999, -9999).playfield.scale, .1);
});

test("editing groups move and resize both overlays while preserving their arrangement", () => {
  for (const [primary, secondary] of [["player-info", "accuracy-counter"], ["hit-error-bar", "hit-counts"]] as const) {
    assert.equal(editingGroup(secondary), primary);
    assert.ok(groupMembers(primary).includes(secondary));
    const layout = defaultLayout();
    layout.overlays[secondary].scale = .8;
    const moved = moveElement(layout, primary, 30, -12);
    for (const id of [primary, secondary]) {
      assert.equal(moved.overlays[id].x, layout.overlays[id].x + 30);
      assert.equal(moved.overlays[id].y, layout.overlays[id].y - 12);
    }
    const box = { x: 0, y: 0, w: 1200, h: 120 };
    const resized = resizeElement(layout, primary, box, "se", 120, 12);
    const a = layout.overlays[primary], b = layout.overlays[secondary];
    const ra = resized.overlays[primary], rb = resized.overlays[secondary];
    assert.ok(Math.abs(rb.scale / ra.scale - b.scale / a.scale) < 1e-9);
    assert.ok(Math.abs((rb.x - ra.x) - (b.x - a.x) * ra.scale / a.scale) < 1e-9);
    assert.ok(Math.abs((rb.y - ra.y) - (b.y - a.y) * ra.scale / a.scale) < 1e-9);
  }
});
