// Fixed export target. Preview volume does not enter the render pipeline.

export const exportLoudness = "loudnorm=I=-14:TP=-1.5:LRA=50";

export function measuredAudioFilter(log: string): string {
  const block = log.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  if (!block) throw new Error("Could not measure export audio.");
  const data = JSON.parse(block) as Record<string, string>;
  // Silence has no integrated loudness. Keep it silent.
  if (data.input_i === "-inf") return "anull";
  const fields = { measured_I: "input_i", measured_TP: "input_tp", measured_LRA: "input_lra", measured_thresh: "input_thresh", offset: "target_offset" };
  const values = Object.entries(fields).map(([name, key]) => {
    const value = Number(data[key]);
    if (!Number.isFinite(value)) throw new Error("Invalid export audio measurement.");
    return `${name}=${value}`;
  });
  return `${exportLoudness}:${values.join(":")}:linear=true`;
}

// Keep Danser's hit sounds, then join the original song before Danser fades its music.
export function outroMusicArgs(gameplay: string, song: string, output: string,
  start: number, leadIn: number, fadeStart: number, duration: number, speed: number, preservesPitch = true) {
  const join = Math.max(0, fadeStart - start);
  const crossfade = .4;
  const tempo = preservesPitch ? `atempo=${speed}` : `asetrate=${48000 * speed},aresample=48000`;
  const tailStart = Math.max(0, start + join);
  const padding = Math.max(0, -leadIn - start);
  return ["-y", "-ss", String(Math.max(0, leadIn + start)), "-i", gameplay, "-i", song,
    "-filter_complex",
    `[0:a]aresample=48000,${padding ? `adelay=${Math.round(padding * 48000)}S:all=1,` : ""}atrim=end=${join + crossfade},asetpts=PTS-STARTPTS[game];` +
    `[1:a]aresample=48000,${tempo},volume=0.25,apad=whole_dur=${tailStart + duration},atrim=start=${tailStart}:end=${tailStart + duration},asetpts=PTS-STARTPTS[song];` +
    `[game][song]acrossfade=d=${crossfade}:c1=tri:c2=tri,apad=whole_dur=${duration},atrim=end=${duration}[audio]`,
    "-map", "[audio]", "-c:a", "pcm_s16le", "-ar", "48000", output];
}

// Fade and resample the entrance. Position is quadratic because speed rises linearly from 0 to 1.
export function entranceSamples(input: Float32Array, sampleRate: number, channels: number, seconds: number) {
  const output = new Float32Array(Math.round(seconds * sampleRate) * channels);
  for (let frame = 0; frame < output.length / channels; frame++) {
    const source = frame * frame / (2 * seconds * sampleRate);
    const index = Math.floor(source), fraction = source - index;
    for (let channel = 0; channel < channels; channel++) {
      const a = input[index * channels + channel] ?? 0;
      const b = input[(index + 1) * channels + channel] ?? a;
      output[frame * channels + channel] = (a + (b - a) * fraction) * (0.5 * frame / (seconds * sampleRate));
    }
  }
  return output;
}

export function entranceAudioArgs(input: string, ramp: string, output: string, ease: number) {
  return ["-y", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", ramp, "-i", input,
    "-filter_complex", `[1:a]aresample=48000,atrim=start=${ease / 2},asetpts=PTS-STARTPTS,aeval=val(ch)*(0.5+0.5*min(1\\,t/0.25)):c=same[tail];[0:a][tail]concat=n=2:v=0:a=1[audio]`,
    "-map", "[audio]", "-c:a", "pcm_f32le", output];
}
