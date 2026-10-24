const { app, BrowserWindow } = require("electron");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-css"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 800, show: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1200));
  const ev = j => win.webContents.executeJavaScript(j);
  console.log(await ev(`(()=>{
    const sh=[...document.styleSheets].find(s=>(s.href||"").includes("theme.css"));
    const regras=[...sh.cssRules];
    const alvo=regras.filter(r=>r.cssText.includes("html.tv .card:focus"));
    const total=regras.length;
    const tvIdx=regras.findIndex(r=>r.selectorText&&r.selectorText.includes("html.tv"));
    return JSON.stringify({total,alvo:alvo.map(r=>r.cssText.slice(0,200)),tvIdx});
  })()`));
  app.exit(0);
});
