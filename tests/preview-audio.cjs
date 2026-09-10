const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const devUrl = process.env.STUDIO_TEST_DEV_URL;
    let renderer = pathToFileURL(path.join(root, "node_modules/replayviewer-js/dist/index.js")).href;
    const clock = devUrl ? new URL("/core/presentation.ts", devUrl).href : pathToFileURL(path.join(root, "dist/core/presentation.js")).href;
    if (devUrl) {
      const source = await (await fetch(new URL("/src/preview-engine.ts", devUrl))).text();
      const dependency = source.match(/from ["']([^"']*replayviewer[^"']*)["']/)?.[1];
      assert.ok(dependency, "Vite must resolve the preview renderer.");
      renderer = new URL(dependency, devUrl).href;
      await win.loadURL(new URL("/overlays/preview.html", devUrl).href);
    } else await win.loadFile(path.join(root, "overlays/preview.html"));
    const map = await fs.readFile(path.join(root, "tests/fixtures/map.osu"), "utf8");
    const result = await win.webContents.executeJavaScript(`(async () => {
      const {AudioSync,parseBeatmap}=await import(${JSON.stringify(renderer)});
      const {gameplayClock,presentationTiming,presentationSeconds}=await import(${JSON.stringify(clock)});
      const timing=presentationTiming(4,60,true,2), results=[];
      for (const seek of [0,5.25,6]) {
        const context=new OfflineAudioContext(1,48000*9,48000);
        Object.defineProperty(context,'resume',{value:async()=>{}});
        const song=context.createBuffer(1,48000*4,48000);
        const marks=[1.03,1.12,1.27,2];
        for(const t of marks) song.getChannelData(0).fill(.8,Math.round(t*48000),Math.round((t+.004)*48000));
        const audio=new AudioSync({ctx:context,songBuffer:song,skinSounds:new Map(),mergedSounds:new Map(),beatmap:parseBeatmap(${JSON.stringify(map)}),hitResults:[],introOffsetMs:0,speed:1});
        audio.setSongVolume(1);
        const position=t=>gameplayClock(timing,seek+t,60);
        await audio.playFrom(position(0).time*1000,{timeAt:t=>position(t).time,elapsedAt:t=>presentationSeconds(timing,t,60)-seek,rateAt:t=>position(t).rate,start:Math.max(0,timing.introFrames/60-seek),rampEnd:(timing.introFrames+timing.introEaseFrames)/60-seek});
        const output=(await context.startRendering()).getChannelData(0), starts=[];
        if(output[0]>.4) starts.push(0);
        for(let i=1;i<output.length;i++) if(output[i]>.4&&output[i-1]<=.4) starts.push(i/48000);
        const expected=marks.map(t=>presentationSeconds(timing,t,60)-seek).filter(t=>t>=0);
        results.push({seek,starts,expected});audio.destroy();
      }
      return results;
    })()`);
    for (const { seek, starts, expected } of result) {
      assert.equal(starts.length, expected.length, `Audio markers after seek ${seek}`);
      for (let i = 0; i < starts.length; i++) assert.ok(Math.abs(starts[i] - expected[i]) < .006,
        `Audio after seek ${seek}: ${starts[i]} vs ${expected[i]}`);
    }
    console.log("Preview audio follows the entrance ramp and seeks within 6 ms.");
  } finally { win.destroy(); }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
