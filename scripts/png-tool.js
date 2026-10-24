// Ferramentas de PNG em JS puro (sem dependências): recorte, composição e zoom
const fs = require("fs");
const zlib = require("zlib");

function decodificarPNG(buf) {
  let off = 8, w = 0, h = 0, bd = 0, ct = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString("ascii", off + 4, off + 8);
    const d = buf.slice(off + 8, off + 8 + len);
    if (tipo === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; inter = d[12]; }
    else if (tipo === "IDAT") idat.push(d);
    else if (tipo === "IEND") break;
    off += 12 + len;
  }
  if (bd !== 8 || inter !== 0) throw new Error("PNG não suportado");
  const canais = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = canais, stride = w * bpp + 1;
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
      const a = x >= bpp ? linha[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = linha[x];
      if (f === 1) v += a; else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1; else if (f === 4) v += paeth(a, b, c);
      linha[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * bpp;
      if (canais >= 3) {
        px[o] = linha[s]; px[o + 1] = linha[s + 1]; px[o + 2] = linha[s + 2];
        px[o + 3] = canais === 4 ? linha[s + 3] : 255;
      } else {
        px[o] = px[o + 1] = px[o + 2] = linha[s];
        px[o + 3] = canais === 2 ? linha[s + 1] : 255;
      }
    }
    prev = linha;
  }
  return { w, h, px };
}

const CRCTAB = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCTAB[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
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
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(raw, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

/* Compõe RGBA sobre um fundo sólido */
function sobreBranco(px, n, cor) {
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(px[i * 4 + c] * a + cor[c] * (1 - a));
    out[i * 4 + 3] = 255;
  }
  return out;
}

/* Recorte com ampliação vizinho-mais-próximo (bom para inspecionar bordas) */
function recorte(img, x, y, w, h, escala = 1) {
  const out = Buffer.alloc(w * escala * h * escala * 4);
  for (let yy = 0; yy < h * escala; yy++) {
    for (let xx = 0; xx < w * escala; xx++) {
      const sx = Math.min(img.w - 1, x + Math.floor(xx / escala));
      const sy = Math.min(img.h - 1, y + Math.floor(yy / escala));
      const s = (sy * img.w + sx) * 4, o = (yy * w * escala + xx) * 4;
      img.px.copy(out, o, s, s + 4);
    }
  }
  return { w: w * escala, h: h * escala, px: out };
}

module.exports = { decodificarPNG, codificarPNG, sobreBranco, recorte };

if (require.main === module) {
  const [acao, entrada, saida, ...resto] = process.argv.slice(2);
  const img = decodificarPNG(fs.readFileSync(entrada));
  if (acao === "crop") {
    const [x, y, w, h, escala] = resto.map(Number);
    const r = recorte(img, x, y, w, h, escala || 1);
    const fundo = sobreBranco(r.px, r.w * r.h, [16, 8, 30]);
    fs.writeFileSync(saida, codificarPNG(r.w, r.h, fundo));
    console.log("crop", r.w + "x" + r.h);
  } else if (acao === "flat") {
    const fundo = sobreBranco(img.px, img.w * img.h, [12, 6, 24]);
    fs.writeFileSync(saida, codificarPNG(img.w, img.h, fundo));
    console.log("flat", img.w + "x" + img.h);
  }
}
