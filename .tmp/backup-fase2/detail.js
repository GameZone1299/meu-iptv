/* Tela de detalhe estilo Netflix (filme/série) com sinopse e episódios.

   Os episódios da série não ficam mais na memória: são lidos do bloco quando
   a tela abre. Por isso abrirDetalhe mostra "Carregando episódios…" e
   preenche a lista assim que o bloco chega. */
let detailAtual=null;

function abrirDetalhe(item){
  detailAtual=item;
  const d=$("#detail");
  const serie=item.tipo==="serie";
  const nome=item.nome;
  const poster=item.logo||"";
  const ano=extractYear(nome);
  const qualidade=detectQuality(nome);
  const tituloLimpo=ano?nome.replace(new RegExp(`\\s*\\(?${ano}\\)?\\s*$`),"") .trim()||nome:nome;

  d.innerHTML=`
    <div class="backdrop" style="${poster?`background-image:url('${esc(capaMenor(poster,780))}')`:""}"></div>
    <button class="close" id="dClose" aria-label="Fechar">✕</button>
    <div class="inner">
      <div class="dhead">
        <img class="dposter" src="${esc(poster)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="dtext">
          <h1>${esc(tituloLimpo)}</h1>
          <div class="dmeta">
            ${ano?`<span>${ano}</span><span class="dot"></span>`:""}
            ${qualidade.length?`<span class="chip">${qualidade[0]}</span>`:""}
            ${serie?`<span class="chip" id="dEpsCount">${item.serie&&item.serie.epQtd?item.serie.epQtd+" episódios":"Série"}</span>`:""}
            <span class="chip">${esc(item.grupo||"")}</span>
          </div>
        </div>
        <p class="syn" id="dSyn">${esc(item.sinopse||"Sinopse não disponível.")}</p>
        <div class="actions">
          <button class="btn-primary" id="dPlay">▶ ${serie?"Assistir T1E1":"Assistir"}</button>
          <button class="btn-ghost" id="dFav">♡ Favorito</button>
          <button class="btn-ghost" id="dMulti">▣ Multi-tela</button>
        </div>
      </div>
      ${serie?`<div class="ephead"><h3 style="margin:0;font-size:17px">Episódios</h3><span style="flex:1"></span><select id="dSeason"></select></div><div class="eps" id="dEps"><div style="color:var(--mut);padding:14px 4px">Carregando episódios…</div></div>`:""}
    </div>`;
  d.classList.add("on");
  document.body.style.overflow="hidden";

  if(!item.sinopse){
    buscarSinopse(nome,serie).then(txt=>{
      const el=$("#dSyn");
      if(el&&txt){el.textContent=txt;item.sinopse=txt}
    });
  }

  $("#dClose").onclick=fecharDetalhe;

  const chaveFav=serie?nome:(item.item&&item.item.u)||"";
  const marcarFav=()=>{
    const el=$("#dFav");
    if(el)el.textContent=fav.has(chaveFav)?"♥ Favorito":"♡ Favorito";
  };
  marcarFav();
  $("#dFav").onclick=()=>{
    if(!chaveFav)return;
    if(fav.has(chaveFav))fav.delete(chaveFav);else fav.add(chaveFav);
    sv("gz_fav",[...fav]);
    marcarFav();
    toast(fav.has(chaveFav)?"Adicionado aos favoritos":"Removido dos favoritos");
  };
  $("#dMulti").onclick=()=>{
    if(serie){toast("Multi-tela disponível para canais ao vivo");return}
    if(item.item&&item.item.t==="live"){closeMulti();multiOpen([item.item]);fecharDetalhe()}
    else toast("Multi-tela disponível para canais ao vivo");
  };

  if(serie){
    const s=item.serie;
    const liberar=async()=>{
      let eps=s&&s.eps?s.eps:(s?await carregarEps(s):[]);
      if(detailAtual!==item)return;
      if(!eps.length){
        $("#dEps").innerHTML='<div style="color:var(--mut);padding:14px 4px">Nenhum episódio encontrado para esta série.</div>';
        return;
      }
      const contagem=$("#dEpsCount");
      if(contagem)contagem.textContent=eps.length+" episódio"+(eps.length>1?"s":"");
      const temporadas=[...new Set(eps.map(e=>e.sn||1))].sort((a,b)=>a-b);
      const sel=$("#dSeason");
      sel.innerHTML=temporadas.map(t=>`<option value="${t}">Temporada ${t}</option>`).join("");
      const renderT=(t)=>{
        $("#dEps").innerHTML=eps.filter(e=>(e.sn||1)===t)
          .sort((a,b)=>(a.en||0)-(b.en||0))
          .map(e=>`<div class="ep" tabindex="0" data-url="${esc(e.u||e.url)}"><span class="num">${esc(e.et||("E"+e.en))}</span><span class="nm">${esc(nomeEpisodio(e,nome))}</span><span class="go">▶</span></div>`).join("");
      };
      sel.onchange=()=>renderT(+sel.value);
      renderT(temporadas[0]);
      $("#dEps").onclick=e=>{
        const ep=e.target.closest(".ep");if(!ep)return;
        const it=eps.find(x=>(x.u||x.url)===ep.dataset.url);
        if(it){fecharDetalhe();play(it)}
      };
      // O player começa no primeiro episódio; se os episódios chegaram depois
      // do clique, usa o que acabou de ser carregado.
      $("#dPlay").onclick=()=>{fecharDetalhe();play(eps[0])};
      $("#dPlay").dataset.pronto="1";
    };
    if(s&&s.eps)liberar();
    else liberar().catch(()=>{
      const box=$("#dEps");
      if(box)box.innerHTML='<div style="color:var(--mut);padding:14px 4px">Não foi possível abrir os episódios desta série.</div>';
    });
  }else{
    $("#dPlay").onclick=()=>{
      const it=item.item;
      if(it){fecharDetalhe();play(it)}
    };
  }
}
function nomeEpisodio(e,serieNome){
  const codigo=esc(e.et||("E"+e.en));
  let t=String(e.n||"");
  if(serieNome&&t.toLowerCase().startsWith(serieNome.toLowerCase()))t=t.slice(serieNome.length);
  t=t.replace(/S\d{1,2}\s*E\d{1,3}/gi,"")
    .replace(/^[\s\-–—:|.]+/,"")
    .replace(/[\s\-–—:|.]+$/,"")
    .trim();
  return t||("Episódio "+(e.en||codigo));
}
function fecharDetalhe(){
  $("#detail").classList.remove("on");
  $("#detail").innerHTML="";
  document.body.style.overflow="";
  detailAtual=null;
}
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#detail").classList.contains("on")){fecharDetalhe();e.preventDefault()}
});

/* ---------------- Sinopses ----------------
   As playlists trazem título e capa, mas não sinopse.
   Fonte 1: TMDB (melhor cobertura) — precisa da chave nas configurações.
   Fonte 2: Wikipédia (sem chave) — só aceita quando o título bate exatamente,
            para não mostrar sinopse de outra obra.
   Resultados ficam em cache no IndexedDB. */
const sinopseCache=new Map();

function limparTitulo(nome){
  return nome
    .replace(/\[[^\]]*\]/g,"")
    .replace(/\((?:19|20)\d{2}\)/g,"")
    .replace(/\b(4K|UHD|FHD|HD|SD|2160p|1080p|720p|480p|LEG|DUB|Dublado|Legendado)\b/gi,"")
    .replace(/\s*[-–—]\s*$/,"")
    .replace(/\s+/g," ")
    .trim();
}
async function buscarSinopse(nome,tipoSerie){
  const chave=(tipoSerie?"tv:":"mv:")+nome.toLowerCase();
  if(sinopseCache.has(chave))return sinopseCache.get(chave);
  try{
    const cache=await cacheGet(chave);
    if(cache!==null&&cache!==undefined){sinopseCache.set(chave,cache);return cache}
  }catch(e){}

  const titulo=limparTitulo(nome);
  if(!titulo)return null;

  let txt=null;
  try{
    if(settings.tmdbKey)txt=await sinopseTMDB(titulo,tipoSerie,settings.tmdbKey);
  }catch(e){}
  if(!txt&&!settings.tmdbKey){
    try{txt=await sinopseWiki(titulo,tipoSerie)}catch(e){}
  }
  sinopseCache.set(chave,txt);
  try{await cacheSet(chave,txt)}catch(e){}
  return txt;
}
async function sinopseTMDB(titulo,tipoSerie,chave){
  const base="https://api.themoviedb.org/3";
  const tipo=tipoSerie?"tv":"movie";
  const u=`${base}/search/${tipo}?api_key=${encodeURIComponent(chave)}&language=pt-BR&query=${encodeURIComponent(titulo)}`;
  const r=await fetch(u);
  if(!r.ok)throw new Error("TMDB "+r.status);
  const j=await r.json();
  const hit=(j.results||[])[0];
  if(!hit||!hit.overview)return null;
  return hit.overview.trim()||null;
}
async function sinopseWiki(titulo,tipoSerie){
  const norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"");
  const alvo=norm(titulo);
  const u="https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch="+encodeURIComponent(titulo+" "+(tipoSerie?"série":"filme"));
  const r=await fetch(u);
  if(!r.ok)return null;
  const j=await r.json();
  const hits=((j.query||{}).search)||[];
  const match=hits.find(h=>{
    const t=norm(h.title);
    return t===alvo||t===norm(titulo+" filme")||t===norm(titulo+" serie")||t===norm(titulo+" série");
  });
  if(!match)return null;
  const r2=await fetch("https://pt.wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(match.title.replace(/ /g,"_")));
  if(!r2.ok)return null;
  const s=await r2.json();
  if(s.type==="disambiguation")return null;
  const ex=(s.extract||"").trim();
  if(ex.length<80)return null;
  return ex;
}
