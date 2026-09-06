import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const env = { ...process.env };
// Development hosts can set this globally, which turns Electron into plain Node.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  require("electron"),
  [fileURLToPath(new URL("..", import.meta.url)), ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
