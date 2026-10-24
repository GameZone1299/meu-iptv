// Banner da Android TV (320x180) com a logo centralizada sobre fundo escuro
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const LOGO = process.argv[2];
const SAIDA = process.argv[3];

app.commandLine.appendSwitch("disable-gpu");
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 320, height: 180, show: false, webPreferences: { offscreen: true } });
  const logo = fs.readFileSync(LOGO).toString("base64");
  const html = `<html><body style="margin:0;width:320px;height:180px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 45%,#2a1450 0%,#120a22 55%,#08040f 100%)">
    <img src="data:image/png;base64,${logo}" style="height:120px;object-fit:contain;filter:drop-shadow(0 0 18px #a855f799)">
    </body></html>`;
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 900));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 320, height: 180 });
  fs.writeFileSync(SAIDA, img.toPNG());
  console.log("banner:", SAIDA, img.getSize().width + "x" + img.getSize().height);
  app.quit();
});
