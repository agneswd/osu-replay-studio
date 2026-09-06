# Command-line rendering

Run `bun run setup` and `bun run build` first.
Create a JSON job with absolute paths:

```json
{
  "replay": "/path/replay.osr",
  "songs": "/path/osu!/Songs",
  "danser": "/path/runtime/danser/danser-cli",
  "output": "/path/video.mp4",
  "width": 1920,
  "height": 1080,
  "fps": 60,
  "thumbnail": true,
  "backgroundDim": 0.72,
  "cursorSize": 1,
  "introOutro": true,
  "overlayAccent": "#d4d7de",
  "leaderboardSize": 50,
  "leaderboardSort": "pp",
  "overlays": ["player-info", "pp-counter", "accuracy-counter", "combo-counter", "health-bar", "hit-counts", "hit-error-bar", "leaderboard", "progress-graph"]
}
```

On Windows, use `danser-cli.exe` and escape backslashes in JSON paths.
Add `beatmap` to select a matching `.osu` file directly.
Add `skinPath` for a skin folder. Add `duration` to limit gameplay seconds.
The intro and outro each run for 5.4 seconds. The first note follows the intro by one second.
An empty `overlays` array hides the gameplay HUD.

```sh
bun run render -- /path/job.json
```

Set `OSU_CLIENT_ID` and `OSU_CLIENT_SECRET` in the environment for online data.
For Linux without a desktop display, run the command through `xvfb-run -a`.
Software rendering can be slow.
