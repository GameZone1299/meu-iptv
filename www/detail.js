/* Tela de detalhe estilo Netflix (filme/série) com sinopse, metadados TMDB e player embutido.

   Os episódios da série não ficam na memória: são lidos do bloco quando
   a tela abre. Por isso abrirDetalhe mostra "Carregando episódios…" e
   preenche a lista assim que o bloco chega. */

let detailAtual = null;
let dPlayerState = {
  hls: null,
  ts: null,
  video: null,
  ativo: false,
  fullscreen: false,
  itemAtual: null,
  ctrlsTimer: null
};

// Chave da API v3 do TMDB (usada estritamente para consulta na API oficial do TMDB)
const TMDB_V3_KEY = "50f85666595d485eb2c05b1931975376";

function abrirDetalhe(item){
  fecharEmbeddedPlayer();
  detailAtual = item;
  const d = $("#detail");
  const serie = item.tipo === "serie";
  const nome = item.nome;
  const poster = item.logo || "";
  const ano = extractYear(nome);
  const qualidade = detectQuality(nome);
  const tituloLimpo = ano ? nome.replace(new RegExp(`\\s*\\(?${ano}\\)?\\s*$`),"").trim() || nome : nome;

  d.innerHTML = `
    <div class="backdrop" id="dBackdrop" style="${poster ? `background-image:url('${esc(capaMenor(poster,1280))}')` : ""}"></div>
    <button class="close" id="dClose" aria-label="Fechar">✕</button>
    <div class="inner">
      <div class="dhead${poster ? "" : " sem-poster"}">
        <img class="dposter" id="dPosterImg" src="${esc(poster)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="dtext">
          <h1 id="dTitle">${esc(tituloLimpo)}</h1>
          <div class="dmeta" id="dMeta">
            ${ano ? `<span>${ano}</span><span class="dot"></span>` : ""}
            ${qualidade.length ? `<span class="chip">${qualidade[0]}</span>` : ""}
            ${serie ? `<span class="chip" id="dEpsCount">${item.serie && item.serie.epQtd ? item.serie.epQtd + " episódios" : "Série"}</span>` : ""}
            <span class="chip">${esc(item.grupo || "")}</span>
          </div>
        </div>

        <p class="syn" id="dSyn">${esc(item.sinopse || "Buscando informações do título…")}</p>

        <div class="actions" id="dActions">
          <button class="btn-primary" id="dPlay">▶ ${serie ? "Assistir episódio" : "Tela cheia"}</button>
          <button class="btn-ghost" id="dFav">♡ Favorito</button>
          <button class="btn-ghost" id="dMulti">▣ Multi-tela</button>
        </div>
        <div class="play-status" id="dPlayStatus" role="status" aria-live="polite">Preparando reprodução…</div>

        <!-- Player Embutido na tela de detalhes -->
        <div class="dplayer-wrap" id="dPlayerWrap">
          <video id="dVideo" playsinline webkit-playsinline></video>
          <div class="dplayer-ctrls" id="dPlayerCtrls">
            <div class="dplayer-bar" id="dPlayerBar" title="Avançar / Retroceder">
              <div class="dplayer-buf" id="dPlayerBuf"></div>
              <div class="dplayer-prog" id="dPlayerProg"></div>
            </div>
            <button class="dplayer-btn" id="dPlayPauseBtn" title="Reproduzir/Pausar">⏸</button>
            <button class="dplayer-btn" id="dMuteBtn" title="Áudio">🔊</button>
            <span class="dplayer-time" id="dTime">00:00 / 00:00</span>
            <button class="dplayer-btn dplayer-full" id="dFullBtn" title="Expandir para tela cheia">⛶</button>
            <button class="dplayer-btn" id="dStopBtn" title="Fechar player embutido">✕</button>
          </div>
        </div>
      </div>
      ${serie ? `
        <div class="ephead">
          <h3 style="margin:0;font-size:17px">Episódios</h3>
          <span style="flex:1"></span>
          <select id="dSeason" aria-label="Selecionar temporada"></select>
        </div>
        <div class="eps" id="dEps">
          <div style="color:var(--mut);padding:14px 4px">Carregando episódios…</div>
        </div>` : ""}
    </div>`;

  d.classList.add("on");
  document.body.style.overflow = "hidden";

  // Busca metadados e sinopses via TMDB (e fallback Wikipedia)
  buscarMetadados(nome, serie, ano).then(meta => {
    if (detailAtual !== item || !meta) return;
    const synEl = $("#dSyn");
    if (synEl && meta.sinopse) {
      synEl.textContent = meta.sinopse;
      item.sinopse = meta.sinopse;
    }
    const bdEl = $("#dBackdrop");
    if (bdEl && meta.backdrop) {
      bdEl.style.backgroundImage = `url('${esc(meta.backdrop)}')`;
    }
    const postEl = $("#dPosterImg");
    if (postEl && meta.poster) {
      postEl.src = meta.poster;
      postEl.style.visibility = "visible";
    }
    const metaEl = $("#dMeta");
    if (metaEl && meta.rating) {
      const notaEl = document.createElement("span");
      notaEl.className = "tmdb-rating";
      notaEl.textContent = `★ ${meta.rating}`;
      metaEl.prepend(notaEl);
    }
  });

  $("#dClose").onclick = fecharDetalhe;

  const chaveFav = serie ? nome : (item.item && item.item.u) || "";
  const marcarFav = () => {
    const el = $("#dFav");
    if (el) el.textContent = fav.has(chaveFav) ? "♥ Favorito" : "♡ Favorito";
  };
  marcarFav();
  $("#dFav").onclick = () => {
    if (!chaveFav) return;
    if (fav.has(chaveFav)) fav.delete(chaveFav); else fav.add(chaveFav);
    if (typeof invalidarResultadoLista === "function") invalidarResultadoLista();
    sv("gz_fav", [...fav]);
    marcarFav();
    toast(fav.has(chaveFav) ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  $("#dMulti").onclick = () => {
    if (serie) { toast("Multi-tela disponível para canais ao vivo"); return; }
    if (item.item && item.item.t === "live") { closeMulti(); multiOpen([item.item]); fecharDetalhe(); }
    else toast("Multi-tela disponível para canais ao vivo");
  };

  if (serie) {
    const s = item.serie;
    const liberar = async () => {
      let eps = s && s.eps ? s.eps : (s ? await carregarEps(s) : []);
      if (detailAtual !== item) return;
      if (!eps.length) {
        $("#dEps").innerHTML = '<div style="color:var(--mut);padding:14px 4px">Nenhum episódio encontrado para esta série.</div>';
        return;
      }
      const contagem = $("#dEpsCount");
      if (contagem) contagem.textContent = eps.length + " episódio" + (eps.length > 1 ? "s" : "");
      const temporadas = [...new Set(eps.map(e => e.sn || 1))].sort((a,b) => a - b);
      const sel = $("#dSeason");
      sel.innerHTML = temporadas.map(t => `<option value="${t}">Temporada ${t}</option>`).join("");

      const renderT = (t) => {
        $("#dEps").innerHTML = eps.filter(e => (e.sn || 1) === t)
          .sort((a,b) => (a.en || 0) - (b.en || 0))
          .map(e => `
            <div class="ep" tabindex="0" data-url="${esc(e.u || e.url)}">
              <span class="num">${esc(e.et || ("E" + e.en))}</span>
              <span class="nm">${esc(nomeEpisodio(e, nome))}</span>
              <span class="go">▶</span>
            </div>`).join("");
      };
      sel.onchange = () => renderT(+sel.value);
      renderT(temporadas[0]);

      $("#dEps").onclick = e => {
        const ep = e.target.closest(".ep");
        if (!ep) return;
        const it = eps.find(x => (x.u || x.url) === ep.dataset.url);
        if (it) {
          $$("#dEps .ep").forEach(x => x.classList.remove("ativa"));
          ep.classList.add("ativa");
          iniciarReproducaoDetalhe(it,{auto:true});
        }
      };

      const ativo=eps[0];
      if(ativo){
        const primeira=$("#dEps .ep");
        if(primeira)primeira.classList.add("ativa");
        iniciarReproducaoDetalhe(ativo,{auto:true});
      }
      $("#dPlay").onclick = () => expandirPlayerDetalhe();
      $("#dPlay").dataset.pronto = "1";
    };

    if (s && s.eps) liberar();
    else liberar().catch(() => {
      const box = $("#dEps");
      if (box) box.innerHTML = '<div style="color:var(--mut);padding:14px 4px">Não foi possível abrir os episódios desta série.</div>';
    });
  } else {
    $("#dPlay").onclick = () => expandirPlayerDetalhe();
    const itemReproducao=item.item;
    if(itemReproducao&&(itemReproducao.u||itemReproducao.url))iniciarReproducaoDetalhe(itemReproducao,{auto:true});
    else mostrarEstadoPlayer("A fonte IPTV não forneceu um link válido para este filme.");
  }

  configurarControlesPlayerEmbutido();
}

function mostrarEstadoPlayer(texto){
  const status=$("#dPlayStatus");
  if(status)status.textContent=texto;
}
function expandirPlayerDetalhe(){
  const video=$("#dVideo");
  if(!video)return;
  if(dPlayerState.ativo&&!video.paused){toggleFullscreenEmbedded(true);return}
  video.play().then(()=>{mostrarEstadoPlayer("");toggleFullscreenEmbedded(true)}).catch(()=>mostrarEstadoPlayer("A reprodução não iniciou. Pressione ▶ nos controles do player para tentar novamente."));
}

/* Filmes e séries permanecem no player embutido em todas as plataformas,
   mantendo os detalhes visíveis e a posição ao alternar tela cheia. */
function iniciarReproducaoDetalhe(it,{auto=true}={}){
  if (!it) return;
  if (typeof PN !== "undefined" && PN.ok && !auto) {
    // O player nativo não pode ficar atrás do overlay de detalhes; nessa plataforma
    // mantém-se a reprodução dentro da página com o vídeo HTML quando suportado.
  }
  tocarNoPlayerEmbutido(it,{auto});
}

function tocarNoPlayerEmbutido(it,{auto=true}={}){
  const mesmaUrl=dPlayerState.itemAtual&&(dPlayerState.itemAtual.u||dPlayerState.itemAtual.url)===(it.u||it.url);
  if(mesmaUrl&&dPlayerState.ativo){
    if(auto&&dPlayerState.video&&dPlayerState.video.paused)dPlayerState.video.play().catch(()=>mostrarEstadoPlayer("Autoplay bloqueado. Pressione ▶ nos controles para iniciar."));
    return;
  }
  fecharEmbeddedPlayer();
  const wrap = $("#dPlayerWrap");
  const video = $("#dVideo");
  if (!wrap || !video) return;

  const url = it.u || it.url;
  if (!url) return;

  wrap.classList.add("ativo");
  mostrarEstadoPlayer("Carregando vídeo…");
  dPlayerState.ativo = true;
  dPlayerState.itemAtual = it;
  dPlayerState.video = video;

  video.volume = (settings.defaultVolume ?? 100) / 100;
  const isTs = /\.ts(\?|$)/i.test(url);
  const isFile = /\.(mp4|mkv|webm|ogv|mov|m4v|mp3|aac)(\?|$)/i.test(url);
  const isHls = /\.m3u8(\?|$)/i.test(url);

  let savedPos = 0;
  if (settings.rememberPosition) {
    const pos = getPositions();
    if (pos[url]) savedPos = pos[url];
  }

  try {
    if (isTs && window.mpegts && mpegts.getFeatureList().mseLivePlayback) {
      const p = mpegts.createPlayer({ type: "mpegts", isLive: false, url }, configTs(false));
      p.attachMediaElement(video);
      p.load();
      dPlayerState.ts = p;
      p.play().then(()=>mostrarEstadoPlayer("")).catch(()=>mostrarEstadoPlayer("Autoplay bloqueado ou formato não compatível. Pressione ▶ para tentar novamente."));
    } else if ((isHls || (!isFile && !isTs)) && window.Hls && Hls.isSupported()) {
      const h = new Hls(configHls(false));
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => video.play().then(()=>mostrarEstadoPlayer("")).catch(()=>mostrarEstadoPlayer("Autoplay bloqueado. Pressione ▶ nos controles para iniciar.")));
      h.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)mostrarEstadoPlayer("Não foi possível reproduzir este link de vídeo ("+data.details+").")});
      dPlayerState.hls = h;
    } else {
      video.src = url;
      video.play().then(()=>mostrarEstadoPlayer("")).catch(()=>mostrarEstadoPlayer("Autoplay bloqueado ou formato não compatível. Pressione ▶ nos controles para tentar."));
    }
  } catch(e) {
    video.src = url;
    video.play().then(()=>mostrarEstadoPlayer("")).catch(()=>mostrarEstadoPlayer("Não foi possível iniciar automaticamente. Pressione ▶ para tentar."));
  }

  if (savedPos > 0) {
    video.addEventListener("loadedmetadata", () => {
      try { video.currentTime = savedPos; } catch(e){}
    }, { once: true });
  }

  // Salva posição de reprodução continuada
  if (settings.rememberPosition) {
    clearInterval(window._dPosInterval);
    window._dPosInterval = setInterval(() => {
      if (video && video.currentTime > 10 && video.duration - video.currentTime > 15) {
        const p = getPositions();
        p[url] = video.currentTime;
        let durs = {}; try { durs = JSON.parse(localStorage.getItem("gz_durs") || "{}"); } catch(e){}
        durs[url] = video.duration || 0;
        sv("gz_positions", p); sv("gz_durs", durs);
      }
    }, 8000);
  }

  // Rola suavemente até o player
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configurarControlesPlayerEmbutido(){
  const wrap = $("#dPlayerWrap");
  const video = $("#dVideo");
  const playBtn = $("#dPlayPauseBtn");
  const muteBtn = $("#dMuteBtn");
  const fullBtn = $("#dFullBtn");
  const stopBtn = $("#dStopBtn");
  const bar = $("#dPlayerBar");
  const prog = $("#dPlayerProg");
  const buf = $("#dPlayerBuf");
  const time = $("#dTime");

  if (!wrap || !video) return;

  const resetCtrlsTimer = () => {
    wrap.classList.add("show-ctrls");
    clearTimeout(dPlayerState.ctrlsTimer);
    dPlayerState.ctrlsTimer = setTimeout(() => {
      if (!video.paused) wrap.classList.remove("show-ctrls");
    }, 4000);
  };

  wrap.onmousemove = resetCtrlsTimer;
  wrap.ontouchstart = resetCtrlsTimer;

  if (playBtn) playBtn.onclick = () => {
    if (video.paused) { video.play().catch(()=>{}); playBtn.textContent = "⏸"; }
    else { video.pause(); playBtn.textContent = "▶"; }
    resetCtrlsTimer();
  };

  if (muteBtn) muteBtn.onclick = () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
    resetCtrlsTimer();
  };

  if (bar) bar.onclick = e => {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (video.duration) {
      video.currentTime = ratio * video.duration;
    }
  };

  video.ontimeupdate = () => {
    const cur = video.currentTime || 0;
    const dur = video.duration || 0;
    if (dur > 0 && prog) {
      prog.style.width = ((cur / dur) * 100) + "%";
    }
    if (time) {
      time.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
    if (dur > 0 && buf && video.buffered.length) {
      const fim = video.buffered.end(video.buffered.length - 1);
      buf.style.width = Math.min(100, (fim / dur) * 100) + "%";
    }
  };

  video.onplay = () => { if (playBtn) playBtn.textContent = "⏸"; mostrarEstadoPlayer(""); };
  video.onerror = () => mostrarEstadoPlayer("Erro ao carregar o vídeo. Verifique se o link IPTV ainda está válido.");
  video.onpause = () => { if (playBtn) playBtn.textContent = "▶"; wrap.classList.add("show-ctrls"); };

  if (fullBtn) fullBtn.onclick = () => toggleFullscreenEmbedded();
  const acaoPlay=$("#dPlay");
  if(acaoPlay)acaoPlay.onclick=()=>expandirPlayerDetalhe();
  if (stopBtn) stopBtn.onclick = () => fecharEmbeddedPlayer();
}

function toggleFullscreenEmbedded(forcar){
  const wrap = $("#dPlayerWrap");
  if (!wrap) return;
  const entrar = forcar !== undefined ? forcar : !dPlayerState.fullscreen;
  dPlayerState.fullscreen = entrar;
  wrap.classList.toggle("fullscreen", entrar);
  const btn = $("#dFullBtn");
  if (btn) btn.textContent = entrar ? "⛶ Sair da tela cheia" : "⛶";

  if (entrar) {
    if (wrap.requestFullscreen) {
      wrap.requestFullscreen().catch(()=>{});
    } else if (wrap.webkitRequestFullscreen) {
      wrap.webkitRequestFullscreen();
    }
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(()=>{});
    }
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && dPlayerState.fullscreen) {
    toggleFullscreenEmbedded(false);
  }
});

function fecharEmbeddedPlayer(){
  clearInterval(window._dPosInterval);
  clearTimeout(dPlayerState.ctrlsTimer);
  if (dPlayerState.fullscreen) toggleFullscreenEmbedded(false);
  if (dPlayerState.hls) { try { dPlayerState.hls.destroy(); } catch(e){} dPlayerState.hls = null; }
  if (dPlayerState.ts) { try { dPlayerState.ts.destroy(); } catch(e){} dPlayerState.ts = null; }
  const video = $("#dVideo");
  if (video) {
    try { video.pause(); } catch(e){}
    video.removeAttribute("src");
    try { video.load(); } catch(e){}
  }
  const wrap = $("#dPlayerWrap");
  if (wrap) wrap.classList.remove("ativo");
  dPlayerState.ativo = false;
  dPlayerState.itemAtual = null;
}

function nomeEpisodio(e, serieNome){
  const codigo = esc(e.et || ("E" + e.en));
  let t = String(e.n || "");
  if (serieNome && t.toLowerCase().startsWith(serieNome.toLowerCase())) t = t.slice(serieNome.length);
  t = t.replace(/S\d{1,2}\s*E\d{1,3}/gi,"")
    .replace(/^[\s\-–—:|.]+/,"")
    .replace(/[\s\-–—:|.]+$/,"")
    .trim();
  return t || ("Episódio " + (e.en || codigo));
}

function fecharDetalhe(){
  fecharEmbeddedPlayer();
  const d = $("#detail");
  d.classList.remove("on");
  d.innerHTML = "";
  document.body.style.overflow = "";
  detailAtual = null;
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("#detail").classList.contains("on")) {
    if (dPlayerState.fullscreen) {
      e.preventDefault();
      toggleFullscreenEmbedded(false);
      return;
    }
    e.preventDefault();
    fecharDetalhe();
  }
});

/* ---------------- TMDB e Sinopses ----------------
   Consulta direta aos metadados oficiais via TMDB v3 com chave incorporada.
   Cache persistente em memória e IndexedDB.
   Fallback inteligente para Wikipédia caso não encontre no TMDB. */
const sinopseCache = new Map();

function limparTitulo(nome){
  return nome
    .replace(/\[[^\]]*\]/g,"")
    .replace(/\((?:19|20)\d{2}\)/g,"")
    .replace(/\b(4K|UHD|FHD|HD|SD|2160p|1080p|720p|480p|LEG|DUB|Dublado|Legendado)\b/gi,"")
    .replace(/\s*[-–—]\s*$/,"")
    .replace(/\s+/g," ")
    .trim();
}

const metadadosPendentes=new Map();
const TMDB_CACHE_VERSION="tmdb-v2";
function chaveMetadados(nome,tipoSerie,ano){
  return `${TMDB_CACHE_VERSION}:${tipoSerie?"tv":"movie"}:${chaveBusca(limparTitulo(nome))}:${ano||""}`;
}
function chaveConteudo(item,tipo){
  const identificador=tipo==="serie"?(item.serie&&item.serie.nome||item.nome):(item.item&&(item.item.u||item.item.url)||item.nome);
  return chaveMetadados(identificador,tipo==="serie",extractYear(identificador));
}
async function buscarMetadados(nome, tipoSerie, ano){
  const chave = chaveMetadados(nome,tipoSerie,ano);
  if (sinopseCache.has(chave)) return sinopseCache.get(chave);
  if(metadadosPendentes.has(chave))return metadadosPendentes.get(chave);
  const promessa=(async()=>{
  try {
    const cache = await cacheGet(chave);
    if (cache && typeof cache === "object") {
      sinopseCache.set(chave, cache);
      return cache;
    }
  } catch(e){}

  const titulo = limparTitulo(nome);
  if (!titulo) return null;

  let meta = null;
  const tmdbChave = (settings && settings.tmdbKey) ? settings.tmdbKey : TMDB_V3_KEY;
  if (tmdbChave) {
    try {
      meta = await consultarTMDB(titulo, tipoSerie, ano, tmdbChave);
    } catch(e){}
  }

  if (!meta || !meta.sinopse) {
    try {
      const txtWiki = await sinopseWiki(titulo, tipoSerie);
      if (txtWiki) {
        meta = meta || {};
        meta.sinopse = txtWiki;
      }
    } catch(e){}
  }

  if (meta) {
    sinopseCache.set(chave, meta);
    try { await cacheSet(chave, meta); } catch(e){}
  }
  return meta;
  })();
  metadadosPendentes.set(chave,promessa);
  try{return await promessa}finally{metadadosPendentes.delete(chave)}
}

async function consultarTMDB(titulo, tipoSerie, ano, chave){
  const base = "https://api.themoviedb.org/3";
  const tipo = tipoSerie ? "tv" : "movie";
  let u = `${base}/search/${tipo}?api_key=${encodeURIComponent(chave)}&language=pt-BR&query=${encodeURIComponent(titulo)}`;
  if (ano) u += `&${tipoSerie ? "first_air_date_year" : "year"}=${encodeURIComponent(ano)}`;

  await aguardarTMDB();
  let r = await fetch(u);
  if (!r.ok) {
    if (ano) {
      u = `${base}/search/${tipo}?api_key=${encodeURIComponent(chave)}&language=pt-BR&query=${encodeURIComponent(titulo)}`;
      r = await fetch(u);
    }
  }
  if (!r.ok) return null;

  const j = await r.json();
  const tituloNorm=chaveBusca(titulo);
  const hits=j.results||[];
  const tituloCorresponde=x=>{
    const titulos=[x.title,x.name,x.original_title,x.original_name].filter(Boolean).map(chaveBusca);
    if(!titulos.includes(tituloNorm))return false;
    const data=x.release_date||x.first_air_date||"";
    const anoResultado=data.slice(0,4);
    return !ano||!anoResultado||String(ano)===anoResultado;
  };
  const hit=hits.find(tituloCorresponde);
  if (!hit) return null;

  return {
    sinopse: hit.overview ? hit.overview.trim() : null,
    backdrop: hit.backdrop_path ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}` : null,
    poster: hit.poster_path ? `https://image.tmdb.org/t/p/w780${hit.poster_path}` : null,
    rating: hit.vote_average ? Number(hit.vote_average).toFixed(1) : null,
    ano: (hit.release_date || hit.first_air_date || "").slice(0,4) || ano || null,
    titulo: hit.title || hit.name || null
  };
}

async function sinopseWiki(titulo, tipoSerie){
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"");
  const alvo = norm(titulo);
  const u = "https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch=" + encodeURIComponent(titulo + " " + (tipoSerie ? "série" : "filme"));
  const r = await fetch(u);
  if (!r.ok) return null;
  const j = await r.json();
  const hits = ((j.query || {}).search) || [];
  const match = hits.find(h => {
    const t = norm(h.title);
    return t === alvo || t === norm(titulo + " filme") || t === norm(titulo + " serie") || t === norm(titulo + " série");
  });
  if (!match) return null;
  const r2 = await fetch("https://pt.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(match.title.replace(/ /g,"_")));
  if (!r2.ok) return null;
  const s = await r2.json();
  if (s.type === "disambiguation") return null;
  const ex = (s.extract || "").trim();
  if (ex.length < 80) return null;
  return ex;
}
