// Captura a home, a intro e o player em tela cheia para conferência visual
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const WWW = process.argv[2];
const FIXTURE = process.argv[3];
const OUT = process.argv[4];
const LARGURA = +(process.argv[5] || 1366);
const ALTURA = +(process.argv[6] || 768);
const SUFIXO = process.argv[7] || "";
const PERFIL = process.argv[8];

app.commandLine.appendSwitch("disable-gpu-compositing");
if (PERFIL) app.setPath("userData", PERFIL);

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: LARGURA, height: ALTURA, show: false,
    webPreferences: { offscreen: true, webSecurity: false, autoplayPolicy: "no-user-gesture-required" },
  });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.join(WWW, "index.html"));

  const capturar = async (nome) => {
    const img = await win.webContents.capturePage();
    const p = path.join(OUT, nome + SUFIXO + ".png");
    fs.writeFileSync(p, img.toPNG());
    console.log("captura:", p, img.getSize().width + "x" + img.getSize().height);
  };

  // Intro logo após abrir
  await new Promise((r) => setTimeout(r, 700));
  await capturar("00-intro");

  await new Promise((r) => setTimeout(r, 2200));

  const texto = fs.readFileSync(FIXTURE, "utf8");
  await win.webContents.executeJavaScript(`(async()=>{
    // Remove as listas embutidas para o teste ficar rápido e previsível
    for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await saveListFile("teste.m3u", ${JSON.stringify(texto)}, "");
    await carregarTudo();
    await new Promise(r=>setTimeout(r,700));
  })()`);
  await new Promise((r) => setTimeout(r, 900));
  await capturar("01-home");

  // Player "tocando" (sem rede) para conferir a barra de tela cheia
  await win.webContents.executeJavaScript(`(()=>{
    goto("movies");
    const m=Lib.movies[0];
    $("#cols").classList.add("tocando");
    $("#ph").classList.add("hide");
    $("#pvt").textContent=m.n; $("#pvh").textContent=m.g;
    showControls();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  await capturar("02-player");

  await win.webContents.executeJavaScript('setFull(true)');
  await new Promise((r) => setTimeout(r, 800));
  await capturar("03-tela-cheia");

  await win.webContents.executeJavaScript('setFull(false);sairDoPlayer();goto("home")');
  await new Promise((r) => setTimeout(r, 500));

  const erros = await win.webContents.executeJavaScript("JSON.stringify(window.__errosUI||[])");
  console.log("erros de UI:", erros);
  app.exit(0);
});
