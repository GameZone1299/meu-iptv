const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900), SUF = process.argv[4] || "";
const OUT = ".tmp/telas-f2d";
const PERFIL = ".tmp/perfil-f2d" + SUF;
app.setPath("userData", path.resolve(PERFIL));
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: W, height: H, show: false,
    webPreferences: { offscreen: true, webSecurity: false, autoplayPolicy: "no-user-gesture-required" } });
  win.webContents.setFrameRate(5);
  const erros = [];
  win.webContents.on("console-message", (_e, lvl, msg) => { if (lvl >= 2) erros.push(msg.slice(0, 250)); });
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 2000));
  const ev = j => win.webContents.executeJavaScript(j);
  const texto = fs.readFileSync(".tmp/teste.m3u", "utf8");
  await ev(`(async()=>{for(const b of await builtinTodas()) builtinDesligar(b.key,true);
    await importarLista("teste.m3u", ${JSON.stringify(texto)}, ""); await carregarTudo();})()`);
  await new Promise(r => setTimeout(r, 1500));
  const shot = async n => { const i = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, n + SUF + ".png"), i.toPNG()); console.log("ok", n); };

  // Filme (primeiro do catálogo)
  await ev(`(()=>{const it=Lib.movies[0];abrirDetalhe({tipo:"filme",nome:it.n||it.name,
    logo:it.l||it.logo||"",grupo:it.g||it.group||"",item:{...it,t:"movies"}})})()`);
  await new Promise(r => setTimeout(r, 1200)); await shot("05-detalhe-filme");
  await ev("fecharDetalhe()"); await new Promise(r => setTimeout(r, 400));

  // Série (primeira que tiver episódios)
  const abriu = await ev(`(async()=>{const s=Lib.series.find(x=>x.epQtd>0)||Lib.series[0];
    if(!s)return null;abrirDetalhe({tipo:"serie",nome:s.nome,logo:s.logo,grupo:s.grupo,serie:s});
    return s.nome})()`);
  await new Promise(r => setTimeout(r, 1500)); await shot("06-detalhe-serie");
  await ev("fecharDetalhe()"); await new Promise(r => setTimeout(r, 400));

  // Configurações e playlists
  await ev("abrirCfg()"); await new Promise(r => setTimeout(r, 900)); await shot("07-cfg");
  await ev('$("#cCfg").click()'); await new Promise(r => setTimeout(r, 500));
  await ev("abrirPlaylists()"); await new Promise(r => setTimeout(r, 900)); await shot("08-playlists");
  await ev('$("#plClose").click()'); await new Promise(r => setTimeout(r, 500));

  // Busca global na home
  await ev('goto("home")'); await new Promise(r => setTimeout(r, 500));
  await ev(`(()=>{const q=$("#hq");q.value="Filme";q.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 900)); await shot("09-busca-home");
  await ev('goto("home")'); await new Promise(r => setTimeout(r, 400));

  console.log("serie aberta:", abriu);
  console.log("detalhe visivel:", await ev('document.querySelector("#detail")?.classList.contains("on")'));
  console.log("overflow horizontal:", await ev('document.documentElement.scrollWidth>document.documentElement.clientWidth'));
  console.log("altura do body vs viewport:", await ev('document.body.scrollHeight+"/"+innerHeight'));
  console.log("erros:", JSON.stringify(erros));
  app.exit(0);
});
