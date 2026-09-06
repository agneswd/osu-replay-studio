import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const rid = process.argv[2] || `${process.platform === "win32" ? "win" : "linux"}-${process.arch}`;
rmSync("runtime/calculator", { recursive: true, force: true });
const result = spawnSync("dotnet", ["publish", "calculator", "-c", "Release", "-r", rid,
  "--self-contained", "true", "-o", "runtime/calculator", "--nologo", "-p:SatelliteResourceLanguages=en"], { stdio: "inherit" });
if (result.status === 0) {
  const project = readFileSync("calculator/ReplayStudio.Calculator.csproj", "utf8");
  const version = project.match(/Include="ppy.osu.Game.Rulesets.Osu" Version="([^"]+)"/)?.[1];
  if (!version) throw Error("Calculator package version is missing.");
  writeFileSync("runtime/calculator/version.json", JSON.stringify({ version }));
}
process.exit(result.status ?? 1);
