/* Carregamento da biblioteca: listas do app + arquivos Importados + links M3U.

   Cada fonte entrega os itens prontos; a biblioteca junta tudo, normaliza as
   categorias e libera a interface. */
let carregando=false;

async function carregarTudo(){
  if(carregando)return;
  carregando=true;
  errs=[];
  resetLib();
  const status=$("#err");
  status.textContent="Carregando listas…";
  try{await migrateOldLists()}catch(e){}

  const erros=[];
  let arquivos=[];
  try{arquivos=await listFiles()}catch(e){erros.push("Não foi possível abrir o armazenamento: "+e.message)}

  const progresso=(msg)=>{status.textContent=msg};

  // 1) Catálogo embutido: manter filmes/séries/adultos, substituir canais antigos.
  let embutidas=[];
  try{embutidas=await builtinAtivas()}catch(e){}
  if(embutidas.length){
    try{
      await carregarEmbutida(n=>progresso("Carregando biblioteca do app: "+n),{semCanais:true});
    }catch(e){erros.push("Biblioteca do app → "+e.message)}
  }

  // TV ao vivo é carregada somente ao entrar na seção, uma lista por vez.
  Lib.live=[];
  Lib.livePlaylistId="";

  // 3) Arquivos importados pelo usuário (só acrescenta conteúdo não-TV).
  for(const rec of arquivos){
    progresso("Carregando "+rec.name+"…");
    try{
      if(rec.modo==="compacto"){
        const fonte=fonteLista(rec);
        const ler=async(n)=>fonte.carregar(n);
        for(const a of rec.arquivos){
          if(/bib-eps/.test(a))continue;
          const buf=await ler(a);
          if(/bib-filmes/.test(a))Lib.movies.push(...Bib.lerItens(buf));
          else if(/bib-live/.test(a)){ /* TV ao vivo antiga substituída pelas quatro fontes empacotadas. */ }
          else if(/bib-adult/.test(a))Lib.adult.push(...Bib.lerItens(buf));
          else if(/bib-series/.test(a)){
            for(const s of Bib.lerSeries(buf)){s._fonte=fonte;Lib.series.push(s)}
          }
        }
        addFonte(fonte);
      }else{
        // formato antigo: texto cru
        const texto=await readListText(rec);
        if(!texto||!/#EXT/.test(texto)){erros.push(rec.name+" → arquivo não parece ser M3U");continue}
        const itens=Bib.compilar([texto]);
        await aplicarCompilado(itens,{semCanais:true});
      }
    }catch(e){erros.push(rec.name+" → "+e.message)}
  }

  // 4) Links M3U antigos não alimentam mais a TV ao vivo; preservá-los no
  // armazenamento permite manter o restante do conteúdo importado intacto.
  for(const u of listaUrls){
    progresso("Baixando "+u.slice(0,60)+"…");
    try{
      const r=await fetch(u);
      if(!r.ok)throw new Error("HTTP "+r.status);
      const texto=await r.text();
      if(!/#EXT/.test(texto)){erros.push(u+" → arquivo não parece ser M3U");continue}
      await aplicarCompilado(Bib.compilar([texto]),{semCanais:true});
    }catch(e){erros.push(u+" → "+e.message)}
  }

  montarBiblioteca();
  errs=erros;
  status.textContent=erros.length?"Alguns itens não puderam ser carregados:\n"+erros.join("\n"):"";
  if(Lib.ready)localStorage.setItem("gz_lastLoad",Date.now().toString());
  carregando=false;
  aplicarPreferenciasAdulto();
  atualizarHome();
  if(scr!=="home"){renderSide();renderList()}
}

/* Itens compilados na hora (link M3U / arquivo em formato antigo):
   tudo entra na memória e os episódios também, porque a fonte é temporária. */
async function aplicarCompilado(compilado,opcoes={}){
  const {arquivos,chunk}=compilado;
  const fonte={id:"mem_"+Date.now(),chunk,carregar:async(n)=>{throw new Error("bloco não disponível")}};
  for(const [nome,buf] of Object.entries(arquivos)){
    if(/bib-eps/.test(nome)){
      const eps=Bib.lerEps(buf);
      const k=parseInt(nome.match(/bib-eps-(\d+)/)[1],10);
      Lib._epsCache.set(fonte.id+"|bib-eps-"+String(k).padStart(3,"0")+".bin",eps);
    }else if(/bib-filmes/.test(nome))Lib.movies.push(...Bib.lerItens(buf));
    else if(/bib-live/.test(nome)&&!opcoes.semCanais)Lib.live.push(...Bib.lerItens(buf));
    else if(/bib-adult/.test(nome))Lib.adult.push(...Bib.lerItens(buf));
    else if(/bib-series/.test(nome)){
      for(const s of Bib.lerSeries(buf)){s._fonte=fonte;Lib.series.push(s)}
    }
  }
  addFonte(fonte);
}
