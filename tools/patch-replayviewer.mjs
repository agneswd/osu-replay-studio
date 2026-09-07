import { readFile, writeFile } from "node:fs/promises";
// Keep these small renderer corrections tied to the pinned upstream version.
const file = "node_modules/replayviewer-js/dist/index.js";
let source = await readFile(file, "utf8");
const changes = [
  ['    this._ruleset.draw(ctx, this._session, timeMs, options);', `    ctx.save();
    const field = options.studioPlayfield;
    if (field) {
      ctx.translate(field.x, field.y);
      ctx.scale(field.scale, field.scale);
      ctx.translate(-640, -360);
    }
    this._ruleset.draw(ctx, this._session, timeMs, options);
    ctx.restore();`],
  ['function drawJudgements(ctx, results, timeMs, skin, mode = "std", circleRadiusOsuPx) {', `const popupCache = new WeakMap();
function drawJudgements(
  ctx, results, timeMs, skin, mode = "std", circleRadiusOsuPx) {
  if (mode === "std") {
    let popups = popupCache.get(results);
    if (!popups) {
      popups = results.filter(result => !result.isSliderSub && result.judgement !== 300);
      popupCache.set(results, popups);
    }
    results = popups;
  }`],
  ['function drawSprite(ctx, s, cx, cy) {', 'function drawSprite(ctx, s, cx, cy, scale = 1, angle = 0) {'],
  ['s.bmp.width / s.scale * CURSOR_PX_PER_NATIVE;', 's.bmp.width / s.scale * CURSOR_PX_PER_NATIVE * scale;'],
  ['s.bmp.height / s.scale * CURSOR_PX_PER_NATIVE;', 's.bmp.height / s.scale * CURSOR_PX_PER_NATIVE * scale;'],
  ['ctx.drawImage(s.bmp, cx - w / 2, cy - h / 2, w, h);', 'ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.drawImage(s.bmp, -w / 2, -h / 2, w, h); ctx.restore();'],
  ['function drawCursor(ctx, replay, timeMs, skin) {', 'function drawCursor(ctx, replay, timeMs, skin, options = {}) {'],
  ['drawSprite(ctx, trail, tx, ty);', 'drawSprite(ctx, trail, tx, ty, options.cursorScale);'],
  ['drawSprite(ctx, cursor, cx, cy);', 'drawSprite(ctx, cursor, cx, cy, options.cursorScale, options.cursorAngle);'],
  ['drawSprite(ctx, cursorMiddle, cx, cy);', 'drawSprite(ctx, cursorMiddle, cx, cy, options.cursorMiddleScale);'],
  ['drawCursor(ctx, s.replay, timeMs, s.skin);', 'drawCursor(ctx, s.replay, timeMs, s.skin, options);'],
  ['rgba(10, 10, 20, ${dim})', 'rgba(0, 0, 0, ${dim})'],
  ['octx.fillStyle = "#1a1a2e";', 'octx.fillStyle = "#000000";'],
  ['ctx.fillStyle = "#1a1a2e";', 'ctx.fillStyle = "#000000";'],
];
for (const [before, after] of changes) {
  if (source.includes(after)) continue;
  if (source.includes(before)) source = source.replace(before, after);
  else throw new Error("The replay renderer changed. Review its preview patch.");
}
await writeFile(file, source);
