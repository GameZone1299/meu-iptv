const { app, BrowserWindow } = require("electron");
const path=require("path");
app.setPath("userData", path.resolve(".tmp/perfil-img"));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1200,height:800,show:false,webPreferences:{offscreen:true,webSecurity:false}});
  await win.loadFile(path.resolve("www/index.html"));
  const ev=js=>win.webContents.executeJavaScript(js);
  for(let i=0;i<30;i++){if(await ev("typeof Lib!=='undefined'&&Lib.ready").catch(()=>false))break;await new Promise(r=>setTimeout(r,500))}
  await ev("goto('movies')");
  await new Promise(r=>setTimeout(r,6000));
  console.log(await ev(`(()=>{const a=[...document.querySelectorAll('#list .card img')].slice(0,8);
    return JSON.stringify(a.map(i=>({src:(i.src||'').slice(0,60),w:i.naturalWidth,vis:i.style.visibility})));})()`));
  console.log("url exemplo", await ev("Lib.movies[0].l"));
  // teste fetch direto da imagem
  console.log(await ev(`(async()=>{try{const r=await fetch(Lib.movies.find(m=>m.l).l);return 'fetch '+r.status}catch(e){return 'erro '+e.message}})()`));
  app.quit();
});
