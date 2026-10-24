const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-f2p"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(5);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(r => setTimeout(r, 1500));
  const ev = j => win.webContents.executeJavaScript(j);
  console.log(await ev(`(()=>{
    const it={tipo:"filme",nome:"Filme Teste 1 (2024)",grupo:"Ação",sinopse:null,item:{u:"x",n:"Filme Teste 1"}};
    abrirDetalhe(it);
    const d=document.querySelector("#detail");
    const cs=getComputedStyle(d);
    const r=[];
    d.querySelectorAll("*").forEach(el=>{
      const b=el.getBoundingClientRect();
      if(b.right>d.clientWidth+1||b.left<-1)r.push(el.className+"|"+el.tagName+"|"+Math.round(b.left)+".."+Math.round(b.right));
    });
    return JSON.stringify({overflowX:cs.overflowX,overflowY:cs.overflowY,
      clientW:d.clientWidth,scrollW:d.scrollWidth,
      detalhes:r.slice(0,8)});
  })()`));
  app.exit(0);
});
