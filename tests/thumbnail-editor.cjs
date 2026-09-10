const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.on("window-all-closed", () => {});
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "studio-thumbnail-editor-"));
  app.setPath("userData", profile);
  await app.whenReady();
  const mod = file => import(pathToFileURL(path.join(root, "dist", file)));
  const { analyze } = await mod("core/analyze.js");
  const { previewData, previewSkin } = await mod("core/preview.js");
  const { captureThumbnail } = await mod("electron/thumbnail.js");
  const { validateThumbnailDocument } = await mod("core/thumbnail-document.js");
  const beatmap = path.join(profile, "map.osu"), replay = path.join(root, "tests/fixtures/replay.osr");
  await fs.copyFile(path.join(root, "tests/fixtures/map.osu"), beatmap);
  await fs.writeFile(path.join(profile, "audio.wav"), Buffer.alloc(44));
  const timeline = await analyze({ replay, beatmap, songs: profile });
  timeline.playerAvatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#5588aa"/></svg>')}`;
  const settings = { replay: "", beatmap: "", songs: profile, songsFound: true, danser: "test", danserFound: true,
    outputDir: profile, width: 1920, height: 1080, fps: 60, overlays: [], overlayAccent: "#d4d7de", backgroundDim: .95,
    cursorSize: 1, skinPath: "", introOutro: true, leaderboardSize: 50, leaderboardSort: "pp" };
  for (const [name, handler] of Object.entries({ defaults: () => settings, osuStatus: () => ({ configured: true }),
    updateStatus: () => ({ state: "disabled" }), ppEngineStatus: () => ({ version: "test" }), skins: () => [],
    choose: () => replay, analyze: () => timeline, previewData: () => previewData(beatmap, replay), previewSkin: () => previewSkin(""),
    saveSettings: patch => Object.assign(settings, patch) })) ipcMain.handle(name, (_event, arg) => handler(arg));
  const win = new BrowserWindow({ show: false, width: 1600, height: 1000, useContentSize: true,
    webPreferences: { offscreen: true, preload: path.join(root, "dist/electron/preload.cjs"), backgroundThrottling: false } });
  const js = expression => win.webContents.executeJavaScript(expression);
  const wait = async expression => {
    for (let i = 0; i < 150; i++) { if (await js(expression)) return; await new Promise(resolve => setTimeout(resolve, 40)); }
    throw Error(`Timed out: ${expression}\n${await js("document.body.innerText")}`);
  };
  const click = async text => { await js(`(()=>{const e=[...document.querySelectorAll('button,[role=tab]')].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)});if(!e)throw Error('Missing ${text}');e.click()})()`); };
  const select = async id => {
    await js(`document.querySelector('.layout-editor').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await js(`(()=>{const r=document.querySelector('[data-layer="${id}"]').getBoundingClientRect();document.querySelector('.layout-editor').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:r.x+10,clientY:${id === 'combo' ? 'r.bottom-5' : 'r.y+10'}}))})()`);
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await wait(`document.querySelector('.layout-selection')?.dataset.element===${JSON.stringify(id)}`);
  };
  const fill = async (label, value) => {
    await js(`(()=>{const e=document.querySelector('input[aria-label=${JSON.stringify(label)}]');if(!e)throw Error('Missing ${label}');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  };
  const checkbox = async label => { await js(`[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).querySelector('input').click()`); };
  const documentValue = () => js(`JSON.parse(localStorage.getItem(${JSON.stringify("studio-thumbnail-v1:" + replay)}))`);
  try {
    await win.loadFile(path.join(root, "dist/ui/index.html"));
    await wait(`document.body.textContent.includes('Open replay')`);
    await click("Open replay");
    await wait(`document.querySelector('button[aria-label=Play]')?.disabled===false`);
    await click("Thumbnail");
    await wait(`document.querySelector('[data-layer=status]')`);
    assert.deepEqual(await js(`(()=>{const e=document.querySelector('[data-layer="top-panel"]'),s=getComputedStyle(e);return [e.offsetLeft,e.offsetTop,e.offsetWidth,s.borderTopWidth,s.borderLeftWidth,s.borderBottomWidth,s.borderRadius]})()`), [0,0,1280,"0px","0px","4px","0px"]);
    await select("status");
    assert.equal(await js(`document.querySelector('input[aria-label="Font size"]').value`), "280");
    await checkbox("Text glow");
    await new Promise(r=>setTimeout(r,200));
    await wait(`getComputedStyle(document.querySelector('[data-layer=status]')).textShadow.split('rgba').length===3`);
    await checkbox("Gradient fill");
    await wait(`getComputedStyle(document.querySelector('[data-layer=status]')).backgroundImage.startsWith('linear-gradient')`);
    await click("Duplicate");
    await wait(`document.querySelector('[data-duplicate]')`);
    const duplicate = await js(`document.querySelector('[data-duplicate]').dataset.layer`);
    await fill("Selected element text", "Copy");
    await wait(`document.querySelector('[data-duplicate]').textContent==='Copy'`);
    assert.equal(await js(`document.querySelector('[data-layer=status]').textContent`), "FC");
    await click("Undo thumbnail edit");
    await wait(`document.querySelector('[data-duplicate]').textContent==='FC'`);
    await click("Redo thumbnail edit");
    await wait(`document.querySelector('[data-duplicate]').textContent==='Copy'`);
    await select("avatar");
    await fill("Corner radius", "60");
    await wait(`getComputedStyle(document.querySelector('[data-layer=avatar]')).borderRadius==='60px'`);
    await click("Duplicate");
    await wait(`document.querySelectorAll('[data-duplicate]').length===2`);
    assert.equal(await js(`document.querySelectorAll('[data-duplicate]')[1].querySelector('img')!==null`), true);
    await checkbox("Drop shadow");
    await wait(`getComputedStyle(document.querySelector('[data-layer="mod-list"]')).filter.includes('drop-shadow')`);
    for (let i = 0; i < 30; i++) await fill("Horizontal offset", String(i % 2));
    assert.equal(await js(`(document.querySelector('[data-layer="mod-list"]').style.filter.match(/drop-shadow/g)||[]).length`), 1,
      "Repeated edits must not accumulate global drop shadows.");
    await select("combo");
    await checkbox("Text glow");
    await wait(`getComputedStyle(document.querySelector('[data-layer=combo] [data-editor-text]')).textShadow.includes('12px')||getComputedStyle(document.querySelector('[data-layer=combo] [data-editor-text]')).textShadow.includes('8.4px')`);
    const value = await documentValue();
    validateThumbnailDocument(value);
    assert.equal(value.layers[duplicate].source, "status");
    const file = path.join(profile, "edited.png");
    await captureThumbnail(root, timeline, file, value.accent, new AbortController().signal, { document: value });
    assert.ok((await fs.stat(file)).size > 10000);
    console.log("Thumbnail defaults, replay glow, gradient, text/image duplicates, independent edits, undo/redo, radius and global shadows passed. Edited PNG exported.");
    if (process.env.STUDIO_TEST_EVIDENCE) {
      await fs.mkdir(process.env.STUDIO_TEST_EVIDENCE, { recursive: true });
      await fs.copyFile(file, path.join(process.env.STUDIO_TEST_EVIDENCE, "thumbnail-edited.png"));
      const plain = { ...value, layers: {}, customTexts: [], dropShadow: undefined };
      await captureThumbnail(root, timeline, path.join(process.env.STUDIO_TEST_EVIDENCE, "thumbnail-default.png"), value.accent, new AbortController().signal, { document: plain });
      for (const [name, misses, sliderBreaks] of [["counts",2,3],["slider-breaks",0,12]]) await captureThumbnail(root, timeline,
        path.join(process.env.STUDIO_TEST_EVIDENCE, `thumbnail-${name}.png`), value.accent, new AbortController().signal,
        { document: { ...plain, status: "counts", misses, sliderBreaks } });
    }
  } finally {
    win.destroy();
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(error => {
      // Chromium can retain profile locks until process exit on Windows.
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
    });
  }
  app.exit(0);
})().catch(error => { console.error(error); app.exit(1); });
