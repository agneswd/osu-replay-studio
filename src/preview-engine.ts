import { frameAt } from "../core/timeline.js";
import { displayMods } from "../core/mods.js";
import { modAssetPath, modColor } from "./mod-badges.js";
import type { StudioDefaults } from "../core/types.js";
import { normalizeLayout, type VideoLayout } from "../core/layout.js";
import { AudioSync, Renderer, Player, TimeMapper, parseReplay, parseBeatmap, computeModDifficulty, applyStacking, loadSkin, buildSkin, type SkinAssets } from "replayviewer-js";
import { unzipSync, strFromU8 } from "fflate";
import { cursorExpansion, visibleCursorFrames } from "../core/cursor.js";
import type { Timeline } from "../core/types.js";

const buffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;

export class PreviewEngine {
  private constructor(readonly renderer: Renderer, readonly audio: AudioSync, readonly context: AudioContext,
    private ownedSkins: SkinAssets[], private background: ImageBitmap | null,
    private expand: (time: number) => number, private rotate: boolean) {}
  private modImages = new Map<string, HTMLCanvasElement>();
  leaderboard(timeline: Timeline, settings: StudioDefaults, layout?: VideoLayout) {
    const target = normalizeLayout(layout).overlays.leaderboard;
    Object.assign(this.renderer.options, { studioUnderlay: settings.overlays.includes("leaderboard") ? (ctx: CanvasRenderingContext2D, timeMs: number) => {
      const rows = frameAt(timeline, timeMs / 1000 / timeline.speed, settings.leaderboardSize, settings.leaderboardSort).leaderboard?.rows ?? [];
      const pinned = rows.some(row => row.current && row.slot === 7);
      ctx.save(); ctx.scale(2 / 3, 2 / 3);
      ctx.translate(target.x, target.y); ctx.scale(target.scale, target.scale);
      ctx.beginPath(); ctx.rect(0, 0, 365, 384); ctx.clip();
      for (const row of rows) {
        const slot = row.slot ?? rows.indexOf(row);
        ctx.globalAlpha = (row.opacity ?? 1) * (row.current ? 1 : .52) * (pinned && !row.current ? Math.max(0, Math.min(1, 7 - slot)) : 1);
        let x = 308;
        for (const mod of displayMods(row.mods)) {
          const source = modAssetPath(mod);
          if (!source) continue;
          let badge = this.modImages.get(source);
          if (!badge) {
            badge = document.createElement("canvas");
            badge.width = badge.height = 54;
            const paint = badge.getContext("2d")!;
            const color = modColor(mod);
            paint.beginPath(); paint.roundRect(0, 0, 54, 54, 9); paint.clip();
            paint.fillStyle = color.bg; paint.fillRect(0, 0, 54, 54);
            const image = new Image();
            // Rasterize the complete badge once, including the CSS styling used by the HUD.
            image.onload = () => {
              if (color.fg === "dark") paint.filter = "brightness(0.15)";
              const scale = Math.max(54 / image.naturalWidth, 54 / image.naturalHeight);
              paint.drawImage(image, (54 - image.naturalWidth * scale) / 2,
                (54 - image.naturalHeight * scale) / 2,
                image.naturalWidth * scale, image.naturalHeight * scale);
            };
            image.src = source;
            this.modImages.set(source, badge);
          }
          ctx.drawImage(badge, x, slot * 48 + 14, 18, 18);
          x += 16;
        }
      }
      ctx.restore();
    } : undefined });
  }
  private size = 1;
  private disposed = false;

  static async create(canvas: HTMLCanvasElement, timeline: Timeline, skinPath: string) {
    const context = new AudioContext();
    const owned: SkinAssets[] = [];
    let background: ImageBitmap | null = null;
    try {
      const [data, baseBytes, selectedBytes] = await Promise.all([
        window.studio.previewData(), window.studio.previewSkin(""), skinPath ? window.studio.previewSkin(skinPath) : undefined,
      ]);
      const base = await loadSkin(buffer(baseBytes), context); owned.push(base);
      const selected = selectedBytes ? await loadSkin(buffer(selectedBytes), context) : undefined;
      if (selected) owned.push(selected);
      const skin = buildSkin(base, selected);
      const iniFiles = unzipSync(new Uint8Array(selectedBytes ?? baseBytes), { filter: file => /(?:^|\/)skin\.ini$/i.test(file.name) });
      const ini = strFromU8(Object.values(iniFiles)[0] ?? new Uint8Array());
      const expand = /^CursorExpand\s*:\s*0/m.test(ini) ? () => 1 : cursorExpansion(timeline.replayFrames ?? [], timeline.speed);
      const rotate = !/^CursorRotate\s*:\s*0/m.test(ini);
      // Smaller judgement bursts keep the workspace preview readable.
      for (const [name, bitmap] of skin.images) {
        if (!/^hit(?:100|50|0)(?:[kg]|-\d+)?(?:@2x)?\.png$/.test(name) || bitmap.width <= 1) continue;
        const resized = await createImageBitmap(bitmap, { resizeWidth: Math.max(1, Math.round(bitmap.width * .7)),
          resizeHeight: Math.max(1, Math.round(bitmap.height * .7)), resizeQuality: "high" });
        skin.images.set(name, resized);
        // buildSkin can share image maps with its input skin.
        owned.push({ ...skin, images: new Map([[name, bitmap], [`${name}-resized`, resized]]) });
      }
      const replay = await parseReplay(buffer(data.replay));
      const map = parseBeatmap(data.mapText);
      const difficulty = computeModDifficulty(map, replay);
      applyStacking(map, difficulty);
      let song: AudioBuffer | null = null;
      if (timeline.audioUrl) song = await context.decodeAudioData(await (await fetch(timeline.audioUrl)).arrayBuffer());
      const sounds = new Map(skin.sounds);
      await Promise.all(Object.entries(data.samples).map(async ([name, bytes]) => {
        try { sounds.set(name.toLowerCase(), await context.decodeAudioData(buffer(bytes))); } catch { /* Ignore invalid map samples. */ }
      }));
      if (timeline.bgImage) background = await createImageBitmap(await (await fetch(timeline.bgImage)).blob());
      const renderer = new Renderer(canvas, new Player(timeline.duration * 1000), replay, map, skin,
        new TimeMapper(replay.frames, 0, 0, timeline.speed), background, difficulty, 1);
      Object.assign(renderer.options, { showJudgement: false, showKeyOverlay: false, showURBar: false, showModIcons: false,
        studioCursorFrames: visibleCursorFrames(replay.frames) });
      const audio = new AudioSync({ ctx: context, songBuffer: song, skinSounds: skin.sounds, mergedSounds: sounds,
        beatmap: map, hitResults: renderer.hitResults, comboFrames: renderer.comboFrames,
        introOffsetMs: 0, speed: timeline.speed, isNC: timeline.preservesPitch === false });
      return new PreviewEngine(renderer, audio, context, owned, background, expand, rotate);
    } catch (error) {
      for (const skin of owned) for (const image of skin.images.values()) image.close();
      background?.close(); await context.close(); throw error;
    }
  }
  cursorSize(size: number) { this.size = size; }
  layout(value?: VideoLayout) {
    const field = normalizeLayout(value).playfield;
    Object.assign(this.renderer.options, { studioPlayfield: { x: field.x / 1.5, y: field.y / 1.5, scale: field.scale } });
  }
  draw(seconds: number, speed: number, dim: number) {
    if (this.disposed) return;
    // Danser uses a 768 px playfield at 720p. The preview uses 720 px.
    const scale = this.size * 16 / 15;
    Object.assign(this.renderer.options, { backgroundDim: dim, cursorMiddleScale: scale,
      cursorScale: scale * this.expand(seconds * speed * 1000), cursorAngle: this.rotate ? seconds * Math.PI / 5 : 0 });
    this.renderer.renderFrameAt(seconds * speed * 1000);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.stop(); this.audio.destroy(); void this.context.close();
    for (const bitmap of new Set(this.ownedSkins.flatMap(skin => [...skin.images.values()]))) bitmap.close();
    this.background?.close();
  }
}
