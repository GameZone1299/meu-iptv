const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'www', 'app.js'), 'utf8');
const from = source.indexOf('let resultadoListaCache=null;');
const baseEnd = source.indexOf('function itemNome(i)', from);
const filterStart = source.indexOf('function passaFiltros(i,q,tokens)', baseEnd);
const filterEnd = source.indexOf('function obterFiltrados()', filterStart);
const renderEnd = source.indexOf('\nfunction cardParaItem', filterEnd);
if ([from, baseEnd, filterStart, filterEnd, renderEnd].some(x => x < 0)) throw new Error('Could not locate filter/cache implementation');
const orderStart = source.indexOf('function chaveOrdem(i)', baseEnd);
const code = source.slice(from, orderStart) + source.slice(filterStart, filterEnd) + source.slice(filterEnd, renderEnd);
let baseCalls = 0;
const context = {
  Lib: { _generation: 1, ready: true, livePlaylistId: '', live: [], movies: [{n:'Água',g:'Ação',u:'a'}, {n:'Outro',g:'Drama',u:'b'}] },
  scr: 'movies', cat: {}, sortBy: 'name-asc', filterQuality: '', advFilter: {}, fav: new Set(), recent: [], viewStats: {}, viewStatsGeneration: 0,
  chaveBusca: s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
  baseList: s => { baseCalls++; return s === 'movies' ? context.Lib.movies : []; },
  itemGrupo: i => i.g || '', itemChaveGrupo: i => i.g || '', itemNome: i => i.n || '',
  extractYear: () => null, detectQuality: () => [], semAcento: s => String(s), prepararBusca: i => { i._q = context.chaveBusca(i.n + ' ' + i.g); return i._q; },
  chaveOrdem: i => ({nome:context.chaveBusca(i.n),ano:0,q:''}),
  document: { querySelector: () => ({value:''}) },
  $: () => ({value:context.query}),
  query:'',
  console
};
context.passaFiltros = function(item, _q, tokens) {
  const idx = item._q !== undefined ? item._q : context.prepararBusca(item);
  return tokens.every(t => idx.includes(t));
};
vm.createContext(context);
vm.runInContext(code, context);
const first = context.obterFiltrados().f;
const afterFirst = baseCalls;
const again = context.obterFiltrados().f;
if (afterFirst !== 1 || baseCalls !== afterFirst || first !== again) throw new Error('Identical list query was not served from cache');
context.query='agua';
const searched = context.obterFiltrados().f;
if (searched.length !== 1 || searched[0].u !== 'a' || baseCalls !== 2) throw new Error('Search change did not recompute correctly');
context.Lib._generation++;
context.Lib.movies.push({n:'Água 2',g:'Ação',u:'c'});
const afterReload = context.obterFiltrados().f;
if (afterReload.length !== 2 || baseCalls !== 3) throw new Error('Library generation change did not invalidate cache');
console.log('PASS: identical query cached; search and library generation changes recompute results.');
