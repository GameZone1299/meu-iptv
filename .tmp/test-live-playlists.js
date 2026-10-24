const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'www', 'live-playlists.js'), 'utf8');
const lines = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-name="News Channel" tvg-logo="logo.png" group-title="News",News Channel',
  'https://example.invalid/live/news.m3u8',
  '#EXTINF:-1 tvg-name="Film 2020" group-title="Movies",Film 2020',
  'https://example.invalid/movie/film.mp4',
  '#EXTINF:-1 tvg-name="Invalid URL" group-title="News",Invalid URL',
  'file:///bad.ts',
  '#EXTINF:-1 tvg-name="News Channel" group-title="News",News Channel',
  'https://example.invalid/live/news.m3u8'
];
const playlist = lines.join('\n');
const calls = [];
const context = {
  console,
  window: {},
  document: { addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  fetch: async url => {
    calls.push(url);
    return new Response(playlist, { status: 200 });
  },
  TextDecoder,
  Bib: { classify: () => 'live' },
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
  const expected = ['CanaisBR02.m3u8', 'CanaisBR03.m3u8', 'CanaisBR04.m3u8', 'CanaisIPTV.m3u8'];
  for (let index = 0; index < expected.length; index++) {
    const result = await context.carregarListasAoVivo(null, index, true);
    if (result.canais.length !== 1 || result.canais[0].n !== 'News Channel') {
      throw new Error(`Lista ${index + 1}: filtro/deduplicação incorretos (${result.canais.length} canais)`);
    }
    if (!calls[index].includes(expected[index])) throw new Error(`Lista ${index + 1}: arquivo incorreto`);
  }
  if (calls.length !== 4) throw new Error(`Esperadas 4 requisições; recebidas ${calls.length}`);
  console.log('PASS: quatro arquivos independentes, filtro de VOD/URL inválida e deduplicação.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
