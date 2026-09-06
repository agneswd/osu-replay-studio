# Third-party software

Replay Studio is licensed under GPL-3.0-only. Separate components retain their own licenses.

| Component | License | Source |
| --- | --- | --- |
| Country flags | CC-BY-4.0 | [Twemoji 16.0.1](https://github.com/discord/twemoji), as used by [osu-web](https://github.com/ppy/osu-web/blob/61b0a41431395f86ff68fa12744f3266448ec885/webpack.config.js#L111) |
| osu! calculator | MIT | [ppy/osu](https://github.com/ppy/osu) |
| Danser 0.11.0 | GPL-3.0 | [Source and build instructions](https://github.com/Wieku/danser-go/tree/0.11.0) |
| FFmpeg | GPL builds | [FFmpeg source](https://ffmpeg.org/download.html#get-sources) |
| ffmpeg-static | GPL-3.0-or-later | [Binary sources and build providers](https://github.com/eugeneware/ffmpeg-static#sources-of-the-binaries) |
| replayviewer-js | MIT | [daladal/replayviewer-js](https://github.com/daladal/replayviewer-js) |
| electron-updater | MIT | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) |
| fflate | MIT | [101arrowz/fflate](https://github.com/101arrowz/fflate) |
| Plus Jakarta Sans | OFL-1.1 | [Tokotype](https://github.com/tokotype/PlusJakartaSans) |
| Teko | OFL-1.1 | [Google Fonts](https://github.com/googlefonts/teko) |
| Baloo 2 | OFL-1.1 | [Ek Type](https://github.com/EkType/Baloo2) |
| Electron | MIT | [electron/electron](https://github.com/electron/electron) |
| React | MIT | [facebook/react](https://github.com/facebook/react) |
| HeroUI | MIT | [heroui-inc/heroui](https://github.com/heroui-inc/heroui) |

The Linux Danser build includes `tools/danser-pipe.patch`. `tools/build-danser.mjs` downloads its exact source and applies the patch.

License texts are in `licenses/` and beside bundled fonts.
Danser includes BASS and other assets with separate terms. See `licenses/danser-credits.md`.
Electron packages include Chromium notices.

The calculator uses the unmodified official NuGet packages listed in `calculator/packages.lock.json`.
Its AutoMapper dependency has advisory GHSA-rvv3-g6hj-g44x. The calculator does not accept mapped object graphs.
It runs in a separate process with a timeout. Keep the official packages under review for an upstream fix.

The preview uses the default skin assets from the bundled Danser archive.
Custom game artwork, music, skins, and player data are not supplied with the app.
The README screenshot shows a user-loaded replay. Outro sounds are original synthesized audio.

`tools/patch-replayviewer.mjs` applies the local black-background, cursor-scale, and judgement lookup corrections to the pinned preview library.

Country flag SVGs are unmodified Twemoji graphics by Twitter, Inc. and other contributors.
The filenames use country codes. The graphics license is in `licenses/twemoji-graphics.txt`.
