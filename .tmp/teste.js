const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const WWW = path.resolve("www");
const OUT = path.resolve(".tmp/telas");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-teste"));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1366, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false },
  });
  win.webContents.setFrameRate(4);
  const erros = [];
  win.webContents.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) erros.push(msg); });
  await win.loadFile(path.join(WWW, "index.html"));

  const ev = (js) => win.webContents.executeJavaScript(js);
  const cap = async (n) => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + ".png"), img.toPNG());
  };

  // espera carregar (intro 1.5s + biblioteca)
  for (let i = 0; i < 40; i++) {
    const pronto = await ev("typeof Lib!=='undefined' && Lib.ready").catch(() => false);
    if (pronto) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 1200));
  console.log("STATS", JSON.stringify(await ev("JSON.stringify(libStats())")));
  console.log("ERROS", JSON.stringify(erros.slice(0, 8)));
  await cap("01-home");

  // Filmes com categorias
  await ev("goto('movies')");
  await new Promise((r) => setTimeout(r, 5000));
  console.log("CATS filmes", JSON.stringify(await ev("JSON.stringify(gruposDe('movies').slice(0,6))")));
  console.log("CATS live", JSON.stringify(await ev("JSON.stringify(gruposDe('live').slice(0,6))")));
  await cap("02-filmes");

  // Busca sem acento
  await ev("goto('search'); document.querySelector('#q').value='acao'; renderList();");
  await new Promise((r) => setTimeout(r, 4000));
  console.log("BUSCA acao:", await ev("document.querySelectorAll('#list .card').length"), await ev("document.querySelector('#listInfo').textContent"));
  await cap("03-busca");

  // Série: abre detalhe e carrega episódios do bloco
  await ev("goto('series')");
  await new Promise((r) => setTimeout(r, 700));
  await ev(`(()=>{const c=document.querySelector('#list .card');c&&c.click()})()`);
  await new Promise((r) => setTimeout(r, 1500));
  console.log("DETALHE eps:", await ev("document.querySelectorAll('#dEps .ep').length"), "| temporadas:", await ev("document.querySelectorAll('#dSeason option').length"));
  await cap("04-serie");

  // TV ao vivo
  await ev("fecharDetalhe(); goto('live')");
  await new Promise((r) => setTimeout(r, 4000));
  await cap("05-live");

  console.log("ERROS FINAL", JSON.stringify(erros.slice(0, 10)));
  app.quit();
});
