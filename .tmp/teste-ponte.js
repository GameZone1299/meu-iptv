// Testa a ponte do player nativo com um plugin simulado: verifica roteamento
// dos controles, esconder atrás de modal, fallback de formato e o "parar ao
// sair da tela".
const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-pntest"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366, height: 768, show: false,
    webPreferences: { offscreen: true, webSecurity: false },
  });
  win.webContents.setFrameRate(4);
  await win.loadFile(path.resolve("www/index.html"));
  const ev = (js) => win.webContents.executeJavaScript(js);
  for (let i = 0; i < 60; i++) {
    if (await ev("typeof Lib!=='undefined'&&Lib.ready").catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  // ---- plugin simulado ----
  await ev(`
    window.__chamadas=[];
    const ouvinte={};
    window.Capacitor={Plugins:{PlayerNativo:{
      abrir:async o=>{__chamadas.push(["abrir",o.url,o.live]);},
      fechar:async()=>{__chamadas.push(["fechar"]);},
      play:async()=>{__chamadas.push(["play"]);},
      pause:async()=>{__chamadas.push(["pause"]);},
      buscar:async o=>{__chamadas.push(["buscar",o.ms]);},
      volume:async o=>{__chamadas.push(["volume",o.valor]);},
      mudo:async o=>{__chamadas.push(["mudo",o.valor]);},
      velocidade:async o=>{__chamadas.push(["velocidade",o.valor]);},
      definirRect:async o=>{__chamadas.push(["rect",o.rect.w,o.visivel]);},
      estado:async()=>({ativo:true,tocando:true,posicao:42000,duracao:600000,buffer:90000}),
      addListener:(n,f)=>{(ouvinte[n]=ouvinte[n]||[]).push(f);}
    }}};
    window.__emitir=(n,d)=>(ouvinte[n]||[]).forEach(f=>f(d||{}));
    PN.ini();
  `);
  // No modo offscreen a janela conta como oculta, e o polling respeita isso
  // (é o comportamento certo no aparelho). Aqui fingimos primeiro plano.
  await ev("(function(){Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});Object.defineProperty(document,'visibilityState',{get:()=>'visible',configurable:true});return 1})()");
  console.log("PN.ok:", await ev("PN.ok"));

  // abre um canal ao vivo no player nativo
  await ev(`(async()=>{const it=Lib.live[0];await play(it);return 1})()`);
  console.log("aberto:", await ev("JSON.stringify(__chamadas.map(c=>c[0]))"));
  console.log("modo-nativo:", await ev("document.documentElement.classList.contains('modo-nativo')"));

  // controles vão para o nativo
  await ev("__chamadas.length=0;$('#playPauseBtn').click()");
  await new Promise((r) => setTimeout(r, 200));
  console.log("play/pause:", await ev("JSON.stringify(__chamadas.map(c=>c[0]))"));

  await new Promise(r=>setTimeout(r,900));await ev("__chamadas.length=0;$('#back10').click()");
  await new Promise((r) => setTimeout(r, 150));
  console.log("back10 (pos ~42s):", await ev("JSON.stringify(__chamadas)"));

  await ev("__chamadas.length=0;$('#volumeSlider').value=40;$('#volumeSlider').oninput()");
  await new Promise((r) => setTimeout(r, 150));
  console.log("volume:", await ev("JSON.stringify(__chamadas)"));

  await ev("__chamadas.length=0;$('#speedSelect').value='1.5';$('#speedSelect').onchange()");
  await new Promise((r) => setTimeout(r, 150));
  console.log("velocidade:", await ev("JSON.stringify(__chamadas)"));

  // barra de progresso alimentada pelo polling
  await new Promise((r) => setTimeout(r, 900));
  console.log("barra:", await ev("$('#currentTime').textContent+' / '+$('#duration').textContent"));

  // sair da tela ENCERRA o player
  await ev("__chamadas.length=0;goto('home')");
  await new Promise((r) => setTimeout(r, 400));
  console.log("ao sair p/ home:", await ev("JSON.stringify(__chamadas.map(c=>c[0]))"),
    "| PN.ativo:", await ev("PN.ativo"),
    "| tocando:", await ev("$('#cols').classList.contains('tocando')"));

  // modal por cima esconde a view nativa
  await ev(`(async()=>{await play(Lib.live[0]);$('#cfg').classList.remove('hide');PN.sincronizarRect();})()`);
  await new Promise((r) => setTimeout(r, 500));
  console.log("com modal aberto -> visivel:", await ev("JSON.stringify(__chamadas.filter(c=>c[0]==='rect').slice(-1))"));
  await ev("$('#cfg').classList.add('hide');PN.sincronizarRect()");
  await new Promise((r) => setTimeout(r, 400));
  console.log("modal fechado -> visivel:", await ev("JSON.stringify(__chamadas.filter(c=>c[0]==='rect').slice(-1))"));

  // erro de codec cai no player da WebView
  await ev("__chamadas.length=0;__emitir('erro',{mensagem:'Decoder init failed for video/avc',codigo:4003})");
  await new Promise((r) => setTimeout(r, 900));
  console.log("erro codec -> bloqueado:", await ev("JSON.stringify([...PN._bloqueados])"),
    "| reabriu nativo?:", await ev("JSON.stringify(__chamadas.map(c=>c[0]))"));

  app.quit();
});
