const { app, BrowserWindow, clipboard, ipcMain, session } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = process.env.STUDIO_TEST_ROOT || path.resolve(__dirname, "..");
const evidence = process.env.STUDIO_TEST_EVIDENCE;
const before = process.env.STUDIO_TEST_BEFORE === "1";
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.on("window-all-closed", () => {});

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "studio-youtube-"));
  app.setPath("userData", profile);
  await app.whenReady();
  let win;
  const originalClipboard = await clipboard.readText();
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => callback({ cancel: true }));
    const { analyze } = await import(pathToFileURL(path.join(root, "dist/core/analyze.js")));
    const { previewData, previewSkin } = await import(pathToFileURL(path.join(root, "dist/core/preview.js")));
    const replay = path.join(root, "tests/fixtures/replay.osr");
    const beatmap = path.join(profile, "map.osu");
    await fs.copyFile(path.join(root, "tests/fixtures/map.osu"), beatmap);
    await fs.writeFile(path.join(profile, "audio.wav"), Buffer.alloc(44));
    const timeline = await analyze({ replay, beatmap, songs: path.dirname(beatmap) });
    timeline.playerAvatar = undefined;
    timeline.player = "Replay player";
    // Exercise missing fields with a valid replay, without requesting online data.
    timeline.ppInfo = undefined;
    timeline.sceneInfo.playStatus.verified = false;
    let saved = {}, replayNumber = 0, copyFails = false, saveFails = false;
    const handlers = {
      defaults: () => ({ replay: "", beatmap: "", songs: path.dirname(beatmap), songsFound: true, danser: "", danserFound: false,
        outputDir: profile, width: 1920, height: 1080, fps: 60, overlays: [], overlayAccent: "#d4d7de", backgroundDim: .95,
        cursorSize: 1, skinPath: "", introOutro: false, leaderboardSize: 50, leaderboardSort: "pp", ...saved }),
      osuStatus: () => ({ configured: true, clientId: "" }), updateStatus: () => ({ state: "disabled", version: "test" }),
      ppEngineStatus: () => ({ version: "test" }), skins: () => [],
      choose: () => `${replay}-${++replayNumber}`, analyze: () => ({ ...timeline, player: `Replay player ${replayNumber}`, replay: `${replay}-${replayNumber}` }),
      previewData: () => previewData(beatmap, replay), previewSkin: () => previewSkin(""),
      saveSettings: patch => { if (saveFails) throw Error("Disk unavailable"); return saved = { ...saved, ...patch }; },
      copyText: text => { if (copyFails) throw Error("Clipboard unavailable"); return clipboard.writeText(text); },
    };
    for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(name, (_event, arg) => handler(arg));
    win = new BrowserWindow({ show: false, width: 1600, height: 1000, useContentSize: true,
      webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false,
        preload: path.join(root, "dist/electron/preload.cjs"), backgroundThrottling: false } });
    const js = code => win.webContents.executeJavaScript(code);
    const wait = async code => {
      for (let i = 0; i < 100; i++) {
        if (await js(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw Error(`Timed out: ${code}\n${await js("document.body.innerText")}`);
    };
    const click = async label => {
      await js(`(() => { const button = [...document.querySelectorAll('button')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)} || e.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw Error('Missing button'); button.click(); })()`);
    };
    const openReplay = async () => {
      const next = replayNumber + 1;
      await click("Open replay");
      await wait(`document.body.textContent.includes('Replay player ${next}') && !document.body.textContent.includes('Importing...')`);
    };
    const fill = async (id, value) => {
      await js(`(() => { const input = document.getElementById(${JSON.stringify(id)}); const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await wait(`document.getElementById(${JSON.stringify(id)}).value === ${JSON.stringify(value)}`);
    };
    const value = id => js(`document.getElementById(${JSON.stringify(id)}).value`);
    const capture = async name => {
      if (!evidence) return;
      await fs.mkdir(evidence, { recursive: true });
      await js("document.fonts.ready");
      await new Promise(resolve => setTimeout(resolve, 400));
      const rect = name === "before" || name === "after-workspace" ? { x: 1040, y: 750, width: 560, height: 250 }
        : name === "after-dialog" ? { x: 420, y: 50, width: 760, height: 900 } : undefined;
      await fs.writeFile(path.join(evidence, `${name}.png`), (await win.webContents.capturePage(rect)).toPNG());
    };
    await win.loadFile(path.join(root, "dist/ui/index.html"));
    win.setContentSize(1600, 1000);
    await wait(`!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Open replay')`);
    if (!before) assert.equal(await js(`document.querySelector('button').ownerDocument.body.textContent.includes('YouTube details')`), true);
    await openReplay();
    await wait(`!document.body.textContent.includes('Loading preview')`);
    await capture(before ? "before" : "after-workspace");
    if (!before) {
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-title')`);
      assert.equal((await value("youtube-description")).includes("Player:"), false);
      await fill("youtube-playerUrl", "https://osu.ppy.sh/users/42");
      await fill("youtube-pp", "412");
      await fill("youtube-status", "FC");
      await wait(`document.getElementById('youtube-title').value.includes('FC 412pp')`);
      await fill("youtube-additional", "Thanks for watching.");
      await wait(`document.getElementById('youtube-description').value.endsWith('Thanks for watching.')`);
      await capture("after-dialog");
      await click("Copy description");
      await wait(`document.body.textContent.includes('Description copied.')`);
      assert.equal(await clipboard.readText(), await value("youtube-description"));
      await fill("youtube-title", "My edited title");
      await fill("youtube-description", "My edited description");
      await fill("youtube-pp", "500");
      await fill("youtube-additional", "Saved credits.");
      assert.equal(await value("youtube-title"), "My edited title");
      assert.equal(await value("youtube-description"), "My edited description");
      await click("Done");
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-title')`);
      assert.equal(await value("youtube-title"), "My edited title");
      await click("Regenerate");
      await wait(`document.body.textContent.includes('Replace your title')`);
      await click("Keep edits");
      assert.equal(await value("youtube-description"), "My edited description");
      await click("Regenerate");
      await click("Replace edits");
      await wait(`document.getElementById('youtube-title').value.includes('500pp')`);
      assert.ok((await value("youtube-description")).endsWith("Saved credits."));
      await fill("youtube-title", "🎵".repeat(101));
      await wait(`document.querySelector('[aria-label="Copy title"]').disabled`);
      await fill("youtube-title", "Corrected title");
      copyFails = true;
      await click("Copy title");
      await wait(`document.body.textContent.includes('Could not copy.')`);
      copyFails = false;
      await click("Copy title");
      await wait(`document.body.textContent.includes('Title copied.')`);
      assert.equal(await clipboard.readText(), "Corrected title");
      saveFails = true;
      await fill("youtube-additional", "Unsaved credits");
      await wait(`document.body.textContent.includes('Could not save additional text.')`);
      saveFails = false;
      await fill("youtube-additional", "Saved credits.");
      await wait(`!document.body.textContent.includes('Could not save additional text.')`);
      await click("Done");
      await openReplay();
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-title')`);
      assert.equal((await value("youtube-title")).includes("Corrected title"), false);
      assert.equal(await value("youtube-playerUrl"), "");
      assert.equal(await value("youtube-additional"), "Saved credits.");
      await win.reload();
      await wait(`!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Open replay')`);
      await openReplay();
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-additional')`);
      assert.equal(await value("youtube-additional"), "Saved credits.");
      win.setContentSize(900, 720);
      await capture("after-small-window");
      console.log("YouTube details: copy, manual edits, regeneration, replay isolation, saved defaults, and errors passed.");
    }
  } finally {
    if (win) win.destroy();
    await clipboard.writeText(originalClipboard);
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(error => {
      // Chromium can retain profile locks until process exit on Windows.
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
    });
  }
  app.exit(0);
})().catch(error => { console.error(error); app.exit(1); });
