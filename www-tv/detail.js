/* Detalhes de filmes e séries com informações opcionais do TMDB. */
const tvMetaPending=new Map();
async function tvFetchMetadata(item,isSeries){
  const titleText=item.nome||item.n||'',kind=isSeries?'tv':'movie';
  const key=state.settings.tmdbKey||'';
  if(!key||!titleText)return null;
  const cacheKey='gz_tv_meta_'+kind+'_'+chaveBusca(titleText);
  try{const saved=localStorage.getItem(cacheKey);if(saved)return JSON.parse(saved)}catch(e){}
  if(tvMetaPending.has(cacheKey))return tvMetaPending.get(cacheKey);
  const task=(async()=>{try{
    const clean=titleText.replace(/\s*\((?:19|20)\d{2}\)\s*$/,'').trim();
    const year=(titleText.match(/\b(?:19|20)\d{2}\b/)||[])[0];
    let url=`https://api.themoviedb.org/3/search/${kind}?api_key=${encodeURIComponent(key)}&language=pt-BR&query=${encodeURIComponent(clean)}`;
    if(year)url+=`&${isSeries?'first_air_date_year':'year'}=${year}`;
    const response=await fetch(url);if(!response.ok)return null;
    const result=await response.json(),needle=chaveBusca(clean);
    const hit=(result.results||[]).find(row=>[row.title,row.name,row.original_title,row.original_name].filter(Boolean).some(value=>chaveBusca(value)===needle));
    if(!hit)return null;
    const meta={poster:hit.poster_path?`https://image.tmdb.org/t/p/w500${hit.poster_path}`:'',backdrop:hit.backdrop_path?`https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`:'',overview:hit.overview||'',rating:hit.vote_average?Number(hit.vote_average).toFixed(1):''};
    try{localStorage.setItem(cacheKey,JSON.stringify(meta))}catch(e){}
    return meta;
  }catch(e){return null}})();
  tvMetaPending.set(cacheKey,task);try{return await task}finally{tvMetaPending.delete(cacheKey)}
}
