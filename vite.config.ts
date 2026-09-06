import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

function mime(file: string) {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".woff2")) return "font/woff2";
  if (file.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

function serveStatic(urlPrefix: string, dir: string): Plugin {
  const root = path.resolve(dir);
  return {
    name: `serve-${urlPrefix}`,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith(urlPrefix)) return next();
        // Source modules need Vite's TypeScript transform, including shared audio code.
        if (/\.tsx?$/.test(url)) return next();
        const rel = decodeURIComponent(
          url.slice(urlPrefix.length).replace(/^\/+/, ""),
        );
        const file = path.resolve(root, rel);
        if (!file.startsWith(root)) return next();
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", mime(file));
        res.setHeader("Cache-Control", "no-store");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "./",
  server: { watch: { ignored: ["**/danser/**", "**/runtime/**", "**/release/**", "**/renders/**", "**/calculator/**", "**/dist/**", "**/.runtime/**"] } },
  build: { outDir: "dist/ui" },
  plugins: [
    react(),
    {
      name: "desktop-live-preview",
      apply: "serve",
      transformIndexHtml: html => html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
      configureServer(server) {
        let timer: ReturnType<typeof setTimeout>;
        const folders = ["overlays", "shared"].map(folder => path.resolve(folder) + path.sep);
        server.watcher.add(folders);
        server.watcher.on("change", file => {
          if (!folders.some(folder => file.startsWith(folder))) return;
          clearTimeout(timer);
          timer = setTimeout(() => server.ws.send({ type: "custom", event: "studio:overlay" }), 100);
        });
        server.httpServer?.on("close", () => clearTimeout(timer));
      },
    },
    tailwindcss(),
    serveStatic("/overlays", "overlays"),
    serveStatic("/shared", "shared"),
  ],
});
