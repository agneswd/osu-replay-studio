import { app, session } from "electron";
import { once } from "node:events";
import { captureOverlay } from "./capture.js";
import { compositeNativeScene } from "./scene-composite.js";
import type { WorkerRequest } from "./capture-process.js";

export async function runCaptureWorker(root: string) {
  if (!process.send) throw new Error("Capture worker requires a parent process.");
  const send = (message: object) => new Promise<void>((resolve, reject) => {
    process.send!(message, error => error ? reject(error) : resolve());
  });
  process.once("disconnect", () => app.exit(0));
  app.on("window-all-closed", () => {});
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (_details, callback) => callback({ cancel: true }),
  );
  try {
    const request = once(process, "message");
    await send({ ready: true });
    const [job] = await request as [WorkerRequest];
    const signal = new AbortController().signal;
    const frames = job.kind === "native"
      ? compositeNativeScene(job.scene, job.background, job.sceneKind, job.frames, job.fps, job.width, job.height, signal)
      : captureOverlay(root)(job.options, job.timeline, job.frames, signal, job.range);
    for await (const frame of frames) {
      const next = once(process, "message");
      await send({ frame });
      await next;
    }
    await send({ done: true });
  } catch (error) {
    await send({ error: error instanceof Error ? error.message : String(error) });
  } finally { app.exit(0); }
}
