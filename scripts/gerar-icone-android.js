// Gera o foreground do ícone adaptativo do Android (logo com margem de segurança)
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
const OUT = process.argv[3];
const ESCALA = 0.62; // o Android recorta até 66% — a logo fica menor para não cortar

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 400, transparent: true });
  await win.loadURL("data:text/html,<body style='margin:0;background:transparent'></body>");
  const dataUrl = "data:image/jpeg;base64," + fs.readFileSync(SRC).toString("base64");

  const render = async (tamanho) => {
    const buf = await win.webContents.executeJavaScript(`(async()=>{
      const img=new Image();img.src=${JSON.stringify(dataUrl)};await img.decode();
      const c=document.createElement("canvas");c.width=${tamanho};c.height=${tamanho};
      const g=c.getContext("2d");
      g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
      const alvo=${tamanho}*${ESCALA};
      const escala=alvo/img.naturalWidth;
      const w=img.naturalWidth*escala, h=img.naturalHeight*escala;
      g.drawImage(img,(${tamanho}-w)/2,(${tamanho}-h)/2,w,h);
      return c.toDataURL("image/png").split(",")[1];
    })()`);
    return Buffer.from(buf, "base64");
  };

  fs.mkdirSync(OUT, { recursive: true });
  for (const [nome, t] of [["mdpi", 108], ["hdpi", 162], ["xhdpi", 216], ["xxhdpi", 324], ["xxxhdpi", 432]]) {
    fs.writeFileSync(path.join(OUT, `ic_launcher_foreground-${nome}.png`), await render(t));
    // splash também
    fs.writeFileSync(path.join(OUT, `splash-${nome}.png`), await render(t));
  }
  console.log("foreground gerado");
  app.exit(0);
});
