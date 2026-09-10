import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CompositeNativeScene } from "../core/native-hud.js";
import type { Capture } from "../core/types.js";

export type WorkerRequest =
  | { kind: "browser"; options: Parameters<Capture>[0]; timeline: Parameters<Capture>[1]; frames: number; range?: Parameters<Capture>[4] }
  | { kind: "native"; scene: string; background: { clear: string; soft: string; motion?: { directory: string; start: number } }; sceneKind: "intro" | "outro"; frames: number; fps: number; width: number; height: number };

type Reply = { ready: true } | { frame: Uint8Array } | { done: true } | { error: string };

// Keep screenshot conversion, PNG compression, and native pixel composition out of the app process.
// One request produces one frame. The next request follows downstream consumption.
export function captureWithWorker(root: string): Capture {
  return (options, timeline, frames, signal, range) =>
    workerFrames(root, { kind: "browser", options, timeline, frames, range }, signal);
}

export function nativeSceneWithWorker(root: string): CompositeNativeScene {
  return (scene, background, sceneKind, frames, fps, width, height, signal) =>
    workerFrames(root, { kind: "native", scene, background, sceneKind, frames, fps, width, height }, signal);
}

async function* workerFrames(root: string, job: WorkerRequest, signal: AbortSignal) {
  signal.throwIfAborted();
  const profile = await mkdtemp(path.join(os.tmpdir(), "studio-capture-"));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, [
    ...(process.defaultApp ? [root] : []), "--capture-worker", profile,
    ...(process.argv.includes("--disable-gpu") ? ["--disable-gpu"] : []),
  ], { env, stdio: ["ignore", "ignore", "pipe", "ipc"], serialization: "advanced" });
  let stderr = "";
  child.stderr!.on("data", chunk => { stderr = (stderr + chunk).slice(-8000); });
  const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
  // Keep startup errors handled even between frame requests.
  let failure: Error | undefined;
  child.on("error", error => { failure = error; });
  const abort = () => child.kill();
  signal.addEventListener("abort", abort, { once: true });
  const receive = (request?: object) => new Promise<Reply>((resolve, reject) => {
    const cleanup = () => {
      child.off("message", message); child.off("exit", exit); child.off("error", error);
    };
    const error = (reason: Error) => { cleanup(); reject(reason); };
    const exit = () => error(new Error(stderr || "Scene capture stopped before completion."));
    const message = (reply: Reply) => { cleanup(); resolve(reply); };
    child.once("message", message); child.once("exit", exit); child.once("error", error);
    if (signal.aborted) error(signal.reason);
    else if (failure) error(failure);
    else if (child.exitCode !== null || child.signalCode !== null) exit();
    else if (request !== undefined) child.send(request, error => { if (error) { cleanup(); reject(error); } });
  });
  try {
    if (!("ready" in await receive())) throw new Error("Invalid capture worker response.");
    let reply = await receive(job);
    while ("frame" in reply) {
      signal.throwIfAborted();
      yield reply.frame;
      reply = await receive({ next: true });
    }
    if ("error" in reply) throw new Error(reply.error);
    if (!("done" in reply)) throw new Error("Invalid capture worker response.");
  } finally {
    signal.removeEventListener("abort", abort);
    child.kill();
    await closed;
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
