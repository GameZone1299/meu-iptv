const zlib=require('zlib'),fs=require('fs');
function mb(n){return (n/1048576).toFixed(1)+'MB'}
const out={movies:[],series:[],live:[],adult:[]};
for(const f of ['canais-br01.m3u8.bin','filmes-series.m3u8.bin']){
  global.gc&&global.gc();
  const before=process.memoryUsage();
  const t0=Date.now();
  const txt=zlib.gunzipSync(fs.readFileSync('www/assets/listas/'+f)).toString('utf8');
  const afterText=process.memoryUsage();
  const lines=txt.split(/\r?\n/);
  const afterSplit=process.memoryUsage();
  let cur=null,cnt=0,emptyLogo=0,totName=0,totUrl=0,totLogo=0;
  for(const line of lines){
    const l=line.trim();if(!l)continue;
    if(l.startsWith('#EXTINF')){
      const a={};const re=/([a-zA-Z0-9_-]+)="([^"]*)"/g;let m;
      while((m=re.exec(l)))a[m[1]]=m[2];
      const c=l.indexOf(',');
      const n=(a['tvg-name']||(c>=0?l.slice(c+1):'')).trim();
      const lo=a['tvg-logo']||'';
      if(!lo)emptyLogo++;
      totName+=n.length;totUrl+=0;totLogo+=lo.length;
      cur={n,l:lo,g:(a['group-title']||'').trim()};
    } else if(!l.startsWith('#')&&cur){
      cur.u=l;totUrl+=l.length;cnt++;
      out.movies.push(cur);cur=null;
    }
  }
  console.log(f,'itens',cnt,'txt',mb(txt.length*2),'logo vazio',emptyLogo,
    'média nome',(totName/cnt).toFixed(1),'url',(totUrl/cnt).toFixed(1),'logo',(totLogo/cnt).toFixed(1));
  console.log('  heap: texto',mb(afterText.heapUsed-before.heapUsed),'após split',mb(afterSplit.heapUsed-before.heapUsed));
  console.log('  tempo',Date.now()-t0,'ms');
  global.gc&&global.gc();
}
console.log('heap final',mb(process.memoryUsage().heapUsed),'rss',mb(process.memoryUsage().rss));
