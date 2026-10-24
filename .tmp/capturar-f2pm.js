const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-f2pm"));
app.whenReady().then(async () => {
  const OUT = ".tmp/telas-f2m"; fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 430, height: 932, show: false,
    webPreferences: { offscreen: true, webSecurity: false, autoplayPolicy: "no-user-gesture-required" } });
  win.webContents.setFrameRate(5);
  const erros = [];
  win.webContents.on("console-message", (_e, l, m) => { if (l >= 2 && !/Security Warning/.test(m)) erros.push(m.slice(0, 140)); });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1400));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1000));
  await ev('goto("live")'); await new Promise(r => setTimeout(r, 700));
  await ev(`(()=>{const it=Lib.live[0];play({...it,t:"live"})})()`);
  await new Promise(r => setTimeout(r, 2000));
  const i = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, "07-player-mobile.png"), i.toPNG());
  console.log("ok 07-player");
  console.log("scrollW:", await ev('document.documentElement.scrollWidth+"/"+innerWidth'));
  console.log("erros:", JSON.stringify(erros));
  app.exit(0);
});
