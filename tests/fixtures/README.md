# Replay fixture

`map.osu` and `replay.osr` are synthetic test data created for this project.
The map has two circles at 2,000 and 3,000 ms, then a slider from 4,000 to 4,500 ms.
The replay hits all three objects. The test creates a temporary audio file because
analysis checks that the beatmap audio exists. No external player data is included.

`lazer.osr` contains the same input frames with lazer score data and slider-tail statistics.
