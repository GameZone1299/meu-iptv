# CONTINUAR AQUI — Game Zone IPTV

> Documento de retomada. Se você (Claude) está lendo isto no início de uma
> sessão nova, este é o estado real do projeto ao fim de 23/10/2026.
> Leia inteiro antes de mexer em qualquer arquivo.

## Onde fica o quê

| O que | Caminho |
|---|---|
| Projeto (fonte de tudo) | `D:\Documentos\IPTV\meu-iptv-projeto\iptv-app` |
| APK entregue | `D:\Documentos\IPTV\GameZoneIPTV.apk` |
| EXE portátil entregue | `D:\Documentos\IPTV\MeuIPTV-windows-exe\GameZoneIPTV-1.0.0.exe` |
| Instalador entregue | `D:\Documentos\IPTV\MeuIPTV-windows-exe\Game Zone IPTV Setup 1.0.0.exe` |
| Cópia web avulsa (espelho servido por HTTP) | `D:\Documentos\IPTV\` (index.html na raiz) |
| Scripts de build/teste descartáveis | `D:\Documentos\IPTV\meu-iptv-projeto\iptv-app\.tmp\` |

Cuidado: a cópia web em `D:\Documentos\IPTV\` **não** é o projeto. Ao mudar
algo em `www/`, é preciso recopiar para lá (ver "Comandos" abaixo).

## O que o app é

- **Android** (celular, Android TV, TV box) via Capacitor 6 + WebView.
- **Windows** via Electron (`electron/` + `www/`).
- Conteúdo VOD/adulto: catálogos compilados no formato binário próprio
  (`bib-*.bin.gzbin`). TV ao vivo é carregada de quatro playlists M3U8
  empacotadas em `www/assets/live-playlists/` e selecionadas separadamente.

O manifesto atual conserva **49.584 filmes**, **11.528 séries**,
**521.681 episódios** e **1.996 itens adultos** (categoria separada, oculta,
com PIN); `bib-live.bin` foi removido dos ativos e a contagem live legada é 0.
Os canais reais só são conhecidos após a lista selecionada ser carregada; não
foi verificada a reprodução de nenhum fluxo.

Memória do renderer: **~58 MB** de heap (antes eram ~500 MB de objetos JS, e o
Android matava o app).

## Decisões estruturais (não desfaça sem motivo)

### 1. Formato binário `GZL1` — `www/bib.js`
As ~574 mil entradas **não** são objetos JS na memória. Ficam num binário
indexado com pools de strings compartilhadas. Filmes, séries e adultos ficam
residentes; a TV ao vivo vem agora de uma playlist M3U selecionada por vez. Os
episódios ficam em blocos de 8192 e só o bloco da série aberta é lido
(`carregarEps` em `www/library.js`).

Cada bloco de episódios tem **pools locais próprios**. Isso é essencial:
com pools globais o arquivo dava 231 MB; com pools locais, 16 MB.

### 2. Extensão `.gzbin` — não é `.gz`
O AAPT/Gradle **remove a extensão `.gz`** ao empacotar o APK. Por isso os
arquivos são `bib-filmes.bin.gzbin` (conteúdo é gzip, só o nome muda). Se
alguém renomear para `.gz`, a biblioteca 404 no aparelho e o app fica vazio.
O código concatena `nome + ".gzbin"` em `www/builtin.js`.

### 3. Categorias canonicalizadas — `www/library.js`
As duas listas escrevem o mesmo grupo de formas diferentes
("SÉRIES | NETFLIX" vs "Series | Netflix"). `canonizarGrupos()` normaliza sem
acento (`chaveGrupo`) e escolhe o rótulo mais frequente. Sem isso, grupos
inteiros sumiam da barra lateral — foi a causa do "filmes só aparecem quando
importo manualmente".

### 4. Player nativo — `PlayerNativoPlugin.java` + `www/player-nativo.js`
O vídeo **não** roda na WebView no Android. Media3/ExoPlayer desenha uma view
nativa posicionada exatamente sobre o `#pvbox`.

Por quê: o `mpegts.js` faz o demux do MPEG-TS em JavaScript, na thread
principal. Em TV box de 1 GB isso satura a CPU → trava e repete o trecho.

Pontos delicados dessa ponte:
- A view nativa é desenhada **acima** da WebView, então ignora o CSS. Quando
  um modal/detalhe abre, `PN._encoberto()` detecta e manda `visivel:false`
  (esconde **e pausa**).
- Chamadas ao nativo passam por uma **fila** (`PN._enfileirar`). Sem ela, um
  `fechar` atrasado derrubava o canal recém-aberto.
- Cada abertura tem uma **geração**; resposta atrasada é descartada.
- Falha por **codec** (não por rede) marca a URL em `PN._bloqueados` e o item
  reabre no player da WebView. A regex é `_formatoIncompativel()` — cuidado
  para não classificar erro de rede como codec.
- Fora do Android (`PN.ok === false`) tudo cai no `mpegts.js`/`hls.js`.

### 5. Parar ao sair da tela
`cleanup()` fecha o nativo, destrói hls/ts, limpa `_wd`, `_reconexao` e
`_posInterval`. `goto("home")` chama `sairDoPlayer()`. Escape e o botão Voltar
do Android (via `KeyboardEvent('Escape')` em `MainActivity`) também fecham.

## Comandos

```bash
cd "D:/Documentos/IPTV/meu-iptv-projeto/iptv-app"

# Regenerar a biblioteca a partir das listas M3U
node scripts/gerar-biblioteca.js www/assets/listas <canais.m3u> <filmes.m3u>

# APK
npx cap sync android
cd android && JAVA_HOME="C:/Program Files/Java/jdk-17" ./gradlew.bat assembleDebug && cd ..
# saída: android/app/build/outputs/apk/debug/app-debug.apk

# EXE Windows (script oficial)
npm run build:win

# Integração TV ao vivo: atualizar as quatro cópias em www/assets/live-playlists/
# (e www-tv/assets/live-playlists/ para TV); originais ficam em D:\\Documentos\\IPTV\\playlist.
# Depois sincronize: npm run android:sync e npm run android:tv:sync.
# Carga: www/live-playlists.js e www-tv/live-playlists.js; nomes/fontes em LIVE_PLAYLISTS.
# Teste isolado do parser: node .tmp/test-live-playlists.js

# Testar a interface sem aparelho (Electron offscreen)
./node_modules/.bin/electron .tmp/teste-apk.js     # biblioteca + busca
./node_modules/.bin/electron .tmp/teste-ponte.js   # ponte do player nativo
./node_modules/.bin/electron .tmp/teste-pn.js      # fallback web (PN.ok=false)

# Sincronizar a cópia web avulsa
cp -f www/{index.html,app.js,library.js,detail.js,db.js,builtin.js,theme.css,bib.js,carregar.js,fflate.min.js,player-nativo.js} ..
```

## O que ficou pendente

1. **Teste em dispositivo Android — prioridade.** Esta sessão não compilou os
   APKs: `npm run android:apk` e `npm run android:tv:apk` falharam porque
   `gradlew.bat` não foi reconhecido pelo shell iniciado pelo npm. Os syncs
   Capacitor de Mobile e TV concluíram. Não foi verificada reprodução de canais
   reais; testar fluxo, alinhamento do player nativo e controles em aparelho.
2. O teste real local do parser classificou, heuristicamente, 1.019 entradas da
   Lista 1, 96 da Lista 2, 2.509 da Lista 3 e 230 da Lista 4 como live. Isso não
   verifica se os endereços respondem nem se o player consegue reproduzi-los.
3. `npm run build:win` foi concluído com código 0 após as alterações de lógica
   e parser; a alteração posterior de documentação/UI de status precisa ser
   incluída no próximo build se houver mudanças após aquele comando.
4. O smoke test Electron de catálogo leu 49.584 filmes, 11.528 séries, 521.681
   episódios e busca; terminou com código 1 por `Uncaught ReferenceError:
   $ is not defined` no teste offscreen, então não é uma validação limpa de
   inicialização. A execução normal do Electron permaneceu ativa por 7s, sem
   interação visual confirmada.
5. Se algum canal não abrir no aparelho, consultar `chrome://inspect` (DevTools
   remoto do WebView) e registrar o erro repassado pelo `onPlayerError` do
   ExoPlayer, sem expor URLs com credenciais.
6. `scripts/embutir-listas.js` delega em `gerar-biblioteca.js`. Não reintroduza
   o formato antigo `.m3u8.bin`.
7. A biblioteca VOD é regenerada quando as listas do provedor mudam. Trocar a
   playlist de TV ao vivo não exige regenerar a biblioteca; atualizar os
   arquivos empacotados requer sincronizar os dois alvos e recompilá-los.

## Armadilhas já pagas (não repita)

- **Cabeçalho do formato:** 4 campos u32 por pool (`3 + i*4`, `4 + i*4`,
  `5 + i*4`, `6 + i*4`). Já houve um bug de 3 campos que corrompia tudo.
- **Capas:** TMDB em `w342` + `loading="lazy"`. `w600` em 60 cards levava 15 s.
  Um IntersectionObserver caseiro não funciona em modo offscreen — foi removido.
- **Busca:** limpar `#q` ao trocar de seção. Sem isso a lista nova parecia vazia.
- **`capitalizarPalavra`:** "4K/UHD" precisa ser dividido no `/`, senão sai "4K/uhd".
- **Scripts de teste no Electron:** `executeJavaScript` não pode ter `return`
  solto no topo. Já causou `Illegal return statement`.
- **Heredoc Bash + comando paralelo:** quebra a saída das chamadas seguintes.
  Use um script por chamada.

## Estado dos artefatos ao fim desta sessão

| Artefato | Tamanho | SHA256 |
|---|---|---|
| `GameZoneIPTV.apk` | 31.150.643 B | `5d39ae2ed25224b60d86daf71af0f8a2ca479ba534531b8acb7833f47a06c3e3` |
| `GameZoneIPTV-1.0.0.exe` | 85.726.624 B | `14a561d4fe2906018888eb1fa287422faa753529451387748c13a0d4137cc0c5` |
| `Game Zone IPTV Setup 1.0.0.exe` | 86.040.818 B | `03f951ea9655783b6415931e67d7c812c48a84e89f2ef40ddf69a13a651eb7e8` |

O APK cresceu de 27 para 31 MB por causa do Media3/ExoPlayer. É esperado.
