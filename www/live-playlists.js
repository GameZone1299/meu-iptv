/* Listas de TV ao vivo empacotadas. Carrega somente a fonte selecionada. */
const LIVE_PLAYLISTS = [
  { id: "lista-1", name: "Lista 1", file: "CanaisBR02.m3u8" },
  { id: "lista-2", name: "Lista 2", file: "CanaisBR03.m3u8" },
  { id: "lista-3", name: "Lista 3", file: "CanaisBR04.m3u8" },
  { id: "lista-4", name: "Lista 4", file: "CanaisIPTV.m3u8" }
];
const LIVE_LIST_KEY = "gz_live_list_selected";
const LIVE_PLAYLIST_BASE = "assets/live-playlists/";
function isLivePlaylistItem(item) {
  const group = String(item.g || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const name = String(item.n || "").trim();
  const url = String(item.u || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\b(filmes?|movies?|series?|temporadas?|episodios?|vod|amazon\s*\|)/i.test(group)) return false;
  if (/\.(mkv|mp4|avi|mov|m4v|webm)(?:[?#]|$)/i.test(url)) return false;
  if (/\bS\d{1,2}\s*E\d{1,3}\b/i.test(name) || /\(?(?:19|20)\d{2}\)?/.test(name)) return false;
  if (/\b(canais?|tv|ao vivo|live)\b/i.test(group)) return true;
  return /\.(?:m3u8|ts)(?:[?#]|$)/i.test(url) || Bib.classify(item) === "live";
}

let livePlaylistIndex = 0;
let livePlaylistCache = { id: "", canais: [] };
let livePlaylistGeneration = 0;

function livePlaylistSelected() {
  try {
    const id = localStorage.getItem(LIVE_LIST_KEY);
    const index = LIVE_PLAYLISTS.findIndex(list => list.id === id);
    if (index >= 0) livePlaylistIndex = index;
  } catch (e) {}
  return livePlaylistIndex;
}

function setLivePlaylistSelected(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LIVE_PLAYLISTS.length) return;
  livePlaylistIndex = index;
  try { localStorage.setItem(LIVE_LIST_KEY, LIVE_PLAYLISTS[index].id) } catch (e) {}
}

async function carregarListasAoVivo(progresso, index = livePlaylistSelected(), recarregar = false) {
  const playlist = LIVE_PLAYLISTS[index];
  if (!playlist) return { canais: [], erros: ["Lista ao vivo inválida."], fontes: [] };
  if (!recarregar && livePlaylistCache.id === playlist.id) {
    return { canais: livePlaylistCache.canais, erros: [], fontes: [] };
  }
  progresso && progresso("Carregando " + playlist.name + "…");
  try {
    const response = await fetch(LIVE_PLAYLIST_BASE + encodeURIComponent(playlist.file));
    if (!response.ok) throw new Error("HTTP " + response.status);
    const canais = [];
    const seen = new Set();
    let buffer = "", current = null, header = false, entries = 0, ignored = 0;
    const processLine = line => {
      const value = line.trim();
      if (!value) return;
      if (!header) {
        if (!value.startsWith("#EXTM3U")) throw new Error("cabeçalho M3U inválido");
        header = true;
        return;
      }
      if (value.startsWith("#EXTINF")) {
        entries++;
        const attrs = {};
        const re = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
        let match;
        while ((match = re.exec(value))) attrs[match[1]] = match[2];
        const comma = value.indexOf(",");
        current = {
          n: (attrs["tvg-name"] || (comma >= 0 ? value.slice(comma + 1) : "")).trim(),
          l: attrs["tvg-logo"] || "",
          g: (attrs["group-title"] || "").trim()
        };
      } else if (!value.startsWith("#") && current) {
        const url = value;
        const item = { n: current.n, u: url, l: current.l, g: current.g };
        if (current.n && !seen.has(url)) {
          seen.add(url);
          if (isLivePlaylistItem(item)) canais.push(item);
          else ignored++;
        }
        current = null;
      }
    };
    const reader = response.body && response.body.getReader ? response.body.getReader() : null;
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
        if (done) break;
      }
    } else {
      buffer = await response.text();
      const lines = buffer.split(/\r?\n/);
      buffer = "";
      for (const line of lines) processLine(line);
    }
    if (buffer) processLine(buffer);
    if (!header || !entries) throw new Error("arquivo não é uma playlist M3U com canais");
    if (!canais.length) throw new Error("nenhum canal com nome e endereço válido");
    livePlaylistCache = { id: playlist.id, canais };
    const avisos = ignored ? [`${ignored.toLocaleString("pt-BR")} itens de filmes/séries ignorados`] : [];
    return { canais, erros: avisos, fontes: [] };
  } catch (error) {
    return { canais: [], erros: [playlist.name + " → " + (error.message || "falha ao carregar")], fontes: [] };
  }
}

async function carregarListaAoVivoSelecionada(recarregar = false) {
  const index = livePlaylistSelected();
  const playlist = LIVE_PLAYLISTS[index];
  const generation = ++livePlaylistGeneration;
  const status = $("#livePlaylistStatus");
  if (status) status.textContent = "Carregando " + playlist.name + "…";
  window.livePlaylistLoading = true;
  try {
    const result = await carregarListasAoVivo(msg => {
      if (generation === livePlaylistGeneration && status) status.textContent = msg;
    }, index, recarregar);
    if (generation !== livePlaylistGeneration) return;
    Lib.live = result.canais;
    Lib.livePlaylistId = playlist.id;
    Lib._generation = (Lib._generation || 0) + 1;
    invalidarResultadoLista();
    Lib._todos = null;
    cat.live = "";
    montarBiblioteca();
    if (status) status.textContent = result.erros.join("\n");
    atualizarHome();
    if (scr === "live") { renderSide(); renderList() }
  } catch (error) {
    if (generation === livePlaylistGeneration) {
      Lib.live = [];
      Lib.livePlaylistId = playlist.id;
      Lib._generation = (Lib._generation || 0) + 1;
      invalidarResultadoLista();
      Lib._todos = null;
      montarBiblioteca();
      if (status) status.textContent = playlist.name + " → " + (error.message || "falha ao carregar");
      if (scr === "live") { renderSide(); renderList() }
    }
  } finally {
    if (generation === livePlaylistGeneration) window.livePlaylistLoading = false;
  }
}

function montarSeletorListasAoVivo() {
  const select = $("#livePlaylistSelect");
  const reload = $("#livePlaylistReload");
  const controls = $("#livePlaylistControls");
  if (!select) return;
  if (controls) controls.classList.add("hidden");
  const selected = livePlaylistSelected();
  select.innerHTML = LIVE_PLAYLISTS.map((list, index) =>
    `<option value="${index}">${list.name}${livePlaylistCache.id===list.id?` · ${livePlaylistCache.canais.length.toLocaleString("pt-BR")} canais`:""}</option>`).join("");
  select.value = String(selected);
  select.onchange = () => {
    setLivePlaylistSelected(Number(select.value));
    livePlaylistCache = { id: "", canais: [] };
    Lib.live = [];
    Lib.livePlaylistId = "";
    Lib._generation = (Lib._generation || 0) + 1;
    invalidarResultadoLista();
    Lib._todos = null;
    carregarListaAoVivoSelecionada();
  };
  if (reload) reload.onclick = () => {
    livePlaylistCache = { id: "", canais: [] };
    carregarListaAoVivoSelecionada(true).finally(montarSeletorListasAoVivo);
  };
}

document.addEventListener("DOMContentLoaded", montarSeletorListasAoVivo, { once: true });
