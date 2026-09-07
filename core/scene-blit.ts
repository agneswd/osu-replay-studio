// Premultiplied BGRA compositor for native scene sprites.

export function fillBgra(dest: Uint8Array, color: [number, number, number, number]) {
  const a = Math.round(color[3] * 255);
  const b = Math.round(color[2] * color[3] * 255);
  const g = Math.round(color[1] * color[3] * 255);
  const r = Math.round(color[0] * color[3] * 255);
  for (let i = 0; i < dest.length; i += 4) {
    dest[i] = b;
    dest[i + 1] = g;
    dest[i + 2] = r;
    dest[i + 3] = a;
  }
}

export function mixBuffers(dest: Uint8Array, clear: Uint8Array, soft: Uint8Array, strength: number) {
  const t = Math.max(0, Math.min(1, strength));
  const u = 1 - t;
  for (let i = 0; i < dest.length; i++) dest[i] = Math.round(clear[i]! * u + soft[i]! * t);
}

export function fadeToBlack(dest: Uint8Array, amount: number) {
  const keep = 1 - Math.max(0, Math.min(1, amount));
  if (keep >= 1) return;
  for (let i = 0; i < dest.length; i += 4) {
    dest[i] = Math.round(dest[i]! * keep);
    dest[i + 1] = Math.round(dest[i + 1]! * keep);
    dest[i + 2] = Math.round(dest[i + 2]! * keep);
    dest[i + 3] = 255;
  }
}

export function blitSprite(
  dest: Uint8Array,
  dw: number,
  dh: number,
  src: Uint8Array,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number],
  clip?: [number, number, number, number],
) {
  if (w <= 0 || h <= 0 || color[3] <= 0 || sw <= 0 || sh <= 0) return;
  const cr = color[0], cg = color[1], cb = color[2], ca = color[3];
  let x0 = Math.max(0, Math.floor(x));
  let y0 = Math.max(0, Math.floor(y));
  let x1 = Math.min(dw, Math.ceil(x + w));
  let y1 = Math.min(dh, Math.ceil(y + h));
  if (clip) {
    x0 = Math.max(x0, Math.floor(clip[0]));
    y0 = Math.max(y0, Math.floor(clip[1]));
    x1 = Math.min(x1, Math.ceil(clip[0] + clip[2]));
    y1 = Math.min(y1, Math.ceil(clip[1] + clip[3]));
  }
  if (x1 <= x0 || y1 <= y0) return;
  const scaleX = sw / w;
  const scaleY = sh / h;
  const interpolate = scaleX !== 1 || scaleY !== 1 || !Number.isInteger(x) || !Number.isInteger(y);
  // Most settled artwork is already at output resolution. Keep that path cheap.
  if (!interpolate) {
    for (let dy = y0; dy < y1; dy++) {
      const destRow = dy * dw * 4, srcRow = (dy - y) * sw * 4;
      for (let dx = x0; dx < x1; dx++) {
        const si = srcRow + (dx - x) * 4, srcA = src[si + 3]! * ca;
        if (srcA < 1) continue;
        const di = destRow + dx * 4;
        const b = src[si]! * cb * ca, g = src[si + 1]! * cg * ca, r = src[si + 2]! * cr * ca;
        if (srcA >= 254.5) {
          dest[di] = b; dest[di + 1] = g; dest[di + 2] = r; dest[di + 3] = 255;
        } else {
          const keep = 1 - srcA / 255;
          dest[di] = b + dest[di]! * keep;
          dest[di + 1] = g + dest[di + 1]! * keep;
          dest[di + 2] = r + dest[di + 2]! * keep;
          dest[di + 3] = srcA + dest[di + 3]! * keep;
        }
      }
    }
    return;
  }
  for (let dy = y0; dy < y1; dy++) {
    const sourceY = Math.min(sh - 1, Math.max(0, (dy + 0.5 - y) * scaleY - 0.5));
    const sy = Math.floor(sourceY), fy = sourceY - sy;
    const nextRow = Math.min(sh - 1, sy + 1) * sw * 4;
    const destRow = dy * dw * 4;
    const srcRow = sy * sw * 4;
    for (let dx = x0; dx < x1; dx++) {
      const sourceX = Math.min(sw - 1, Math.max(0, (dx + 0.5 - x) * scaleX - 0.5));
      const sx = Math.floor(sourceX);
      const si = srcRow + sx * 4;
      let b = src[si]!, g = src[si + 1]!, r = src[si + 2]!, a = src[si + 3]!;
      {
        // Interpolate premultiplied channels to avoid dark fringes on text and rounded edges.
        const fx = sourceX - sx, right = Math.min(sw - 1, sx + 1) * 4;
        const tr = srcRow + right, bl = nextRow + sx * 4, br = nextRow + right;
        const tlWeight = (1 - fx) * (1 - fy), trWeight = fx * (1 - fy), blWeight = (1 - fx) * fy, brWeight = fx * fy;
        b = b * tlWeight + src[tr]! * trWeight + src[bl]! * blWeight + src[br]! * brWeight;
        g = g * tlWeight + src[tr + 1]! * trWeight + src[bl + 1]! * blWeight + src[br + 1]! * brWeight;
        r = r * tlWeight + src[tr + 2]! * trWeight + src[bl + 2]! * blWeight + src[br + 2]! * brWeight;
        a = a * tlWeight + src[tr + 3]! * trWeight + src[bl + 3]! * blWeight + src[br + 3]! * brWeight;
      }
      const srcA = a * ca;
      if (srcA < 1) continue;
      const srcB = b * cb * ca;
      const srcG = g * cg * ca;
      const srcR = r * cr * ca;
      const di = destRow + dx * 4;
      if (srcA >= 254.5) {
        dest[di] = srcB;
        dest[di + 1] = srcG;
        dest[di + 2] = srcR;
        dest[di + 3] = 255;
        continue;
      }
      const keep = 1 - srcA / 255;
      dest[di] = srcB + dest[di]! * keep;
      dest[di + 1] = srcG + dest[di + 1]! * keep;
      dest[di + 2] = srcR + dest[di + 2]! * keep;
      dest[di + 3] = srcA + dest[di + 3]! * keep;
    }
  }
}
