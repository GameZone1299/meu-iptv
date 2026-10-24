const fs=require('fs'),zlib=require('zlib'),Bib=require('../www/bib.js');
const load=p=>zlib.gunzipSync(fs.readFileSync(p)).buffer.slice(0);
const series=Bib.lerSeries(load('.tmp/bib/bib-series.bin.gz'));
const um=series.filter(s=>s.epQtd===1);
console.log('séries',series.length,'com 1 episódio',um.length);
const pats={'1x01':/\b\d{1,2}\s*x\s*\d{1,3}\b/i,'T1E1':/\bT\d{1,2}\s*E\d{1,3}\b/i,'EP':/\bEP?\s*\.?\s*\d{1,3}\b/i,'TEMP':/\bTEMP(ORADA)?\s*\d/i,'CAP':/\bCAP[IÍ]TULO\s*\d/i,'SxxExx':/\bS\d{1,2}\s*E\d{1,3}\b/i};
for(const [k,re] of Object.entries(pats)){
  const n=um.filter(s=>re.test(s.nome));console.log(' 1-ep com',k,n,n?JSON.stringify(um.find(s=>re.test(s.nome))?.nome):'');
}
console.log('exemplos 1-ep:',um.slice(0,12).map(s=>s.nome+' | '+s.grupo));
const grupos={};for(const s of series)grupos[s.grupo]=(grupos[s.grupo]||0)+1;
console.log('grupos séries',Object.keys(grupos).length, Object.entries(grupos).sort((a,b)=>b[1]-a[1]).slice(0,12));
