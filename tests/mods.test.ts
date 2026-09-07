import assert from "node:assert/strict";
import test from "node:test";
import { displayMods } from "../core/mods.js";

test("mod display order is independent of API and replay order", () => {
  for (const input of ["DTHRHD", "HDHRDT", "HRDTHD"])
    assert.deepEqual(displayMods(input), ["HD", "HR", "DT"]);
  assert.deepEqual(displayMods("NCHDHR"), ["HD", "HR", "NC"]);
});

test("mod display removes redundant flags without hiding unknown mods", () => {
  assert.deepEqual(displayMods("DTHDNCSDPFHD"), ["HD", "PF", "NC"]);
  assert.deepEqual(displayMods("ZZHDAA"), ["HD", "AA", "ZZ"]);
  for (const input of [undefined, "", "NM", "None"]) assert.deepEqual(displayMods(input), []);
  assert.deepEqual(displayMods("dthd"), ["HD", "DT"]);
});
