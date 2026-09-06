import { crc32, deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer) {
  const bytes = Buffer.allocUnsafe(data.length + 12);
  bytes.writeUInt32BE(data.length, 0);
  bytes.write(type, 4, 4, "ascii");
  data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

// Chromium supplies premultiplied BGRA on the supported x64 platforms.
// Reuse scanline storage and use fast, lossless compression for the local video pipe.
export function pngEncoder(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const prefix = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header)]);
  const end = chunk("IEND", Buffer.alloc(0));
  const stride = width * 4 + 1;
  const rows = Buffer.alloc(stride * height);
  return (bgra: Buffer) => {
    if (bgra.length !== width * height * 4) throw new Error("Unexpected capture bitmap size.");
    let source = 0;
    for (let y = 0; y < height; y++) {
      let target = y * stride + 1;
      for (let x = 0; x < width; x++, source += 4, target += 4) {
        const alpha = bgra[source + 3];
        if (alpha === 0) { rows.writeUInt32LE(0, target); continue; }
        const scale = alpha < 255 ? 255 / alpha : 1;
        rows[target] = Math.round(bgra[source + 2] * scale);
        rows[target + 1] = Math.round(bgra[source + 1] * scale);
        rows[target + 2] = Math.round(bgra[source] * scale);
        rows[target + 3] = alpha;
      }
    }
    return Buffer.concat([prefix, chunk("IDAT", deflateSync(rows, { level: 1 })), end]);
  };
}
