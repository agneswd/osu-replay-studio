import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

protocol.registerSchemesAsPrivileged([{ scheme: "studio-media", privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }]);

export function registerMedia() {
  const files = new Map<string, string>();
  protocol.handle("studio-media", async request => {
    const file = files.get(request.url);
    if (!file || !["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 404 });
    const response = await net.fetch(pathToFileURL(file).href, { method: request.method, headers: request.headers });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  });
  return (file: string) => {
    files.clear();
    const url = `studio-media://audio/${randomUUID()}`;
    files.set(url, file);
    return url;
  };
}
