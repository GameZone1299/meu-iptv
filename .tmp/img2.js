const { app, BrowserWindow } = require("electron");
const path=require("path");
app.setPath("userData", path.resolve(".tmp/perfil-img2"));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:900,height:600,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  await win.loadFile(path.resolve("www/index.html"));
  const ev=js=>win.webContents.executeJavaScript(js);
  await new Promise(r=>setTimeout(r,3000));
  console.log(await ev(`new Promise(res=>{const i=new Image();i.onload=()=>res('ok '+i.naturalWidth);
    i.onerror=e=>res('erro');i.src='https://image.tmdb.org/t/p/w600_and_h900_bestv2/nEktirdxkXk42NuM8WGlUcP9D28.jpg';
    setTimeout(()=>res('timeout w='+i.naturalWidth),15000)})`));
  app.quit();
});
