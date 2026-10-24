const fs=require('fs'),zlib=require('zlib'),Bib=require('../www/bib.js');
function load(p){return zlib.gunzipSync(fs.readFileSync(p)).buffer.slice(0)}
const mb=n=>(n/1048576).toFixed(1);
let t=Date.now();
const filmes=Bib.lerItens(load('.tmp/bib/bib-filmes.bin.gz'));
console.log('filmes',filmes.length,'em',Date.now()-t,'ms; heap',mb(process.memoryUsage().heapUsed));
t=Date.now();
const series=Bib.lerSeries(load('.tmp/bib/bib-series.bin.gz'));
console.log('series',series.length,'em',Date.now()-t,'ms; heap',mb(process.memoryUsage().heapUsed));
const live=Bib.lerItens(load('.tmp/bib/bib-live.bin.gz'));
const adult=Bib.lerItens(load('.tmp/bib/bib-adult.bin.gz'));
console.log('live',live.length,'adult',adult.length);
console.log('ex filme',filmes[0]);
console.log('ex serie',series[0],series[0].epQtd);
const eps=Bib.lerEps(load('.tmp/bib/bib-eps-000.bin.gz'));
console.log('eps bloco0',eps.length,eps[0]);
// confere um episódio do bloco da série 0
console.log('série 0 epIni',series[0].epIni,'epQtd',series[0].epQtd);
const c=Math.floor(series[0].epIni/Bib.CHUNK);
const ch=Bib.lerEps(load('.tmp/bib/bib-eps-'+String(c).padStart(3,'0')+'.bin.gz'));
const off=series[0].epIni-c*Bib.CHUNK;
console.log('primeiro ep da série 0:',ch[off]);
// totais
let tot=0;for(let k=0;k<64;k++){tot+=Bib.lerEps(load('.tmp/bib/bib-eps-'+String(k).padStart(3,'0')+'.bin.gz')).length}
console.log('total eps',tot,'heap final',mb(process.memoryUsage().heapUsed),'rss',mb(process.memoryUsage().rss));
