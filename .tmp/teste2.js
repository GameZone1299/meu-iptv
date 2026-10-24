const { app, BrowserWindow } = require("electron");
const fs=require("fs"),path=require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-teste2"));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1366,height:768,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  win.webContents.setFrameRate(4);
  await win.loadFile(path.resolve("www/index.html"));
  const ev=js=>win.webContents.executeJavaScript(js);
  for(let i=0;i<40;i++){if(await ev("typeof Lib!=='ready'&&Lib.ready").catch(()=>false))break;await new Promise(r=>setTimeout(r,500))}
  await new Promise(r=>setTimeout(r,1000));
  // memória e tempo de carga
  console.log("HEAP", await ev("performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+'MB':'n/d'"));
  // categorias
  console.log("LIVE cat 4k:", await ev(`JSON.stringify(gruposDe('live').filter(g=>/4k|uhd/i.test(g.rotulo)))`));
  console.log("SERIES cats:", await ev(`gruposDe('series').length`));
  // busca
  await ev("goto('search');$('#q').value='vingadores';renderList()");
  await new Promise(r=>setTimeout(r,500));
  console.log("busca vingadores:", await ev("document.querySelector('#listInfo').textContent"));
  await ev("$('#q').value='dublado';renderList()");
  await new Promise(r=>setTimeout(r,500));
  console.log("busca dublado:", await ev("document.querySelector('#listInfo').textContent"));
  // filtro por categoria em filmes
  await ev("goto('movies')");
  await new Promise(r=>setTimeout(r,400));
  const cat=await ev("document.querySelector('#side .sc[data-g=\'filmes acao\']')?'tem':'nao'");
  console.log("cat acao:",cat);
  await ev("cat['movies']='filmes acao';renderSide();renderList()");
  await new Promise(r=>setTimeout(r,400));
  console.log("filtro acao:", await ev("document.querySelector('#listInfo').textContent"));
  // paginação
  await ev("cat['movies']='';limit=LIMITE_TELA;renderList()");
  console.log("more btn:", await ev("document.querySelector('#more')?document.querySelector('#more').textContent:'nao'"));
  app.quit();
});
