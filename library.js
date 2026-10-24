/* Biblioteca: agrupa episódios em séries e prepara os catálogos.
   Roda em blocos (yield ao navegador) para não travar a interface. */
const Lib={
  movies:[],
  series:[],      // séries agregadas: {tipo:"serie",nome,logo,grupo,eps:[...], ano}
  live:[],
  adult:[],
  byUrl:new Map(),
  ready:false
};

function resetLib(){
  Lib.movies=[];Lib.series=[];Lib.live=[];Lib.adult=[];Lib.byUrl=new Map();
  Lib._eps=null;Lib._epsCount=0;Lib._todos=null;Lib.ready=false;
}

/* Recebe os itens do worker de uma lista e acumula na biblioteca */
function addToLib(items){
  // Filmes
  for(const it of items.movies||[]){Lib.movies.push(it);Lib.byUrl.set(it.u,it)}
  // Canais
  for(const it of items.live||[]){Lib.live.push(it);Lib.byUrl.set(it.u,it)}
  // Adultos (mantidos separados e ocultos por padrão)
  for(const it of items.adult||[]){Lib.adult.push(it);Lib.byUrl.set(it.u,it)}
  // Séries: acumula episódios agora, agrega depois em agruparSeries()
  if(!Lib._eps)Lib._eps=[];
  for(const it of items.series||[]){
    it._serie=it.s||limparTituloBase(it.n)||it.n;
    Lib.byUrl.set(it.u,it);
    Lib._eps.push(it);
  }
}

/* Agrupa episódios por série. É O(n) com Map, rápido mesmo para 500 mil itens. */
function agruparSeries(){
  const eps=Lib._eps||[];
  const mapa=new Map();
  for(const e of eps){
    const chave=e._serie.toLowerCase();
    let g=mapa.get(chave);
    if(!g){
      g={tipo:"serie",nome:e._serie,logo:e.l,grupo:e.g,eps:[]};
      mapa.set(chave,g);
    }
    g.eps.push(e);
    // Usa a primeira capa encontrada
    if(!g.logo&&e.l)g.logo=e.l;
  }
  Lib.series=[...mapa.values()];
  // Ordena episódios de cada série
  for(const s of Lib.series){
    s.eps.sort((a,b)=>(a.sn||1)-(b.sn||1)||(a.en||0)-(b.en||0));
  }
  Lib.series.sort((a,b)=>a.nome.localeCompare(b.nome,"pt"));
  Lib.live.sort((a,b)=>a.n.localeCompare(b.n,"pt"));
  Lib._epsCount=Lib.series.reduce((n,s)=>n+s.eps.length,0);
  Lib._eps=null;
  Lib._todos=null;
  agruparVersoesFilmes();
  Lib.ready=true;
}

/* As listas trazem o mesmo filme em várias versões (Dublado, Legendado, 4K…),
   cada uma com URL própria. Por padrão viram um card só, com seletor de versão.
   Nada é descartado: todas as versões continuam reproduzíveis. */
function chaveFilme(nome){
  const base=String(nome||"")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/\[[^\]]*\]/g,"")
    .replace(/\b(4k|uhd|hdr|fhd|hd|sd|2160p|1080p|720p|480p|leg|dub|dublado|legendado|dual)\b/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .trim();
  // O ano faz parte da chave: sem ele, "Scarlet (2025)" e "Scarlet (2023)"
  // viravam o mesmo filme e o usuário perdia uma das obras.
  const ano=(String(nome||"").match(/\b(19|20)\d{2}\b/)||[])[0]||"";
  return base+(ano?"|"+ano:"");
}
function agruparVersoesFilmes(){
  if(!Lib.movies.length)return;
  if(settings.agruparVersoes===false){
    // Modo "mostrar tudo": cada versão vira um card próprio
    Lib.movies.sort((a,b)=>a.n.localeCompare(b.n,"pt"));
    Lib._todos=null;
    return;
  }
  const mapa=new Map();
  for(const m of Lib.movies){
    const k=chaveFilme(m.n)||m.u;
    let g=mapa.get(k);
    if(!g){g={...m,versoes:[]};mapa.set(k,g)}
    g.versoes.push(m);
    // Capa: prefere a que veio na primeira versão
    if(!g.l&&m.l)g.l=m.l;
  }
  Lib.movies=[...mapa.values()];
  Lib.movies.sort((a,b)=>a.n.localeCompare(b.n,"pt"));
  Lib._todos=null;
}

/* Todos os itens reproduzíveis (usado em busca/favoritos sem recriar arrays a cada render) */
function libTodos(){
  if(!Lib._todos){
    Lib._todos=[...Lib.movies,...Lib.series,...Lib.live,...Lib.adult];
  }
  return Lib._todos;
}

/* Estatísticas para a home */
function libStats(){
  // filmesTodas = todas as versões (Dublado, Legendado, 4K…) contadas separado.
  // É esse número que aparece no arquivo .m3u — mostramos os dois para o
  // usuário ver que nenhum título se perdeu no agrupamento.
  let filmesTodas=0;
  for(const m of Lib.movies)filmesTodas+=m.versoes?m.versoes.length:1;
  return{
    movies:Lib.movies.length,
    filmesTodas,
    series:Lib.series.length,
    episodes:Lib._epsCount||0,
    live:Lib.live.length,
    adult:Lib.adult.length
  };
}
