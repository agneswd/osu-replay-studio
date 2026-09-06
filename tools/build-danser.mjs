import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const commit = "8331b0ffb841cc9e0f5e6b756bcf2bba2a9465c0";
const scratch = await mkdtemp(path.join(os.tmpdir(), "studio-danser-"));
const output = path.resolve("runtime/danser/libdanser-core.so");
const patch = path.resolve("tools/danser-pipe.patch");
function run(command, args, cwd = scratch) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, CGO_ENABLED: "1" } });
  if (result.status !== 0) throw Error(`${command} failed.`);
}
try {
  const response = await fetch(`https://codeload.github.com/Wieku/danser-go/tar.gz/${commit}`);
  if (!response.ok) throw Error("Could not download Danser source.");
  const archive = path.join(scratch, "source.tar.gz");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  run("tar", ["-xzf", archive]);
  const source = path.join(scratch, `danser-go-${commit}`);
  run("git", ["apply", patch], source);
  run("go", ["build", "-trimpath", "-ldflags", "-s -w -X github.com/wieku/danser-go/build.VERSION=0.11.0 -X github.com/wieku/danser-go/build.Stream=Release",
    "-buildmode=c-shared", "-o", output, "-tags", "exclude_cimgui_glfw exclude_cimgui_sdli"], source);
  await rm(output.replace(/\.so$/, ".h"), { force: true });
} finally { await rm(scratch, { recursive: true, force: true }); }
