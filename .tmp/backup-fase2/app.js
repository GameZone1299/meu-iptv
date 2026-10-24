/* ==========================================================
   Game Zone IPTV — núcleo do aplicativo
   ========================================================== */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const arr=v=>Array.isArray(v)?v:(v?[v]:[]);
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const LIM=180;

/* ---------- Estado ---------- */
let settings={
  bufferSize:30,defaultVolume:100,controlsTimeout:5,lowLatency:false,autoReconnect:true,reconnectInterval:12,
  hwAccel:true,showPreview:false,showChannelNum:false,showEpg:true,showAdult:false,autoRefresh:false,
  agruparVersoes:false,modoLeve:false,
  rememberPosition:true,pip:false,audioLang:"",subtitleLang:"",
  timeout:15,userAgent:"",referer:"",headers:"",useProxy:false,proxyUrl:"",
  epgUrls:[],epgAutoUpdate:true,epgUpdateInterval:12,epgDays:3,epgShowPast:false,tmdbKey:"",
  parentalControl:false,parentalPin:"",hideAdult:true,catchup:false,catchupDays:24,ia:false
};
function carregarSettings(){
  try{const s=JSON.parse(localStorage.getItem("gz_settings")||"{}");Object.assign(settings,s)}catch(e){}
  try{const old=JSON.parse(localStorage.getItem("iptv_settings")||"{}");Object.assign(settings,old)}catch(e){}
  try{const old=JSON.parse(localStorage.getItem("iptv_epgdata")||"null");if(old&&old.byId)localStorage.setItem("gz_epgdata",JSON.stringify(old))}catch(e){}
}
carregarSettings();

let fav=new Set(),recent=[],viewStats={},view=[],sideCats=[],scr="home",cat={},limit=LIM;
let hls=null,ts=null,errs=[];
let sortBy="name-asc",filterQuality="",advFilter={};
let listaUrls=[];
try{fav=new Set(JSON.parse(localStorage.getItem("gz_fav")||localStorage.getItem("iptv_fav")||"[]"))}catch(e){}
try{recent=JSON.parse(localStorage.getItem("gz_recent")||localStorage.getItem("iptv_recent")||"[]")}catch(e){}
try{viewStats=JSON.parse(localStorage.getItem("gz_stats")||localStorage.getItem("iptv_stats")||"{}")}catch(e){}
try{listaUrls=arr(JSON.parse(localStorage.getItem("gz_urls")||"[]"))}catch(e){}

const T={movies:"Filmes",series:"Séries",live:"TV ao Vivo",favs:"Favoritos",recent:"Recentes",search:"Busca",adult:"Adulto"};

/* ---------- Utilidades ---------- */
function formatTime(s){
  if(!isFinite(s))return"0:00";
  s=Math.max(0,Math.floor(s));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`;
}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
function extractYear(name){const m=String(name||"").match(/\b(19\d{2}|20[0-3]\d)\b/);return m?parseInt(m[1]):null}
function detectQuality(name){
  const n=String(name||"").toUpperCase();
  if(/\b(4K|UHD|2160P)\b/.test(n))return["4K"];
  if(/\b(FHD|1080P)\b/.test(n))return["FHD","HD"];
  if(/\b(HD|720P)\b/.test(n))return["HD"];
  if(/\b(SD|480P|360P)\b/.test(n))return["SD"];
  return[];
}
const limparTituloBase=n=>String(n)
  .replace(/\[[^\]]*\]/g,"")
  .replace(/\((?:19|20)\d{2}\)/g,"")
  .replace(/\b(4K|UHD|FHD|HD|SD|2160p|1080p|720p|480p|LEG|DUB|Dublado|Legendado)\b/gi,"")
  .replace(/\s*[-–—]\s*$/,"").replace(/\s+/g," ").trim();

let toastTimer=null;
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("on");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("on"),2600);
}

/* ---------- Detecção do aparelho ---------- */
/* Celular/TV box: menos animação, menos blur e menos cards por tela.
   O mesmo CSS serve para todos, mas o aparelho fraco não precisa sofrer. */
const ehAndroid=!!window.Capacitor||/Android/i.test(navigator.userAgent||"");
const ehTV=/TV|BRAVIA|AFT|GoogleTV/i.test(navigator.userAgent||"")||(ehAndroid&&!("ontouchstart"in window));
if(ehAndroid)document.documentElement.classList.add("android");
if(ehTV)document.documentElement.classList.add("tv");
const LIMITE_TELA=(ehAndroid||ehTV)?120:LIM;
/* Modo leve liga sozinho em TV box e celular antigo: são os aparelhos que
   engasgam com animação e blur. O usuário pode desligar nas configurações. */
function detectarModoLeve(){
  if(settings.modoLeve===true)return true;
  if(settings.modoLeve===false)return false;
  const mem=navigator.deviceMemory||4;
  const nucleos=navigator.hardwareConcurrency||4;
  return (ehTV||ehAndroid)&&(mem<=2||nucleos<=4);
}
if(detectarModoLeve())document.documentElement.classList.add("modo-leve");

/* ---------- Home ---------- */
const SL=[
  {ico:"🍿 Filmes",t:"Filmes em destaque",d:"Milhares de títulos para maratonar hoje.",s:"movies"},
  {ico:"📺 Séries",t:"Séries completas",d:"Todas as temporadas, todos os episódios.",s:"series"},
  {ico:"📡 Ao vivo",t:"TV ao vivo",d:"Canais de esportes, notícias e entretenimento.",s:"live"}
];
let si=0,stm=null;
function tick(){
  const d=new Date();
  $("#clk").textContent=d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  const p=Object.fromEntries(new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).formatToParts(d).map(x=>[x.type,x.value]));
  $("#dt").textContent=cap(p.weekday)+", "+p.day+" de "+cap(p.month);
}
function showSlide(n){
  si=n;const s=SL[n];
  $("#hIco").textContent=s.ico;$("#hT").textContent=s.t;$("#hD").textContent=s.d;
  $("#dots").innerHTML=SL.map((_,i)=>`<i class="${i===n?"on":""}"></i>`).join("");
  const lista=n===1?Lib.series:Lib.movies;
  const bg=lista.find(x=>x.logo||x.l);
  const url=bg?(bg.logo||bg.l):"";
  $("#heroBg").style.backgroundImage=url?`url('${url}')`:"";
}
function startSlides(){clearInterval(stm);stm=setInterval(()=>{if(scr==="home"&&!document.hidden)showSlide((si+1)%SL.length)},8000)}

/* ---------- Capas ----------
   Cada card pedia a capa em w600 (300-600 KB). Numa TV box com internet de
   10 Mbps, 60 cards ao mesmo tempo levavam 15 s para aparecer e o WebView
   travava. Aqui a mesma capa é pedida no tamanho em que vai ser exibida e o
   número de downloads simultâneos fica limitado. */
const CAPA_RE=/\/(t\/p\/)(w\d+|original)(_and_h\d+_bestv2)?\//;
function capaMenor(url,largura){
  const u=String(url||"");
  if(!CAPA_RE.test(u))return u;
  return u.replace(CAPA_RE,"/t/p/w"+(largura||342)+"/");
}
/* O navegador só baixa a capa quando o card chega perto da tela
   (loading="lazy"), então não é preciso controlar a fila na mão. */
const observarCapas=()=>{};

function cardHTML(o){
  const capa=capaMenor(o.logo,342);
  return `<div class="card" tabindex="0" data-tipo="${o.tipo}" data-key="${esc(o.key)}">
    <img class="poster" loading="lazy" decoding="async" src="${esc(capa)}" alt="" onerror="this.style.visibility='hidden'">
    ${o.badge?`<span class="badge">${esc(o.badge)}</span>`:""}
    ${o.prog?`<div class="prog"><i style="width:${o.prog}%"></i></div>`:""}
    <div class="play"><span>▶</span></div>
    <div class="meta"><b>${esc(o.nome)}</b>${o.sub?`<small>${esc(o.sub)}</small>`:""}</div>
  </div>`;
}
function movieCard(m){
  const q=detectQuality(m.n);
  return cardHTML({tipo:"filme",nome:m.n,logo:m.l,key:m.u,sub:[m.g,q[0]].filter(Boolean).join(" · "),badge:q[0]||""});
}
function serieCard(s){
  const n=s.epQtd||(s.eps?s.eps.length:0);
  return cardHTML({tipo:"serie",nome:s.nome,logo:s.logo,key:s.nome,sub:`${n} episódio${n===1?"":"s"}`,badge:n>1?`${n} eps`:""});
}
function liveCard(c){
  return cardHTML({tipo:"canal",nome:c.n,logo:c.l,key:c.u,sub:c.g});
}
/* A capa é a maior fonte de tráfego e de travamento: com 180 cards o
   WebView abre 180 conexões. Mostramos poucos por vez e deixamos o
   navegador decodificar só o que está na tela. */
const MAX_CARDS=60;

function atualizarHome(){
  const s=libStats();
  const n=v=>v.toLocaleString("pt-BR");
  $("#nmovies").textContent=s.movies?`${n(s.movies)} filmes`:"Adicione uma playlist";
  $("#nseries").textContent=s.series?`${n(s.series)} séries · ${n(s.episodes)} episódios`:"Adicione uma playlist";
  $("#nlive").textContent=s.live?`${n(s.live)} canais`:"Adicione uma playlist";
  $("#nfav").textContent="("+fav.size+")";

  $("#railMovies").innerHTML=Lib.movies.slice(0,16).map(movieCard).join("")||'<span style="color:var(--mut);font-size:14px">Nenhum filme carregado.</span>';
  $("#railSeries").innerHTML=Lib.series.slice(0,16).map(serieCard).join("")||'<span style="color:var(--mut);font-size:14px">Nenhuma série carregada.</span>';
  $("#railLive").innerHTML=Lib.live.slice(0,16).map(liveCard).join("")||'<span style="color:var(--mut);font-size:14px">Nenhum canal carregado.</span>';
  const rc=recent.slice(0,12);
  $("#recent").innerHTML=rc.map(it=>cardHTML({tipo:it.t==="series"?"serie":"canal",nome:it.name||limparTituloBase(it.n||""),logo:it.logo||it.l||"",key:it.url||it.u,sub:T[it.t]||""})).join("")||'<span style="color:var(--mut);font-size:14px">Nada assistido ainda.</span>';
  renderCont();
  showSlide(si);
  observarCapas($("#home"));
  atualizarStorage();
}
async function atualizarStorage(){
  try{
    if(navigator.storage&&navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      const mb=v=>((v||0)/1048576).toFixed(1);
      const el=$("#storageInfo");
      if(el)el.textContent=`Armazenamento usado: ${mb(e.usage)} MB de ${mb(e.quota)} MB disponíveis.`;
    }
  }catch(e){}
}

function renderCont(){
  const pos=getPositions();
  let durs={};try{durs=JSON.parse(localStorage.getItem("gz_durs")||"{}")}catch(e){}
  const items=Object.keys(pos).map(u=>{
    const f=Lib.byUrl.get(u)||recent.find(r=>(r.url||r.u)===u);
    if(!f)return null;
    const nome=f.n||f.name||limparTituloBase(f.nome||"");
    return{nome,logo:f.l||f.logo||"",u,pos:pos[u],dur:durs[u]||0};
  }).filter(Boolean).sort((a,b)=>b.pos-a.pos).slice(0,12);
  const head=$("#contHead");
  if(!items.length){head.classList.add("hide");$("#cont").innerHTML="";return}
  head.classList.remove("hide");
  $("#cont").innerHTML=items.map(x=>{
    const pct=x.dur?Math.min(100,(x.pos/x.dur)*100):0;
    return cardHTML({tipo:"filme",nome:x.nome,logo:x.logo,key:x.u,sub:formatTime(x.pos)+(x.dur?" de "+formatTime(x.dur):""),prog:pct});
  }).join("");
}
function getPositions(){try{return JSON.parse(localStorage.getItem("gz_positions")||localStorage.getItem("iptv_positions")||"{}")}catch(e){return{}}}

/* ---------- Navegação ---------- */
function goto(s){
  if(s==="adult"){
    if(!settings.showAdult||settings.hideAdult){toast("Categoria adulta desativada nas configurações.");return}
    if(!pedirPin())return;
  }
  // Voltar para a tela inicial encerra o que estava tocando. Antes o vídeo
  // continuava rodando (e consumindo rede e decodificador) por trás.
  if(s==="home"&&$("#cols").classList.contains("tocando"))sairDoPlayer();

  scr=s;
  // Ao trocar de seção a busca é limpa: manter o texto dava a impressão de
  // que a categoria nova estava vazia (o filtro continuava valendo).
  if(s!=="search"&&$("#q")&&$("#q").value){$("#q").value=""}
  $("#home").classList.toggle("hide",s!=="home");
  $("#sec").classList.toggle("hide",s==="home");
  if(s==="home"){atualizarHome();return}
  $$(".pill").forEach(b=>b.classList.toggle("on",b.dataset.s===s));
  limit=LIMITE_TELA;renderSide();renderList();
}
function baseList(s){
  if(s==="favs"){
    const out=[];
    for(const m of Lib.movies)if(fav.has(m.u))out.push(m);
    for(const l of Lib.live)if(fav.has(l.u))out.push(l);
    for(const sr of Lib.series)if(fav.has(sr.nome)||(sr.eps&&sr.eps.some(e=>fav.has(e.u))))out.push(sr);
    return out;
  }
  if(s==="recent")return recent;
  if(s==="search")return libTodos();
  if(s==="series")return Lib.series;
  if(s==="movies")return Lib.movies;
  if(s==="live")return Lib.live;
  if(s==="adult")return Lib.adult;
  return[];
}
function itemNome(i){return i.nome!==undefined?i.nome:(i.n||i.name||"")}
function itemGrupo(i){return i.grupo!==undefined?i.grupo:(i.g||i.group||"")}
function itemChaveGrupo(i){return i.gk||chaveGrupo(itemGrupo(i))}

/* PIN do controle parental */
let pinLiberado=false;
function pedirPin(){
  if(!settings.parentalControl||!settings.parentalPin)return true;
  if(pinLiberado)return true;
  const pin=prompt("Digite o PIN do controle parental:");
  if(pin===settings.parentalPin){pinLiberado=true;return true}
  toast("PIN incorreto.");
  return false;
}
function aplicarPreferenciasAdulto(){
  const pill=$("#pillAdult");
  if(!pill)return;
  const pode=settings.showAdult&&!settings.hideAdult;
  pill.style.display=pode?"":"none";
}

/* ---------- Categorias ---------- */
/* A barra lateral mostra todas as categorias da seção, da maior para a menor.
   As duas listas traziam o mesmo grupo escrito de formas diferentes; agora
   elas aparecem juntas, com o total somado. */
function renderSide(){
  const secao=scr==="favs"||scr==="recent"||scr==="search"?null:scr;
  let cats=[];
  if(secao){
    cats=gruposDe(secao).map(g=>[g.chave,g.rotulo,g.total]);
  }else{
    const m=new Map();
    for(const i of baseList(secao||scr)){
      const k=itemChaveGrupo(i),r=itemGrupo(i)||"Sem categoria";
      m.set(k,[r,(m.get(k)?m.get(k)[1]:0)+1]);
    }
    cats=[...m].map(([k,v])=>[k,v[0],v[1]]).sort((a,b)=>b[2]-a[2]);
  }
  sideCats=["",...cats.map(c=>c[0])];
  const atual=cat[scr]||"";
  const linha=(chave,rotulo,total)=>`<div class="sc${chave===atual?" on":""}" tabindex="0" data-g="${esc(chave)}"><span>${esc(rotulo)}</span><em>${total.toLocaleString("pt-BR")}</em></div>`;
  const todas=baseList(secao||scr).length;
  $("#side").innerHTML=linha("","⭐ Todas",todas)+cats.map(([k,r,t])=>linha(k,r,t)).join("");
  const barra=$("#catbar");
  if(barra)barra.innerHTML=linha("","Todas",todas)+cats.map(([k,r,t])=>linha(k,r,t)).join("");
  $("#side").classList.toggle("hide",scr==="recent"||scr==="search");
}

/* ---------- Lista ---------- */
/* Ordena uma vez por item, não dentro do comparador (com 50 mil filmes o
   comparador antigo era refeito centenas de milhares de vezes). */
function chaveOrdem(i){
  if(i._ordem!==undefined)return i._ordem;
  const nome=itemNome(i);
  i._ordem={
    nome:semAcento(nome).toLowerCase(),
    ano:extractYear(nome)||0,
    q:(detectQuality(nome)||[])[0]||"",
    grupo:semAcento(itemGrupo(i)).toLowerCase()
  };
  return i._ordem;
}
const recIdx=(()=>{
  const m=new Map();
  return()=>{
    if(m.size)return m;
    recent.forEach((r,i)=>{const k=r.url||r.u;if(k)m.set(k,i)});
    return m;
  };
})();

function passaFiltros(i,q,tokens){
  const c=cat[scr]||"";
  if(c&&itemChaveGrupo(i)!==c)return false;
  const nome=itemNome(i);
  if(tokens.length){
    let idx=i._q!==undefined?i._q:prepararBusca(i);
    for(const t of tokens)if(idx.indexOf(t)<0)return false;
  }
  if(advFilter.genre&&semAcento(itemGrupo(i)).toLowerCase().indexOf(advFilter.genre)<0)return false;
  if(advFilter.quality||filterQuality){
    const qq=(chaveOrdem(i).q||"");
    if(advFilter.quality&&qq!==advFilter.quality)return false;
    if(filterQuality&&qq!==filterQuality)return false;
  }
  if(advFilter.yearFrom||advFilter.yearTo){
    const y=chaveOrdem(i).ano;
    if(!y)return false;
    if(advFilter.yearFrom&&y<advFilter.yearFrom)return false;
    if(advFilter.yearTo&&y>advFilter.yearTo)return false;
  }
  return true;
}

function renderList(){
  const termo=$("#q").value.trim();
  const tokens=chaveBusca(termo).split(" ").filter(Boolean);
  const base=baseList(scr);
  const f=[];
  for(const i of base)if(passaFiltros(i,termo,tokens))f.push(i);

  const chaveNome=i=>chaveOrdem(i).nome;
  if(sortBy==="name-asc")f.sort((a,b)=>chaveNome(a)<chaveNome(b)?-1:chaveNome(a)>chaveNome(b)?1:0);
  else if(sortBy==="name-desc")f.sort((a,b)=>chaveNome(b)<chaveNome(a)?-1:chaveNome(b)>chaveNome(a)?1:0);
  else if(sortBy==="date-desc")f.sort((a,b)=>chaveOrdem(b).ano-chaveOrdem(a).ano);
  else if(sortBy==="date-asc")f.sort((a,b)=>chaveOrdem(a).ano-chaveOrdem(b).ano);
  else if(sortBy==="recent"){const r=recIdx();f.sort((a,b)=>(r.get(a.u)??9999)-(r.get(b.u)??9999))}
  else if(sortBy==="views")f.sort((a,b)=>(viewStats[b.u]||0)-(viewStats[a.u]||0));

  // Nunca desenhamos milhares de cards de uma vez: o WebView engasga.
  const mostrar=Math.min(limit,MAX_CARDS);
  view=f.slice(0,mostrar);
  const cards=view.map(i=>{
    if(i.tipo==="serie"||i.epQtd!==undefined)return serieCard(i);
    if(scr==="live"||scr==="adult"||(i.u&&/\.ts(\?|$)/i.test(i.u)))return liveCard(i);
    if(scr==="recent")return cardHTML({tipo:i.t==="live"?"canal":"filme",nome:i.name||i.n||"",logo:i.logo||i.l||"",key:i.url||i.u,sub:T[i.t]||""});
    return movieCard(i);
  }).join("");

  const restantes=f.length-mostrar;
  let rodape="";
  if(restantes>0){
    rodape=`<button id="more" style="width:100%;margin-top:16px">Mostrar mais (${restantes.toLocaleString("pt-BR")} restantes)</button>`;
  }
  $("#list").innerHTML=`<div class="grid">${cards}</div>`+rodape
    +(f.length?"":`<div style="padding:34px;color:var(--mut);text-align:center">${["favs","recent","search"].includes(scr)?"Nada encontrado.":"Esta categoria está vazia."}</div>`);
  // Aviso de quantos resultados existem ajuda a saber que o filtro funcionou
  observarCapas($("#list"));
  const info=$("#listInfo");
  if(info)info.textContent=(termo||cat[scr])?`${f.length.toLocaleString("pt-BR")} resultado${f.length===1?"":"s"}`:"";
}

/* ---------- Reprodução ---------- */
function cleanup(){
  if(hls){try{hls.destroy()}catch(e){}hls=null}
  if(ts){try{ts.destroy()}catch(e){}ts=null}
  clearInterval(window._wd);
  clearTimeout(window._reconexao);
  clearInterval(window._posInterval);
  // Player nativo: libera o decodificador na hora. Sem isso o vídeo
  // continuava tocando por trás depois de sair da tela.
  if(typeof PN!=="undefined"&&PN.ativo)PN.fechar();
  const v=$("#v");
  try{v.pause()}catch(e){}
  v.removeAttribute("src");
  try{v.load()}catch(e){}
}
function sairDoPlayer(){
  cleanup();
  if(typeof PN!=="undefined"){PN.ativo=false;PN.item=null;PN.tocando=false}
  document.documentElement.classList.remove("modo-nativo");
  const ph=$("#ph");ph.classList.remove("hide");
  ph.textContent="Transmissão encerrada.\nSelecione outro título para assistir.";
  $("#cols").classList.remove("tocando");
  $("#pvbox").classList.remove("isLive","full");
  document.body.classList.remove("player-full");
  $("#ctrlLive").classList.remove("on");
  $("#pvt").textContent="";$("#pvh").textContent="";
  $("#controls").classList.remove("show");
  $("#progressFill").style.width="0";
  $("#progressThumb").style.left="0";
  $("#progressBuf").style.width="0";
  if(document.body.classList.contains("cinema"))toggleCinema(false);
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  closeMulti();
}

/* Configuração do player por tipo de transmissão.
   Canais .ts (a grande maioria): o mpegts.js precisa limpar o buffer antigo,
   senão o SourceBuffer cresce sem parar, o decodificador do celular/TV box
   perde o ritmo e o vídeo repete o trecho já visto. */
function configTs(live){
  const leve=!!settings.modoLeve;
  return{
    enableWorker:!leve,
    lazyLoad:live,
    stashInitialSize:live?384:Math.max(64,settings.bufferSize)*64,
    liveBufferLatencyChasing:live,
    liveBufferLatencyMaxLatency:live?2.5:5,
    liveBufferLatencyMinRemain:0.7,
    autoCleanupSourceBuffer:true,
    autoCleanupMaxBackwardDuration:20,
    autoCleanupMinBackwardDuration:8,
    fixAudioTimestampGap:true,
    enableStuckEvent:true,
    seekType:"range"
  };
}
function configHls(live){
  const leve=!!settings.modoLeve;
  return{
    enableWorker:!leve,
    lowLatencyMode:!!settings.lowLatency,
    // Em TV 720p/1080p não adianta baixar 4K: só trava a decodificação
    capLevelToPlayerSize:true,
    capLevelOnFPSDrop:true,
    backBufferLength:live?20:settings.bufferSize,
    maxBufferLength:live?20:settings.bufferSize,
    maxMaxBufferLength:live?40:settings.bufferSize*2,
    manifestLoadingTimeOut:settings.timeout*1000,
    levelLoadingTimeOut:settings.timeout*1000,
    fragLoadingTimeOut:settings.timeout*1000,
    startLevel:-1,
    abrEwmaDefaultEstimate:settings.modoLeve?500000:1000000,
    liveSyncDurationCount:3,
    liveMaxLatencyDurationCount:10
  };
}

async function play(it){
  if(!it)return;
  const v=$("#v");
  const url=it.u||it.url;
  if(!url)return;
  const live=it.t==="live"||/\.ts(\?|$)/i.test(url);

  $("#ph").classList.add("hide");
  $("#cols").classList.add("tocando");
  $("#pvt").textContent=it.n||it.name||"";
  $("#pvh").textContent=it.g||it.group||"";
  $("#pvbox").classList.toggle("isLive",live);
  $("#ctrlLive").classList.toggle("on",live);
  $("#progressFill").style.width="0";$("#progressThumb").style.left="0";$("#progressBuf").style.width="0";
  $("#qualitySelect").innerHTML='<option value="auto">Auto</option>';
  $("#qualitySelect").disabled=true;
  v.volume=(settings.defaultVolume??100)/100;

  cleanup();

  let savedPos=0;
  if(settings.rememberPosition&&!live){
    const pos=getPositions();
    if(pos[url])savedPos=pos[url];
  }

  // Android: vídeo no player nativo (decodificação por hardware). Se o
  // aparelho não aceitar, cai no mpegts.js/hls.js logo abaixo.
  if(typeof PN!=="undefined"&&PN.ok){
    const nativo=await PN.abrir(it,url,live);
    if(nativo){
      if(savedPos>0)PN.buscar(savedPos);
      if(live&&settings.autoReconnect)vigiarAoVivo(it,url);
      if(settings.rememberPosition&&!live)salvarPosicao(it,url);
      viewStats[url]=(viewStats[url]||0)+1;sv("gz_stats",viewStats);
      const resumo={url,name:it.n||it.name,logo:it.l||it.logo,group:it.g||it.group,t:live?"live":(it.t||"movies")};
      recent=[resumo,...recent.filter(r=>(r.url||r.u)!==url)].slice(0,40);
      sv("gz_recent",recent);
      return;
    }
  }

  const isTs=/\.ts(\?|$)/i.test(url),isFile=/\.(mp4|mkv|webm|ogv|mov|m4v|mp3|aac)(\?|$)/i.test(url),isHls=/\.m3u8(\?|$)/i.test(url);

  if(isTs&&window.mpegts&&mpegts.getFeatureList().mseLivePlayback){
    ts=mpegts.createPlayer({type:"mpegts",isLive:true,url},configTs(live));
    ts.attachMediaElement(v);
    ts.on(mpegts.Events.ERROR,(t,d,i)=>{
      // Erros de rede num canal ao vivo são normais: reconecta sozinho
      if(live&&settings.autoReconnect){
        reconectar(it,url);
      }else mostrarErro(t+" / "+d,i);
    });
    ts.load();
  }else if((isHls||(!isFile&&!isTs))&&window.Hls&&Hls.isSupported()){
    const cfg=configHls(live);
    if(settings.userAgent||settings.referer||settings.headers){
      cfg.xhrSetup=xhr=>{
        if(settings.userAgent)xhr.setRequestHeader("User-Agent",settings.userAgent);
        if(settings.referer)xhr.setRequestHeader("Referer",settings.referer);
        if(settings.headers)settings.headers.split("\n").forEach(h=>{const[k,val]=h.split(":");if(k&&val)xhr.setRequestHeader(k.trim(),val.trim())});
      };
    }
    hls=new Hls(cfg);
    hls.loadSource(url);hls.attachMedia(v);
    hls.on(Hls.Events.MANIFEST_PARSED,(_,d)=>{
      const lv=(d.levels||[]).filter(l=>l.height>0).sort((a,b)=>b.height-a.height);
      if(lv.length<2)return;
      const sel=$("#qualitySelect");
      sel.innerHTML='<option value="auto">Auto</option>'+lv.map(l=>`<option value="${l.height}">${l.height>=2160?"4K":l.height+"p"}</option>`).join("");
      sel.disabled=false;
      sel.onchange=()=>{
        if(!hls)return;
        if(sel.value==="auto")hls.currentLevel=-1;
        else{const i=hls.levels.findIndex(l=>l.height===parseInt(sel.value));if(i>=0)hls.currentLevel=i}
      };
    });
    hls.on(Hls.Events.ERROR,(_,d)=>{
      if(!d.fatal)return;
      if(live&&settings.autoReconnect){reconectar(it,url);return}
      const det="HLS "+d.details+(d.response&&d.response.code?" / "+d.response.code:"");
      try{hls.destroy()}catch(e){}
      hls=null;
      v.src=url;v.play().catch(()=>{});
      v.onerror=()=>mostrarErro(det);
    });
  }else{
    v.src=url;
  }

  try{
    const aplicarTracks=()=>{
      if(settings.audioLang){
        const tracks=v.audioTracks;
        if(tracks&&tracks.length){
          for(let i=0;i<tracks.length;i++)tracks[i].enabled=(tracks[i].language||"").startsWith(settings.audioLang);
        }
      }
    };
    v.addEventListener("loadedmetadata",aplicarTracks,{once:true});
  }catch(e){}

  v.play().catch(()=>{});

  if(savedPos>0){
    v.addEventListener("loadedmetadata",()=>{v.currentTime=savedPos},{once:true});
  }

  if(settings.autoReconnect&&live)vigiarAoVivo(it,url);
  if(settings.rememberPosition&&!live)salvarPosicao(it,url);

  viewStats[url]=(viewStats[url]||0)+1;sv("gz_stats",viewStats);
  const resumo={url,name:it.n||it.name,logo:it.l||it.logo,group:it.g||it.group,t:live?"live":(it.t||"movies")};
  recent=[resumo,...recent.filter(r=>(r.url||r.u)!==url)].slice(0,40);
  sv("gz_recent",recent);
}

/* Vigia do canal ao vivo. Dois sintomas diferentes:
   - tempo congelado por muitos segundos  -> travou
   - o vídeo "volta" e repete              -> buffer com atraso crescente
   Nos dois casos a solução é recarregar a transmissão, com espera crescente
   para não martelar um servidor que já está ruim. */
let tentativasReconexao=0;
function vigiarAoVivo(it,url){
  clearInterval(window._wd);
  // No player nativo quem cuida do buffer é o ExoPlayer; aqui só vigiamos
  // travamento total (tempo parado), que é o caso em que vale reconectar.
  const nativo=typeof PN!=="undefined"&&PN.ativo;
  let ultimo=nativo?PN.pos:0,parado=0,ultimoNativo=PN.pos;
  window._wd=setInterval(()=>{
    if(document.hidden)return;
    const v=$("#v");

    if(nativo){
      if(!PN.ativo)return;
      if(Math.abs(PN.pos-ultimoNativo)<0.15&&PN.tocando){parado++}else{parado=0}
      ultimoNativo=PN.pos;
      if(parado>=Math.ceil(settings.reconnectInterval/1.5)){clearInterval(window._wd);reconectar(it,url)}
      return;
    }

    if(v.paused||!v.src&&!ts&&!hls)return;
    if(Math.abs(v.currentTime-ultimo)<0.25){
      parado++;
      if(parado>=Math.ceil(settings.reconnectInterval/1.5)){clearInterval(window._wd);reconectar(it,url)}
    }else{
      parado=0;ultimo=v.currentTime;
      // Atraso grande em relação ao "ao vivo": volta para perto do presente
      const b=v.buffered;
      if(b&&b.length){
        const fim=b.end(b.length-1);
        if(fim-v.currentTime>6){
          try{v.currentTime=fim-1}catch(e){}
        }
      }
    }
  },1500);
}
function reconectar(it,url){
  clearInterval(window._wd);
  clearTimeout(window._reconexao);
  const espera=Math.min(15000,1500*Math.pow(1.6,tentativasReconexao++));
  $("#ph").classList.remove("hide");
  $("#ph").textContent="Reconectando ao canal…";
  window._reconexao=setTimeout(async()=>{
    try{await play(it)}catch(e){}
  },espera);
}
function salvarPosicao(it,url){
  const v=$("#v");
  clearInterval(window._posInterval);
  const guardar=()=>{
    const pos=tempoAtual(),dur=duracaoAtual();
    if(pos>10&&dur-pos>15){
      const p=getPositions();
      p[url]=pos;
      let durs={};try{durs=JSON.parse(localStorage.getItem("gz_durs")||"{}")}catch(e){}
      durs[url]=dur||0;
      sv("gz_positions",p);sv("gz_durs",durs);
    }
  };
  window._posInterval=setInterval(guardar,8000);
  v.onended=()=>{
    clearInterval(window._posInterval);
    const p=getPositions();delete p[url];sv("gz_positions",p);
  };
}
function mostrarErro(det,code){
  const ph=$("#ph");
  ph.classList.remove("hide");
  let why="o servidor bloqueou o acesso ou o link expirou";
  const d=String(det||"");
  if(/403|401|forbidden/i.test(d))why="o servidor recusou o acesso (login, limite de conexões ou bloqueio)";
  else if(/404|410/.test(d))why="este canal não existe mais no servidor";
  else if(/Network|Timeout|Connect|network/i.test(d))why="falha de rede ou bloqueio do servidor";
  else if(/Codec|Media|Format|Unsupported/i.test(d))why="o formato (por exemplo H.265) não é aceito pelo player";
  ph.textContent="Não foi possível abrir este item.\nMotivo provável: "+why+"."+(code?"\nCódigo: "+code:"");
}

/* ---------- Controles do player ---------- */
const v=$("#v");
let controlsTimeout=null;
/* Em Android o vídeo roda no player nativo; o <video> fica vazio. Estes
   atalhos decidem para quem vai cada comando, sem espalhar `if` por tudo. */
const nativoAtivo=()=>typeof PN!=="undefined"&&PN.ok&&PN.ativo;
const tocandoAgora=()=>nativoAtivo()?PN.tocando:!v.paused;
const tempoAtual=()=>nativoAtivo()?PN.pos:v.currentTime;
const duracaoAtual=()=>nativoAtivo()?PN.dur:(v.duration||0);
function togglePlay(){
  if(nativoAtivo()){PN.tocando?PN.pause():PN.play();return}
  if(v.paused)v.play().catch(()=>{});else v.pause();
}
function irPara(seg){
  if(nativoAtivo()){PN.buscar(Math.max(0,seg));PN.pos=Math.max(0,seg);pintarProgresso(PN.pos,PN.dur,PN.buf,PN.aoVivo);return}
  v.currentTime=seg;
}
/* Tempo/barra. Chamado pelo polling do player nativo e pelos eventos do
   <video> — assim a barra funciona nos dois modos. */
function pintarProgresso(pos,dur,buf,aoVivo){
  if(aoVivo)return;
  if(!dur||dur<=0)return;
  const p=Math.max(0,Math.min(100,(pos/dur)*100));
  $("#progressFill").style.width=p+"%";
  $("#progressThumb").style.left=p+"%";
  $("#currentTime").textContent=formatTime(pos);
  $("#duration").textContent=formatTime(dur);
  if(buf>0)$("#progressBuf").style.width=Math.min(100,(buf/dur)*100)+"%";
}
function showControls(){
  $("#controls").classList.add("show");
  clearTimeout(controlsTimeout);
  controlsTimeout=setTimeout(()=>{if(tocandoAgora())$("#controls").classList.remove("show")},(settings.controlsTimeout||5)*1000);
}
$("#pvbox").onmousemove=showControls;
$("#pvbox").onmouseleave=()=>{clearTimeout(controlsTimeout);if(tocandoAgora())$("#controls").classList.remove("show")};
v.onplay=()=>{$("#playPauseBtn").textContent="⏸";showControls();tentativasReconexao=0;$("#ph").classList.add("hide")};
v.onpause=()=>{$("#playPauseBtn").textContent="▶";clearTimeout(controlsTimeout);$("#controls").classList.add("show")};
v.ontimeupdate=()=>{
  if(nativoAtivo())return;
  if($("#pvbox").classList.contains("isLive"))return;
  if(!v.duration)return;
  const p=(v.currentTime/v.duration)*100||0;
  $("#progressFill").style.width=p+"%";
  $("#progressThumb").style.left=p+"%";
  $("#currentTime").textContent=formatTime(v.currentTime);
  $("#duration").textContent=formatTime(v.duration);
};
v.onprogress=()=>{
  if(nativoAtivo())return;
  try{
    if(!v.buffered.length||!v.duration)return;
    const e=v.buffered.end(v.buffered.length-1);
    $("#progressBuf").style.width=Math.min(100,(e/v.duration)*100)+"%";
  }catch(e){}
};
$("#playPauseBtn").onclick=togglePlay;
$("#back10").onclick=()=>irPara(Math.max(0,tempoAtual()-10));
$("#fwd10").onclick=()=>{const d=duracaoAtual();if(d)irPara(Math.min(d-1,tempoAtual()+10))};
$("#muteBtn").onclick=()=>{
  if(nativoAtivo()){
    const m=!PN.mudoAtual;PN.mudoAtual=m;PN.mudo(m);
    $("#muteBtn").textContent=m?"🔇":"🔊";return;
  }
  v.muted=!v.muted;$("#muteBtn").textContent=v.muted?"🔇":"🔊";
};
$("#volumeSlider").oninput=()=>{
  const vol=$("#volumeSlider").value/100;
  if(nativoAtivo()){PN.mudoAtual=false;PN.volume(vol);$("#muteBtn").textContent="🔊";return}
  v.volume=vol;v.muted=false;$("#muteBtn").textContent="🔊";
};
$("#speedSelect").onchange=()=>{
  const s=parseFloat($("#speedSelect").value);
  if(nativoAtivo())PN.velocidade(s);else v.playbackRate=s;
  showControls();
};
$("#fullscreenBtn").onclick=()=>setFull(!$("#pvbox").classList.contains("full"));
$("#fullLabel").onclick=()=>setFull(!$("#pvbox").classList.contains("full"));
$("#xf").onclick=e=>{e.stopPropagation();setFull(false)};
$("#rotateBtn").onclick=async()=>{
  try{
    if(screen.orientation&&screen.orientation.lock){
      const atual=screen.orientation.type||"";
      await screen.orientation.lock(atual.startsWith("landscape")?"portrait":"landscape");
      toast(atual.startsWith("landscape")?"Tela na vertical":"Tela na horizontal");
    }else toast("Este dispositivo não permite girar a tela.");
  }catch(err){toast("Não foi possível girar a tela.")}
};

let seeking=false;
const seekFrom=e=>{
  const dur=duracaoAtual();
  if(!dur)return;
  const rect=$("#progressBar").getBoundingClientRect();
  const p=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  irPara(p*dur);
  $("#progressFill").style.width=(p*100)+"%";
  $("#progressThumb").style.left=(p*100)+"%";
};
$("#progressBar").onmousedown=e=>{if(!duracaoAtual())return;seeking=true;seekFrom(e);e.preventDefault()};
document.addEventListener("mousemove",e=>{if(seeking)seekFrom(e)});
document.addEventListener("mouseup",()=>{seeking=false});
$("#progressBar").onclick=seekFrom;

const tipCanvas=$("#tipCanvas"),tipCtx=tipCanvas&&tipCanvas.getContext("2d");
$("#progressBar").onmousemove=e=>{
  const tip=$("#ctrlTip");
  const dur=duracaoAtual();
  if(!dur||!settings.showPreview){tip.style.display="none";return}
  const rect=$("#progressBar").getBoundingClientRect();
  const p=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  tip.style.display="flex";
  tip.style.left=Math.max(90,Math.min(rect.width-90,e.clientX-rect.left))+"px";
  $("#tipTime").textContent=formatTime(p*dur);
  // A prévia usa um quadro do próprio <video>; no player nativo não existe.
  if(tipCanvas)tipCanvas.style.display=nativoAtivo()?"none":"";
  if(!nativoAtivo()&&tipCtx&&v.readyState>=2){try{tipCtx.drawImage(v,0,0,160,90)}catch(err){tip.style.display="none"}}
};
$("#progressBar").onmouseleave=()=>{$("#ctrlTip").style.display="none"};

function setFull(on){
  const b=$("#pvbox");
  b.classList.toggle("full",on);
  document.body.classList.toggle("player-full",on);
  // No player nativo a "tela cheia" é só a área do #pvbox indo a 0,0,tela
  // inteira — quem desenha o vídeo acompanha o retângulo. Pedir o fullscreen
  // do HTML junto criaria dois modos de tela cheia brigando.
  const nativo=typeof PN!=="undefined"&&PN.ok&&PN.ativo;
  if(!nativo){
    if(on){
      const req=b.requestFullscreen||b.webkitRequestFullscreen;
      if(req){try{const p=req.call(b,{navigationUI:"hide"});if(p&&p.catch)p.catch(()=>{})}catch(e){}}
    }else{
      if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
      else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();
    }
  }
  on?showControls():$("#controls").classList.remove("show");
  if(typeof PN!=="undefined")PN.sincronizarRect();
}
$("#pFechar").onclick=e=>{e.stopPropagation();sairDoPlayer()};
$("#fsBtn").onclick=e=>{e.stopPropagation();setFull(!$("#pvbox").classList.contains("full"))};
/* Clique/toque na área do vídeo: em tela cheia, o nativo cobre a WebView e
   esses eventos não chegam aqui. Falta então um caminho de saída que
   funcione nos dois modos — o botão ✕ do nativo e o Escape/Voltar. */
$("#pvbox").ondblclick=e=>{
  if(e.target.closest("#controls")||e.target.closest("#pvtop"))return;
  setFull(!$("#pvbox").classList.contains("full"));
};
document.addEventListener("fullscreenchange",()=>{
  if(!document.fullscreenElement&&$("#pvbox").classList.contains("full")){
    $("#pvbox").classList.remove("full");
    document.body.classList.remove("player-full");
    $("#controls").classList.remove("show");
  }
});

function toggleCinema(on){
  const b=document.body;
  const next=on===undefined?!b.classList.contains("cinema"):on;
  b.classList.toggle("cinema",next);
  $("#cinemaBtn").textContent=next?"✕":"🎬";
  if(next&&!$("#pvbox").classList.contains("full"))setFull(true);
  else if(!next&&$("#pvbox").classList.contains("full"))setFull(false);
  showControls();
}
async function togglePip(){
  try{
    if(document.pictureInPictureElement)await document.exitPictureInPicture();
    else if(v.requestPictureInPicture)await v.requestPictureInPicture();
    else toast("Picture-in-Picture não disponível neste dispositivo.");
  }catch(e){toast("Picture-in-Picture não disponível")}
}
$("#pipBtn").onclick=e=>{e.stopPropagation();togglePip()};
$("#cinemaBtn").onclick=e=>{e.stopPropagation();toggleCinema()};

/* ==========================================================
   EPG
   ========================================================== */
let epg={byId:{},byName:{},updated:0};
const epgKey=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
function parseXmltv(xml){
  const doc=new DOMParser().parseFromString(xml,"text/xml");
  if(doc.querySelector("parsererror"))throw new Error("XML inválido");
  const toMs=s=>{
    const m=String(s).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if(!m)return NaN;
    let ms=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
    const off=(String(s).match(/ ([+-]\d{4})/)||[])[1];
    if(off){const sg=off[0]==="-"?-1:1;ms-=sg*(parseInt(off.slice(1,3),10)*60+parseInt(off.slice(3,5),10))*60000}
    return ms;
  };
  const out=[];
  doc.querySelectorAll("programme").forEach(p=>{
    const ch=p.getAttribute("channel"),st=p.getAttribute("start"),en=p.getAttribute("stop");
    if(!ch||!st)return;
    const a=toMs(st),b=en?toMs(en):a+3600000;
    if(!isFinite(a))return;
    const ti=p.querySelector("title"),de=p.querySelector("desc"),ca=p.querySelector("category");
    out.push({ch,start:a,stop:isFinite(b)?b:a+3600000,title:ti?ti.textContent.trim():"",desc:de?de.textContent.trim():"",cat:ca?ca.textContent.trim():""});
  });
  return out;
}
function buildEpgIndex(list){
  const byId={},byName={};
  for(const p of list){
    (byId[p.ch]=byId[p.ch]||[]).push(p);
    (byName[epgKey(p.ch)]=byName[epgKey(p.ch)]||[]).push(p);
  }
  const sort=o=>{for(const k in o)o[k].sort((a,b)=>a.start-b.start);return o};
  return{byId:sort(byId),byName:sort(byName)};
}
function epgFor(it){
  if(!it)return null;
  const id=it.i||it.id||"",nome=it.n||it.nome||"";
  const ok=a=>a&&a.length?a:null;
  return ok(id&&epg.byId[id])||ok(epg.byName[epgKey(id)])||ok(epg.byName[epgKey(nome)]);
}
function nowNext(it){
  const l=epgFor(it);if(!l)return null;
  const t=Date.now();let now=null,next=null;
  for(const p of l){
    if(p.start<=t&&p.stop>t){now=p;continue}
    if(p.start>t){next=p;break}
  }
  return now?{now,next}:null;
}
const fmtProgTime=ms=>new Date(ms).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
async function loadEpg(){
  const urls=settings.epgUrls||[];
  try{const c=JSON.parse(localStorage.getItem("gz_epgdata")||"null");if(c&&c.byId)epg=c}catch(e){}
  if(!urls.length)return;
  const last=parseInt(localStorage.getItem("gz_epgtime")||"0");
  if(Date.now()-last<(settings.epgUpdateInterval||12)*3600000&&Object.keys(epg.byId||{}).length)return;
  const all=[];
  const res=await Promise.allSettled(urls.map(async u=>{
    const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);
    return parseXmltv(await r.text());
  }));
  res.forEach((r,i)=>{if(r.status==="fulfilled")all.push(...r.value);else errs.push("EPG "+urls[i]+" → "+r.reason.message)});
  if(!all.length)return;
  const cut=Date.now()+(settings.epgDays||3)*86400000;
  epg={...buildEpgIndex(all.filter(p=>p.stop>Date.now()-3600000&&p.start<cut)),updated:Date.now()};
  sv("gz_epgdata",epg);sv("gz_epgtime",Date.now());
  if(scr!=="home")renderList();
}
function openEpg(it){
  const list=epgFor(it);
  $("#epgTitle").textContent=it.n||it.nome||"Guia";
  const box=$("#epgGrid");
  if(!list||!list.length){
    box.innerHTML='<div style="color:var(--mut);padding:16px">Sem dados de EPG para este canal. Configure as URLs em ⚙️ → 📅 EPG.</div>';
    $("#epgModal").classList.remove("hide");return;
  }
  const t=Date.now();
  const progs=list.filter(p=>settings.epgShowPast||p.stop>t);
  box.innerHTML=progs.map(p=>{
    const cur=p.start<=t&&p.stop>t;
    return `<div class="ep${cur?" cur":""}" style="${cur?"border-color:var(--acc);background:var(--surface2)":""}">
      <span class="num">${fmtProgTime(p.start)}</span>
      <span class="nm"><b>${esc(p.title||"—")}</b>${p.desc?`<small style="display:block;color:var(--mut);font-weight:400;white-space:normal">${esc(p.desc)}</small>`:""}</span>
      ${cur?'<span class="go" style="color:var(--acc);font-weight:800;font-size:11px">AGORA</span>':""}
    </div>`;
  }).join("");
  $("#epgModal").classList.remove("hide");
  const cur=box.querySelector(".ep.cur");if(cur)cur.scrollIntoView({block:"center"});
}

/* ==========================================================
   Multi-tela
   ========================================================== */
let multi=[],multiAudio=0;
function multiPlayers(){return[...document.querySelectorAll("#multi .mp video")]}
function multiOpen(list){
  closeMulti();
  const box=$("#multi");
  box.className="g"+Math.min(4,Math.max(2,list.length));
  box.innerHTML=list.slice(0,4).map((it,i)=>`
    <div class="mp" data-i="${i}">
      <video playsinline muted></video>
      <div class="ml">${esc(it.n||it.name||"")}</div>
      <button class="ma${i===0?" on":""}" data-a="${i}" title="Ouvir este canal">🔊</button>
      <button class="mx" data-x="${i}" title="Fechar">✕</button>
    </div>`).join("");
  box.classList.remove("hide");
  $("#multiBar").classList.remove("hide");
  multi=[];
  list.slice(0,4).forEach((it,i)=>startMultiStream(it,i));
  multiAudio=0;setMultiAudio(0);
}
async function startMultiStream(it,i){
  const wrap=document.querySelector(`#multi .mp[data-i="${i}"]`);
  if(!wrap)return;
  const el=wrap.querySelector("video");
  const entry={it,video:el,hls:null,ts:null};
  multi[i]=entry;
  const url=it.u||it.url;
  if(!url)return;
  const isTs=/\.ts(\?|$)/i.test(url),isFile=/\.(mp4|mkv|webm|ogv|mov|m4v)(\?|$)/i.test(url),isHls=/\.m3u8(\?|$)/i.test(url);
  try{
    if(isTs&&window.mpegts){
      const p=mpegts.createPlayer({type:"mpegts",isLive:true,url},configTs(true));
      p.attachMediaElement(el);p.load();p.play().catch(()=>{});entry.ts=p;
    }else if((isHls||(!isFile&&!isTs))&&window.Hls&&Hls.isSupported()){
      const h=new Hls(configHls(true));
      h.loadSource(url);h.attachMedia(el);el.play().catch(()=>{});entry.hls=h;
    }else{el.src=url;el.play().catch(()=>{})}
  }catch(e){}
}
function setMultiAudio(i){
  multiAudio=i;
  multiPlayers().forEach((el,n)=>{el.muted=n!==i});
  $$("#multi .ma").forEach(b=>b.classList.toggle("on",+b.dataset.a===i));
}
function closeMulti(){
  for(const m of multi){try{m.hls&&m.hls.destroy()}catch(e){}try{m.ts&&m.ts.destroy()}catch(e){}}
  multi=[];
  const box=$("#multi");if(!box)return;
  box.classList.add("hide");box.innerHTML="";
  $("#multiBar").classList.add("hide");
}
function openMulti(){
  const pool=[...Lib.live.slice(0,2),...recent.filter(r=>r.t==="live").map(r=>({n:r.name,u:r.url})),...Lib.live.slice(0,2)];
  const uniq=[];
  for(const x of pool)if(x&&x.u&&!uniq.some(y=>y.u===x.u))uniq.push(x);
  if(uniq.length<2)return toast("Precisa de pelo menos 2 canais ao vivo para usar a multi-tela.");
  multiOpen(uniq.slice(0,2));
}

/* ==========================================================
   Configurações
   ========================================================== */
function abrirCfg(){
  $("#cfg").classList.remove("hide");
  carregarFormCfg();
}
function carregarFormCfg(){
  $("#u_bufferSize").value=settings.bufferSize;
  $("#bufferValue").textContent=settings.bufferSize+"s";
  $("#u_defaultVolume").value=settings.defaultVolume;
  $("#volumeValue").textContent=settings.defaultVolume+"%";
  $("#u_controlsTimeout").value=settings.controlsTimeout;
  $("#u_audioLang").value=settings.audioLang||"";
  $("#u_subtitleLang").value=settings.subtitleLang||"";
  $("#u_lowLatency").checked=!!settings.lowLatency;
  $("#u_autoReconnect").checked=!!settings.autoReconnect;
  $("#u_reconnectInterval").value=settings.reconnectInterval;
  $("#u_rememberPosition").checked=!!settings.rememberPosition;
  $("#u_pip").checked=!!settings.pip;
  $("#u_showPreview").checked=!!settings.showPreview;
  $("#u_showChannelNum").checked=!!settings.showChannelNum;
  $("#u_showEpg").checked=settings.showEpg!==false;
  $("#u_showAdult").checked=!!settings.showAdult;
  const ag=$("#u_agruparVersoes");if(ag)ag.checked=settings.agruparVersoes===true;
  const ml=$("#u_modoLeve");if(ml)ml.checked=!!settings.modoLeve;
  $("#u_autoRefresh").checked=!!settings.autoRefresh;
  $("#u_timeout").value=settings.timeout;
  $("#u_userAgent").value=settings.userAgent||"";
  $("#u_referer").value=settings.referer||"";
  $("#u_headers").value=settings.headers||"";
  $("#u_useProxy").checked=!!settings.useProxy;
  $("#u_proxyUrl").value=settings.proxyUrl||"";
  $("#u_epgUrls").value=(settings.epgUrls||[]).join("\n");
  $("#u_epgAutoUpdate").checked=settings.epgAutoUpdate!==false;
  $("#u_epgUpdateInterval").value=settings.epgUpdateInterval;
  $("#u_epgDays").value=settings.epgDays;
  $("#u_epgShowPast").checked=!!settings.epgShowPast;
  $("#u_tmdbKey").value=settings.tmdbKey||"";
  $("#u_parentalControl").checked=!!settings.parentalControl;
  $("#u_parentalPin").value=settings.parentalPin||"";
  $("#u_hideAdult").checked=settings.hideAdult!==false;
  $("#u_hwAccel").checked=settings.hwAccel!==false;
  $("#u_ia").checked=!!settings.ia;
  $("#u_catchup").checked=!!settings.catchup;
  $("#u_catchupDays").value=settings.catchupDays;
  atualizarStorage();
}
function salvarCfg(){
  settings.bufferSize=parseInt($("#u_bufferSize").value)||30;
  settings.defaultVolume=parseInt($("#u_defaultVolume").value);
  settings.controlsTimeout=parseInt($("#u_controlsTimeout").value)||5;
  settings.audioLang=$("#u_audioLang").value;
  settings.subtitleLang=$("#u_subtitleLang").value;
  settings.lowLatency=$("#u_lowLatency").checked;
  settings.autoReconnect=$("#u_autoReconnect").checked;
  settings.reconnectInterval=parseInt($("#u_reconnectInterval").value)||12;
  settings.rememberPosition=$("#u_rememberPosition").checked;
  settings.pip=$("#u_pip").checked;
  settings.showPreview=$("#u_showPreview").checked;
  settings.showChannelNum=$("#u_showChannelNum").checked;
  settings.showEpg=$("#u_showEpg").checked;
  settings.showAdult=$("#u_showAdult").checked;
  const ag=$("#u_agruparVersoes");
  settings.agruparVersoes=ag?ag.checked:settings.agruparVersoes;
  const ml=$("#u_modoLeve");
  if(ml)settings.modoLeve=ml.checked;
  settings.autoRefresh=$("#u_autoRefresh").checked;
  settings.timeout=parseInt($("#u_timeout").value)||15;
  settings.userAgent=$("#u_userAgent").value.trim();
  settings.referer=$("#u_referer").value.trim();
  settings.headers=$("#u_headers").value.trim();
  settings.useProxy=$("#u_useProxy").checked;
  settings.proxyUrl=$("#u_proxyUrl").value.trim();
  settings.epgUrls=$("#u_epgUrls").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  settings.epgAutoUpdate=$("#u_epgAutoUpdate").checked;
  settings.epgUpdateInterval=parseInt($("#u_epgUpdateInterval").value)||12;
  settings.epgDays=parseInt($("#u_epgDays").value)||3;
  settings.epgShowPast=$("#u_epgShowPast").checked;
  settings.tmdbKey=$("#u_tmdbKey").value.trim();
  settings.parentalControl=$("#u_parentalControl").checked;
  settings.parentalPin=$("#u_parentalPin").value.replace(/\D/g,"").slice(0,4);
  settings.hideAdult=$("#u_hideAdult").checked;
  settings.hwAccel=$("#u_hwAccel").checked;
  settings.ia=$("#u_ia").checked;
  settings.catchup=$("#u_catchup").checked;
  settings.catchupDays=parseInt($("#u_catchupDays").value)||24;
  sv("gz_settings",settings);
  $("#v").volume=settings.defaultVolume/100;
  $("#cfg").classList.add("hide");
  toast("Configurações salvas");
  aplicarPreferenciasAdulto();
  if(scr!=="home")renderList();
}

/* ==========================================================
   Playlists
   ========================================================== */
async function abrirPlaylists(){
  $("#pl").classList.remove("hide");
  await renderArquivos();
}
async function renderArquivos(){
  const box=$("#plList");
  let arquivos=[];
  try{arquivos=await listFiles()}catch(e){}
  const urls=listaUrls.map((u,i)=>({tipo:"url",u,i}));

  const embutidas=await builtinTodas().catch(()=>[]);
  const desligadas=builtinDesligadas();
  const nomesImportados=new Set(arquivos.map(a=>a.name));
  const caixaEmb=$("#plBuiltin");
  if(caixaEmb){
    caixaEmb.innerHTML=embutidas.map(b=>{
      const removida=desligadas.includes(b.key);
      const substituida=nomesImportados.has(b.nome)||nomesImportados.has(b.nome+"");
      const estado=removida?"removida":substituida?"substituída por um arquivo seu":"incluída no app";
      const acao=removida
        ? `<button data-restore="${b.key}" style="padding:5px 12px">↺ Restaurar</button>`
        : `<button data-remove="${b.key}" style="padding:5px 10px">✕</button>`;
      return `<div class="ep" style="cursor:default${removida?";opacity:.55":""}">
        <span class="num">APP</span>
        <span class="nm"><b>${esc(b.nome||"Biblioteca do app")}</b><small style="display:block;color:var(--mut);font-size:11.5px">${esc(b.tipo||"Filmes, séries e canais")} · ${estado}</small></span>
        ${substituida?"":acao}
      </div>`;
    }).join("")||'<div style="color:var(--mut);font-size:13px">Este app não trouxe listas embutidas.</div>';
  }

  const linhas=[
    ...arquivos.map(a=>`<div class="ep" style="cursor:default"><span class="num">${esc((a.kind||"").toUpperCase()||"LISTA")}</span><span class="nm">${esc(a.name)}</span><button class="mx" data-del="${a.id}" style="padding:5px 10px">✕</button></div>`),
    ...urls.map(x=>`<div class="ep" style="cursor:default"><span class="num">LINK</span><span class="nm" style="font-size:12px">${esc(x.u)}</span><button data-delurl="${x.i}" style="padding:5px 10px">✕</button></div>`)
  ];
  box.innerHTML=linhas.join("")||'<div style="color:var(--mut);font-size:13px">Nenhum link ou arquivo adicionado por você.</div>';
  const s=libStats();
  const resumo=$("#plResumo");
  if(resumo){
    const n=v=>v.toLocaleString("pt-BR");
    resumo.innerHTML=`<b>${n(s.movies+s.episodes+s.live+s.adult)}</b> entradas na biblioteca<br>
      <span style="color:var(--mut)">${n(s.movies)} filmes · ${n(s.series)} séries (${n(s.episodes)} episódios) · ${n(s.live)} canais ao vivo · ${n(s.adult)} conteúdo adulto</span>`;
  }
}
async function adicionarUrls(){
  const txt=$("#plUrls").value.trim();
  if(!txt)return;
  const novos=txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  listaUrls=[...new Set([...listaUrls,...novos])];
  sv("gz_urls",listaUrls);
  $("#plUrls").value="";
  $("#plStatus").textContent=`${novos.length} link(s) adicionado(s). Atualizando biblioteca…`;
  await renderArquivos();
  await carregarTudo();
  $("#plStatus").textContent="Biblioteca atualizada.";
}
async function adicionarArquivos(files){
  for(const f of files){
    $("#plStatus").textContent=`Importando ${f.name}…`;
    try{
      const texto=await f.text();
      if(!/#EXT/.test(texto)){toast(f.name+": não parece uma lista M3U");continue}
      const kind=$("#plKind").value==="auto"?"":$("#plKind").value;
      await importarLista(f.name,texto,kind,(i,t)=>{$("#plStatus").textContent=`Convertendo ${f.name}: ${i}/${t}`});
    }catch(e){toast("Falha ao importar "+f.name+": "+e.message)}
  }
  await renderArquivos();
  $("#plStatus").textContent="Importação concluída. Atualizando biblioteca…";
  await carregarTudo();
  $("#plStatus").textContent="Biblioteca atualizada.";
}

/* ==========================================================
   Delegação de cliques / eventos
   ========================================================== */
document.addEventListener("click",async e=>{
  const t=e.target;

  const card=t.closest(".card");
  if(card){
    const tipo=card.dataset.tipo,key=card.dataset.key;
    if(tipo==="serie"){
      const s=Lib.seriePorNome.get(key);
      if(s)abrirDetalhe({tipo:"serie",nome:s.nome,logo:s.logo,grupo:s.grupo,serie:s});
      return;
    }
    if(tipo==="canal"){
      const it=Lib.byUrl.get(key)||Lib.live.find(x=>x.u===key)||recent.find(r=>(r.url||r.u)===key);
      if(it)play({...it,t:"live",u:it.u||it.url,n:it.n||it.name,g:it.g||it.group});
      return;
    }
    const it=Lib.byUrl.get(key)||recent.find(r=>(r.url||r.u)===key);
    if(it){
      abrirDetalhe({
        tipo:"filme",nome:it.n||it.name||"",logo:it.l||it.logo||"",
        grupo:it.g||it.group||"",sinopse:it.sinopse||null,item:{...it,t:"movies"}
      });
    }else{
      const rec=recent.find(r=>(r.url||r.u)===key);
      if(rec)play({url:rec.url,u:rec.url,n:rec.name,logo:rec.logo,g:rec.group,t:"movies"});
    }
    return;
  }

  const tile=t.closest(".tile[data-s]");
  if(tile){goto(tile.dataset.s);return}
  const pill=t.closest(".pill");
  if(pill){goto(pill.dataset.s);return}
  const lg=t.closest("[data-goto]");
  if(lg){goto(lg.dataset.goto);return}

  const sc=t.closest(".sc");
  if(sc){
    cat[scr]=sc.dataset.g||"";limit=LIMITE_TELA;renderSide();renderList();
    return;
  }
  if(t.id==="more"){limit+=MAX_CARDS;renderList();return}
});

/* ---------- Configurações: abas ---------- */
$$(".cfg-tab").forEach(b=>b.onclick=()=>{
  $$(".cfg-tab").forEach(x=>x.classList.remove("on"));
  $$(".cfg-content").forEach(x=>x.classList.remove("on"));
  b.classList.add("on");
  $("#tab-"+b.dataset.tab).classList.add("on");
});
$("#bCfg").onclick=abrirCfg;
$("#bCfg2").onclick=abrirCfg;
$("#cCfg").onclick=()=>$("#cfg").classList.add("hide");
$("#cCancel").onclick=()=>$("#cfg").classList.add("hide");
$("#save").onclick=salvarCfg;
$("#bPlaylist").onclick=abrirPlaylists;
$("#plClose").onclick=()=>$("#pl").classList.add("hide");
$("#plAddUrls").onclick=adicionarUrls;
$("#plPick").onclick=()=>$("#plInput").click();
$("#plInput").onchange=async e=>{await adicionarArquivos([...e.target.files]);e.target.value=""};
$("#plList").onclick=async e=>{
  const d=e.target.closest("[data-del]");
  if(d){await apagarLista(d.dataset.del);await renderArquivos();await carregarTudo();return}
  const u=e.target.closest("[data-delurl]");
  if(u){listaUrls.splice(+u.dataset.delurl,1);sv("gz_urls",listaUrls);await renderArquivos();await carregarTudo()}
};
$("#plBuiltin").onclick=async e=>{
  const rem=e.target.closest("[data-remove]");
  if(rem){
    builtinDesligar(rem.dataset.remove,true);
    $("#plStatus").textContent="Lista removida. Você pode restaurá-la a qualquer momento aqui.";
    await renderArquivos();await carregarTudo();
    return;
  }
  const res=e.target.closest("[data-restore]");
  if(res){
    builtinDesligar(res.dataset.restore,false);
    $("#plStatus").textContent="Lista restaurada. Carregando…";
    await renderArquivos();await carregarTudo();
    $("#plStatus").textContent="Biblioteca atualizada.";
  }
};
$("#u_bufferSize").oninput=()=>$("#bufferValue").textContent=$("#u_bufferSize").value+"s";
$("#u_defaultVolume").oninput=()=>$("#volumeValue").textContent=$("#u_defaultVolume").value+"%";
$("#epgClear").onclick=()=>{
  localStorage.removeItem("gz_epgdata");localStorage.removeItem("gz_epgtime");
  epg={byId:{},byName:{},updated:0};
  cacheSet("__clear__",Date.now()).catch(()=>{});
  toast("Cache do EPG limpo");
};

/* ---------- Busca / ordenação ---------- */
/* Digitar não pode disparar a filtragem a cada tecla: com 574 mil itens isso
   travava a digitação. Espera o usuário parar por 250 ms. */
let buscaTimer=null;
function buscaComEspera(){
  clearTimeout(buscaTimer);
  buscaTimer=setTimeout(()=>{limit=LIMITE_TELA;renderList()},250);
}
$("#q").oninput=buscaComEspera;
$("#q").onkeydown=e=>{
  if(e.key==="Enter"){clearTimeout(buscaTimer);limit=LIMITE_TELA;renderList()}
};
$("#sortBy").onchange=()=>{sortBy=$("#sortBy").value;limit=LIMITE_TELA;renderList()};
$("#filterQuality").onchange=()=>{filterQuality=$("#filterQuality").value;limit=LIMITE_TELA;renderList()};
$("#back").onclick=()=>{$("#q").value="";advFilter={};filterQuality="";sortBy="name-asc";cat={};goto("home")};
$("#allRec").onclick=()=>goto("recent");
$("#hq").onkeydown=e=>{
  if(e.key!=="Enter")return;
  const val=$("#hq").value.trim();
  if(!val)return;
  $("#q").value=val;$("#hq").value="";$("#hq").blur();cat.search="";goto("search");
};
$("#hbtn").onclick=()=>goto(SL[si].s);
$("#hbtn2").onclick=()=>goto(SL[si].s==="live"?"live":"movies");

$("#advSearch").onclick=()=>$("#advSearchModal").classList.remove("hide");
$("#advSearchClose").onclick=()=>$("#advSearchModal").classList.add("hide");
$("#advSearchClear").onclick=()=>{
  ["title","genre","year_from","year_to"].forEach(k=>$("#adv_"+k).value="");
  $("#adv_quality").value="";advFilter={};limit=LIMITE_TELA;renderList();
};
$("#advSearchBtn").onclick=()=>{
  advFilter={
    title:chaveBusca($("#adv_title").value),
    genre:chaveBusca($("#adv_genre").value),
    yearFrom:parseInt($("#adv_year_from").value)||null,
    yearTo:parseInt($("#adv_year_to").value)||null,
    quality:$("#adv_quality").value
  };
  limit=LIMITE_TELA;renderList();$("#advSearchModal").classList.add("hide");
};

/* ---------- EPG modal ---------- */
$("#epgClose").onclick=()=>$("#epgModal").classList.add("hide");

/* ---------- Multi ---------- */
$("#btnMulti").onclick=openMulti;
$("#mClose").onclick=closeMulti;
$("#mAdd").onclick=()=>{
  const pool=Lib.live.find(x=>!multi.some(m=>m&&(m.it.u||m.it.url)===x.u));
  if(!pool)return toast("Não há outro canal para adicionar.");
  if(multi.length>=4)return toast("Máximo de 4 canais.");
  multiOpen([...multi.filter(Boolean).map(m=>m.it),pool]);
};
$("#multi").onclick=e=>{
  const a=e.target.closest(".ma");
  if(a){setMultiAudio(+a.dataset.a);return}
  const x=e.target.closest(".mx");
  if(x){
    const rest=multi.filter((m,i)=>m&&i!==+x.dataset.x).map(m=>m.it);
    if(rest.length>=2)multiOpen(rest);else closeMulti();
  }
};

/* ---------- Exportar / importar / resetar ---------- */
$("#exportCfg").onclick=()=>{
  const exp={settings,fav:[...fav],recent,listaUrls,versao:2};
  const blob=new Blob([JSON.stringify(exp,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="gamezone-backup-"+new Date().toISOString().slice(0,10)+".json";
  a.click();
};
$("#importCfg").onclick=()=>$("#importFile").click();
$("#importFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const imp=JSON.parse(await f.text());
    if(imp.settings)Object.assign(settings,imp.settings);
    if(imp.fav)fav=new Set(imp.fav);
    if(imp.recent)recent=imp.recent;
    if(imp.listaUrls)listaUrls=imp.listaUrls;
    sv("gz_settings",settings);sv("gz_fav",[...fav]);sv("gz_recent",recent);sv("gz_urls",listaUrls);
    toast("Configurações importadas");
    $("#cfg").classList.add("hide");
    await carregarTudo();
  }catch(err){alert("Erro ao importar: "+err.message)}
  e.target.value="";
};
$("#resetCfg").onclick=async()=>{
  if(!confirm("Isso apaga configurações, favoritos, histórico e as listas salvas. Continuar?"))return;
  try{
    const db=await openDB();
    db.transaction("lists","readwrite").objectStore("lists").clear();
    db.transaction("cache","readwrite").objectStore("cache").clear();
  }catch(e){}
  localStorage.clear();
  location.reload();
};

/* ---------- Teclado (controle remoto / TV) ---------- */
function nav(dir){
  const root=$("#cfg").classList.contains("hide")&&$("#pl").classList.contains("hide")?document:($("#cfg").classList.contains("hide")?$("#pl"):$("#cfg"));
  const els=[...root.querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(x=>x.getClientRects().length&&!x.disabled);
  const cur=document.activeElement;
  if(!els.includes(cur)){els[0]&&els[0].focus();return}
  const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let best=null,bs=1e9;
  for(const el of els){
    if(el===cur||cur.contains(el)||el.contains(cur))continue;
    const b=el.getBoundingClientRect(),dx=b.left+b.width/2-cx,dy=b.top+b.height/2-cy;
    const[p,o]=dir==="r"?[dx,dy]:dir==="l"?[-dx,dy]:dir==="d"?[dy,dx]:[-dy,dx];
    if(p<=4)continue;
    const s=p+2.5*Math.abs(o);
    if(s<bs){bs=s;best=el}
  }
  if(best){best.focus();best.scrollIntoView({block:"nearest",inline:"nearest"})}
}
document.addEventListener("keydown",e=>{
  const tg=e.target,typing=/INPUT|TEXTAREA|SELECT/.test(tg.tagName);
  if(e.key==="Escape"||e.key==="Backspace"||e.keyCode===461){
    if($("#detail").classList.contains("on")){e.preventDefault();fecharDetalhe();return}
    if(!$("#multi").classList.contains("hide")){e.preventDefault();closeMulti();return}
    if(document.body.classList.contains("cinema")){e.preventDefault();toggleCinema(false);return}
    if($("#advSearchModal").classList.contains("hide")===false){e.preventDefault();$("#advSearchModal").classList.add("hide");return}
    if($("#epgModal").classList.contains("hide")===false){e.preventDefault();$("#epgModal").classList.add("hide");return}
    if(!$("#pl").classList.contains("hide")){e.preventDefault();$("#pl").classList.add("hide");return}
    if(!$("#cfg").classList.contains("hide")){e.preventDefault();$("#cfg").classList.add("hide");return}
    if($("#pvbox").classList.contains("full")){e.preventDefault();setFull(false);return}
    if($("#cols").classList.contains("tocando")){e.preventDefault();sairDoPlayer();return}
    if(!typing&&scr!=="home"){e.preventDefault();$("#q").value="";goto("home");return}
  }
  if(e.key==="Enter"&&tg.tagName==="DIV"&&tg.hasAttribute("tabindex")){
    e.preventDefault();tg.click();return;
  }
  if(!typing&&!$("#pvbox").classList.contains("hide")&&(nativoAtivo()||v.currentSrc||v.src||ts||hls)){
    if(e.key===" "||e.code==="Space"){e.preventDefault();togglePlay();return}
    if(e.key==="ArrowLeft"){e.preventDefault();irPara(Math.max(0,tempoAtual()-10));return}
    if(e.key==="ArrowRight"){e.preventDefault();const d=duracaoAtual();if(d)irPara(Math.min(d-1,tempoAtual()+10));return}
  }
  if(e.key==="f"||e.key==="F"){if(!typing){setFull(!$("#pvbox").classList.contains("full"));return}}
  if(e.key==="m"||e.key==="M"){
    if(!typing){
      if(nativoAtivo()){PN.mudoAtual=!PN.mudoAtual;PN.mudo(PN.mudoAtual);$("#muteBtn").textContent=PN.mudoAtual?"🔇":"🔊"}
      else{v.muted=!v.muted;$("#muteBtn").textContent=v.muted?"🔇":"🔊"}
      return;
    }
  }
  const d={ArrowRight:"r",ArrowLeft:"l",ArrowDown:"d",ArrowUp:"u"}[e.key];
  if(!d)return;
  if(typing)return;
  e.preventDefault();nav(d);
});

/* ==========================================================
   Inicialização
   ========================================================== */
tick();setInterval(tick,60000);
startSlides();

(async function inicio(){
  $("#v").volume=(settings.defaultVolume??100)/100;
  const intro=$("#intro");
  if(intro){
    document.documentElement.classList.add("intro-lock");
    const sair=()=>{
      intro.classList.add("off");
      document.documentElement.classList.remove("intro-lock");
      setTimeout(()=>intro.remove(),800);
    };
    setTimeout(sair,1500);
    intro.onclick=sair;
  }
  aplicarPreferenciasAdulto();
  await carregarTudo();
  aplicarPreferenciasAdulto();
  loadEpg();
  if(settings.epgAutoUpdate&&settings.epgUrls&&settings.epgUrls.length){
    clearInterval(window._epgTimer);
    window._epgTimer=setInterval(loadEpg,(settings.epgUpdateInterval||12)*3600000);
  }
  if(settings.autoRefresh){
    clearInterval(window._refreshTimer);
    window._refreshTimer=setInterval(carregarTudo,24*3600000);
  }
})();
