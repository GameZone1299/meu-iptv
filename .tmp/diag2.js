const { app, BrowserWindow } = require("electron");
const path = require("path");
app.disableHardwareAcceleration();
app.setPath("userData", path.join(__dirname, "perfil-diag2"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(path.join(process.argv[2], "index.html"));
  await new Promise(r => setTimeout(r, 2500));
  await win.webContents.executeJavaScript(`(()=>{
    $("#cols").classList.add("tocando");$("#ph").classList.add("hide");showControls();
  })()`);
  await new Promise(r => setTimeout(r, 400));
  const i = await win.webContents.executeJavaScript(`(()=>{
    const g=s=>{const e=document.querySelector(s);if(!e)return "AUSENTE";
      const r=e.getBoundingClientRect(),c=getComputedStyle(e);
      return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),disp:c.display,vis:c.visibility,op:c.opacity});};
    return JSON.stringify({label:g("#fullLabel"),fs:g("#fullscreenBtn"),row:g(".ctrl-buttons"),pvtop:g("#pvtop"),fsBtn:g("#fsBtn")});
  })()`);
  console.log(i);
  app.exit(0);
});
