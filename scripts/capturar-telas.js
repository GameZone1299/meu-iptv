// Abre o app no Electron, injeta uma playlist de teste e salva capturas de tela
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const WWW = process.argv[2];
const FIXTURE = process.argv[3];
const OUT = process.argv[4];
const LARGURA = +(process.argv[5] || 1366);
const ALTURA = +(process.argv[6] || 768);
const SUFIXO = process.argv[7] || "";

app.commandLine.appendSwitch("disable-gpu-compositing");
// Perfil isolado: cada execução começa sem listas salvas de capturas anteriores
const PERFIL = process.argv[8];
if (PERFIL) app.setPath("userData", PERFIL);

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: LARGURA, height: ALTURA, show: false,
    webPreferences: { offscreen: true, webSecurity: false, autoplayPolicy: "no-user-gesture-required" },
  });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.join(WWW, "index.html"));
  await new Promise((r) => setTimeout(r, 1500));

  const texto = fs.readFileSync(FIXTURE, "utf8");
  // injeta a playlist e espera a biblioteca carregar
  await win.webContents.executeJavaScript(`(async()=>{
    await saveListFile("teste.m3u", ${JSON.stringify(texto)}, "");
    await carregarTudo();
    await new Promise(r=>setTimeout(r,600));
  })()`);
  await new Promise((r) => setTimeout(r, 900));

  const capturar = async (nome) => {
    const img = await win.webContents.capturePage();
    const p = path.join(OUT, nome + SUFIXO + ".png");
    fs.writeFileSync(p, img.toPNG());
    console.log("captura:", p, img.getSize().width + "x" + img.getSize().height);
  };

  await capturar("01-home");

  await win.webContents.executeJavaScript('goto("movies")');
  await new Promise((r) => setTimeout(r, 500));
  await capturar("02-filmes");

  await win.webContents.executeJavaScript(`(()=>{
    const m=Lib.movies[0];
    abrirDetalhe({tipo:"filme",nome:m.n,logo:m.l,grupo:m.g,item:m});
  })()`);
  await new Promise((r) => setTimeout(r, 900));
  await capturar("03-detalhe-filme");

  await win.webContents.executeJavaScript(`(()=>{
    fecharDetalhe();goto("series");
    const s=Lib.series[0];
    abrirDetalhe({tipo:"serie",nome:s.nome,logo:s.logo,grupo:s.grupo,eps:s.eps});
  })()`);
  await new Promise((r) => setTimeout(r, 900));
  await capturar("04-detalhe-serie");

  await win.webContents.executeJavaScript('fecharDetalhe();abrirPlaylists()');
  await new Promise((r) => setTimeout(r, 600));
  await capturar("05-playlists");

  await win.webContents.executeJavaScript('$("#pl").classList.add("hide");abrirCfg()');
  await new Promise((r) => setTimeout(r, 600));
  await capturar("06-config");

  await win.webContents.executeJavaScript('$("#cfg").classList.add("hide");goto("home")');
  await new Promise((r) => setTimeout(r, 400));

  const erros = await win.webContents.executeJavaScript(
    'JSON.stringify(window.__errosUI||[])'
  );
  console.log("erros de UI:", erros);
  app.exit(0);
});
