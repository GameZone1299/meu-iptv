const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
const W = +(process.argv[2] || 1920), H = +(process.argv[3] || 1080), SUF = process.argv[4] || "-tv";
const OUT = ".tmp/telas-f2tv";
app.setPath("userData", path.resolve(".tmp/perfil-f2tv" + SUF));
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: W, height: H, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  const erros = [];
  win.webContents.on("console-message", (_e, lvl, msg) => { if (lvl >= 2 && !/Security Warning/.test(msg)) erros.push(msg.slice(0, 200)); });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1200));
  const ev = j => win.webContents.executeJavaScript(j);
  await ev('document.documentElement.classList.add("tv")');
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1500));
  const shot = async n => { const i = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + SUF + ".png"), i.toPNG()); console.log("ok", n); };
  await shot("01-home");

  // Simula navegação por controle remoto: foca o primeiro card e segue com Tab
  await ev('goto("movies")'); await new Promise(r => setTimeout(r, 900));
  const foco = await ev(`(()=>{const c=document.querySelector("#list .card");if(!c)return "sem card";
    c.focus();return document.activeElement.className})()`);
  await new Promise(r => setTimeout(r, 400)); await shot("02-filmes-foco");
  console.log("foco no card:", foco);
  console.log("tamanho de fonte:", await ev('getComputedStyle(document.documentElement).fontSize'));
  console.log("altura card:", await ev('Math.round(document.querySelector("#list .card").getBoundingClientRect().height)'));
  console.log("rail:", await ev('getComputedStyle(document.querySelector("#rail")).display'),
    "| bnav:", await ev('getComputedStyle(document.querySelector("#bnav")).display'));
  console.log("erros:", JSON.stringify(erros));
  app.exit(0);
});
