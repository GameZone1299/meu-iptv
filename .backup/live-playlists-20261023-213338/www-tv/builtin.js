/* Listas embutidas, agora no formato compacto (bib.js).

   Antes: dois .m3u gzipados (10 MB) que eram descomprimidos e transformados
   em ~500 MB de objetos na memória do celular — o Android matava o app.
   Agora: a biblioteca já vem num binário indexado. Só filmes, séries e canais
   ficam na memória (~30 MB); os 521 mil episódios são lidos por bloco quando
   a série é aberta. */

const BUILTIN_OFF_KEY = "gz_builtin_off";
let _bibManifesto = null;

function builtinDesligadas() {
  try { return JSON.parse(localStorage.getItem(BUILTIN_OFF_KEY) || "[]") } catch (e) { return [] }
}
function builtinDesligar(key, desligar) {
  let off = builtinDesligadas().filter(k => k !== key);
  if (desligar) off.push(key);
  try { localStorage.setItem(BUILTIN_OFF_KEY, JSON.stringify(off)) } catch (e) {}
}

async function builtinManifesto() {
  if (_bibManifesto) return _bibManifesto;
  try {
    const r = await fetch("assets/listas/bib-manifest.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    _bibManifesto = await r.json();
  } catch (e) {
    _bibManifesto = { versao: 2, arquivos: [], totais: {}, chunk: 8192 };
  }
  return _bibManifesto;
}

/* gzip -> ArrayBuffer, com DecompressionStream ou fflate (WebViews antigas) */
async function descomprimir(buf) {
  if ("DecompressionStream" in self) {
    try {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([buf]).stream().pipeThrough(ds);
      return await new Response(stream).arrayBuffer();
    } catch (e) { /* cai no fflate */ }
  }
  if (self.fflate && self.fflate.gunzipSync) {
    const out = self.fflate.gunzipSync(new Uint8Array(buf));
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  throw new Error("não foi possível descomprimir a lista neste dispositivo");
}

/* Uma "fonte" sabe carregar um arquivo da biblioteca pelo nome. */
function fonteEmbutida() {
  return {
    id: "app",
    chunk: 8192,
    async carregar(nome) {
      const r = await fetch("assets/listas/" + nome + ".gzbin");
      if (!r.ok) throw new Error("HTTP " + r.status + " em " + nome);
      return descomprimir(await r.arrayBuffer());
    }
  };
}
function fonteImportada(rec) {
  return {
    id: rec.id,
    chunk: rec.chunk || 8192,
    async carregar(nome) {
      const b = await idbGet("lists", rec.id + "/" + nome);
      if (!b || !b.dados) throw new Error("bloco ausente: " + nome);
      return b.dados;
    }
  };
}

async function builtinAtivas() {
  const m = await builtinManifesto();
  const off = builtinDesligadas();
  const listas = m.listas || [{ key: "tudo", nome: "Biblioteca do app" }];
  return listas.filter(l => !off.includes(l.key));
}

function builtinTodas() {
  return builtinManifesto().then(m => m.listas || [{ key: "tudo", nome: "Biblioteca do app" }]);
}

/* Carrega a biblioteca embutida dentro de Lib (chamado por carregarTudo) */
async function carregarEmbutida(progresso) {
  const m = await builtinManifesto();
  if (!m.arquivos || !m.arquivos.length) throw new Error("biblioteca do app não encontrada");
  const fonte = fonteEmbutida();
  fonte.chunk = m.chunk || 8192;

  const baixar = async (a) => {
    progresso && progresso(a);
    return descomprimir(await (await fetch("assets/listas/" + a + ".gzbin")).arrayBuffer());
  };

  // Só os catálogos ficam residentes; os blocos de episódios são lidos sob demanda.
  const arquivos = m.arquivos.filter(a => !/bib-eps/.test(a));
  const buffers = await Promise.all(arquivos.map(baixar));

  arquivos.forEach((a, i) => {
    const buf = buffers[i];
    if (/bib-filmes/.test(a)) Lib.movies.push(...Bib.lerItens(buf));
    else if (/bib-live/.test(a)) Lib.live.push(...Bib.lerItens(buf));
    else if (/bib-adult/.test(a)) Lib.adult.push(...Bib.lerItens(buf));
    else if (/bib-series/.test(a)) {
      for (const s of Bib.lerSeries(buf)) {
        s._fonte = fonte;
        Lib.series.push(s);
      }
    }
  });
  addFonte(fonte);
  return { embutida: true, totais: m.totais || {} };
}
