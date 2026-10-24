const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-pntest2"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({width:1366,height:768,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  win.webContents.setFrameRate(4);
  await win.loadFile(path.resolve("www/index.html"));
  win.webContents.on("console-message",(_e,l,m)=>{ if(l>=2) console.log("CONSOLE:",String(m).slice(0,200)); });
  const ev = async (js) => { try { return await win.webContents.executeJavaScript(js); } catch(e) { console.log("EV-ERRO:", String(e.message).slice(0,120), "|js:", js.slice(0,60)); return null; } };
  for (let i=0;i<60;i++){ if(await ev("typeof Lib!=='undefined'&&Lib.ready").catch(()=>false)) break; await new Promise(r=>setTimeout(r,400)); }
  await ev(`
    window.__chamadas=[]; const ouvinte={};
    window.Capacitor={Plugins:{PlayerNativo:{
      abrir:async o=>{__chamadas.push(["abrir",o.live]);},
      fechar:async()=>{__chamadas.push(["fechar"]);},
      play:async()=>{__chamadas.push(["play"]);},pause:async()=>{__chamadas.push(["pause"]);},
      buscar:async o=>{__chamadas.push(["buscar",o.ms]);},
      volume:async()=>{},mudo:async()=>{},velocidade:async()=>{},
      definirRect:async()=>{__chamadas.push(["rect"]);},
      estado:async()=>({ativo:true,tocando:true,posicao:42000,duracao:600000,buffer:90000}),
      addListener:(n,f)=>{(ouvinte[n]=ouvinte[n]||[]).push(f);}
    }}};
    window.__emitir=(n,d)=>(ouvinte[n]||[]).forEach(f=>f(d||{}));
    PN.ini();
  `);
  await ev("(function(){Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});return 1})()");
  // FILME (VOD) -> barra deve andar
  await ev("(async()=>{await play(Lib.movies[0])})()");
  await new Promise(r=>setTimeout(r,1600));
  console.log("filme -> tempo:", await ev("$('#currentTime').textContent+' / '+$('#duration').textContent"),
    "| largura barra:", await ev("$('#progressFill').style.width"),
    "| isLive class:", await ev("$('#pvbox').classList.contains('isLive')"));
  // erro de rede em VOD: NÃO deve cair no fallback de formato
  const antes = await ev("PN._bloqueados.size");
  await ev("__emitir('erro',{mensagem:'Source error: connection reset',codigo:2001})");
  await new Promise(r=>setTimeout(r,600));
  console.log("erro de rede -> bloqueados:", antes, "->", await ev("PN._bloqueados.size"),
    "| mensagem exibida:", await ev("$('#ph').textContent.slice(0,40)"));
  // erro de codec: marca e cai no player web
  await ev("__emitir('erro',{mensagem:'MediaCodec decoder init failed',codigo:4003})");
  await new Promise(r=>setTimeout(r,900));
  console.log("erro codec -> bloqueados:", await ev("PN._bloqueados.size"), "| PN.ativo:", await ev("PN.ativo"));
  // tentar abrir de novo a mesma URL: deve recusar o nativo
  console.log("abre de novo no nativo?", await ev("PN.abrir(PN.item||Lib.movies[0], encodeURI([...PN._bloqueados][0]), false)").catch(()=>"erro"));
  app.quit();
});
