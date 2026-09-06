import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runtimeRoot } from "../core/runtime.js";
import {
  danserCandidates,
  outputStem,
  sanitizeFileName,
  songsCandidates,
  uniqueOutputPath,
} from "../core/paths.js";

test("songs candidates cover wine installs on Linux and AppData on Windows", () => {
  const linux = songsCandidates("/home/player", "linux", { USER: "player" });
  assert.ok(linux.includes(path.normalize("/home/player/.local/share/osu-wine/osu!/Songs")));
  assert.ok(linux.includes(path.normalize("/home/player/.local/share/osu-winello/osu!/Songs")));
  assert.ok(
    linux.includes(
      path.normalize("/home/player/.wine/drive_c/users/player/AppData/Local/osu!/Songs"),
    ),
  );
  const win = songsCandidates("C:\\Users\\player", "win32", {
    LOCALAPPDATA: "C:\\Users\\player\\AppData\\Local",
  });
  assert.ok(win.some((item) => item.endsWith(path.join("osu!", "Songs"))));
});

test("danser candidates prefer the bundled binary", () => {
  const linux = danserCandidates("/app", "linux");
  assert.equal(linux[0], path.join(runtimeRoot(), "danser", "danser-cli"));
  const win = danserCandidates("C:\\app", "win32");
  assert.equal(
    win[0],
    path.join(runtimeRoot(), "danser", "danser-cli.exe"),
  );
});

test("output names strip unsafe characters and add a number when the file exists", async () => {
  assert.equal(sanitizeFileName('a<>:"/\\|?*b'), "a b");
  assert.equal(outputStem("player", "map / title"), "player - map title");
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-out-"));
  try {
    const first = await uniqueOutputPath(dir, "player - song");
    assert.equal(first, path.join(dir, "player - song.mp4"));
    await writeFile(first, "");
    const second = await uniqueOutputPath(dir, "player - song");
    assert.equal(second, path.join(dir, "player - song 1.mp4"));
    await writeFile(second, "");
    const third = await uniqueOutputPath(dir, "player - song");
    assert.equal(third, path.join(dir, "player - song 2.mp4"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
