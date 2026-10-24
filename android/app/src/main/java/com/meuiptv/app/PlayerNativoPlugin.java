package com.meuiptv.app;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.analytics.AnalyticsListener;
import androidx.media3.exoplayer.source.LoadEventInfo;
import androidx.media3.exoplayer.source.MediaLoadData;
import androidx.media3.common.Format;
import androidx.media3.datasource.HttpDataSource;
import java.io.IOException;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.PlayerView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Map;

/* Player nativo (ExoPlayer/Media3).

   Por que existe: o mpegts.js desmonta o MPEG-TS em JavaScript, na thread
   principal do WebView. Numa TV box de 1 GB isso satura a CPU, o buffer
   cresce, o canal trava e repete o trecho. Aqui a decodificação usa o
   decodificador de hardware do aparelho, em thread própria.

   A interface continua na WebView; esta view é posicionada exatamente sobre
   a área do player (#pvbox), que o JavaScript informa a cada mudança de
   layout (tela cheia, girar, rolar). */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "PlayerNativo")
public class PlayerNativoPlugin extends Plugin {

    private ExoPlayer player;
    private PlayerView playerView;
    private FrameLayout container;
    private LinearLayout barra;
    private boolean telaCheia = false;
    private long bufferingStartedAtMs;
    private long playerGeneration;

    private static String horaLog() {
        return String.valueOf(System.currentTimeMillis());
    }

    private static String mensagemSegura(String mensagem) {
        if (mensagem == null) return "";
        return mensagem.replaceAll("https?://[^\\s\\\"']+", "[URL]")
                .replaceAll("(?i)(token|key|password|username|user|auth|signature)=([^&\\s]+)", "$1=[redacted]")
                .replaceAll("[\\r\\n]+", " ");
    }

    private static String causaSegura(Throwable erro) {
        StringBuilder causas = new StringBuilder();
        Throwable atual = erro;
        int profundidade = 0;
        while (atual != null && profundidade++ < 8) {
            if (causas.length() > 0) causas.append(" <- ");
            causas.append(atual.getClass().getSimpleName());
            String msg = mensagemSegura(atual.getMessage());
            if (!msg.isEmpty()) causas.append(": ").append(msg);
            atual = atual.getCause();
        }
        return causas.toString();
    }

    private static String formatoSeguro(Format formato) {
        if (formato == null) return "indisponivel";
        return "mime=" + formato.sampleMimeType + " codecs=" + formato.codecs
                + " resolucao=" + formato.width + "x" + formato.height
                + " bitrate=" + formato.bitrate;
    }

    private static String hostSeguro(android.net.Uri uri) {
        String host = uri == null ? null : uri.getHost();
        return host == null ? "desconhecido" : host;
    }

    private long lastLoadSummaryLogMs;

    private void logCarregamento(String evento, LoadEventInfo info, MediaLoadData dados,
                                 IOException erro) {
        String host = hostSeguro(info == null ? null : android.net.Uri.parse(info.uri.toString()));
        StringBuilder linha = new StringBuilder("time=").append(horaLog())
                .append(" event=").append(evento).append(" host=").append(host);
        if (info != null) linha.append(" elapsedMs=").append(info.elapsedRealtimeMs)
                .append(" bytes=").append(info.bytesLoaded);
        if (dados != null) linha.append(" dataType=").append(dados.dataType)
                .append(" trackType=").append(dados.trackType)
                .append(" format={").append(formatoSeguro(dados.trackFormat)).append('}');
        if (erro != null) {
            linha.append(" cause={").append(causaSegura(erro)).append('}');
            if (erro instanceof HttpDataSource.InvalidResponseCodeException) {
                linha.append(" httpStatus=")
                        .append(((HttpDataSource.InvalidResponseCodeException) erro).responseCode);
            }
        }
        long agora = android.os.SystemClock.elapsedRealtime();
        if (erro != null) {
            android.util.Log.w("GameZonePlayer", linha.toString());
        } else if ("load_completed".equals(evento)
                && (agora - lastLoadSummaryLogMs >= 15000 || info != null && info.bytesLoaded > 4 * 1024 * 1024)) {
            lastLoadSummaryLogMs = agora;
            android.util.Log.i("GameZonePlayer", linha.toString());
        }
    }

    /* ---------------------------------------------------------------- */
    /* Ciclo de vida                                                     */
    /* ---------------------------------------------------------------- */

    @Override
    protected void handleOnPause() {
        // Sair do app não pode continuar consumindo o decodificador.
        if (player != null) player.pause();
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        liberar();
        super.handleOnDestroy();
    }

    /* ---------------------------------------------------------------- */
    /* Métodos expostos ao JavaScript                                    */
    /* ---------------------------------------------------------------- */

    @PluginMethod
    public void abrir(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url vazia");
            return;
        }
        final boolean aoVivo = Boolean.TRUE.equals(call.getBoolean("live", false));
        final String ua = call.getString("userAgent");
        final String referer = call.getString("referer");
        final JSObject rect = call.getObject("rect");
        final float volume = call.getFloat("volume", 1f);

        getActivity().runOnUiThread(() -> {
            try {
                montarView(rect);
                montarPlayer(url, aoVivo, ua, referer, volume);
                call.resolve();
            } catch (Exception e) {
                liberar();
                call.reject("falha ao abrir o player: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void fechar(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            liberar();
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (player != null) player.play(); call.resolve(); });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (player != null) player.pause(); call.resolve(); });
    }

    @PluginMethod
    public void buscar(PluginCall call) {
        final long ms = call.getLong("ms", 0L);
        getActivity().runOnUiThread(() -> { if (player != null) player.seekTo(ms); call.resolve(); });
    }

    @PluginMethod
    public void volume(PluginCall call) {
        final float v = call.getFloat("valor", 1f);
        getActivity().runOnUiThread(() -> { if (player != null) player.setVolume(v); call.resolve(); });
    }

    @PluginMethod
    public void mudo(PluginCall call) {
        final boolean m = Boolean.TRUE.equals(call.getBoolean("valor", false));
        getActivity().runOnUiThread(() -> { if (player != null) player.setVolume(m ? 0f : 1f); call.resolve(); });
    }

    @PluginMethod
    public void velocidade(PluginCall call) {
        final float v = call.getFloat("valor", 1f);
        getActivity().runOnUiThread(() -> {
            if (player != null) player.setPlaybackSpeed(v);
            call.resolve();
        });
    }

    /* A área do player muda (tela cheia, girar o celular, rolar a lista).
       O JavaScript recalcula o retângulo e manda de novo. */
    @PluginMethod
    public void definirRect(PluginCall call) {
        final JSObject rect = call.getObject("rect");
        final boolean full = Boolean.TRUE.equals(call.getBoolean("full", false));
        final boolean visivel = !Boolean.FALSE.equals(call.getBoolean("visivel", true));
        getActivity().runOnUiThread(() -> {
            telaCheia = full;
            if (container != null) {
                container.setVisibility(visivel ? View.VISIBLE : View.GONE);
            }
            // Esconder sem parar deixaria o áudio tocando por trás de um modal
            if (!visivel && player != null) player.pause();
            if (visivel) aplicarRect(rect);
            call.resolve();
        });
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject o = new JSObject();
        if (player == null) {
            o.put("ativo", false);
        } else {
            o.put("ativo", true);
            o.put("tocando", player.isPlaying());
            o.put("posicao", player.getCurrentPosition());
            o.put("duracao", player.getDuration() == C.TIME_UNSET ? -1 : player.getDuration());
            o.put("buffer", player.getBufferedPosition());
            o.put("aoVivo", player.isCurrentMediaItemLive());
        }
        call.resolve(o);
    }

    /* ---------------------------------------------------------------- */
    /* Montagem                                                          */
    /* ---------------------------------------------------------------- */

    private void montarView(JSObject rect) {
        ViewGroup raiz = (ViewGroup) getBridge().getWebView().getParent();
        if (raiz == null) throw new IllegalStateException("sem raiz de views");

        if (container == null) {
            // A raiz do Capacitor é um CoordinatorLayout; o container ocupa a
            // tela toda e o PlayerView é posicionado dentro dele, recortado na
            // área exata do player.
            container = new FrameLayout(getContext());
            container.setBackgroundColor(Color.TRANSPARENT);
            ViewGroup.LayoutParams lp = raiz instanceof androidx.coordinatorlayout.widget.CoordinatorLayout
                    ? new androidx.coordinatorlayout.widget.CoordinatorLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    : new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            raiz.addView(container, lp);
        }
        if (playerView == null) {
            playerView = new PlayerView(getContext());
            playerView.setBackgroundColor(Color.BLACK);
            playerView.setUseController(true);
            playerView.setControllerShowTimeoutMs(4000);
            playerView.setControllerAutoShow(true);
            playerView.setControllerHideOnTouch(true);
            playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
            playerView.setKeepScreenOn(true);
            container.addView(playerView, new FrameLayout.LayoutParams(0, 0));
            estilizarControles();
            montarBarra();
        }
        container.setVisibility(View.VISIBLE);
        aplicarRect(rect);
    }

    /* Os controles do ExoPlayer herdam as cores de exo_controls_* do tema
       (res/values/styles.xml). Aqui só garantimos que os botões aceitem foco:
       no controle remoto da TV, sem isso, não dá para navegar até eles. */
    private void estilizarControles() {
        playerView.setShutterBackgroundColor(Color.TRANSPARENT);
        int[] alvos = {
                androidx.media3.ui.R.id.exo_play_pause,
                androidx.media3.ui.R.id.exo_rew,
                androidx.media3.ui.R.id.exo_ffwd,
                androidx.media3.ui.R.id.exo_play,
                androidx.media3.ui.R.id.exo_pause,
                androidx.media3.ui.R.id.exo_progress
        };
        for (int id : alvos) {
            View alvo = playerView.findViewById(id);
            if (alvo != null) alvo.setFocusable(true);
        }
    }

    private void montarBarra() {
        barra = new LinearLayout(getContext());
        barra.setOrientation(LinearLayout.HORIZONTAL);
        barra.setGravity(Gravity.END);

        barra.addView(botao("⛶", v -> {
            telaCheia = !telaCheia;
            JSObject o = new JSObject();
            o.put("full", telaCheia);
            notifyListeners("telaCheia", o);
        }));
        barra.addView(botao("✕", v -> {
            notifyListeners("fechar", new JSObject());
            liberar();
        }));

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.topMargin = dp(12);
        lp.rightMargin = dp(12);
        container.addView(barra, lp);
    }

    private TextView botao(String texto, View.OnClickListener acao) {
        TextView b = new TextView(getContext());
        b.setText(texto);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        b.setTextColor(Color.WHITE);
        b.setGravity(Gravity.CENTER);
        b.setFocusable(true);
        b.setClickable(true);
        b.setPadding(dp(14), dp(8), dp(14), dp(8));

        GradientDrawable fundo = new GradientDrawable();
        fundo.setColor(0xCC070410);
        fundo.setCornerRadius(dp(10));
        fundo.setStroke(dp(1), 0x33FFFFFF);
        b.setBackground(fundo);

        b.setOnClickListener(acao);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.leftMargin = dp(8);
        b.setLayoutParams(lp);
        return b;
    }

    private void montarPlayer(String url, boolean aoVivo, String ua, String referer, float volume) {
        liberarPlayer();

        Map<String, String> cabecalhos = new HashMap<>();
        if (referer != null && !referer.isEmpty()) cabecalhos.put("Referer", referer);

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(ua != null && !ua.isEmpty() ? ua : "Mozilla/5.0")
                .setConnectTimeoutMs(10000)
                .setReadTimeoutMs(20000)
                .setAllowCrossProtocolRedirects(true)
                .setDefaultRequestProperties(cabecalhos);

        MediaItem mediaItem = MediaItem.fromUri(url);
        MediaSource fonte;
        String lowerUrl = url.toLowerCase();
        if (lowerUrl.contains(".m3u8") || "m3u8".equalsIgnoreCase(android.net.Uri.parse(url).getLastPathSegment())) {
            fonte = new HlsMediaSource.Factory(http)
                    .setAllowChunklessPreparation(true)
                    .createMediaSource(mediaItem);
        } else {
            // .ts mantém o caminho progressivo; URLs sem extensão mantêm autodetecção Media3.
            fonte = lowerUrl.contains(".ts")
                    ? new ProgressiveMediaSource.Factory(http).createMediaSource(mediaItem)
                    : new DefaultMediaSourceFactory(http).createMediaSource(mediaItem);
        }

        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        aoVivo ? 1500 : DefaultLoadControl.DEFAULT_MIN_BUFFER_MS,
                        aoVivo ? 12000 : DefaultLoadControl.DEFAULT_MAX_BUFFER_MS,
                        aoVivo ? 750 : DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_MS,
                        aoVivo ? 1500 : DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS)
                .setPrioritizeTimeOverSizeThresholds(aoVivo)
                .build();
        player = new ExoPlayer.Builder(getContext())
                .setLoadControl(loadControl)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(http))
                .build();

        player.setVolume(volume);
        String resolvedHost;
        try {
            resolvedHost = android.net.Uri.parse(url).getHost();
        } catch (Exception ignored) {
            // Nunca registra query string, que pode conter credenciais do provedor.
            resolvedHost = "desconhecido";
        }
        final String host = resolvedHost == null ? "desconhecido" : resolvedHost;

        playerGeneration++;
        bufferingStartedAtMs = 0;
        final long generation = playerGeneration;
        android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=player_open"
                + " generation=" + generation + " host=" + host + " live=" + aoVivo);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int estado) {
                String nome = estado == Player.STATE_BUFFERING ? "BUFFERING"
                        : estado == Player.STATE_READY ? "READY"
                        : estado == Player.STATE_ENDED ? "ENDED" : "IDLE";
                long now = android.os.SystemClock.elapsedRealtime();
                long bufferedMs = player.getBufferedPosition();
                if (estado == Player.STATE_BUFFERING) {
                    if (bufferingStartedAtMs == 0) bufferingStartedAtMs = now;
                    android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=state"
                            + " generation=" + generation + " state=BUFFERING host=" + host
                            + " bufferedMs=" + bufferedMs);
                } else {
                    long bufferingDuration = bufferingStartedAtMs == 0 ? 0 : now - bufferingStartedAtMs;
                    if (bufferingStartedAtMs != 0 || estado == Player.STATE_READY) {
                        android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=state"
                                + " generation=" + generation + " state=" + nome + " host=" + host
                                + " bufferedMs=" + bufferedMs + " bufferingDurationMs=" + bufferingDuration);
                    }
                    bufferingStartedAtMs = 0;
                }
                JSObject state = new JSObject();
                state.put("state", nome);
                state.put("bufferedMs", bufferedMs);
                notifyListeners("playerState", state);
                if (estado == Player.STATE_ENDED) notifyListeners("fim", new JSObject());
            }

            @Override
            public void onPlayerError(PlaybackException erro) {
                String causa = causaSegura(erro);
                android.util.Log.e("GameZonePlayer", "time=" + horaLog() + " event=playback_error"
                        + " generation=" + generation + " host=" + host
                        + " errorCode=" + erro.errorCode + " errorCodeName=" + erro.getErrorCodeName()
                        + " cause={" + causa + "}");
                JSObject o = new JSObject();
                o.put("mensagem", erro.getErrorCodeName());
                o.put("codigo", erro.errorCode);
                notifyListeners("erro", o);
            }

            @Override
            public void onIsPlayingChanged(boolean tocando) {
                android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=is_playing"
                        + " generation=" + generation + " value=" + tocando + " host=" + host);
                JSObject o = new JSObject();
                o.put("tocando", tocando);
                notifyListeners("estado", o);
            }

            @Override
            public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=channel_transition"
                        + " generation=" + generation + " reason=" + reason + " host=" + host);
            }
        });

        player.addAnalyticsListener(new AnalyticsListener() {
            @Override
            public void onLoadStarted(AnalyticsListener.EventTime eventTime, LoadEventInfo loadEventInfo,
                                      MediaLoadData mediaLoadData) {
                logCarregamento("load_started", loadEventInfo, mediaLoadData, null);
            }

            @Override
            public void onLoadCompleted(AnalyticsListener.EventTime eventTime, LoadEventInfo loadEventInfo,
                                        MediaLoadData mediaLoadData) {
                logCarregamento("load_completed", loadEventInfo, mediaLoadData, null);
            }

            @Override
            public void onLoadError(AnalyticsListener.EventTime eventTime, LoadEventInfo loadEventInfo,
                                    MediaLoadData mediaLoadData, IOException error, boolean wasCanceled) {
                logCarregamento("load_error canceled=" + wasCanceled, loadEventInfo, mediaLoadData, error);
            }

            @Override
            public void onVideoInputFormatChanged(AnalyticsListener.EventTime eventTime, Format format,
                                                   androidx.media3.exoplayer.DecoderReuseEvaluation evaluation) {
                android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=video_format"
                        + " generation=" + generation + " host=" + host + " format={"
                        + formatoSeguro(format) + "}");
            }

            @Override
            public void onAudioInputFormatChanged(AnalyticsListener.EventTime eventTime, Format format,
                                                   androidx.media3.exoplayer.DecoderReuseEvaluation evaluation) {
                android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=audio_format"
                        + " generation=" + generation + " host=" + host + " format={"
                        + formatoSeguro(format) + "}");
            }
        });

        playerView.setPlayer(player);
        player.setMediaSource(fonte);
        player.prepare();
        player.setPlayWhenReady(true);
    }

    private void aplicarRect(JSObject rect) {
        if (container == null || playerView == null || rect == null) return;

        View web = getBridge().getWebView();
        if (web.getWidth() <= 0 || web.getHeight() <= 0) return;

        double vw = rect.optDouble("vw", 0);
        if (vw <= 0) return;

        // O retângulo vem em pixels CSS; a view nativa usa pixels físicos.
        float escala = (float) (web.getWidth() / vw);

        int x = (int) Math.round(num(rect.opt("x")) * escala);
        int y = (int) Math.round(num(rect.opt("y")) * escala);
        int w = (int) Math.round(num(rect.opt("w")) * escala);
        int h = (int) Math.round(num(rect.opt("h")) * escala);

        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) playerView.getLayoutParams();
        lp.width = Math.max(1, w);
        lp.height = Math.max(1, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        playerView.setLayoutParams(lp);

        // Os botões ficam no canto superior direito do player (e não da tela)
        if (barra != null) {
            FrameLayout.LayoutParams bl = (FrameLayout.LayoutParams) barra.getLayoutParams();
            bl.topMargin = y + dp(telaCheia ? 22 : 10);
            bl.rightMargin = dp(12) + Math.max(0, web.getWidth() - (x + w));
            barra.setLayoutParams(bl);
        }
    }

    private static double num(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0;
    }

    private int dp(int v) {
        return Math.round(v * getContext().getResources().getDisplayMetrics().density);
    }

    private void liberarPlayer() {
        if (player != null) {
            android.util.Log.i("GameZonePlayer", "time=" + horaLog() + " event=player_close"
                    + " generation=" + playerGeneration);
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private void liberar() {
        liberarPlayer();
        if (playerView != null) {
            playerView.setPlayer(null);
            if (playerView.getParent() instanceof ViewGroup) {
                ((ViewGroup) playerView.getParent()).removeView(playerView);
            }
            playerView = null;
        }
        barra = null;
        if (container != null) {
            if (container.getParent() instanceof ViewGroup) {
                ((ViewGroup) container.getParent()).removeView(container);
            }
            container = null;
        }
    }
}
