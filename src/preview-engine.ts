import { AudioSync, Renderer, Player, TimeMapper, parseReplay, parseBeatmap, computeModDifficulty, applyStacking, loadSkin, buildSkin, type SkinAssets } from "replayviewer-js";
import { unzipSync, strFromU8 } from "fflate";
import { cursorExpansion } from "../core/cursor.js";
import type { Timeline } from "../core/types.js";

const buffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;

export class PreviewEngine {
  private constructor(readonly renderer: Renderer, readonly audio: AudioSync, readonly context: AudioContext,
    private ownedSkins: SkinAssets[], private background: ImageBitmap | null,
    private expand: (time: number) => number, private rotate: boolean) {}
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
      Object.assign(renderer.options, { showJudgement: false, showKeyOverlay: false, showURBar: false, showModIcons: false });
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
