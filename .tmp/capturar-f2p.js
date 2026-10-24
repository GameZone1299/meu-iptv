const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-f2p2"));
app.whenReady().then(async () => {
  const OUT = ".tmp/telas-f2p"; fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1440, height: 900, show: false,
    webPreferences: { offscreen: true, webSecurity: false, autoplayPolicy: "no-user-gesture-required" } });
  win.webContents.setFrameRate(5);
  const erros = [];
  win.webContents.on("console-message", (_e, lvl, msg) => { if (lvl >= 2 && !/Security Warning/.test(msg)) erros.push(msg.slice(0, 160)); });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1500));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1200));
  await ev('goto("live")'); await new Promise(r => setTimeout(r, 800));
  const shot = async n => { const i = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + ".png"), i.toPNG()); console.log("ok", n); };
  await shot("01-live");
  await ev(`(()=>{const it=Lib.live[0];play({...it,t:"live"})})()`);
  await new Promise(r => setTimeout(r, 2500)); await shot("02-player");
  console.log("pvbox visivel:", await ev('!document.querySelector("#pvbox").classList.contains("hide")'));
  console.log("tocando class:", await ev('document.querySelector("#cols").classList.contains("tocando")'));
  console.log("erros:", JSON.stringify(erros));
  app.exit(0);
});
