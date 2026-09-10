import path from "node:path";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { nativeImage } from "electron";
import readline from "node:readline";
import { blitSprite, fadeToBlack, mixBuffers } from "../core/scene-blit.js";
import { sceneBlur, sceneFade, outroPause } from "../core/presentation.js";
import type { HudFrame } from "../core/native-hud.js";

interface SceneData { fps: number; assets: string[]; frames: string; foreground?: HudFrame }

function bitmap(file: string) {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) throw new Error(`Scene image is missing or invalid: ${file}`);
  const { width, height } = image.getSize();
  return { width, height, data: new Uint8Array(image.toBitmap()) };
}

export async function* compositeNativeScene(
  scene: string,
  background: { clear: string; soft: string; motion?: { directory: string; start: number } },
  kind: "intro" | "outro",
  frames: number,
  fps: number,
  width: number,
  height: number,
  signal: AbortSignal,
) {
  const data = JSON.parse(await readFile(scene, "utf8")) as SceneData;
  if (data.fps !== fps) throw new Error("Native scene frame rate does not match the presentation clock.");
  let clear = bitmap(background.clear);
  let soft = bitmap(background.soft);
  if (clear.width !== width || clear.height !== height || soft.width !== width || soft.height !== height)
    throw new Error("Scene background size does not match the output.");
  const assets = data.assets.map(file => file ? bitmap(file) : undefined);
  const dest = new Uint8Array(width * height * 4);
  const mixed = new Uint8Array(width * height * 4);
  let mixedStrength = Number.NaN;
  let previousFrame = "";
  const scaleX = width / 1920, scaleY = height / 1080;
  const drawForeground = (target: Uint8Array, opacity = 1) => {
    for (const sprite of data.foreground?.sprites ?? []) {
      const asset = assets[sprite.asset]!;
      blitSprite(target, width, height, asset.data, asset.width, asset.height,
        sprite.x * scaleX, sprite.y * scaleY, sprite.w * scaleX, sprite.h * scaleY,
        [sprite.color[0], sprite.color[1], sprite.color[2], sprite.color[3] * opacity],
        sprite.clip ? [sprite.clip[0] * scaleX, sprite.clip[1] * scaleY, sprite.clip[2] * scaleX, sprite.clip[3] * scaleY] : undefined);
    }
  };
  let index = 0;
  const transitionFrames = kind === "outro" ? Math.round(outroPause * fps) : 0;
  for (; index < transitionFrames; index++) {
    signal.throwIfAborted();
    const progress = index / transitionFrames;
    mixBuffers(mixed, clear.data, soft.data, progress * progress * (3 - 2 * progress));
    drawForeground(mixed, progress * progress * (3 - 2 * progress));
    yield Buffer.from(mixed);
  }
  const stream = createReadStream(data.frames);
  const zip = createGunzip();
  const lines = readline.createInterface({ input: stream.pipe(zip), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      signal.throwIfAborted();
      if (index >= frames) break;
      const time = (index - transitionFrames) / fps;
      const strength = sceneBlur(kind, time);
      const moving = background.motion && index >= background.motion.start;
      if (moving) {
        clear = bitmap(path.join(background.motion!.directory, `motion-clear-${index}.png`));
        soft = bitmap(path.join(background.motion!.directory, `motion-soft-${index}.png`));
      }
      const backgroundChanged = moving || strength !== mixedStrength;
      if (backgroundChanged) {
        mixBuffers(mixed, clear.data, soft.data, strength);
        mixedStrength = strength;
      }
      // Hold the composed image while both the sprite frame and background stay unchanged.
      if (line !== previousFrame || backgroundChanged) {
        const frame = JSON.parse(line) as HudFrame;
        dest.set(mixed);
        drawForeground(dest);
        for (const sprite of frame.sprites) {
          const asset = assets[sprite.asset];
          if (!asset) throw new Error(`Native scene sprite ${sprite.asset} is missing.`);
          blitSprite(
            dest, width, height, asset.data, asset.width, asset.height,
            sprite.x * scaleX, sprite.y * scaleY, sprite.w * scaleX, sprite.h * scaleY,
            sprite.color,
            sprite.clip ? [sprite.clip[0] * scaleX, sprite.clip[1] * scaleY, sprite.clip[2] * scaleX, sprite.clip[3] * scaleY] : undefined,
          );
        }
        previousFrame = line;
      }
      // Fade a separate output buffer so repeated frames cannot accumulate the fade.
      const output = Buffer.from(dest);
      fadeToBlack(output, sceneFade(kind, time));
      yield output;
      index++;
    }
  } finally {
    lines.close();
    zip.close();
    stream.destroy();
  }
  if (index !== frames) throw new Error("Native scene frame count does not match the presentation clock.");
}
