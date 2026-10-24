/* Worker de parsing: transforma texto M3U em itens compactos sem travar a interface */
function parseM3U(txt, kind){
  const out=[];
  let cur=null;
  const lines=txt.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const l=lines[i].trim();
    if(!l)continue;
    if(l.startsWith("#EXTINF")){
      const attrs={};
      const re=/([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let m;
      while((m=re.exec(l)))attrs[m[1]]=m[2];
      const comma=l.indexOf(",");
      const name=(attrs["tvg-name"]||(comma>=0?l.slice(comma+1):"")).trim();
      cur={
        n:name,
        l:attrs["tvg-logo"]||"",
        g:(attrs["group-title"]||"").trim(),
        k:kind
      };
    }else if(!l.startsWith("#")&&cur){
      cur.u=l;
      out.push(cur);
      cur=null;
    }
  }
  return out;
}
/* Deriva a categoria quando o playlist não traz group-title coerente */
function classify(it){
  const g=(it.g||"").toLowerCase();
  const u=(it.u||"").toLowerCase();
  if(/\/movie\//.test(u))return"movies";
  if(/\/series\//.test(u))return"series";
  if(/\/(live|hls)\/|\/\d+\.(ts|m3u8)$/.test(u))return"live";
  if(g.startsWith("series")||g.startsWith("séries")||g.startsWith("series |")||g.startsWith("séries |"))return"series";
  if(g.startsWith("filme")||g.startsWith("filmes")||g.includes("filmes"))return"movies";
  if(g.startsWith("coletânea")||g.startsWith("coletanea"))return"series";
  return"live";
}
/* Agrupa episódios: "Channel Zero S01E02" -> serie "Channel Zero", episódio S01E02 */
const EP_RE=/\s*[-–—]?\s*S(\d{1,2})\s*E(\d{1,3})\s*$/i;
function splitEpisode(name,herdado){
  const m=name.match(EP_RE);
  if(!m)return null;
  let serie=name.slice(0,m.index).trim();
  // Alguns provedores mandam o episódio sozinho ("S01E01"): herda o nome anterior
  if(!serie&&herdado)serie=herdado;
  return{serie,season:+m[1],episode:+m[2],tag:`S${String(m[1]).padStart(2,"0")}E${String(m[2]).padStart(2,"0")}`};
}
/* Conteúdo adulto: fica numa aba própria, oculta por padrão */
const ADULT_RE=/\b(adulto|adultos|adult|xxx|porn|er[oó]tic|18\+)\b/i;
function isAdult(it){
  if(ADULT_RE.test(it.g||""))return true;
  return /\[(adulto|xxx)\]/i.test(it.n||"");
}
/* As listas reais têm 870 mil entradas e o app guarda tudo em memória num
   celular. O tvg-id do arquivo não é usado em lugar nenhum, então nem é
   carregado — economiza dezenas de MB. O EPG casa pelo nome do canal. */

self.onmessage=function(e){
  const{id,text,kind}=e.data;
  try{
    const items=parseM3U(text,kind||"");
    // normaliza: define categoria final e separa série/episódio
    const movies=[],series=[],live=[],adult=[];
    const seen=new Set();
    let ultimaSerie="",ultimoFilme=null;
    for(const it of items){
      if(!it.u||!it.n)continue;
      if(seen.has(it.u))continue;
      seen.add(it.u);
      if(isAdult(it)){it.ad=1;adult.push(it);continue}
      const cat=classify(it);
      // A lista manda a mesma obra várias vezes e, nas repetições, só a marca
      // da versão ("[L]", "[D]", "4K"). Sem isso viravam cards sem nome.
      const soMarca=/^[\[(]\s*(l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)\s*[\])]\s*(\(?\d{4}\)?)?$/i.test(it.n.trim());
      if(soMarca&&ultimoFilme){
        // Tira a marca-base do título herdado para não acumular "[L][L][D]"
        const alvo=it.n.trim();
        const marca=(alvo.match(/[\[(]\s*(l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)\s*[\])]/i)||[])[0]||alvo;
        const anoDoAlvo=(alvo.match(/\(?(19|20)\d{2}\)?/)||[])[0]||"";
        const anoBase=(ultimoFilme.n.match(/\(?(19|20)\d{2}\)?/)||[])[0]||"";
        const base=ultimoFilme.n
          .replace(/\s*[\[(](l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)[\])]\s*/gi," ")
          .replace(/\s*\(?(19|20)\d{2}\)?\s*$/,"").trim();
        it.n=(base||ultimoFilme.n)+" "+marca+(anoDoAlvo||anoBase?" "+(anoDoAlvo||anoBase):"");
        it.n=it.n.replace(/\s+/g," ").trim();
        if(!it.l)it.l=ultimoFilme.l;
      }
      if(cat==="movies"){movies.push(it);ultimoFilme=it}
      else if(cat==="series"){
        const ep=splitEpisode(it.n,ultimaSerie);
        if(ep){
          if(ep.serie)ultimaSerie=ep.serie;
          it.s=ep.serie;it.sn=ep.season;it.en=ep.episode;it.et=ep.tag;
        }
        series.push(it);
      }else{live.push(it)}
    }
    const groups={movies:new Map(),series:new Map(),live:new Map()};
    for(const it of movies)groups.movies.set(it.g,(groups.movies.get(it.g)||0)+1);
    for(const it of series){const g=it.s?"Series":"Series";const k=it.g||g;groups.series.set(k,(groups.series.get(k)||0)+1)}
    for(const it of live)groups.live.set(it.g,(groups.live.get(it.g)||0)+1);
    self.postMessage({
      id,
      ok:true,
      counts:{movies:movies.length,series:series.length,live:live.length,adult:adult.length},
      groups:{
        movies:[...groups.movies],
        series:[...groups.series],
        live:[...groups.live]
      },
      items:{movies,series,live,adult}
    });
  }catch(err){
    self.postMessage({id,ok:false,error:String(err&&err.message||err)});
  }
};
