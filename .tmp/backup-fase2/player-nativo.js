/* Ponte para o player nativo do Android (ExoPlayer/Media3).

   O vídeo deixa de ser decodificado dentro da WebView. A view nativa é
   posicionada exatamente sobre a área do player e recebe play/pause/seek.

   Fora do Android (EXE, navegador) nada disso existe: `PN.ok` fica falso e o
   app continua usando o mpegts.js/hls.js de sempre. */
const PN = {
  ok: false,
  ativo: false,
  tocando: false,
  pos: 0,
  dur: 0,
  buf: 0,
  item: null,
  url: "",
  aoVivo: false,
  _plugin: null,
  _timer: null,
  _listeners: false,
  _rectTimer: null,
  _geracao: 0,
  /* URLs que o decodificador do aparelho recusou — vão para o player da
     WebView, que pode decodificar por software. */
  _bloqueados: new Set(),

  _formatoIncompativel(msg) {
    // O ExoPlayer devolve textos como "Decoder init failed", "Unsupported
    // format", "MediaCodec... error". Erro de rede não entra aqui.
    return /decoder|codec|unsupported|format|mediacodec|initialization/i.test(msg || "");
  },

  ini() {
    try {
      this._plugin =
        (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PlayerNativo) || null;
    } catch (e) {
      this._plugin = null;
    }
    // Só vale a pena no Android: no EXE e no navegador não existe plugin.
    this.ok = !!this._plugin;

    if (!this.ok) return;
    window.addEventListener("resize", () => this.sincronizarRect());
    document.addEventListener("fullscreenchange", () => this.sincronizarRect());
    window.addEventListener("scroll", () => this.sincronizarRect(), true);
    const box = document.querySelector("#pvbox");
    if (box && window.ResizeObserver) new ResizeObserver(() => this.sincronizarRect()).observe(box);

    // Sair do app / trocar de aba: nada continua tocando escondido
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.ativo) this.pause();
    });
  },

  /* As chamadas ao nativo passam por uma fila. Sem isso, um "fechar" e um
     "abrir" disparados quase juntos (trocar de canal) chegam fora de ordem e
     o fechar pode derrubar o player que o abrir acabou de criar. */
  _fila: Promise.resolve(),
  _enfileirar(fn) {
    const proxima = this._fila.then(fn, fn);
    this._fila = proxima.catch(() => {});
    return proxima;
  },

  /* Retângulo do player em pixels CSS, relativo à viewport. */
  _rect() {
    const b = document.querySelector("#pvbox");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
  },

  _ouvir() {
    if (this._listeners || !this._plugin) return;
    this._listeners = true;

    this._plugin.addListener("estado", (d) => {
      this.tocando = !!d.tocando;
      const b = document.querySelector("#playPauseBtn");
      if (b) b.textContent = this.tocando ? "⏸" : "▶";
      if (this.tocando) {
        const ph = document.querySelector("#ph");
        if (ph) ph.classList.add("hide");
        if (typeof tentativasReconexao !== "undefined") tentativasReconexao = 0;
      }
    });

    this._plugin.addListener("erro", (d) => {
      const msg = String((d && d.mensagem) || "");
      // Formato que o decodificador do aparelho não aceita (H.265 numa TV
      // box antiga, por exemplo): tentar de novo no nativo só repete o erro.
      // Nesse caso a URL é marcada e o play() cai no player da WebView, que
      // às vezes consegue decodificar por software.
      if (this._formatoIncompativel(msg)) {
        this._bloqueados.add(this.url);
        const item = this.item;
        if (typeof sairDoPlayer === "function") sairDoPlayer();
        if (item && typeof play === "function") setTimeout(() => play(item), 120);
        return;
      }
      if (this.aoVivo && typeof reconectar === "function") reconectar(this.item, this.url);
      else if (typeof mostrarErro === "function") mostrarErro(msg, d && d.codigo);
    });

    this._plugin.addListener("fim", () => {
      if (typeof sairDoPlayer === "function") sairDoPlayer();
    });

    // A tela cheia é decidida no nativo (o botão fica sobre o vídeo)
    this._plugin.addListener("telaCheia", (d) => {
      if (typeof setFull === "function") setFull(!!d.full, { nativo: true });
    });

    this._plugin.addListener("fechar", () => {
      if (typeof sairDoPlayer === "function") sairDoPlayer();
    });
  },

  async abrir(it, url, aoVivo) {
    if (!this.ok) return false;
    // Este aparelho já recusou este stream: nem tenta no nativo.
    if (this._bloqueados.has(url)) return false;
    this._ouvir();

    // Cada abertura ganha uma geração. Se o usuário trocar de canal antes
    // desta terminar, a resposta atrasada da anterior é descartada — senão
    // ela reativaria o player depois de um "fechar".
    const geracao = ++this._geracao;
    this.item = it;
    this.url = url;
    this.aoVivo = !!aoVivo;

    try {
      await this._enfileirar(() =>
        this._plugin.abrir({
          url,
          live: !!aoVivo,
          userAgent: (typeof settings !== "undefined" && settings.userAgent) || "",
          referer: (typeof settings !== "undefined" && settings.referer) || "",
          volume: (typeof settings !== "undefined" ? settings.defaultVolume ?? 100 : 100) / 100,
          rect: this._rect() || { x: 0, y: 0, w: 0, h: 0, vw: window.innerWidth, vh: window.innerHeight },
        })
      );
    } catch (e) {
      if (geracao === this._geracao) this.ativo = false;
      return false;
    }

    if (geracao !== this._geracao) return false;
    this.ativo = true;
    this.pos = 0;
    this.dur = 0;
    this.buf = 0;
    this._oculto = this._encoberto();
    document.documentElement.classList.add("modo-nativo");
    this._iniciarPolling();
    this.sincronizarRect();
    return true;
  },

  async fechar() {
    this._geracao++; // invalida qualquer abertura em andamento
    this._pararPolling();
    // Marca como inativo já: quem chama (cleanup) decide o resto do fluxo
    // logo em seguida, sem esperar a resposta do nativo.
    this.ativo = false;
    this.tocando = false;
    document.documentElement.classList.remove("modo-nativo");
    if (!this.ok) return;
    try {
      await this._enfileirar(() => this._plugin.fechar());
    } catch (e) {}
    this.pos = 0;
    this.dur = 0;
    this.buf = 0;
    const b = document.querySelector("#playPauseBtn");
    if (b) b.textContent = "▶";
  },

  async play() {
    if (!this.ativo) return;
    try {
      await this._plugin.play();
      this.tocando = true;
    } catch (e) {}
  },
  async pause() {
    if (!this.ativo) return;
    try {
      await this._plugin.pause();
      this.tocando = false;
    } catch (e) {}
  },
  async buscar(seg) {
    if (!this.ativo) return;
    try {
      await this._plugin.buscar({ ms: Math.round(seg * 1000) });
      this.pos = seg;
    } catch (e) {}
  },
  async volume(v) {
    if (!this.ativo) return;
    try {
      await this._plugin.volume({ valor: v });
    } catch (e) {}
  },
  async mudo(m) {
    if (!this.ativo) return;
    try {
      await this._plugin.mudo({ valor: !!m });
    } catch (e) {}
  },
  async velocidade(v) {
    if (!this.ativo) return;
    try {
      await this._plugin.velocidade({ valor: v });
    } catch (e) {}
  },

  /* Alguma tela está por cima do player? A view nativa é desenhada ACIMA da
     WebView, então ela não respeitaria o empilhamento do CSS: sem este
     controle o vídeo ficaria por cima de modais e da tela de detalhes. */
  _encoberto() {
    if (document.querySelector("#detail.on")) return true;
    for (const sel of ["#cfg", "#multi", "#pl", "#epgModal", "#advSearchModal"]) {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains("hide")) return true;
    }
    return false;
  },

  /* A área do player muda (tela cheia, girar, rolar a lista). O nativo
     precisa saber onde desenhar. */
  sincronizarRect() {
    if (!this.ativo || !this._plugin) return;
    clearTimeout(this._rectTimer);
    this._rectTimer = setTimeout(async () => {
      const rect = this._rect();
      if (!rect) return;
      const box = document.querySelector("#pvbox");
      const visivel = !this._encoberto();
      try {
        await this._plugin.definirRect({
          rect,
          full: !!(box && box.classList.contains("full")),
          visivel,
        });
      } catch (e) {}
    }, 80);
  },

  _iniciarPolling() {
    this._pararPolling();
    // O <video> não está em uso neste modo; tempo e barra vêm do nativo.
    this._timer = setInterval(async () => {
      if (!this.ativo || !this._plugin || document.hidden) return;
      try {
        const e = await this._plugin.estado();
        if (!e || !e.ativo) return;
        this.tocando = !!e.tocando;
        this.pos = (e.posicao || 0) / 1000;
        this.dur = e.duracao > 0 ? e.duracao / 1000 : 0;
        this.buf = (e.buffer || 0) / 1000;
        if (typeof pintarProgresso === "function") pintarProgresso(this.pos, this.dur, this.buf, this.aoVivo);
        // Modais/detalhe podem abrir a qualquer momento: mantém a view
        // escondida enquanto algo estiver por cima do player.
        const enc = this._encoberto();
        if (enc !== this._oculto) {
          this._oculto = enc;
          this.sincronizarRect();
        }
      } catch (e) {}
    }, 700);
  },
  _pararPolling() {
    clearInterval(this._timer);
    this._timer = null;
  },
};

PN.ini();
