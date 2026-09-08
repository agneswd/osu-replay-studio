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
    const { captureThumbnail } = await import(pathToFileURL(path.join(root, "dist/electron/thumbnail.js")));
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
    let saved = {}, replayNumber = 0, copyFails = false, saveFails = false, renderFails = false;
    let shownFile = "", studioOpened = false;
    const videoFile = path.join(profile, "replay.mp4"), thumbnailFile = path.join(profile, "replay.png");
    const handlers = {
      defaults: () => ({ replay: "", beatmap: "", songs: path.dirname(beatmap), songsFound: true, danser: "test-renderer", danserFound: true,
        outputDir: profile, width: 1920, height: 1080, fps: 60, overlays: [], overlayAccent: "#d4d7de", backgroundDim: .95,
        cursorSize: 1, skinPath: "", introOutro: false, leaderboardSize: 50, leaderboardSort: "pp", ...saved }),
      osuStatus: () => ({ configured: true, clientId: "" }), updateStatus: () => ({ state: "disabled", version: "test" }),
      ppEngineStatus: () => ({ version: "test" }), skins: () => [],
      choose: () => `${replay}-${++replayNumber}`, analyze: () => ({ ...timeline, player: `Replay player ${replayNumber}`, replay: `${replay}-${replayNumber}` }),
      previewData: () => previewData(beatmap, replay), previewSkin: () => previewSkin(""),
      saveSettings: patch => { if (saveFails) throw Error("Disk unavailable"); return saved = { ...saved, ...patch }; },
      uniqueOutput: () => videoFile,
      render: async () => { if (renderFails) throw Error("Test render failed"); await fs.writeFile(videoFile, "test video"); return videoFile; },
      exportThumbnail: async input => {
        assert.ok(input.document, "Use the editor document for the exported thumbnail.");
        assert.ok(Object.values(input.document.layers).some(layer => layer.text === "Upload thumbnail"), "Export the edited thumbnail text.");
        await captureThumbnail(root, input.timeline, thumbnailFile, input.accent, new AbortController().signal, { document: input.document });
        return thumbnailFile;
      },
      reveal: () => {}, revealExport: file => { assert.ok([videoFile, thumbnailFile].includes(file)); shownFile = file; },
      openYouTubeStudio: () => { studioOpened = true; },
      copyText: text => { if (copyFails) throw Error("Clipboard unavailable"); return clipboard.writeText(text); },
    };
    for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(name, (_event, arg) => handler(arg));
    win = new BrowserWindow({ show: false, width: 1600, height: 1000, useContentSize: true,
      webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false,
        preload: path.join(root, "dist/electron/preload.cjs"), backgroundThrottling: false } });
    const js = code => win.webContents.executeJavaScript(code).catch(error => { throw Error(`${error.message}\n${code}`); });
    const wait = async code => {
      for (let i = 0; i < 100; i++) {
        if (await js(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw Error(`Timed out: ${code}\n${await js("document.body.innerText")}`);
    };
    const click = async label => {
      await js(`(() => { const button = [...document.querySelectorAll('button,[role="tab"]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)} || e.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw Error('Missing button'); button.click(); })()`);
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
        : (name === "after-dialog" || name === "after-ready") ? await js(`(() => {
          const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
          return { x: Math.floor(r.x) - 16, y: Math.floor(r.y) - 16, width: Math.ceil(r.width) + 32, height: Math.ceil(r.height) + 32 };
        })()`) : undefined;
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
      await click("Render video");
      await wait(`document.body.textContent.includes('Show in folder')`);
      await click("Thumbnail");
      await wait(`!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Export PNG' && !e.disabled)`);
      await click("Add text");
      await wait(`!!document.querySelector('input[aria-label="Selected element text"]')`);
      await js(`(() => { const input = document.querySelector('input[aria-label="Selected element text"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Upload thumbnail'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await click("Export PNG");
      await wait(`[...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Export PNG' && !e.disabled) && document.body.textContent.includes('Show in folder')`);
      await click("YouTube details");
      await wait(`document.body.textContent.includes('Ready to upload')`);
      assert.equal(await value("youtube-title"), "Corrected title");
      await click("Copy video path");
      await wait(`document.body.textContent.includes('Video path copied.')`);
      assert.equal(await clipboard.readText(), videoFile);
      await click("Copy thumbnail path");
      await wait(`document.body.textContent.includes('Thumbnail path copied.')`);
      assert.equal(await clipboard.readText(), thumbnailFile);
      await click("Show video file");
      await wait(`document.body.textContent.includes('Video shown in your file manager.')`);
      assert.equal(shownFile, videoFile);
      await click("Show thumbnail file");
      await wait(`document.body.textContent.includes('Thumbnail shown in your file manager.')`);
      assert.equal(shownFile, thumbnailFile);
      await click("Open YouTube Studio");
      await wait(`document.body.textContent.includes('YouTube Studio opened')`);
      assert.equal(studioOpened, true);
      assert.ok(await js(`(() => { const body = document.querySelector('.modal__body'); return body.scrollHeight <= body.clientHeight + 1; })()`), "The desktop upload dialog fits without body scrolling.");
      await capture("after-ready");
      await click("Done");
      await click("Video");
      renderFails = true;
      await click("Render video");
      await wait(`document.body.textContent.includes('Test render failed')`);
      await click("Dismiss error");
      await click("YouTube details");
      await wait(`document.body.textContent.includes('Ready to upload')`);
      await click("Copy video path");
      await wait(`document.body.textContent.includes('Video path copied.')`);
      assert.equal(await clipboard.readText(), videoFile, "A failed render keeps the last completed export.");
      await click("Done");
      await openReplay();
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-title')`);
      assert.equal((await value("youtube-title")).includes("Corrected title"), false);
      assert.equal(await value("youtube-playerUrl"), "");
      assert.equal(await js(`!!document.querySelector('[aria-label="Copy video path"]') || !!document.querySelector('[aria-label="Copy thumbnail path"]')`), false);
      assert.equal(await value("youtube-additional"), "Saved credits.");
      await win.reload();
      await wait(`!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Open replay')`);
      await openReplay();
      await click("YouTube details");
      await wait(`!!document.getElementById('youtube-additional')`);
      assert.equal(await value("youtube-additional"), "Saved credits.");
      win.setContentSize(900, 720);
      await capture("after-small-window");
      console.log("YouTube details: copy, manual edits, regeneration, replay isolation, saved defaults, exported files, browser handoff, and errors passed.");
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
