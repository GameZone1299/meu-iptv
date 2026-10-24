const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-foco"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 900, show: true, webPreferences: { offscreen: false } });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1500));
  const ev = j => win.webContents.executeJavaScript(j);
  await ev('document.documentElement.classList.add("tv")');
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1200));
  await ev('goto("movies")'); await new Promise(r => setTimeout(r, 900));
  await ev('document.querySelector("#list .card").focus()');
  await new Promise(r => setTimeout(r, 600));
  console.log(await ev(`(()=>{const c=document.querySelector("#list .card");const s=getComputedStyle(c);
    return JSON.stringify({m1:c.matches("html.tv .card:focus"),m2:c.matches(":focus"),
      ativo:document.activeElement===c,sombra:s.boxShadow.slice(0,60),html:document.documentElement.className})})()`));
  app.exit(0);
});
