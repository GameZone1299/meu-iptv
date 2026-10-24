const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = ['CanaisBR02.m3u8', 'CanaisBR03.m3u8', 'CanaisBR04.m3u8', 'CanaisIPTV.m3u8'];
const source = fs.readFileSync(path.join(root, 'www', 'live-playlists.js'), 'utf8');
const context = {
  window: {},
  document: { addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  TextDecoder,
  Response,
  fetch: async url => {
    const name = decodeURIComponent(url.split('/').pop());
    return new Response(fs.createReadStream(path.join(root, 'www', 'assets', 'live-playlists', name)), { status: 200 });
  },
  Bib: { classify: item => /\/(live|hls)\/|\/\d+\.(ts|m3u8)$/i.test(item.u) ? 'live' : 'movies' },
  $: () => null,
  arr: value => Array.isArray(value) ? value : [],
  sv() {},
  Lib: { live: [] },
  cat: { live: '' },
  montarBiblioteca() {},
  atualizarHome() {},
  scr: 'home',
  renderSide() {},
  renderList() {}
};

vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  const summary = [];
  for (let index = 0; index < files.length; index++) {
    const result = await context.carregarListasAoVivo(null, index, true);
    if (!result.canais.length) throw new Error(`Lista ${index + 1} sem canal classificado; entradas ignoradas: ${result.erros.join('; ')}`);
    summary.push({ file: files[index], channels: result.canais.length });
  }
  fs.writeFileSync(path.join(__dirname, 'real-playlists-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
})().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
