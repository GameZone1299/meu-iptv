// Prepara os assets de imagem: fundo da home, ícones do Windows e do Android.
// Usa o Chromium do Electron para decodificar/redimensionar/recomprimir.
const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const LOGO = process.argv[2];   // PNG com transparência (quadrado)
const FUNDO = process.argv[3];  // JPG da tela inicial
const WWW = process.argv[4];    // pasta www/assets

const ICO = [16, 24, 32, 48, 64, 128, 256];
const ANDROID = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

function icoDePNGs(pngs) {
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
    dir.writeUInt8(d, b);
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

app.commandLine.appendSwitch("disable-gpu");
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 900, transparent: true });
  await win.loadURL("data:text/html,<body style='margin:0;background:transparent'></body>");

  const logoUrl = "data:image/png;base64," + fs.readFileSync(LOGO).toString("base64");
  const fundoUrl = "data:image/jpeg;base64," + fs.readFileSync(FUNDO).toString("base64");

  const rodar = (js) => win.webContents.executeJavaScript(js);

  /* ---------- Fundo da tela inicial ---------- */
  const fundo = await rodar(`(async()=>{
    const img=new Image();img.src=${JSON.stringify(fundoUrl)};await img.decode();
    const w=1500, h=Math.round(img.naturalHeight*w/img.naturalWidth);
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const g=c.getContext("2d");
    g.imageSmoothingQuality="high";
    g.drawImage(img,0,0,w,h);
    // Escurece de leve na origem: o CSS final ainda aplica o véu escuro
    return c.toDataURL("image/jpeg",0.78).split(",")[1];
  })()`);
  fs.mkdirSync(WWW, { recursive: true });
  fs.writeFileSync(path.join(WWW, "fundo.jpg"), Buffer.from(fundo, "base64"));

  /* ---------- Logo dentro do app (512, transparente) ---------- */
  const logo512 = await rodar(`(async()=>{
    const img=new Image();img.src=${JSON.stringify(logoUrl)};await img.decode();
    const c=document.createElement("canvas");c.width=512;c.height=512;
    const g=c.getContext("2d");g.imageSmoothingQuality="high";
    g.drawImage(img,0,0,512,512);
    return c.toDataURL("image/png").split(",")[1];
  })()`);
  fs.writeFileSync(path.join(WWW, "logo.png"), Buffer.from(logo512, "base64"));

  /* ---------- Ícones ---------- */
  const render = async (tamanho, fundoCor, escala) =>
    Buffer.from(
      await rodar(`(async()=>{
        const img=new Image();img.src=${JSON.stringify(logoUrl)};await img.decode();
        const c=document.createElement("canvas");c.width=${tamanho};c.height=${tamanho};
        const g=c.getContext("2d");
        g.imageSmoothingQuality="high";
        ${fundoCor ? `g.fillStyle=${JSON.stringify(fundoCor)};g.fillRect(0,0,${tamanho},${tamanho});` : ""}
        const alvo=${tamanho}*${escala};
        g.drawImage(img,(${tamanho}-alvo)/2,(${tamanho}-alvo)/2,alvo,alvo);
        return c.toDataURL("image/png").split(",")[1];
      })()`),
      "base64"
    );

  const ICO_DIR = path.join(WWW, "icons");
  fs.mkdirSync(ICO_DIR, { recursive: true });
  const pngs = [];
  for (const t of ICO) pngs.push({ tamanho: t, data: await render(t, null, 1) });
  fs.writeFileSync(path.join(ICO_DIR, "icon.ico"), icoDePNGs(pngs));
  fs.writeFileSync(path.join(ICO_DIR, "icon.png"), await render(512, null, 1));
  for (const t of [48, 72, 96, 144, 192, 512]) {
    fs.writeFileSync(path.join(ICO_DIR, `icon-${t}.png`), await render(t, null, 1));
  }

  /* ---------- Android: foreground adaptativo + splash ---------- */
  const RES = process.argv[5];
  if (RES) {
    for (const [dens, t] of Object.entries(ANDROID)) {
      const fg = await render(t, null, 0.78);
      fs.writeFileSync(path.join(RES, `mipmap-${dens}`, "ic_launcher_foreground.png"), fg);
      fs.writeFileSync(path.join(RES, `mipmap-${dens}`, "ic_launcher.png"), await render(t, "#0B0618", 1));
      fs.writeFileSync(path.join(RES, `mipmap-${dens}`, "ic_launcher_round.png"), await render(t, "#0B0618", 1));
    }
    // Splash: logo centralizada em fundo escuro
    for (const [dens, [w, h]] of Object.entries(SPLASH)) {
      for (const [pasta, largura, altura] of [
        [`drawable-port-${dens}`, w, h],
        [`drawable-land-${dens}`, h, w],
      ]) {
        const lado = Math.round(Math.min(largura, altura) * 0.42);
        const b64 = await rodar(`(async()=>{
          const img=new Image();img.src=${JSON.stringify(logoUrl)};await img.decode();
          const c=document.createElement("canvas");c.width=${largura};c.height=${altura};
          const g=c.getContext("2d");
          g.fillStyle="#08040F";g.fillRect(0,0,${largura},${altura});
          g.imageSmoothingQuality="high";
          g.drawImage(img,(${largura}-${lado})/2,(${altura}-${lado})/2,${lado},${lado});
          return c.toDataURL("image/png").split(",")[1];
        })()`);
        fs.writeFileSync(path.join(RES, pasta, "splash.png"), Buffer.from(b64, "base64"));
      }
    }
    // drawable/splash.png (fallback sem qualificador)
    fs.copyFileSync(path.join(RES, "drawable-port-mdpi", "splash.png"), path.join(RES, "drawable", "splash.png"));
  }

  console.log("assets prontos");
  app.exit(0);
});
