package com.meuiptv.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/* Ajustes pensados para celular, Android TV e TV box:

   - A tela não apaga nem bloqueia enquanto o app está aberto (numa TV isso
     importa: o sistema "dorme" e o vídeo congela).
   - O WebView é configurado para gastar menos memória, que é o que fazia o
     processo ser encerrado pelo Android depois de um tempo.
   - O botão Voltar fecha modais/player antes de sair do app. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Layout em tela cheia, respeitando o recorte da câmera/notch
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

        // Player nativo para o vídeo (o WebView cuida da interface)
        registerPlugin(PlayerNativoPlugin.class);

        configurarWebView();
    }

    private void configurarWebView() {
        WebView web = getBridge().getWebView();
        if (web == null) return;

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        // O controle remoto/teclado precisa chegar ao JavaScript (setas, Enter)
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
    }

    @Override
    public void onBackPressed() {
        // Deixa o JavaScript decidir (fecha modal/player antes de sair do app)
        WebView web = getBridge().getWebView();
        if (web != null) {
            web.evaluateJavascript(
                    "(function(){var e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true});" +
                            "document.dispatchEvent(e);return document.getElementById('home')" +
                            ".classList.contains('hide');})()",
                    value -> {
                        if (!"true".equals(value)) super.onBackPressed();
                    });
            return;
        }
        super.onBackPressed();
    }
}
