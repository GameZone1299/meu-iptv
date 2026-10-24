const zlib=require('zlib'),fs=require('fs');
const EP_RE=/\s*[-–—]?\s*S(\d{1,2})\s*E(\d{1,3})\s*$/i;
const ADULT_RE=/\b(adulto|adultos|adult|xxx|porn|er[oó]tic|18\+)\b/i;
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
function parse(txt){
  const out=[];let cur=null;
  for(const line of txt.split(/\r?\n/)){
    const l=line.trim();if(!l)continue;
    if(l.startsWith("#EXTINF")){
      const a={};const re=/([a-zA-Z0-9_-]+)="([^"]*)"/g;let m;
      while((m=re.exec(l)))a[m[1]]=m[2];
      const c=l.indexOf(",");
      cur={n:(a["tvg-name"]||(c>=0?l.slice(c+1):"")).trim(),l:a["tvg-logo"]||"",g:(a["group-title"]||"").trim()};
    }else if(!l.startsWith("#")&&cur){cur.u=l;out.push(cur);cur=null}
  }
  return out;
}
const all=new Map();
for(const f of ['canais-br01.m3u8.bin','filmes-series.m3u8.bin']){
  const txt=zlib.gunzipSync(fs.readFileSync('www/assets/listas/'+f)).toString('utf8');
  const items=parse(txt);
  const b={movies:0,series:0,live:0,adult:0};
  const ext={};const liveG={};const liveExt={};
  const seen=new Set();let dup=0;
  for(const it of items){
    if(!it.u||!it.n)continue;
    if(seen.has(it.u)){dup++;continue}
    seen.add(it.u);
    if(ADULT_RE.test(it.g||"")||/\[(adulto|xxx)\]/i.test(it.n||"")){b.adult++;continue}
    const c=classify(it);b[c]++;
    if(c==='live'){
      const e=(it.u.split('?')[0].match(/\.([a-z0-9]+)$/i)||[])[1]||'sem-ext';
      liveExt[e]=(liveExt[e]||0)+1;
      liveG[it.g]=(liveG[it.g]||0)+1;
    }
    all.set(it.u,{...it,k:c});
  }
  console.log('\n===',f,'| itens',items.length,'| dup na lista',dup);
  console.log('buckets',b);
  console.log('live por extensão',Object.entries(liveExt).sort((a,c)=>c[1]-a[1]).slice(0,8));
  console.log('live top grupos',Object.entries(liveG).sort((a,c)=>c[1]-a[1]).slice(0,10));
}
let mk={movies:0,series:0,live:0,adult:0};
for(const v of all.values())mk[v.k]++;
console.log('\n=== união sem URL repetida:',all.size,mk);
// filmes cujo URL termina em .m3u8/.ts (suspeitos de ir para live)
let sus=0;for(const v of all.values())if(v.k!=='live'&&/\.(m3u8|ts)(\?|$)/i.test(v.u))sus++;
console.log('filmes/series com url .m3u8/.ts:',sus);
