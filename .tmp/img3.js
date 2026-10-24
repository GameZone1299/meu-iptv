const { app, BrowserWindow } = require("electron");
const path=require("path");
app.setPath("userData", path.resolve(".tmp/perfil-img3"));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1200,height:800,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  await win.loadFile(path.resolve("www/index.html"));
  const ev=js=>win.webContents.executeJavaScript(js);
  for(let i=0;i<30;i++){if(await ev("typeof Lib!=='undefined'&&Lib.ready").catch(()=>false))break;await new Promise(r=>setTimeout(r,500))}
  await ev("goto('movies')");
  for(const s of [3,8,15]){
    await new Promise(r=>setTimeout(r, s*1000));
    console.log(s+"s:", await ev(`[...document.querySelectorAll('#list .card img')].slice(0,6).map(i=>i.naturalWidth).join(',')`));
  }
  app.quit();
});
