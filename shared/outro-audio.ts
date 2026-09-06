// Original, deterministic entrance sounds shared by preview and export.
export const outroSampleRate = 24000;
export function outroSamples() {
  const samples = new Float32Array(outroSampleRate * 2);
  let seed = 47;
  for (const [start, duration, pitch, gain] of [
    [0, .22, 900, .035], [.15, .48, 240, .065], [.75, .3, 130, .09],
    [1.1, .27, 600, .045], [1.29, .18, 760, .04], [1.43, .18, 1050, .035],
  ]) {
    let smooth = 0;
    for (let i = 0; i < duration * outroSampleRate; i++) {
      const t = i / outroSampleRate;
      const progress = t / duration;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      smooth += ((seed / 2147483648 - 1) - smooth) * .18;
      const envelope = Math.sin(Math.PI * progress) ** 2;
      const tone = Math.sin(2 * Math.PI * pitch * (t - .28 * t * progress));
      samples[Math.round(start * outroSampleRate) + i] += gain * envelope * (.6 * smooth + .4 * tone);
    }
  }
  return samples;
}
