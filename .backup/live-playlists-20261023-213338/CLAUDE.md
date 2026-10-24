# Game Zone IPTV — contexto para desenvolvimento

> Referência de retomada baseada nos arquivos presentes no projeto e nos documentos lidos em 23/10/2026. Quando este documento divergir do código, confirme o estado atual antes de agir. Não trate planos como funcionalidades já concluídas.

## Aplicativo

**Game Zone IPTV** (`package.json`, versão declarada `1.0.0`) é um aplicativo com interface web empacotada em múltiplas plataformas:

- Windows: Electron.
- Android/celular: Capacitor 6 e WebView.
- Android TV: projeto Capacitor separado (`android-tv/`) e conteúdo web separado (`www-tv/`).

A interface inclui início, filmes, séries, TV ao vivo, favoritos, playlists e ajustes. Os dados de catálogo embutidos usam uma biblioteca binária própria identificada no manifesto como `gzl1`, com dados gzipados `.gzbin`.

## Estrutura e arquivos principais

- `package.json`: dependências, scripts npm e configuração electron-builder.
- `electron/main.js`: janela Electron e carregamento de `www/index.html`; F11 alterna tela cheia.
- `www/index.html`: estrutura da interface principal e ordem de carregamento dos scripts.
- `www/theme.css`: estilos da interface.
- `www/app.js`: navegação, renderização e comportamento geral da interface/player.
- `www/library.js`: estado e lógica dos catálogos, categorias e busca.
- `www/bib.js`: leitura/formato da biblioteca compacta.
- `www/builtin.js`: manifesto e carregamento dos dados embutidos.
- `www/carregar.js`: carregamento de dados/listas (confirmar detalhes no código antes de alterar).
- `www/db.js`: persistência local/IndexedDB.
- `www/detail.js`: telas de detalhes.
- `www/player-nativo.js`: ponte JS do player nativo.
- `www/vendor/hls.min.js` e `www/vendor/mpegts.js`: players web usados como caminho de reprodução/fallback.
- `www/assets/listas/bib-manifest.json` e arquivos `bib-*.bin.gzbin`: catálogo binário. O manifesto presente informa 49.584 filmes, 11.528 séries, 521.681 episódios, 905 canais ao vivo, 1.996 itens adultos e blocos de 8192.
- `android/app/src/main/java/com/meuiptv/app/PlayerNativoPlugin.java`: integração nativa Media3/ExoPlayer para Android.
- `android/app/src/main/java/com/meuiptv/app/MainActivity.java`: Activity Android principal.
- `android-tv/`: projeto Android TV separado, incluindo `android-tv/app/src/main/java/com/gamezone/tv/PlayerNativoPlugin.java` e `MainActivity.java`.
- `www-tv/`: cópia web destinada à variante Android TV; verificar sincronização com `www/` antes de editar.
- `capacitor.config.json`: app Android comum aponta para `www` e appId `com.gamezone.iptv`.
- `capacitor.config.tv.json`: TV aponta para `www-tv`, appId `com.gamezone.iptv.tv` e projeto `android-tv`.
- `scripts/cap-tv.js`: faz cópia/sync da variante TV usando temporariamente o config TV, restaurando o config principal em `finally`.
- `scripts/`: geração/patches auxiliares; verifique os scripts existentes e suas entradas antes de executá-los.
- `CONTINUAR-AQUI.md`: notas de retomada detalhadas, comandos, decisões e pendências previamente registradas. Algumas informações são declarações desse documento e não foram verificadas independentemente nesta análise.
- `LEIA-ME.md`: instruções gerais de build.
- `build-run.cmd`, `exec-*.bat`, `COMPILAR-*.bat`, `TESTAR-APP.bat`: scripts Windows auxiliares; ler o conteúdo antes de usar.

## Executar, testar e compilar

Scripts declarados no `package.json` (requer dependências instaladas):

```powershell
npm start                 # Executa a versão Electron
npm run build:win         # Gera o alvo portable do Windows em dist/
npm run android:sync     # Sincroniza Capacitor com Android
npm run android:apk      # assembleDebug em android/
npm run android:tv:copy  # Copia web para o projeto Android TV
npm run android:tv:sync  # Sincroniza Android TV
npm run android:tv:apk   # assembleDebug em android-tv/
npm run android:tv:install # Instala debug no dispositivo conectado
```

Para Windows, `LEIA-ME.md` também lista `npm install` antes de `npm start`/`npm run build:win`. Builds Android exigem JDK/SDK compatíveis; `LEIA-ME.md` menciona JDK 17 e Android Studio. O arquivo `build-run.cmd` chama `npx cap sync android`, Gradle `assembleDebug` com `JAVA_HOME=C:\Program Files\Java\jdk-17` e electron-builder para portable + NSIS. `CONTINUAR-AQUI.md` menciona ainda `./node_modules/.bin/electron-builder --win portable --win nsis` e testes Electron em `.tmp/`; confira se os scripts/arquivos ainda existem antes de executar.

O README descreve GitHub Actions **Build Meu IPTV**, mas workflow não foi inspecionado nesta análise, portanto o procedimento remoto e nomes exatos dos artefatos não foram confirmados. Não foi executado nenhum build nem teste nesta tarefa.

## Funcionalidades e implementação observáveis

- Interface principal separa filmes, séries, TV ao vivo, favoritos, playlists e ajustes (`www/index.html`).
- Filmes, séries, canais e conteúdo adulto são lidos do catálogo embutido conforme `www/builtin.js` e manifesto. Episódios são organizados em blocos; `www/library.js` declara cache de blocos carregados.
- Player: há HLS e MPEG-TS no lado web; também existe plugin Android nativo Media3/ExoPlayer e ponte JS. A existência dos componentes é confirmada; o comportamento em aparelhos reais não foi testado nesta tarefa.
- A variante Android TV tem cópias próprias da interface e código nativo; não presuma que uma mudança em `www/` seja automaticamente aplicada em `www-tv/`.
- O manifesto atual quantifica os dados embutidos, mas não comprova disponibilidade, atualidade ou funcionamento de cada canal/URL.

## TV ao vivo — tarefa planejada, não concluída

O objetivo informado para o trabalho futuro é **substituir os canais antigos por quatro listas M3U8 independentes**, preservando filmes e séries intactos. Isto é uma tarefa planejada, não uma funcionalidade concluída. Antes de implementá-la:

1. identificar como os canais antigos são incorporados e de onde vêm as listas;
2. definir/confirmar as quatro fontes M3U8 e como cada uma será selecionada/atualizada;
3. alterar somente a origem/fluxo de TV ao vivo, evitando regenerar ou modificar catálogos de filmes e séries;
4. validar ambas as variantes (Android comum e Android TV) e testar reprodução nos aparelhos disponíveis.

Não há URLs das quatro listas registradas aqui: não foram confirmadas nesta análise.

## Problemas de reprodução e pendências

`CONTINUAR-AQUI.md` registra como pendência histórica testar o player nativo em aparelho Android real; o texto diz que o emulador falhava por ausência do Android Emulator Hypervisor Driver e que a ponte havia sido testada de forma simulada. Isso é informação de um resumo anterior, não uma verificação feita nesta sessão. Não foram examinados logs atuais de erro de reprodução nem reproduzidos erros; portanto não afirmar uma causa ou correção atual sem evidência.

O código Java do plugin comenta que o player nativo existe para evitar carga de demux MPEG-TS na thread principal em TV boxes de poucos recursos. Essa é a justificativa registrada no código, não um diagnóstico independente de falhas atuais.

## Decisões e cuidados técnicos registrados

- `www/bib.js`/`www/library.js` implementam formato compacto para evitar criar centenas de milhares de objetos JS residentes; o resumo `CONTINUAR-AQUI.md` registra blocos de episódios com pools locais e extensão `.gzbin` por causa do empacotamento Android. Confirmar detalhes em `scripts/` e no código antes de modificar formato ou nomes.
- `www/library.js` contém normalização de nomes/categorias para agrupar rótulos equivalentes.
- `scripts/cap-tv.js` restaura a configuração Capacitor original em `finally`; preserve esse comportamento se alterar o script.
- A UI roda na WebView; o plugin nativo é uma implementação Android separada. Preserve o caminho de fallback web e a ponte existente ao trabalhar no player.

## Regras para alterações futuras

1. Ler `CONTINUAR-AQUI.md`, este arquivo e os arquivos relevantes antes de editar; verificar se os fatos ainda correspondem ao código atual.
2. Preservar funcionalidades existentes, especialmente filmes/séries, biblioteca binária, reprodução/fallback e compatibilidade entre `www/` e `www-tv/`.
3. Fazer backup dos arquivos/dados de entrada antes de alterações importantes, geração de biblioteca ou sincronização/build que possa sobrescrever cópias. Registrar claramente o que foi copiado e para onde.
4. Fazer alterações pequenas e localizadas; não substituir listas/dados existentes sem confirmar fontes e escopo.
5. Não declarar correção, build ou teste concluído sem executar e observar o resultado. Registrar erros com logs/saídas disponíveis e sem inferir causa.
6. Antes de executar scripts de build ou geração, ler o script e confirmar suas entradas/saídas.

## Próximas tarefas conhecidas

1. Planejar e implementar a troca de canais antigos pelas quatro listas M3U8 independentes, sem afetar filmes e séries.
2. Testar o player nativo em Android/Android TV reais, se ainda pendente, incluindo alinhamento/controles e canais representativos.
3. Confirmar comportamento da sincronização da variante TV e equivalência dos arquivos web pertinentes após mudanças.
4. Rodar e registrar builds/testes relevantes para cada alteração.

## Lacunas desta recuperação

- URLs, nomes e credenciais (se houver) das quatro listas M3U8: não fornecidos/verificados.
- Origem exata dos antigos canais e seu fluxo de regeneração: não rastreados integralmente.
- Erros atuais de reprodução, logs e correções: não disponíveis nesta análise.
- Resultado atual de build/instalação e teste em dispositivos reais: não executado.
- Workflow GitHub Actions e configurações completas do Gradle/Android TV: não examinados em detalhe.
- O conteúdo de `www/` e `www-tv/` pode divergir; a equivalência integral não foi comparada.
