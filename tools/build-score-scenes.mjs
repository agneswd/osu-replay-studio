import { build, context } from "esbuild";
const compile = async options => {
  if (process.argv.includes("--watch")) await (await context(options)).watch();
  else await build(options);
};
await compile({
  entryPoints: ["src/score-scenes/player.tsx"], outfile: "overlays/score-scenes/player.js",
  bundle: true, minify: true, jsx: "automatic", format: "iife", target: "chrome120",
  define: { "process.env.NODE_ENV": '\"production\"' },
  loader: { ".woff2": "file" }, assetNames: "fonts/[name]-[hash]",
});
await compile({
  entryPoints: ["src/overlay-runtime.ts"], outfile: "overlays/runtime.js",
  bundle: true, minify: true, format: "iife", target: "chrome120",
});

await compile({
  entryPoints: ["src/thumbnail-render/player.tsx"], outfile: "overlays/thumbnail/player.js",
  bundle: true, minify: true, jsx: "automatic", format: "iife", target: "chrome120",
  define: { "process.env.NODE_ENV": '\"production\"' },
  loader: { ".woff2": "file" }, assetNames: "fonts/[name]-[hash]",
});
