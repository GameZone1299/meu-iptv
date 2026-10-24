const { app, BrowserWindow } = require("electron");
const path=require("path");
app.setPath("userData", path.resolve(".tmp/perfil-img4"));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1200,height:800,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  await win.loadFile(path.resolve("www/index.html"));
  const ev=js=>win.webContents.executeJavaScript(js);
  for(let i=0;i<30;i++){if(await ev("typeof Lib!=='undefined'&&Lib.ready").catch(()=>false))break;await new Promise(r=>setTimeout(r,500))}
  const t0=Date.now();
  await ev("goto('movies')");
  const r=await ev(`new Promise(res=>{
    const imgs=[...document.querySelectorAll('#list .card img')].slice(0,3);
    let n=0;const t=Date.now();
    imgs.forEach(i=>{i.onload=()=>{n++;if(n===imgs.length)res('3 carregadas em '+(Date.now()-t)+'ms')}});
    setTimeout(()=>res('timeout '+n+'/'+imgs.length+' w='+imgs.map(i=>i.naturalWidth).join(',')),20000);
  })`);
  console.log("após goto:", Date.now()-t0, "ms |", r);
  console.log("imgs no DOM:", await ev("document.querySelectorAll('#list .card img').length"));
  app.quit();
});
