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
- `www/assets/listas/bib-manifest.json` e arquivos `bib-*.bin.gzbin`: catálogo binário. Após a integração das quatro playlists, o manifesto ativo conserva filmes, séries, episódios e itens adultos; a entrada/catálogo `bib-live.bin` foi removida dos assets ativos. O manifesto informa 49.584 filmes, 11.528 séries, 521.681 episódios, 0 canais legados e 1.996 itens adultos; blocos de episódios de 8192.
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

Para Windows, `LEIA-ME.md` também lista `npm install` antes de `npm start`/`npm run build:win`. Builds Android exigem JDK/SDK compatíveis. Durante esta integração, os scripts de sync Capacitor para Mobile e TV concluíram com sucesso; os comandos APK declarados falharam porque `gradlew.bat` não foi reconhecido como comando pelo ambiente. O `build:win` terminou com sucesso no estado final observado. `build-run.cmd` pode usar configurações próprias; leia-o antes de executar.

O README descreve GitHub Actions **Build Meu IPTV**; o procedimento remoto não foi usado nesta integração. Os testes executados e os builds Android pendentes estão resumidos em `CONTINUAR-AQUI.md`.

## Funcionalidades e implementação observáveis

- Interface principal separa filmes, séries, TV ao vivo, favoritos, playlists e ajustes (`www/index.html`).
- Filmes, séries e conteúdo adulto são lidos do catálogo embutido conforme `www/builtin.js` e manifesto. TV ao vivo é carregada da playlist selecionada em `www/live-playlists.js`. Episódios são organizados em blocos; `www/library.js` declara cache de blocos carregados.
- Player: há HLS e MPEG-TS no lado web; também existe plugin Android nativo Media3/ExoPlayer e ponte JS. A existência dos componentes é confirmada; o comportamento em aparelhos reais não foi testado nesta tarefa.
- A variante Android TV tem cópias próprias da interface e código nativo; não presuma que uma mudança em `www/` seja automaticamente aplicada em `www-tv/`.
- O manifesto atual quantifica os dados embutidos, mas não comprova disponibilidade, atualidade ou funcionamento de cada canal/URL.

## TV ao vivo — integração em validação

A integração substitui o catálogo live legado por quatro playlists empacotadas, selecionáveis individualmente. O módulo de carregamento está em `www/live-playlists.js` e sua variante TV em `www-tv/live-playlists.js`; os nomes e arquivos estão no array `LIVE_PLAYLISTS` (`Lista 1` a `Lista 4`). Os arquivos originais permanecem em `D:\Documentos\IPTV\playlist`; cópias para distribuição ficam em `www/assets/live-playlists/` e `www-tv/assets/live-playlists/`, sincronizadas aos projetos nativos via `npm run android:sync` e `npm run android:tv:sync`.

Os manifestos ativos removem `bib-live.bin`, os quatro assets binários legados foram removidos após conferir os backups em `.backup/live-playlists-20261023-213338`, e a contagem `totais.live` foi zerada. Catálogos de filmes, séries, episódios, adulto e módulos compartilhados não devem ser removidos. Listas M3U contendo VOD são filtradas por metadados, nome e endereço; isso é heurístico e deve ser reavaliado com dados reais sem registrar URLs completas, pois podem conter credenciais.

Testes isolados em `.tmp/test-live-playlists.js` e `.tmp/diagnose-live-flow.js` verificam parser, mapeamento, deduplicação, atualização de estado e mensagem de falha usando fixtures fictícias (não são URLs de canais reais). `.tmp/test-real-playlists.js` processou localmente as quatro listas: 1.019, 96, 2.509 e 230 itens classificados como live pelo filtro atual; isso não comprova disponibilidade ou reprodução. Um smoke test Electron confirmou catálogos de filmes/séries/episódios carregados, mas terminou com código não-zero por erro `$ is not defined` observado na janela de teste. O EXE Windows foi gerado; APK Mobile/TV não compilaram porque `gradlew.bat` não foi reconhecido pelo npm scripts. Veja `CONTINUAR-AQUI.md` para limitações.

## Problemas de reprodução e pendências

A integração ainda precisa ser testada em aparelho Android real. Nesta sessão, os syncs Capacitor Mobile/TV concluíram, mas os comandos de build APK falharam porque `gradlew.bat` não foi reconhecido pelo ambiente npm. Não foram reproduzidos canais reais nem examinados logs atuais de reprodução; não afirmar funcionamento ou causa de falhas sem evidência.

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

1. Corrigir a invocação do Gradle wrapper no ambiente Windows e compilar APKs Mobile e Android TV.
2. Testar o player nativo em Android/Android TV reais, incluindo alinhamento/controles e canais representativos; nenhum canal real foi confirmado nesta sessão.
3. Revalidar visualmente a interface Electron e corrigir o erro do smoke test offscreen (`$ is not defined`), sem considerar o teste atual como inicialização limpa.
4. Revisar a filtragem heurística de VOD nas quatro listas e os estados de seleção, recarga e erro.
5. Atualizar a cópia web avulsa em `D:\Documentos\IPTV\` somente se ela fizer parte da entrega desejada; não foi sincronizada nesta etapa.

## Lacunas desta recuperação

- URLs, nomes e credenciais (se houver) das quatro listas M3U8: não fornecidos/verificados.
- Origem exata dos antigos canais e seu fluxo de regeneração: não rastreados integralmente.
- Erros atuais de reprodução, logs e correções: não disponíveis nesta análise.
- Resultado atual de build/instalação e teste em dispositivos reais: não executado.
- Workflow GitHub Actions e configurações completas do Gradle/Android TV: não examinados em detalhe.
- O conteúdo de `www/` e `www-tv/` pode divergir; a equivalência integral não foi comparada.
