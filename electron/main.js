const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    backgroundColor: "#070410",
    title: "Game Zone IPTV",
    autoHideMenuBar: true,
    webPreferences: {
      // webSecurity desligado: permite abrir listas e canais que não enviam CORS
      webSecurity: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "..", "www", "index.html"));
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
