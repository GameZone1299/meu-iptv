const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-f2tab"));
app.whenReady().then(async () => {
  const OUT = ".tmp/telas-f2tab"; fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1024, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1400));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1000));
  const shot = async n => { const i = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + ".png"), i.toPNG()); console.log("ok", n); };
  await shot("01-home");
  await ev('goto("movies")'); await new Promise(r => setTimeout(r, 800)); await shot("02-filmes");
  console.log("rail:", await ev('getComputedStyle(document.querySelector("#rail")).display'),
    "bnav:", await ev('getComputedStyle(document.querySelector("#bnav")).display'),
    "catbar:", await ev('getComputedStyle(document.querySelector("#catbar")).display'));
  console.log("scrollW:", await ev('document.documentElement.scrollWidth+"/"+innerWidth'));
  app.exit(0);
});
