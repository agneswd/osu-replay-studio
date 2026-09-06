import { build } from "electron-builder";
import { readFile } from "node:fs/promises";
const repository = process.env.GITHUB_REPOSITORY;
if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid GITHUB_REPOSITORY.");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${version}`)
  throw new Error("The release tag must match the package.json version.");
const [owner, repo] = repository?.split("/") ?? [];
await build({ publish: "never", config: { extends: "./electron-builder.yml",
  ...(repository ? { publish: [{ provider: "github", owner, repo }],
    extraMetadata: { repository: { type: "git", url: `https://github.com/${repository}.git` } } } : {}) } });
