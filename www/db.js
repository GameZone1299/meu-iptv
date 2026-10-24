/* Armazenamento persistente das playlists (IndexedDB).

   Antes, o texto cru da lista era guardado e reinterpretado a cada abertura.
   Agora cada arquivo importado é convertido uma única vez para o formato
   compacto (bib.js) e guardado em blocos — abrir o app depois disso é rápido
   e não consome memória proporcional ao tamanho da lista. */
const DB_NAME="gamezone_iptv";
const DB_VER=1;
let _db=null;

function openDB(){
  if(_db)return Promise.resolve(_db);
  return new Promise((res,rej)=>{
    if(!self.indexedDB)return rej(new Error("IndexedDB indisponível"));
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains("lists"))db.createObjectStore("lists",{keyPath:"id"});
      if(!db.objectStoreNames.contains("meta"))db.createObjectStore("meta",{keyPath:"k"});
      if(!db.objectStoreNames.contains("cache"))db.createObjectStore("cache",{keyPath:"k"});
    };
    req.onsuccess=()=>{_db=req.result;res(_db)};
    req.onerror=()=>rej(req.error);
  });
}
function tx(store,mode){
  return openDB().then(db=>db.transaction(store,mode).objectStore(store));
}
function idbPut(store,val){
  return tx(store,"readwrite").then(s=>new Promise((res,rej)=>{
    const r=s.put(val);
    r.onsuccess=()=>res(true);
    r.onerror=()=>rej(r.error);
  }));
}
function idbGet(store,key){
  return tx(store,"readonly").then(s=>new Promise((res,rej)=>{
    const r=s.get(key);
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  }));
}
function idbAll(store){
  return tx(store,"readonly").then(s=>new Promise((res,rej)=>{
    const r=s.getAll();
    r.onsuccess=()=>res(r.result||[]);
    r.onerror=()=>rej(r.error);
  }));
}
function idbDel(store,key){
  return tx(store,"readwrite").then(s=>new Promise((res,rej)=>{
    const r=s.delete(key);
    r.onsuccess=()=>res(true);
    r.onerror=()=>rej(r.error);
  }));
}

/* Importa uma lista: converte para a biblioteca compacta e guarda os blocos.
   Reimportar um arquivo de mesmo nome substitui o anterior. */
async function importarLista(name,text,kind,aoProgredir){
  const antigos=await idbAll("lists").catch(()=>[]);
  for(const a of antigos){
    if(a.name===name)await apagarLista(a.id).catch(()=>{});
  }
  const id="list_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
  const {arquivos,chunk,totais}=Bib.compilar([text]);
  const nomes=Object.keys(arquivos);
  for(let i=0;i<nomes.length;i++){
    const n=nomes[i];
    // Guarda o binário já pronto: nenhuma reinterpretação é feita ao abrir.
    await idbPut("cache",{k:id+"/"+n,dados:arquivos[n]});
    aoProgredir&&aoProgredir(i+1,nomes.length);
  }
  await idbPut("lists",{
    id,name,kind,addedAt:Date.now(),modo:"compacto",
    chunk,totais,arquivos:nomes
  });
  return id;
}

/* Compatibilidade: listas guardadas no formato antigo (texto/gzip) continuam
   abrindo; a conversão acontece uma vez, na primeira leitura. */
async function readListText(rec){
  if(typeof rec.payload==="string")return rec.payload;
  if(rec.payload&&rec.payload.gzip&&"DecompressionStream" in self){
    const ds=new DecompressionStream("gzip");
    const stream=new Blob([rec.payload.data]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  return "";
}

/* Fonte de leitura de uma lista importada (usada pela biblioteca) */
function fonteLista(rec){
  return {
    id:rec.id,
    chunk:rec.chunk||Bib.CHUNK,
    async carregar(nome){
      const b=await idbGet("cache",rec.id+"/"+nome);
      if(!b||!b.dados)throw new Error("bloco ausente: "+nome);
      return b.dados;
    }
  };
}

async function listFiles(){
  const all=await idbAll("lists");
  return all.map(r=>({
    id:r.id,name:r.name,kind:r.kind,addedAt:r.addedAt,
    size:r.size||0,modo:r.modo||"texto",totais:r.totais||null,
    // O carregador percorre `arquivos` para saber quais blocos abrir. Sem
    // isso, uma lista importada aparecia na tela mas nunca era lida.
    arquivos:r.arquivos||[],chunk:r.chunk||Bib.CHUNK
  }));
}
async function apagarLista(id){
  const rec=await idbGet("lists",id);
  if(rec&&rec.arquivos){
    for(const n of rec.arquivos)await idbDel("cache",id+"/"+n).catch(()=>{});
  }
  return idbDel("lists",id);
}

/* Cache genérico (metadados de sinopse, estado) */
async function cacheSet(k,v){return idbPut("cache",{k,v,t:Date.now()})}
async function cacheGet(k){const r=await idbGet("cache",k);return r&&r.v!==undefined?r.v:null}
async function metaSet(k,v){return idbPut("meta",{k,v})}
async function metaGet(k){const r=await idbGet("meta",k);return r?r.v:null}

/* Migração única: move listas antigas do localStorage para o IndexedDB */
async function migrateOldLists(){
  let old;
  try{old=JSON.parse(localStorage.getItem("iptv_files")||"null")}catch(e){return}
  if(!old)return;
  for(const kind of["live","movies","series"]){
    for(const f of (old[kind]||[])){
      if(f&&f.text)await importarLista(f.name||"Lista",f.text,kind).catch(()=>{});
    }
  }
  try{localStorage.removeItem("iptv_files")}catch(e){}
}
