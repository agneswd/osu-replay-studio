# Render pipeline

1. Validate paths, output settings and required tools.
2. Parse `.osr` input and resolve the exact local `.osu` by MD5.
3. Re-simulate the replay, build sparse snapshots, and fetch optional online data.
4. Create an isolated Danser runtime with only the selected map folder linked into Songs.
5. Render gameplay with Danser 0.11.0. Disable its HUD, results screen and motion blur.
6. Trim Danser startup. Start one second before the first note when the intro is enabled.
7. Sample one complete overlay snapshot per output frame.
8. Capture transparent PNG frames through an offscreen Electron window.
9. Stream frames to FFmpeg with backpressure and composite them over gameplay.
10. Finish the MP4 at the selected size and frame rate, without overwriting an existing file.

## Clock

The core uses `beatmapMs = videoSeconds * 1000 * modSpeed`.
Danser 0.11.0 has a mandatory 1000 ms lead-in even when LeadInTime is zero.
Its preempt period then runs at mod speed. The base trim is `1 + preemptMs / 1000 / modSpeed` seconds. With an intro, add the first note time at mod speed, then subtract one second.
LeadInHold, seizure warning, local offsets, online offsets and results screens are disabled.
This mapping depends on Danser 0.11.0. Recheck it before upgrading Danser.

The overlay has no wall-clock timers or network clients. Every frame replaces its
visible state, so seeking backward uses the same values as forward playback.
Optional intro and outro animations each run for 5.4 seconds. The first note arrives one second after the intro ends.
Gameplay holds its first frame during the intro and its last frame during the outro.
Original outro sounds use the same sample generator in preview and export.
The audio mix ends at the video duration. Music follows the gameplay clock. Preview uses the same presentation clock.

Export audio uses two-pass loudness normalization with a -14 LUFS target and a -1.5 dB true-peak limit.
Preview volume does not affect export audio.

## Core boundary

`render(options, capture, signal, progress, onlineClient?, thumbnail?)` lives in `core/render.ts`.
The capture function returns an async stream of PNG frames. The core knows nothing
about Electron or React. The CLI calls this function through Electron.

Tool arguments use `spawn` without a shell. Cancellation terminates tool process groups.
The UI renderer has no Node integration. Its preload exposes only specific operations.
Remote requests and permission requests are blocked. Development mode permits only its local Vite server. Overlay text uses `textContent`.

Job directories are removed when the job finishes or fails. Source replays,
maps, and the installed Danser configuration remain unchanged.

The Linux Danser build keeps the current pipe size when the kernel denies resizing.
The patch is `tools/danser-pipe.patch`. It does not change system limits.
