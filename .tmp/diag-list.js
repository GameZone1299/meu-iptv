const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-f2q"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1800));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1200));
  await ev('goto("movies")'); await new Promise(r => setTimeout(r, 800));
  console.log(await ev(`(()=>{const g=(s)=>{const e=document.querySelector(s);if(!e)return s+": ausente";
    const b=e.getBoundingClientRect(),c=getComputedStyle(e);
    return s+" w="+Math.round(b.width)+" x="+Math.round(b.left)+" cols="+c.gridTemplateColumns+" disp="+c.display};
    return [g("#sec"),g(".cols"),g("#side"),g("#list"),g("#list .grid"),g("#list .card")].join("\\n")})()`));
  app.exit(0);
});
