// Testa o pacote do APK: carrega android/app/src/main/assets/public (mesmo
// layout que o WebView vê) e confere se a biblioteca embutida carrega e abre
// episódios de um bloco .gzbin.
const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-apk"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false },
  });
  win.webContents.setFrameRate(4);
  win.webContents.on("console-message", (_e, lvl, msg) => {
    if (lvl >= 2) console.log("CONSOLE", msg.slice(0, 300));
  });
  await win.loadFile(path.resolve("android/app/src/main/assets/public/index.html"));
  const ev = (js) => win.webContents.executeJavaScript(js);
  for (let i = 0; i < 60; i++) {
    if (await ev("typeof Lib!=='undefined'&&Lib.ready").catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 800));
  console.log("ready:", await ev("Lib.ready"));
  console.log("stats:", await ev("JSON.stringify(libStats())"));
  console.log("HEAP:", await ev("performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+'MB':'n/d'"));
  console.log("filmes cats:", await ev("gruposDe('movies').length"), "series cats:", await ev("gruposDe('series').length"), "live cats:", await ev("gruposDe('live').length"));
  console.log("primeira cat filmes:", await ev("JSON.stringify(gruposDe('movies')[0])"));
  // abre episódios de uma série (baixa o bloco .gzbin sob demanda)
  console.log("eps serie 0:", await ev(`(async()=>{const s=Lib.series[0];const e=await carregarEps(s);return s.nome+" | "+e.length+" eps | ex: "+(e[0]&&e[0].n)})()`));
  console.log("busca acao:", await ev(`(buscar('','acao')||[]).length`));
  app.quit();
});
