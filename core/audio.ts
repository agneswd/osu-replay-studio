// Fixed export target. Preview volume does not enter the render pipeline.
import { outroSampleRate, outroSamples } from "../shared/outro-audio.js";

export const exportLoudness = "loudnorm=I=-14:TP=-1.5:LRA=50";

export function outroWave() {
  const samples = outroSamples();
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(outroSampleRate, 24); wav.writeUInt32LE(outroSampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, index) => wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2));
  return wav;
}

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
