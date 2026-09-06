import { mkdir, mkdtemp, cp, rm, chmod, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
if (!["linux", "win32"].includes(process.platform) || process.arch !== "x64") throw Error("Only Linux and Windows x64 are supported.");
const platform = process.platform === "win32" ? "win" : "linux";
const archive = `danser-0.11.0-${platform}.zip`;
const scratch = await mkdtemp(path.join(os.tmpdir(), "studio-runtime-"));
try {
  const response = await fetch(`https://github.com/Wieku/danser-go/releases/download/0.11.0/${archive}`);
  if (!response.ok) throw Error(`Danser download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hashes = JSON.parse(await (await import("node:fs/promises")).readFile("tools/runtime-checksums.json", "utf8"));
  if (createHash("sha256").update(bytes).digest("hex") !== hashes[archive]) throw Error("Danser checksum does not match.");
  const zip = path.join(scratch, "danser.zip");
  await writeFile(zip, bytes);
  const out = path.join(scratch, "out");
  const extract = process.platform === "win32"
    ? spawnSync("tar", ["-xf", zip, "-C", scratch], { stdio: "inherit" })
    : spawnSync("unzip", ["-q", zip, "-d", out], { stdio: "inherit" });
  if (extract.status !== 0) throw Error("Danser extraction failed.");
  await rm("runtime/danser", { recursive: true, force: true });
  await mkdir("runtime/danser", { recursive: true });
  if (process.platform === "win32") {
    await rm(zip);
    await cp(scratch, "runtime/danser", { recursive: true });
  } else {
    await cp(out, "runtime/danser", { recursive: true });
    await chmod("runtime/danser/danser-cli", 0o755);
    const compile = spawnSync(process.execPath, ["tools/build-danser.mjs"], { stdio: "inherit" });
    if (compile.status !== 0) throw Error("Could not build the Linux renderer.");
  }
  await rm("runtime/ffmpeg", { recursive: true, force: true });
  if (process.platform === "linux") await rm("runtime/danser/ffmpeg", { recursive: true, force: true });
  await mkdir("runtime/ffmpeg", { recursive: true });
  for (const [name, file] of [["ffmpeg", require("ffmpeg-static")]]) {
    const target = `runtime/ffmpeg/${name}${process.platform === "win32" ? ".exe" : ""}`;
    await cp(file, target);
    if (process.platform !== "win32") await chmod(target, 0o755);
  }
} finally { await rm(scratch, { recursive: true, force: true }); }
