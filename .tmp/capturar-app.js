const { app, BrowserWindow } = require("electron");
const path = require("path");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.resolve(".tmp/perfil-captura"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false, webPreferences: { offscreen: true, webSecurity: false } });
  win.webContents.setFrameRate(4);
  await win.loadFile(path.resolve("www/index.html"));
  await new Promise(resolve => setTimeout(resolve, 5000));
  const image = await win.webContents.capturePage();
  const output = path.resolve(".tmp/gamezone-home.png");
  require("fs").writeFileSync(output, image.toPNG());
  console.log("SCREENSHOT:", output, "size:", image.getSize().width, "x", image.getSize().height);
  app.quit();
});
