/* Biblioteca: catálogos prontos para a interface.

   Antes, cada uma das 574 mil entradas virava um objeto em memória (~500 MB)
   e o Android matava o app. Agora os dados vêm do formato compacto (bib.js):
   filmes, séries, canais e adultos ficam residentes; os episódios ficam em
   blocos e só o bloco da série aberta é lido.

   Também é aqui que as categorias ganham nome legível: as listas trazem o
   mesmo grupo escrito de jeitos diferentes ("SÉRIES | NETFLIX" e
   "Series | Netflix"), e sem normalizar viravam duas categorias na barra. */
let libGeneration=0;
const Lib={
  _generation:0,
  movies:[],
  series:[],      // {tipo:"serie",nome,logo,grupo,epIni,epQtd,eps:null}
  live:[],
  adult:[],
  byUrl:new Map(), // só o que está carregado (filmes, canais, adultos, séries abertas)
  seriePorNome:new Map(),
  fontes:[],
  ready:false,
  _epsCache:new Map(), // nome do bloco -> episódios
  _blocoPromessa:new Map()
};

function resetLib(){
  Lib._generation=++libGeneration;
  Lib.movies=[];Lib.series=[];Lib.live=[];Lib.adult=[];
  Lib.byUrl=new Map();Lib.seriePorNome=new Map();
  Lib.fontes=[];Lib.ready=false;
  Lib._epsCache=new Map();Lib._blocoPromessa=new Map();
  Lib._epsCount=0;Lib._grupos=null;
}

/* ---------- texto ---------- */
const semAcento=s=>String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"");
const chaveBusca=s=>semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
/* Índice de busca pronto no item (sem acento, sem pontuação). Guardado uma vez:
   a busca passa a comparar strings simples e acha "acao" em "Ação". */
function prepararBusca(i){
  if(i._q===undefined)i._q=chaveBusca((i.n||i.nome||"")+" "+(i.g||i.grupo||""));
  return i._q;
}

/* ---------- categorias ---------- */
const ACRONIMOS=new Set(["uhd","4k","8k","hd","fhd","sd","ppv","tv","sbt","hbo","dc","eua","usa","br","xx","cx","amc","nba","nfl","ufc","f1","mtv","cnn","bts","abc","cbs","nbc","fox","disney+","globoplay","h2","a&e"]);
const PALAVRAS={
  series:"Séries",serie:"Série",filmes:"Filmes",filme:"Filme",canais:"Canais",canal:"Canal",
  coletanea:"Coletânea","24hrs":"24 Horas","24h":"24 Horas",leg:"Legendados",dub:"Dublado",
  documentario:"Documentário",animacao:"Animação",acao:"Ação",comedia:"Comédia",
  ficcao:"Ficção",suspense:"Suspense",terror:"Terror",drama:"Drama",romance:"Romance",
  fantasia:"Fantasia",crime:"Crime",natalino:"Natalino",faroeste:"Faroeste",nacionais:"Nacionais",
  legendados:"Legendados",adultos:"Adultos",adulto:"Adultos",infantil:"Infantil",
  noticias:"Notícias",esportes:"Esportes",variedades:"Variedades",filmeseseries:"Filmes e Séries"
};
function capitalizarPalavra(w){
  const low=semAcento(w).toLowerCase();
  // "4K/UHD", "HD/SD", "24HRS": siglas compostas ficam todas em maiúsculas
  if(low.includes("/")){
    return w.split("/").map(p=>ACRONIMOS.has(semAcento(p).toLowerCase())?p.toUpperCase():capitalizarPalavra(p)).join("/");
  }
  if(ACRONIMOS.has(low))return low==="4k"?"4K":w.toUpperCase();
  if(PALAVRAS[low])return PALAVRAS[low];
  // Toda em maiúsculas (ou toda minúscula) vira Capitalizada; misturada é marca
  // ("Netflix", "Prime Video") e fica como veio.
  if(w===w.toUpperCase()||w===w.toLowerCase()){
    return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();
  }
  return w;
}
function formatarGrupo(g){
  const limpo=String(g||"").replace(/\s*[=|]\s*/g," · ").replace(/\s+/g," ").trim();
  if(!limpo)return "Sem categoria";
  return limpo.split(" ").map(w=>{
    if(w==="·")return w;
    // "FILMES" dentro de "XX FILMES" já é tratado palavra a palavra
    return capitalizarPalavra(w);
  }).join(" ");
}
const chaveGrupo=g=>chaveBusca(g)||"sem categoria";
/* O mesmo grupo aparece escrito de vários jeitos nas duas listas. A chave
   normalizada junta tudo; o rótulo exibido é a forma mais frequente. */
function canonizarGrupos(itens){
  const contagem=new Map();
  for(const it of itens){
    const k=chaveGrupo(it.g||it.grupo);
    let m=contagem.get(k);
    if(!m){m=new Map();contagem.set(k,m)}
    const bruto=it.g||it.grupo||"";
    m.set(bruto,(m.get(bruto)||0)+1);
  }
  const rotulo=new Map();
  for(const [k,m] of contagem){
    let melhor="",n=-1;
    for(const [bruto,c] of m)if(c>n){n=c;melhor=bruto}
    rotulo.set(k,formatarGrupo(melhor));
  }
  for(const it of itens){
    const k=chaveGrupo(it.g||it.grupo);
    it.gk=k;
    it.g=rotulo.get(k)||formatarGrupo(it.g||it.grupo);
  }
  return rotulo;
}

/* ---------- carregar ---------- */
function addFonte(f){Lib.fontes.push(f)}

/* Junta os itens de todas as fontes e prepara índices/categorias */
function montarBiblioteca(){
  const rotulo=new Map();
  for(const coll of ["movies","live","adult"]){
    const r=canonizarGrupos(Lib[coll]);
    for(const [k,v] of r)rotulo.set(k,v);
  }
  const rs=canonizarGrupos(Lib.series);
  for(const [k,v] of rs)rotulo.set(k,v);
  Lib._rotulosGrupo=rotulo;

  Lib.movies.sort((a,b)=>a.n.localeCompare(b.n,"pt"));
  Lib.live.sort((a,b)=>a.n.localeCompare(b.n,"pt"));
  Lib.series.sort((a,b)=>a.nome.localeCompare(b.nome,"pt"));
  Lib.adult.sort((a,b)=>a.n.localeCompare(b.n,"pt"));

  Lib.byUrl=new Map();
  for(const m of Lib.movies)Lib.byUrl.set(m.u,m);
  for(const c of Lib.live)Lib.byUrl.set(c.u,c);
  for(const a of Lib.adult)Lib.byUrl.set(a.u,a);

  Lib.seriePorNome=new Map();
  for(const s of Lib.series)Lib.seriePorNome.set(s.nome,s);

  Lib._epsCount=Lib.series.reduce((n,s)=>n+(s.epQtd||0),0);
  Lib._grupos=null;
  Lib.ready=true;
}

/* ---------- episódios sob demanda ---------- */
/* O epIni é o índice global da série dentro da fonte; o bloco é epIni/chunk
   e a posição dentro do bloco é o resto. */
function blocoDaSerie(s){
  const f=s._fonte;
  const chunk=f.chunk||Bib.CHUNK;
  const k=Math.floor(s.epIni/chunk);
  return {nome:"bib-eps-"+String(k).padStart(3,"0")+".bin",base:s.epIni-k*chunk,fonte:f};
}
async function lerBloco(nome,fonte){
  const chave=(fonte&&fonte.id?fonte.id+"|":"")+nome;
  if(Lib._epsCache.has(chave))return Lib._epsCache.get(chave);
  if(Lib._blocoPromessa.has(chave))return Lib._blocoPromessa.get(chave);
  const geracao=Lib._generation;
  const p=(async()=>{
    const buf=await fonte.carregar(nome);
    const eps=Bib.lerEps(buf);
    if(geracao===Lib._generation)Lib._epsCache.set(chave,eps);
    return eps;
  })().finally(()=>Lib._blocoPromessa.delete(chave));
  Lib._blocoPromessa.set(chave,p);
  return p;
}
/* Devolve os episódios da série, carregando o bloco na primeira abertura.
   O bloco inteiro (8 mil episódios) fica em cache: abrir outra série do
   mesmo bloco é instantâneo. */
async function carregarEps(s){
  if(s.eps)return s.eps;
  if(!s._fonte)return [];
  const geracao=Lib._generation;
  const {nome,base,fonte}=blocoDaSerie(s);
  const bloco=await lerBloco(nome,fonte);
  const eps=bloco.slice(base,base+s.epQtd).filter(Boolean);
  if(geracao!==Lib._generation)return eps;
  for(const e of eps){
    e.g=s.grupo;
    e._serie=s.nome;
    Lib.byUrl.set(e.u,e);
  }
  s.eps=eps;
  return eps;
}

/* ---------- consultas ---------- */
function libStats(){
  const n=s=>s||0;
  return{
    movies:Lib.movies.length,
    filmesTodas:Lib.movies.length,
    series:Lib.series.length,
    episodes:Lib._epsCount||0,
    live:Lib.live.length,
    adult:Lib.adult.length
  };
}

/* Categorias de uma seção: [{chave,rotulo,total}] ordenado por total */
function gruposDe(secao){
  if(!Lib._grupos)Lib._grupos={};
  if(Lib._grupos[secao])return Lib._grupos[secao];
  const base=secao==="movies"?Lib.movies:secao==="live"?Lib.live:secao==="adult"?Lib.adult:Lib.series;
  const meta=new Map();
  for(const it of base){
    const k=it.gk||chaveGrupo(it.g||it.grupo);
    let m=meta.get(k);
    if(!m){m={chave:k,rotulo:(it.g||it.grupo)||"Sem categoria",total:0};meta.set(k,m)}
    m.total++;
  }
  const out=[...meta.values()].sort((a,b)=>b.total-a.total||a.rotulo.localeCompare(b.rotulo,"pt"));
  Lib._grupos[secao]=out;
  return out;
}

/* Busca: todas as palavras precisam aparecer no nome ou na categoria */
function buscar(secao,termo){
  const tokens=chaveBusca(termo).split(" ").filter(Boolean);
  if(!tokens.length)return null;
  const base=secao==="movies"?Lib.movies:secao==="live"?Lib.live:secao==="adult"?Lib.adult:
    secao==="series"?Lib.series:libTodos();
  const out=[];
  for(const it of base){
    const q=it._q!==undefined?it._q:prepararBusca(it);
    let ok=true;
    for(const t of tokens){if(q.indexOf(t)<0){ok=false;break}}
    if(ok)out.push(it);
  }
  return out;
}

/* Todos os itens "raiz" (sem episódios) para busca global */
function libTodos(){
  if(!Lib._todos)Lib._todos=[...Lib.movies,...Lib.series,...Lib.live,...Lib.adult];
  return Lib._todos;
}

function invalidarTodos(){Lib._todos=null;Lib._grupos=null}
