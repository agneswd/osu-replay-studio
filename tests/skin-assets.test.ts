import test from "node:test";
import assert from "node:assert/strict";
import { gameplaySkinAssets } from "../core/skin-assets.js";

test("gameplay skin loading retains custom fonts, animated sprites and hit sounds", () => {
  const keep = gameplaySkinAssets("[Fonts]\nHitCirclePrefix: my-circles\nScorePrefix: digits\nComboPrefix: combo");
  for (const name of ["skin.ini", "Cursor@2x.png", "sliderb0.png", "hit100-12@2x.png", "followpoint-3.png", "my-circles-0.png", "digits-dot.png", "combo-9.png", "spinner-background.png", "normal-hitclap.wav", "combobreak.ogg"])
    assert.ok(keep(name), name);
  for (const name of ["menu-background.png", "ranking-panel@2x.png", "mania-stage-left.png", "welcome.wav", "taiko-hitcircle.png"])
    assert.ok(!keep(name), name);
});
