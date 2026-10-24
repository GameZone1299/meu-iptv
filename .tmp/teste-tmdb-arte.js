const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-tmdb-arte"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({width: 1366, height: 768, show: false, webPreferences: {offscreen: true, webSecurity: false}});
  win.webContents.setFrameRate(4);
  win.webContents.on("console-message", (_e, lvl, msg) => { if (lvl >= 2 && !msg.includes("Electron Security Warning")) console.log("CONSOLE", msg.slice(0, 300)); });
  await win.loadFile(path.resolve("www/index.html"));
  const ev = js => win.webContents.executeJavaScript(js);
  for (let i = 0; i < 60; i++) {
    if (await ev("typeof Lib!=='undefined'&&Lib.ready").catch(() => false)) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const result = await ev(`(async()=>{try{const m=await buscarMetadados("The Matrix",false,1999);return JSON.stringify({ready:Lib.ready,hasMeta:!!m,hasPoster:!!(m&&m.poster),poster:m&&m.poster,hasBackdrop:!!(m&&m.backdrop),rating:m&&m.rating})}catch(e){return JSON.stringify({error:String(e)})}})()`);
  console.log("TMDB_ARTE_TEST:", result);
  app.quit();
});
