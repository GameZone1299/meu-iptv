// Gera a biblioteca compacta (assets/listas/bib-*.bin) a partir das listas M3U.
// Uso: node scripts/gerar-biblioteca.js <pasta-saida> <lista1.m3u> <lista2.m3u>
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Bib = require("../www/bib.js");

const SAIDA = process.argv[2];
const ORIGENS = process.argv.slice(3);
if (!SAIDA || !ORIGENS.length) {
  console.error("uso: node scripts/gerar-biblioteca.js <saida> <lista.m3u>...");
  process.exit(1);
}

const ler = (p) => {
  const b = fs.readFileSync(p);
  // aceita tanto .m3u puro quanto o .bin já gzipado do build anterior
  if (b[0] === 0x1f && b[1] === 0x8b) return zlib.gunzipSync(b).toString("utf8");
  return b.toString("utf8");
};

const textos = ORIGENS.map(ler);
console.log("listas:", ORIGENS.map((o) => path.basename(o)).join(", "));

const t0 = Date.now();
const { arquivos, chunk, totais } = Bib.compilar(textos);
console.log("compilado em", Date.now() - t0, "ms", totais);

fs.mkdirSync(SAIDA, { recursive: true });
let totalGz = 0;
for (const [nome, buf] of Object.entries(arquivos)) {
  const gz = zlib.gzipSync(Buffer.from(buf), { level: 9 });
  fs.writeFileSync(path.join(SAIDA, nome + ".gzbin"), gz);
  totalGz += gz.length;
  console.log(`  ${nome.padEnd(18)} ${(buf.byteLength / 1048576).toFixed(1).padStart(7)} MB → ${(gz.length / 1048576).toFixed(2).padStart(6)} MB`);
}
console.log("total comprimido:", (totalGz / 1048576).toFixed(2), "MB");

const manifesto = {
  versao: 2,
  formato: "gzl1",
  chunk,
  totais,
  arquivos: Object.keys(arquivos),
};
fs.writeFileSync(path.join(SAIDA, "bib-manifest.json"), JSON.stringify(manifesto, null, 2));
console.log("manifesto:", path.join(SAIDA, "bib-manifest.json"));
