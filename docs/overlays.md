# Overlay options

The preview and exported video use the same overlay layout, scaled from 1920 × 1080.
All ten components are enabled by default. Disable individual components beside the preview.

| Component | Data |
| --- | --- |
| Player info | Name, profile, score, stars, and BPM |
| Performance points | Current PP and map SS estimate |
| Accuracy | Judgements and grade |
| Combo | Current combo and peak combo |
| Health | Recorded life graph |
| Hit counts | Slider breaks, misses, 100s, and 50s |
| Hit error | Circle timing errors and unstable rate, or UR |
| Map leaderboard | Nearby entries from the top 50 or 100 online scores |
| Map progress | Object density and elapsed map time |
| Key presses | Two input lanes, press counts, and tapping speed |

The health bar depletes from both outer ends toward the middle.
SS and S grades use silver for Hidden or Flashlight, and gold otherwise.
Number columns have fixed widths. Counters roll when values change.
Timing markers grow over 140 ms, then fade over five seconds. The pointer follows average hit timing.

The leaderboard defaults to PP order. Score order uses stable totals for stable replays and standardized totals for lazer.
Positions refer to the fetched map-score pool. They are not global PP ranks.
The replay stays at the bottom while the list scrolls, then moves into position among the top eight entries.
Rows enter from the edge that matches their rank. All motion follows replay time, including backward seeks.
Without online data, the replay has no displayed rank.

The accent color applies to overlays, score animations, the transition swipe, and the exported thumbnail.
Hit judgement colors retain their meaning.

The intro shows monthly player playcounts and a peak marker. The map graph shows failures and exits by map progress.
The outro shows the player's six best plays. These sections use the configured osu! API connection.
Missing data stays hidden. No sample playcounts or invented ranks are shown.

Gameplay and the HUD stay frozen, blurred, and dim during the intro.
After the intro overlay ends, gameplay holds for one second, then eases from a stop to 1x.
A dim beatmap image stays visible even with 100% gameplay dim.
The outro starts when replay data ends. Map music ducks to half volume and keeps playing until the fade to black.
The HUD hides when the outro starts. The outro ends with a fade to black.

The line below the map graph marks 100s, 50s, and misses at their map positions.
It appears after the first such judgement. It does not show elapsed progress.
