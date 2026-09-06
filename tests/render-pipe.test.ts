import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../core/render.js";

test("cancelled encoders close a capture source blocked on a full pipe", async () => {
  const controller = new AbortController();
  let closed = false;
  async function* frames() {
    try { while (true) yield Buffer.alloc(8 * 1024 * 1024); }
    finally { closed = true; }
  }
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await assert.rejects(run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], controller.signal, () => {}, undefined, frames()), /abort/i);
    assert.ok(closed, "Capture resources must close before cancellation completes.");
  } finally { clearTimeout(timer); }
});

test("encoder failure closes its input source", async () => {
  let closed = false;
  async function* frames() {
    try { while (true) yield Buffer.alloc(8 * 1024 * 1024); }
    finally { closed = true; }
  }
  await assert.rejects(run(process.execPath, ["-e", "process.exit(2)"], new AbortController().signal, () => {}, undefined, frames()), /exited with 2/);
  assert.ok(closed);
});
