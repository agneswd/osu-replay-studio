import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

test("presentation TypeScript modules pass through Vite in desktop development", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "studio-vite-"));
  const server = await createServer({ cacheDir, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
  try {
    await server.listen();
    const response = await fetch(new URL("core/presentation.ts", server.resolvedUrls!.local[0]));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /javascript/);
  } finally {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});
