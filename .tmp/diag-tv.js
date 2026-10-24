const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-f2f"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1920, height: 1080, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1200));
  const ev = j => win.webContents.executeJavaScript(j);
  await ev('document.documentElement.classList.add("tv")');
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1200));
  await ev('goto("movies")'); await new Promise(r => setTimeout(r, 900));
  console.log(await ev(`(()=>{const c=document.querySelector("#list .card");c.focus();
    const s=getComputedStyle(c);
    return JSON.stringify({foco:document.activeElement===c,fv:c.matches(":focus-visible"),
      sombra:s.boxShadow,borda:s.borderColor,transform:s.transform})})()`));
  console.log(await ev(`JSON.stringify({docW:document.documentElement.scrollWidth,winW:innerWidth,
    secW:Math.round(document.querySelector("#sec").getBoundingClientRect().width),
    gridW:Math.round(document.querySelector("#list .grid").getBoundingClientRect().width),
    listW:Math.round(document.querySelector("#list").getBoundingClientRect().width)})`));
  app.exit(0);
});
