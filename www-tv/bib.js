/* ==========================================================
   Formato compacto da biblioteca (GZL1)

   O problema que isto resolve: as listas têm 574 mil entradas. Ler tudo
   para a memória como objetos JS custava ~500 MB, e o Android matava o
   aplicativo depois de alguns minutos.

   Aqui os dados ficam num binário com strings em UTF-8 e índices numéricos.
   O app carrega só o que precisa: filmes, séries (sem episódios), canais.
   Os 521 mil episódios ficam em blocos e só o bloco da série aberta é lido.

   Usado em dois lugares:
     - no build (Node) para gerar assets/listas/bib-*.bin
     - no navegador para compilar arquivos que o usuário importa
   ========================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Bib = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MAGIC = 0x314c5a47; // "GZL1"
  const CHUNK = 8192; // episódios por bloco

  /* ---------- classificação (mesma regra de antes) ---------- */
  const ADULT_RE = /\b(adulto|adultos|adult|xxx|porn|er[oó]tic|18\+)\b/i;
  const EP_RE = /\s*[-–—]?\s*S(\d{1,2})\s*E(\d{1,3})\s*$/i;
  const MARCA_RE = /^[\[(]\s*(l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)\s*[\])]\s*(\(?\d{4}\)?)?$/i;

  function classify(it) {
    const g = (it.g || "").toLowerCase();
    const u = (it.u || "").toLowerCase();
    if (/\/movie\//.test(u)) return "movies";
    if (/\/series\//.test(u)) return "series";
    if (/\/(live|hls)\/|\/\d+\.(ts|m3u8)$/.test(u)) return "live";
    if (g.startsWith("series") || g.startsWith("séries") || g.startsWith("series |") || g.startsWith("séries |")) return "series";
    if (g.startsWith("filme") || g.startsWith("filmes") || g.includes("filmes")) return "movies";
    if (g.startsWith("coletânea") || g.startsWith("coletanea")) return "series";
    return "live";
  }

  function parseM3U(txt) {
    const out = [];
    let cur = null;
    const lines = txt.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      if (l.startsWith("#EXTINF")) {
        const attrs = {};
        const re = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
        let m;
        while ((m = re.exec(l))) attrs[m[1]] = m[2];
        const comma = l.indexOf(",");
        cur = {
          n: (attrs["tvg-name"] || (comma >= 0 ? l.slice(comma + 1) : "")).trim(),
          l: attrs["tvg-logo"] || "",
          g: (attrs["group-title"] || "").trim(),
        };
      } else if (!l.startsWith("#") && cur) {
        cur.u = l;
        out.push(cur);
        cur = null;
      }
    }
    return out;
  }

  /* ---------- string pools ---------- */
  function pool() {
    const map = new Map();
    const list = [];
    return {
      id(s) {
        if (!s) return 0xffffffff;
        let i = map.get(s);
        if (i === undefined) {
          i = list.length;
          map.set(s, i);
          list.push(s);
        }
        return i;
      },
      list,
    };
  }

  /* ---------- compilar: textos M3U -> arquivos binários ---------- */
  /* Devolve { arquivos: {nome: ArrayBuffer}, totais: {...} } */
  function compilar(textos) {
    const nomes = pool(), urls = pool(), logos = pool(), grupos = pool();
    const filmes = [], series = [], eps = [], live = [], adult = [];

    // séries agregadas por nome normalizado
    const serieIdx = new Map();
    const seriesObj = [];
    const seenUrl = new Set();

    let ultimaSerie = "", ultimoFilme = null;

    for (const txt of textos) {
      const items = parseM3U(txt);
      for (const it of items) {
        if (!it.u || !it.n) continue;
        if (seenUrl.has(it.u)) continue;
        seenUrl.add(it.u);

        // ajuste dos títulos que vêm só com a marca da versão ("[L]", "4K")
        if (MARCA_RE.test(it.n.trim()) && ultimoFilme) {
          const alvo = it.n.trim();
          const marca = (alvo.match(/[\[(]\s*(l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)\s*[\])]/i) || [])[0] || alvo;
          const anoDoAlvo = (alvo.match(/\(?(19|20)\d{2}\)?/) || [])[0] || "";
          const anoBase = (ultimoFilme.n.match(/\(?(19|20)\d{2}\)?/) || [])[0] || "";
          const base = ultimoFilme.n
            .replace(/\s*[\[(](l|d|leg|dub|4k|uhd|hdr|1080p|7200?p)[\])]\s*/gi, " ")
            .replace(/\s*\(?(19|20)\d{2}\)?\s*$/, "").trim();
          it.n = ((base || ultimoFilme.n) + " " + marca + (anoDoAlvo || anoBase ? " " + (anoDoAlvo || anoBase) : ""))
            .replace(/\s+/g, " ").trim();
          if (!it.l) it.l = ultimoFilme.l;
        }

        if (ADULT_RE.test(it.g || "") || /\[(adulto|xxx)\]/i.test(it.n || "")) {
          adult.push(it);
          continue;
        }

        const cat = classify(it);
        if (cat === "movies") {
          filmes.push(it);
          ultimoFilme = it;
        } else if (cat === "series") {
          const m = it.n.match(EP_RE);
          let serie = "", sn = 1, en = 0;
          if (m) {
            serie = it.n.slice(0, m.index).trim();
            sn = +m[1];
            en = +m[2];
            if (!serie && ultimaSerie) serie = ultimaSerie;
            if (serie) ultimaSerie = serie;
          } else {
            // "Coletânea" e séries sem código de episódio entram como 1 episódio
            serie = it.n;
          }
          const chave = serie.toLowerCase();
          let si = serieIdx.get(chave);
          if (si === undefined) {
            si = seriesObj.length;
            serieIdx.set(chave, si);
            seriesObj.push({ nome: serie, logo: it.l || "", grupo: it.g || "", epIni: eps.length, epQtd: 0 });
          }
          const s = seriesObj[si];
          if (!s.logo && it.l) s.logo = it.l;
          eps.push({ n: it.n, u: it.u, sn, en, si });
          s.epQtd++;
        } else {
          live.push(it);
        }
      }
    }

    // episódios dentro de cada série em ordem de temporada/episódio
    const porSerie = new Map();
    for (const e of eps) {
      if (!porSerie.has(e.si)) porSerie.set(e.si, []);
      porSerie.get(e.si).push(e);
    }
    const epsOrdenados = [];
    for (let si = 0; si < seriesObj.length; si++) {
      const arr = porSerie.get(si) || [];
      arr.sort((a, b) => a.sn - b.sn || a.en - b.en);
      seriesObj[si].epIni = epsOrdenados.length;
      seriesObj[si].epQtd = arr.length;
      for (const e of arr) epsOrdenados.push(e);
    }

    // ---- serialização ----
    const f = {
      filmes: [],
      series: [],
      eps: epsOrdenados,
      live: [],
      adult: [],
    };
    for (const m of filmes) f.filmes.push([nomes.id(m.n), urls.id(m.u), logos.id(m.l), grupos.id(m.g)]);
    for (const s of seriesObj) f.series.push([nomes.id(s.nome), logos.id(s.logo), grupos.id(s.grupo), s.epIni, s.epQtd]);
    for (const c of live) f.live.push([nomes.id(c.n), urls.id(c.u), logos.id(c.l), grupos.id(c.g)]);
    for (const a of adult) f.adult.push([nomes.id(a.n), urls.id(a.u), logos.id(a.l), grupos.id(a.g)]);

    const arquivos = {
      "bib-filmes.bin": binFilmes(f.filmes, nomes, urls, logos, grupos),
      "bib-series.bin": binSeries(f.series, nomes, urls, logos, grupos),
      "bib-live.bin": binFilmes(f.live, nomes, urls, logos, grupos),
      "bib-adult.bin": binFilmes(f.adult, nomes, urls, logos, grupos),
    };
    const nChunks = Math.max(1, Math.ceil(f.eps.length / CHUNK));
    for (let k = 0; k < nChunks; k++) {
      const parte = f.eps.slice(k * CHUNK, (k + 1) * CHUNK);
      // Pool próprio por bloco: as strings de um bloco não se repetem nos
      // outros, então cada arquivo fica pequeno (era o erro de embutir a
      // tabela inteira em todos os 64 blocos).
      arquivos["bib-eps-" + String(k).padStart(3, "0") + ".bin"] = binEps(parte);
    }

    return {
      arquivos,
      chunk: CHUNK,
      totais: {
        filmes: f.filmes.length,
        series: f.series.length,
        episodios: f.eps.length,
        live: f.live.length,
        adult: f.adult.length,
        chunks: nChunks,
      },
    };
  }

  const enc = new TextEncoder();

  function bytesDePool(p) {
    const parts = [];
    let total = 0;
    for (const s of p.list) {
      const b = enc.encode(s);
      parts.push(b);
      total += b.length;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const b of parts) {
      out.set(b, o);
      o += b.length;
    }
    return out;
  }
  function offsetsDePool(p) {
    const off = new Uint32Array(p.list.length + 1);
    let o = 0;
    for (let i = 0; i < p.list.length; i++) {
      off[i] = o;
      o += enc.encode(p.list[i]).length;
    }
    off[p.list.length] = o;
    return off;
  }

  /* Cabeçalho (u32):
       0 magic | 1 versão | 2 nº de pools
       a partir de 3, 4 campos por pool: count, dataPos, dataLen, offPos
     Depois: dados das strings, tabela de offsets (u32) e o registro. */
  function montar(pools, registro) {
    const dados = pools.map(bytesDePool);
    const offs = pools.map(offsetsDePool);
    const header = new Uint32Array(3 + pools.length * 4);
    header[0] = MAGIC;
    header[1] = 1;
    header[2] = pools.length;

    let pos = header.byteLength;
    const dadosPos = [];
    pools.forEach((p, i) => {
      dadosPos.push(pos);
      header[3 + i * 4] = p.list.length;
      header[4 + i * 4] = pos;
      header[5 + i * 4] = dados[i].length;
      pos += dados[i].length;
    });

    pos = (pos + 3) & ~3;
    const offPos = [];
    pools.forEach((p, i) => {
      offPos.push(pos);
      header[6 + i * 4] = pos;
      pos += offs[i].byteLength;
    });

    pos = (pos + 3) & ~3;
    const recPos = pos;
    pos += registro.byteLength;

    const out = new ArrayBuffer(pos);
    const u8 = new Uint8Array(out);
    u8.set(new Uint8Array(header.buffer), 0);
    dados.forEach((d, i) => u8.set(d, dadosPos[i]));
    offs.forEach((o, i) => u8.set(new Uint8Array(o.buffer), offPos[i]));
    u8.set(new Uint8Array(registro.buffer), recPos);
    return { buf: out, recPos };
  }

  function binFilmes(rows, nomes, urls, logos, grupos) {
    const rec = new Uint32Array(rows.length * 4);
    rows.forEach((r, i) => rec.set(r, i * 4));
    return montar([nomes, urls, logos, grupos], rec).buf;
  }
  function binSeries(rows, nomes, urls, logos, grupos) {
    const rec = new Uint32Array(rows.length * 5);
    rows.forEach((r, i) => rec.set(r, i * 5));
    return montar([nomes, urls, logos, grupos], rec).buf;
  }
  function binEps(rows) {
    const nomes = pool(), urls = pool();
    const rec = new Uint32Array(rows.length * 4);
    rows.forEach((r, i) => {
      rec[i * 4] = nomes.id(r.n);
      rec[i * 4 + 1] = urls.id(r.u);
      rec[i * 4 + 2] = r.sn;
      rec[i * 4 + 3] = r.en;
    });
    return montar([nomes, urls], rec).buf;
  }

  /* ---------- leitura ---------- */
  function abrir(buf) {
    const u32 = new Uint32Array(buf);
    if (u32[0] !== MAGIC) throw new Error("arquivo de biblioteca inválido");
    const nPools = u32[2];
    const dec = new TextDecoder();
    const pools = [];
    for (let i = 0; i < nPools; i++) {
      const count = u32[3 + i * 4];
      const dataPos = u32[4 + i * 4];
      const dataLen = u32[5 + i * 4];
      const offPos = u32[6 + i * 4] / 4;
      const offs = u32.subarray(offPos, offPos + count + 1);
      const bytes = new Uint8Array(buf, dataPos, dataLen);
      pools.push({
        count,
        get(idx) {
          if (idx === 0xffffffff || idx >= count) return "";
          return dec.decode(bytes.subarray(offs[idx], offs[idx + 1]));
        },
      });
    }
    return { pools, u32, recPos: localizarRegistros(u32, nPools) };
  }

  /* lê registros de 4 campos (filmes / live / adult) */
  function lerItens(buf) {
    const { pools, u32, recPos } = abrir(buf);
    const [nomes, urls, logos, grupos] = pools;
    const n = (buf.byteLength - recPos) / 16;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = recPos / 4 + i * 4;
      out[i] = {
        n: nomes.get(u32[o]),
        u: urls.get(u32[o + 1]),
        l: logos.get(u32[o + 2]),
        g: grupos.get(u32[o + 3]),
      };
    }
    return out;
  }

  function lerSeries(buf) {
    const { pools, u32, recPos } = abrir(buf);
    const [nomes, , logos, grupos] = pools;
    const n = (buf.byteLength - recPos) / 20;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = recPos / 4 + i * 5;
      out[i] = {
        tipo: "serie",
        nome: nomes.get(u32[o]),
        logo: logos.get(u32[o + 1]),
        grupo: grupos.get(u32[o + 2]),
        epIni: u32[o + 3],
        epQtd: u32[o + 4],
        eps: null,
      };
    }
    return out;
  }

  function lerEps(buf) {
    const { pools, u32, recPos } = abrir(buf);
    const [nomes, urls] = pools;
    const n = (buf.byteLength - recPos) / 16;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = recPos / 4 + i * 4;
      const sn = u32[o + 2], en = u32[o + 3];
      out[i] = {
        n: nomes.get(u32[o]),
        u: urls.get(u32[o + 1]),
        sn,
        en,
        et: "S" + String(sn).padStart(2, "0") + "E" + String(en).padStart(2, "0"),
      };
    }
    return out;
  }

  function localizarRegistros(u32, nPools) {
    // O registro começa logo depois das tabelas de offsets (já alinhadas a 4).
    let pos = 0;
    for (let i = 0; i < nPools; i++) {
      const offPos = u32[6 + i * 4];
      const count = u32[3 + i * 4];
      pos = Math.max(pos, offPos + (count + 1) * 4);
    }
    return (pos + 3) & ~3;
  }

  return { MAGIC, CHUNK, compilar, lerItens, lerSeries, lerEps, parseM3U, classify };
});
