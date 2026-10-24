const { app, BrowserWindow } = require("electron");
const path = require("path");
app.disableHardwareAcceleration();
app.setPath("userData", path.join(__dirname, "perfil-pl"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 900, show: false,
    webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(path.join(process.argv[2], "index.html"));
  await new Promise(r => setTimeout(r, 12000));
  await win.webContents.executeJavaScript('abrirPlaylists()');
  await new Promise(r => setTimeout(r, 1200));
  const img = await win.webContents.capturePage();
  require("fs").writeFileSync(path.join(__dirname, "telas3", "playlists.png").replace("telas3","telas3"), img.toPNG());
  console.log("ok");
  app.exit(0);
});
