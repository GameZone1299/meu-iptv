// Gera ícones (.ico, .png mipmaps) a partir da logo usando o Chromium do Electron
const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
const OUT = process.argv[3];
const TAMANHOS_PNG = [48, 72, 96, 144, 192, 512];
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];

function icoDePNGs(pngs) {
  // Monta um .ico com PNGs embutidos (suportado desde o Vista)
  const n = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(n, 4);
  const dir = Buffer.alloc(16 * n);
  let offset = 6 + 16 * n;
  pngs.forEach((p, i) => {
    const b = 16 * i;
    const d = p.tamanho >= 256 ? 0 : p.tamanho;
    dir.writeUInt8(d, b + 0);
    dir.writeUInt8(d, b + 1);
    dir.writeUInt8(0, b + 2);
    dir.writeUInt8(0, b + 3);
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(p.data.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 800, height: 800, transparent: true });
  await win.loadURL("data:text/html,<body style='margin:0;background:transparent'></body>");
  const dataUrl = "data:image/jpeg;base64," + fs.readFileSync(SRC).toString("base64");

  const render = async (tamanho) => {
    const buf = await win.webContents.executeJavaScript(`(async()=>{
      const img=new Image();
      img.src=${JSON.stringify(dataUrl)};
      await img.decode();
      const c=document.createElement("canvas");
      c.width=${tamanho};c.height=${tamanho};
      const g=c.getContext("2d");
      g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
      // Recorte quadrado centralizado (a logo é 1264x843, 3:2)
      const lado=Math.min(img.naturalWidth,img.naturalHeight);
      const sx=(img.naturalWidth-lado)/2, sy=(img.naturalHeight-lado)/2;
      g.drawImage(img,sx,sy,lado,lado,0,0,${tamanho},${tamanho});
      return c.toDataURL("image/png").split(",")[1];
    })()`);
    return Buffer.from(buf, "base64");
  };

  const pngs = [];
  for (const t of TAMANHOS_ICO) pngs.push({ tamanho: t, data: await render(t) });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "icon.ico"), icoDePNGs(pngs));
  fs.writeFileSync(path.join(OUT, "icon.png"), await render(512));
  for (const t of TAMANHOS_PNG) {
    fs.writeFileSync(path.join(OUT, `icon-${t}.png`), await render(t));
  }
  // Ícones redondos/adaptativos do Android
  for (const t of [108, 162, 216, 324, 432]) {
    fs.writeFileSync(path.join(OUT, `ic_launcher-${t}.png`), await render(t));
  }
  console.log("ícones gerados em", OUT);
  app.exit(0);
});
