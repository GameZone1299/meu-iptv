// UI smoke test for embedded autoplay and details/fullscreen actions; no stream is fetched.
const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-detail-autoplay"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 720, show: false, webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(2);
  win.webContents.on("console-message", (_e, level, message) => { if (level >= 2 && !message.includes("Electron Security Warning")) console.log("CONSOLE_ERROR:", message.slice(0, 240)); });
  await win.loadFile(path.resolve("www/index.html"));
  const result = await win.webContents.executeJavaScript(`(()=>{
    const fake={tipo:'filme',nome:'Synthetic test',logo:'',item:{u:'https://example.invalid/video.mp4',t:'movie'}};
    abrirDetalhe(fake);
    const video=document.querySelector('#dVideo');
    const embedded=document.querySelector('#dPlayerWrap').classList.contains('ativo');
    const stillOnDetails=document.querySelector('#detail').classList.contains('on');
    const samePlayerAction=document.querySelector('#dPlay').onclick instanceof Function;
    fecharDetalhe();
    return JSON.stringify({embedded,stillOnDetails,detailActionBound:samePlayerAction,playerStopped:!dPlayerState.ativo});
  })()`);
  console.log("DETAIL_AUTOPLAY_SMOKE:", result);
  app.quit();
});
