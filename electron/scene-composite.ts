import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { nativeImage } from "electron";
import readline from "node:readline";
import { blitSprite, fadeToBlack, mixBuffers } from "../core/scene-blit.js";
import { sceneBlur, sceneFade } from "../core/presentation.js";
import type { HudFrame } from "../core/native-hud.js";

interface SceneData { fps: number; assets: string[]; frames: string }

function bitmap(file: string) {
  const image = nativeImage.createFromPath(file);
  const { width, height } = image.getSize();
  return { width, height, data: new Uint8Array(image.toBitmap()) };
}

export async function* compositeNativeScene(
  scene: string,
  background: { clear: string; soft: string },
  kind: "intro" | "outro",
  frames: number,
  fps: number,
  width: number,
  height: number,
  signal: AbortSignal,
) {
  const data = JSON.parse(await readFile(scene, "utf8")) as SceneData;
  const clear = bitmap(background.clear);
  const soft = bitmap(background.soft);
  if (clear.width !== width || clear.height !== height)
    throw new Error("Scene background size does not match the output.");
  const assets = data.assets.map(file => file ? bitmap(file) : undefined);
  const dest = new Uint8Array(width * height * 4);
  const mixed = new Uint8Array(width * height * 4);
  let mixedStrength = Number.NaN;
  const scaleX = width / 1920, scaleY = height / 1080;
  const stream = createReadStream(data.frames);
  const zip = createGunzip();
  const lines = readline.createInterface({ input: stream.pipe(zip), crlfDelay: Infinity });
  let index = 0;
  try {
    for await (const line of lines) {
      signal.throwIfAborted();
      if (index >= frames) break;
      const frame = JSON.parse(line) as HudFrame;
      const time = index / fps;
      const strength = sceneBlur(kind, time);
      if (strength !== mixedStrength) {
        mixBuffers(mixed, clear.data, soft.data, strength);
        mixedStrength = strength;
      }
      dest.set(mixed);
      for (const sprite of frame.sprites) {
        const asset = assets[sprite.asset];
        if (!asset) continue;
        blitSprite(
          dest, width, height, asset.data, asset.width, asset.height,
          sprite.x * scaleX, sprite.y * scaleY, sprite.w * scaleX, sprite.h * scaleY,
          sprite.color,
          sprite.clip ? [sprite.clip[0] * scaleX, sprite.clip[1] * scaleY, sprite.clip[2] * scaleX, sprite.clip[3] * scaleY] : undefined,
        );
      }
      fadeToBlack(dest, sceneFade(kind, time));
      yield Buffer.from(dest);
      index++;
    }
  } finally {
    lines.close();
    zip.close();
    stream.destroy();
  }
  if (index !== frames) throw new Error("Native scene frame count does not match the presentation clock.");
}
