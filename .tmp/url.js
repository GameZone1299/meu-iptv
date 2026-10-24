const zlib=require('zlib'),fs=require('fs');
const urls=[];
for(const f of ['canais-br01.m3u8.bin','filmes-series.m3u8.bin']){
  const txt=zlib.gunzipSync(fs.readFileSync('www/assets/listas/'+f)).toString('utf8');
  let cur=false;
  for(const line of txt.split(/\r?\n/)){
    const l=line.trim();if(!l)continue;
    if(l.startsWith('#EXTINF'))cur=true;
    else if(!l.startsWith('#')&&cur){urls.push(l);cur=false}
  }
}
console.log('urls',urls.length);
const shape=new Map(),host=new Map(),pre=new Map();
let tot=0;
for(const u of urls){
  tot+=u.length;
  let m=u.match(/^(https?:\/\/[^/]+)(\/[^/]*)?(\/[^/]*)?(\/[^/]*)?(\/[^/]*)?/);
  const h=m?m[1]:'?';host.set(h,(host.get(h)||0)+1);
  // prefixo até o último '/' (diretório)
  const d=u.slice(0,u.lastIndexOf('/')+1);pre.set(d,(pre.get(d)||0)+1);
  const s=u.replace(/\d+/g,'#').slice(0,140);shape.set(s,(shape.get(s)||0)+1);
}
console.log('chars totais',tot,'média',(tot/urls.length).toFixed(1));
console.log('hosts',host.size);[...host].sort((a,b)=>b[1]-a[1]).slice(0,6).forEach(x=>console.log(' ',x[1],x[0]));
console.log('prefixos de diretório',pre.size);
let prefSum=0;for(const [d,c] of pre)prefSum+=Math.min(d.length,45)*c;
console.log('ganho máximo se compartilhar até 45 chars de prefixo:',(prefSum/1048576).toFixed(1),'MB de',(tot/1048576).toFixed(1),'MB');
console.log('shape distintos',shape.size);
[...shape].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(x=>console.log(' ',x[1],x[0]));
