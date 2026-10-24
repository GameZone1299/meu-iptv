const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-pv"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1400));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1000));
  await ev('goto("live")'); await new Promise(r => setTimeout(r, 600));
  await ev(`(()=>{const it=Lib.live[0];play({...it,t:"live"})})()`);
  await new Promise(r => setTimeout(r, 1800));
  console.log(await ev(`(()=>{const b=document.querySelector("#pvbox").getBoundingClientRect();
    const out=[...document.querySelectorAll("#controls button,#controls select,#controls input")].map(e=>{
      const r=e.getBoundingClientRect();return (e.id||e.className)+" "+Math.round(r.left)+".."+Math.round(r.right)+(r.right>b.right?" ESTOURA":"")});
    return "pvbox "+Math.round(b.left)+".."+Math.round(b.right)+"\n"+out.join("\n")})()`));
  app.exit(0);
});
