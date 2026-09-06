# Build from source

Install Node.js 22.12 or newer, Bun 1.4.2, and the .NET 10 SDK.
Linux builds also need Go 1.24.1 or newer, `unzip`, Git, a C compiler, and OpenGL, X11, and GTK3 development libraries. Use Linux or Windows x64.

```sh
bun install --frozen-lockfile
bun run setup
bun run start
```

`setup` downloads the pinned runtime tools and builds the self-contained osu! calculator.
The installed app does not require Node.js or .NET.

Use `bun run dev` for live desktop updates. UI and overlay changes reload automatically.
Backend changes rebuild without restarting the app. Restart `bun run dev` to apply backend changes.
Use `bun run start` for a normal local build.

```sh
bun run test
bun run package
```

Packages appear in `release/`. Linux produces an AppImage. Windows produces an NSIS installer.
Build each package on its target operating system.

## GitHub builds

Every push and pull request builds both packages and uploads workflow artifacts.
To publish a release, update `package.json`, commit the change, and push a matching `v` version tag.
The release job attaches both packages, update manifests, and blockmaps after all checks pass.
The build reads `GITHUB_REPOSITORY` to set its update source. Local builds have no update source unless you set this variable.
Keep the update manifests and installers together in each public GitHub release. Do not publish prereleases as stable updates.
Windows installers are unsigned unless signing credentials are configured.

Dependabot checks the official osu! calculator packages weekly.
Review calculator updates and publish a new app release after tests pass.
A new osu! development package can differ from the live ranking formula.
Review the upstream AutoMapper advisory listed in `THIRD-PARTY.md` before publication.

## Project layout

- `core/`: replay analysis, timeline, online data, and rendering.
- `calculator/`: official osu! difficulty and PP calculation.
- `electron/`: desktop windows, file access, and frame capture.
- `src/`: workspace and score animations.
- `overlays/` and `shared/`: gameplay HUD.

Build output, runtime downloads, credentials, and local replays are ignored by Git.
Synthetic replay fixtures are included for tests.
