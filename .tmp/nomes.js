const zlib=require('zlib'),fs=require('fs');
let dif=0,tot=0,semNome=0,ex=[];
let soMarca=0,marcas=[];
for(const f of ['filmes-series.m3u8.bin','canais-br01.m3u8.bin']){
  const txt=zlib.gunzipSync(fs.readFileSync('www/assets/listas/'+f)).toString('utf8');
  let cur=null;
  for(const line of txt.split(/\r?\n/)){
    const l=line.trim();if(!l)continue;
    if(l.startsWith('#EXTINF')){
      const a={};const re=/([a-zA-Z0-9_-]+)="([^"]*)"/g;let m;
      while((m=re.exec(l)))a[m[1]]=m[2];
      const c=l.indexOf(',');
      const depois=(c>=0?l.slice(c+1):'').trim();
      const tn=(a['tvg-name']||'').trim();
      cur={tn,depois,g:(a['group-title']||'').trim()};
    } else if(!l.startsWith('#')&&cur){
      tot++;
      const nome=cur.tn||cur.depois;
      if(!nome)semNome++;
      if(cur.tn&&cur.depois&&cur.tn!==cur.depois){dif++;if(ex.length<8)ex.push([cur.g,cur.tn,cur.depois])}
      if(/^[\[(]\s*(l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)\s*[\])]\s*(\(?\d{4}\)?)?$/i.test(nome.trim())){soMarca++;if(marcas.length<8)marcas.push([cur.g,nome])}
      cur=null;
    }
  }
}
console.log({tot,dif,semNome,soMarca});
console.log('exemplos divergência tvg-name <-> nome:',ex);
console.log('exemplos só marca:',marcas);
