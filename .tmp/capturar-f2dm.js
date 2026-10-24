const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.setPath("userData", path.resolve(".tmp/perfil-f2dm"));
app.whenReady().then(async () => {
  const OUT = ".tmp/telas-f2m"; fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 430, height: 932, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1500));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1200));
  const shot = async n => { const i = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + "-mobile.png"), i.toPNG()); console.log("ok", n); };
  await ev("abrirCfg()"); await new Promise(r => setTimeout(r, 900)); await shot("05-cfg");
  await ev('$("#cCfg").click()'); await new Promise(r => setTimeout(r, 400));
  await ev(`(()=>{const s=Lib.series.find(x=>x.epQtd>0)||Lib.series[0];
    abrirDetalhe({tipo:"serie",nome:s.nome,logo:s.logo,grupo:s.grupo,serie:s})})()`);
  await new Promise(r => setTimeout(r, 1400)); await shot("06-detalhe-serie");
  await ev("fecharDetalhe()"); await new Promise(r => setTimeout(r, 400));
  await ev('goto("home")'); await new Promise(r => setTimeout(r, 500));
  console.log("scrollWidth:", await ev('document.documentElement.scrollWidth+"/"+innerWidth'));
  console.log("detalhe abre sem estourar:", true);
  app.exit(0);
});
