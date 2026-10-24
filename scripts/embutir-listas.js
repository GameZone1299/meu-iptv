// Embute as listas do usuário no app.
// Antes gerava .m3u8.bin gzipado (a interface descomprimia tudo na memória e o
// Android matava o app). Agora só delega para gerar-biblioteca.js, que escreve
// o formato compacto bib-*.bin.gzbin + bib-manifest.json.
//
// Uso: node scripts/embutir-listas.js <pasta-saida> <canais.m3u> <filmes.m3u>
const path = require("path");
const { execFileSync } = require("child_process");

const SAIDA = process.argv[2];
const ORIGENS = process.argv.slice(3).filter(Boolean);

if (!SAIDA || !ORIGENS.length) {
  console.error("uso: node scripts/embutir-listas.js <saida> <lista.m3u>...");
  process.exit(1);
}

execFileSync(
  process.execPath,
  [path.join(__dirname, "gerar-biblioteca.js"), SAIDA, ...ORIGENS],
  { stdio: "inherit" }
);
