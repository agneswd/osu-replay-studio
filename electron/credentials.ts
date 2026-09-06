import { app, safeStorage } from "electron";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createOsuClient, type OsuClient, type OsuCredentials } from "../core/online.js";

export class Credentials {
  private current?: OsuCredentials;
  private client?: OsuClient;
  private file = path.join(app.getPath("userData"), "osu-credentials.json");
  async load() {
    if (process.env.OSU_CLIENT_ID && process.env.OSU_CLIENT_SECRET) {
      this.current = { clientId: process.env.OSU_CLIENT_ID, clientSecret: process.env.OSU_CLIENT_SECRET };
    } else {
      try {
        const saved = JSON.parse(await readFile(this.file, "utf8")) as { clientId: string; encryptedSecret: string };
        this.current = { clientId: saved.clientId, clientSecret: safeStorage.decryptString(Buffer.from(saved.encryptedSecret, "base64")) };
      } catch { /* Missing or locked credentials can be replaced in Settings. */ }
    }
    if (this.current) this.client = createOsuClient(this.current);
  }
  status() { return { clientId: this.current?.clientId ?? "", configured: !!this.client }; }
  getClient() { return this.client; }
  async save(value: OsuCredentials) {
    if (!/^\d+$/.test(value?.clientId) || !value.clientSecret?.trim()) throw new Error("Enter the osu! client ID and client secret.");
    const secure = safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
    if (!secure) throw new Error("Secure storage is unavailable. Start or unlock your system keyring, then restart Replay Studio.");
    const next = createOsuClient(value);
    await next.test(AbortSignal.timeout(15000));
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ clientId: value.clientId, encryptedSecret: safeStorage.encryptString(value.clientSecret).toString("base64") }), { mode: 0o600 });
    this.current = value;
    this.client = next;
    return this.status();
  }
  async clear() {
    await rm(this.file, { force: true });
    this.current = undefined; this.client = undefined;
    return this.status();
  }
}
