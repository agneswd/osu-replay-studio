# Performance checks

Build the app and runtime first. Run these checks on the same machine and replay:

```sh
bun run benchmark
bunx tsx benchmarks/import.ts /path/to/job.json
bunx electron benchmarks/workspace.cjs /path/to/job.json
bunx tsx benchmarks/composite.ts
node benchmarks/capture.mjs
```

Use a local [render job](cli.md) with an explicit beatmap path for import and workspace checks.
The workspace check uses temporary settings. It measures playback and 100 random seeks, then repeats the seeks with cached graphics.
On Linux without a display, prefix Electron commands with `xvfb-run -a`.

Local Linux x64 results with Node.js 26.4 and Electron 44:

| Check | Before | After |
| --- | ---: | ---: |
| Repeat map lookup | 1,863 ms | 0.1-0.5 ms |
| Repeat replay analysis | 588 ms | 51-58 ms |
| Repeat preview asset loading | 81 ms | 13-19 ms |
| JavaScript time during five seconds of playback | 1.09 s | 0.25 s |
| App process memory | 1,429 MiB | 1,035 MiB |
| Software overlay capture at 720p | 45 frames/s | 54 frames/s |
| Linux AppImage | 367 MiB | 218 MiB |
| Unpacked Linux app | 779 MiB | 521 MiB |
| Windows installer | 372 MiB | 218 MiB |

The sampled replay has 574 score snapshots. These results are not hardware guarantees.
App memory sums process working sets and can count shared pages more than once.
Random seek drawing took 6.7 ms at the 95th percentile on the first pass and 0.2 ms on the second pass.
These drawing times exclude GPU completion and display latency.
The synthetic ten-minute overlay benchmark took 0.038 ms per frame, including JSON encoding.

Map matches are hash-checked before reuse. The PP cache holds up to eight results with at most 20,000 snapshots each.
The preview loads gameplay skin assets only. Unchanged video controls do not render on each playback frame.
Capture uses fast lossless PNG compression. Alpha tests check all 256 opacity values and cleared frames.
A shorter capture wait changed frame hashes, so the app retains the full paint wait.

Raw frame transfer took 2.18 s versus 2.78 s for PNG in a 120-frame test.
It changed decoded frame hashes and increased capture-process memory, so it was not retained.
Alternative RLE and Huffman compression also increased gameplay capture time.
Encoder cancellation now closes capture resources even when the input pipe is full.
The headless calculator excludes unused game resources and native graphics, audio, and video libraries.
Its published Linux runtime is 128 MiB. Calculator tests run against that reduced runtime.
