const { app, BrowserWindow } = require("electron");
const path = require("path");
app.disableHardwareAcceleration();
app.setPath("userData", path.join(__dirname, "perfil-stats"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 800, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(path.join(process.argv[2], "index.html"));
  await new Promise(r => setTimeout(r, 9000));
  const out = await win.webContents.executeJavaScript(`(()=>{
    const s=libStats();
    const versoes=Lib.movies.reduce((n,m)=>n+(m.versoes?m.versoes.length:1),0);
    const eps=Lib.series.reduce((n,x)=>n+x.eps.length,0);
    const multi=Lib.movies.filter(m=>m.versoes&&m.versoes.length>1).length;
    const maxV=Math.max(...Lib.movies.map(m=>m.versoes?m.versoes.length:1));
    const canaisPorGrupo={};
    for(const c of Lib.live) canaisPorGrupo[c.g]=(canaisPorGrupo[c.g]||0)+1;
    return JSON.stringify({s,versoes,eps,multi,maxV,
      gruposCanais:Object.keys(canaisPorGrupo).length,
      adultos:Lib.adult.length});
  })()`);
  console.log("STATS " + out);
  app.exit(0);
});
