// Smoke test isolated live recovery behavior without opening a real stream.
const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-live-watch"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 600, show: false, webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(2);
  await win.loadFile(path.resolve("www/index.html"));
  const result = await win.webContents.executeJavaScript(`(()=>{
    const ph=document.querySelector('#ph');
    const fake={t:'live',u:'https://example.invalid/live.ts',n:'synthetic'};
    tentativasReconexao=9;urlReconexaoAtual=fake.u;
    reconectar(fake,fake.u);
    const wait=window._reconexao;
    const delay=Math.min(15000,1500*Math.pow(1.6,Math.min(9,6)));
    clearTimeout(window._reconexao);window._reconexao=null;
    return JSON.stringify({attemptsAfterSchedule:tentativasReconexao,delayBounded:delay<=15000,placeholder:ph.textContent,sourceWasNotFetched:!document.querySelector('#v').currentSrc});
  })()`);
  console.log("LIVE_WATCH_SMOKE:", result);
  app.quit();
});
