// Remove o fundo quadriculado (falso transparente) da logo e grava um PNG com alfa
const fs = require("fs");
const zlib = require("zlib");

const SRC = process.argv[2];
const OUT = process.argv[3];
const LADO = +(process.argv[4] || 800);

/* ---------- PNG: leitura ---------- */
function decodificarPNG(buf) {
  let off = 8;
  let w = 0, h = 0, bd = 0, ct = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString("ascii", off + 4, off + 8);
    const d = buf.slice(off + 8, off + 8 + len);
    if (tipo === "IHDR") {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      bd = d[8]; ct = d[9]; inter = d[12];
    } else if (tipo === "IDAT") idat.push(d);
    else if (tipo === "IEND") break;
    off += 12 + len;
  }
  if (bd !== 8 || inter !== 0) throw new Error(`PNG não suportado (bitDepth ${bd}, interlace ${inter})`);
  const canais = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!canais) throw new Error("Tipo de cor não suportado: " + ct);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = canais;
  const stride = w * bpp + 1;
  const px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(w * bpp);

  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < h; y++) {
    const f = raw[y * stride];
    const linha = Buffer.from(raw.slice(y * stride + 1, y * stride + 1 + w * bpp));
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? linha[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = linha[x];
      if (f === 1) v += a; else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1; else if (f === 4) v += paeth(a, b, c);
      linha[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const s = x * bpp;
      if (canais >= 3) {
        px[o] = linha[s]; px[o + 1] = linha[s + 1]; px[o + 2] = linha[s + 2];
        px[o + 3] = canais === 4 ? linha[s + 3] : 255;
      } else {
        px[o] = px[o + 1] = px[o + 2] = linha[s]; px[o + 3] = canais === 2 ? linha[s + 1] : 255;
      }
    }
    prev = linha;
  }
  return { w, h, px };
}

/* ---------- PNG: escrita ---------- */
const CRCTAB = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCTAB[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function bloco(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length, 0);
  const t = Buffer.from(tipo, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])), 0);
  return Buffer.concat([len, t, dados, crc]);
}
function codificarPNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(raw, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- Remoção do fundo ---------- */
const img = decodificarPNG(fs.readFileSync(SRC));
const { w, h, px } = img;

// O "transparente" da imagem é um xadrez claro. Tudo o que for neutro
// (R≈G≈B) e claro, ligado à borda, vira transparente — inclusive a sombra.
const lum = new Uint8Array(w * h);
const neutro = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  lum[i] = (r * 299 + g * 587 + b * 114) / 1000;
  neutro[i] = mx - mn <= 26 ? 1 : 0;
}

const fundo = new Uint8Array(w * h);
const pilha = new Int32Array(w * h);
let topo = 0;
const pode = (i) => !fundo[i] && neutro[i] && lum[i] >= 150;
for (let x = 0; x < w; x++) {
  for (const y of [0, h - 1]) { const i = y * w + x; if (pode(i)) { fundo[i] = 1; pilha[topo++] = i; } }
}
for (let y = 0; y < h; y++) {
  for (const x of [0, w - 1]) { const i = y * w + x; if (pode(i)) { fundo[i] = 1; pilha[topo++] = i; } }
}
while (topo > 0) {
  const i = pilha[--topo];
  const x = i % w, y = (i - x) / w;
  if (x > 0 && pode(i - 1)) { fundo[i - 1] = 1; pilha[topo++] = i - 1; }
  if (x < w - 1 && pode(i + 1)) { fundo[i + 1] = 1; pilha[topo++] = i + 1; }
  if (y > 0 && pode(i - w)) { fundo[i - w] = 1; pilha[topo++] = i - w; }
  if (y < h - 1 && pode(i + w)) { fundo[i + w] = 1; pilha[topo++] = i + w; }
}

// Suaviza a borda: quem ficou de fora mas é limítrofe do fundo ganha alfa parcial
for (let p = 0; p < 2; p++) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (fundo[i]) continue;
      const viz = fundo[i - 1] || fundo[i + 1] || fundo[i - w] || fundo[i + w];
      if (!viz) continue;
      // Borda clara e neutra: é resto do xadrez, sai também
      if (neutro[i] && lum[i] >= 210) { fundo[i] = 1; }
      else { px[i * 4 + 3] = Math.min(px[i * 4 + 3], 110); }
    }
  }
}
for (let i = 0; i < w * h; i++) if (fundo[i]) px[i * 4 + 3] = 0;

/* ---------- Recorte + redimensionamento ---------- */
let minX = w, minY = h, maxX = 0, maxY = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (px[(y * w + x) * 4 + 3] > 8) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const larg = maxX - minX + 1, alt = maxY - minY + 1;
const ladoSrc = Math.max(larg, alt);
const cx = (minX + maxX + 1) / 2, cy = (minY + maxY + 1) / 2;

// Bilinear do quadrado central
const out = Buffer.alloc(LADO * LADO * 4);
const s = ladoSrc / LADO;
for (let y = 0; y < LADO; y++) {
  const sy = cy - ladoSrc / 2 + (y + 0.5) * s - 0.5;
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
  const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
  const fy = Math.max(0, Math.min(1, sy - y0));
  for (let x = 0; x < LADO; x++) {
    const sx = cx - ladoSrc / 2 + (x + 0.5) * s - 0.5;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)));
    const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
    const fx = Math.max(0, Math.min(1, sx - x0));
    const o = (y * LADO + x) * 4;
    for (let c = 0; c < 4; c++) {
      const p00 = px[(y0 * w + x0) * 4 + c], p10 = px[(y0 * w + x1) * 4 + c];
      const p01 = px[(y1 * w + x0) * 4 + c], p11 = px[(y1 * w + x1) * 4 + c];
      // Alfa é ponderado à parte para não escurecer a borda (halo preto)
      out[o + c] = Math.round(
        (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy
      );
    }
    // Corrige cor pré-multiplicada na borda
    const a = out[o + 3] / 255;
    if (a > 0.02 && a < 0.98) {
      const a00 = px[(y0 * w + x0) * 4 + 3] / 255, a10 = px[(y0 * w + x1) * 4 + 3] / 255;
      const a01 = px[(y1 * w + x0) * 4 + 3] / 255, a11 = px[(y1 * w + x1) * 4 + 3] / 255;
      const aa = (a00 * (1 - fx) + a10 * fx) * (1 - fy) + (a01 * (1 - fx) + a11 * fx) * fy;
      out[o + 3] = Math.round(aa * 255);
    }
  }
}

fs.writeFileSync(OUT, codificarPNG(LADO, LADO, out));
let transparentes = 0;
for (let i = 0; i < w * h; i++) if (fundo[i]) transparentes++;
console.log("logo pronta:", OUT, LADO + "x" + LADO, "| fundo removido:", ((transparentes / (w * h)) * 100).toFixed(1) + "%");
