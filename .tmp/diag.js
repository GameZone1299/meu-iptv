const { app, BrowserWindow } = require("electron");
const path = require("path");
app.disableHardwareAcceleration();
app.setPath("userData", path.join(__dirname, "perfil-diag"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(path.join(process.argv[2], "index.html"));
  await new Promise(r => setTimeout(r, 3500));
  const info = await win.webContents.executeJavaScript(`(()=>{
    const h=document.querySelector('.hc h1'), p=document.querySelector('.hc p');
    const cs=getComputedStyle(h);
    return JSON.stringify({hT:document.querySelector('#hT').textContent,
      h1:h.textContent, p:p.textContent,
      color:cs.color, bgImage:cs.backgroundImage.slice(0,60), clip:cs.webkitBackgroundClip});
  })()`);
  console.log(info);
  app.exit(0);
});
