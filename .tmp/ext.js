const zlib=require('zlib'),fs=require('fs');
const m=new Map();
for(const f of ['canais-br01.m3u8.bin','filmes-series.m3u8.bin']){
  const txt=zlib.gunzipSync(fs.readFileSync('www/assets/listas/'+f)).toString('utf8');
  let cur=null;
  for(const line of txt.split(/\r?\n/)){
    const l=line.trim();if(!l)continue;
    if(l.startsWith('#EXTINF'))cur=l;
    else if(!l.startsWith('#')&&cur){
      const e=(l.split('?')[0].match(/\.([a-z0-9]{1,5})$/i)||[])[1]||'sem-ext';
      m.set(e,(m.get(e)||0)+1);cur=null;
    }
  }
}
console.log([...m].sort((a,b)=>b[1]-a[1]));
