import { readFile, writeFile } from "node:fs/promises";
// Keep these small renderer corrections tied to the pinned upstream version.
const file = "node_modules/replayviewer-js/dist/index.js";
let source = await readFile(file, "utf8");
// The presentation clock schedules the song ramp and hit sounds on the audio thread.
const changes = [
  ["async playFrom(presMs) {", `async playFrom(presMs, studioClock) {
    this._studioClock = studioClock;`],
  ["return this._presTimeAtStart + (this.ctx.currentTime - this._ctxTimeAtStart) * 1e3 * this._userRate;", `if (this._studioClock) return this._studioClock.timeAt(this.ctx.currentTime - this._ctxTimeAtStart) * 1000;
    return this._presTimeAtStart + (this.ctx.currentTime - this._ctxTimeAtStart) * 1e3 * this._userRate;`],
  ["    source.playbackRate.value = this._playRate * this._userRate;\n    source.connect(this.songGain);", `    source.playbackRate.value = this._playRate * this._userRate;
    source.connect(this.songGain);
    if (this._studioClock) {
      const clock = this._studioClock;
      const begins = Math.max(0, clock.start, clock.elapsedAt(0));
      const offset = Math.max(0, clock.timeAt(begins) * this._playRate);
      if (offset >= this._playBuffer.duration) { source.disconnect(); return; }
      const when = this._ctxTimeAtStart + begins;
      source.playbackRate.setValueAtTime(this._playRate * clock.rateAt(begins), when);
      if (clock.rampEnd > begins) source.playbackRate.linearRampToValueAtTime(this._playRate, this._ctxTimeAtStart + clock.rampEnd);
      source.start(when, offset);
      this.activeSong = source;
      return;
    }`, "      const clock = this._studioClock;"],
  ["      source.start(when, offset);", `      const entranceGain = this.ctx.createGain();
      entranceGain.gain.setValueAtTime(.5 * clock.rateAt(begins) + .5 * Math.min(1, Math.max(0, (begins - clock.rampEnd) / .25)), when);
      if (clock.rampEnd > begins) entranceGain.gain.linearRampToValueAtTime(.5, this._ctxTimeAtStart + clock.rampEnd);
      if (clock.rampEnd + .25 > begins) entranceGain.gain.linearRampToValueAtTime(1, this._ctxTimeAtStart + clock.rampEnd + .25);
      source.disconnect();
      source.connect(entranceGain);
      entranceGain.connect(this.songGain);
      source.onended = () => entranceGain.disconnect();
      source.start(when, offset);`],
  ["const when = anchorCtxS + (ev.beatmapMs - anchorBeatmapMs) / toRealSec;", `const when = anchorCtxS + (this._studioClock
        ? this._studioClock.elapsedAt((ev.beatmapMs - this.introOffsetMs) / (1000 * this.speed))
        : (ev.beatmapMs - anchorBeatmapMs) / toRealSec);`],

  ['    this._ruleset.draw(ctx, this._session, timeMs, options);', `    ctx.save();
    const field = options.studioPlayfield;
    if (field) {
      ctx.translate(field.x, field.y);
      ctx.scale(field.scale, field.scale);
      ctx.translate(-640, -360);
    }
    this._ruleset.draw(ctx, this._session, timeMs, options);
    ctx.restore();`],
  ['    }\n    ctx.save();\n    const field = options.studioPlayfield;', '    }\n    options.studioUnderlay?.(ctx, timeMs);\n    ctx.save();\n    const field = options.studioPlayfield;'],
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
  ['function drawCursor(ctx, replay, timeMs, skin, options = {}) {\n  const { frames } = replay;', 'function drawCursor(ctx, replay, timeMs, skin, options = {}) {\n  const frames = options.studioCursorFrames ?? replay.frames;'],
  ['  const times = getCumulativeTimes(frames);\n  const idx = findFrameIndex(times, timeMs);', '  const times = getCumulativeTimes(frames);\n  timeMs = Math.max(timeMs, times[0]);\n  const idx = findFrameIndex(times, timeMs);'],
  ['drawSprite(ctx, trail, tx, ty);', 'drawSprite(ctx, trail, tx, ty, options.cursorScale);'],
  ['drawSprite(ctx, cursor, cx, cy);', 'drawSprite(ctx, cursor, cx, cy, options.cursorScale, options.cursorAngle);'],
  ['drawSprite(ctx, cursorMiddle, cx, cy);', 'drawSprite(ctx, cursorMiddle, cx, cy, options.cursorMiddleScale);'],
  ['drawCursor(ctx, s.replay, timeMs, s.skin);', 'drawCursor(ctx, s.replay, timeMs, s.skin, options);'],
  ['rgba(10, 10, 20, ${dim})', 'rgba(0, 0, 0, ${dim})'],
  ['octx.fillStyle = "#1a1a2e";', 'octx.fillStyle = "#000000";'],
  ['ctx.fillStyle = "#1a1a2e";', 'ctx.fillStyle = "#000000";'],
];
for (const [before, after, marker = after] of changes) {
  if (source.includes(marker)) continue;
  if (source.includes(before)) source = source.replace(before, after);
  else throw new Error("The replay renderer changed. Review its preview patch.");
}
await writeFile(file, source);

const declarations = "node_modules/replayviewer-js/dist/player/AudioSync.d.ts";
const types = await readFile(declarations, "utf8");
const before = "playFrom(presMs: number): Promise<void>;";
const after = "playFrom(presMs: number, studioClock?: { timeAt(seconds: number): number; elapsedAt(seconds: number): number; rateAt(seconds: number): number; start: number; rampEnd: number }): Promise<void>;";
if (!types.includes(before) && !types.includes(after)) throw new Error("The replay audio API changed. Review its clock patch.");
await writeFile(declarations, types.replace(before, after));
