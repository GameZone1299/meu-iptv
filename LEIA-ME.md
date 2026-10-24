# Meu IPTV — Android (celular + TV) e Windows (EXE)

## Jeito mais fácil: compilar na nuvem (grátis, sem instalar nada)

1. Crie uma conta em github.com e um repositório novo (pode ser privado).
2. Envie todo o conteúdo desta pasta (incluindo a pasta `.github`).
3. No repositório, abra **Actions → Build Meu IPTV → Run workflow**.
4. Em alguns minutos, baixe em **Artifacts**:
   - `MeuIPTV-android-apk` → `app-debug.apk` (instala no celular e na Android TV)
   - `MeuIPTV-windows-exe` → instalador `.exe` e versão portátil `.exe`

## Instalar o APK
- **Celular:** abra o APK e permita "instalar de fontes desconhecidas".
- **Android TV:** coloque o APK num pendrive ou use o app "Send Files to TV" / "Downloader",
  e instale. O app aparece na tela inicial da TV (já está configurado como Leanback).

## Compilar no seu PC (opcional)
- Windows: `npm install` e depois `npm run build:win` (sai em `dist/`).
- Testar no PC sem compilar: `npm install` e `npm start`.
- Android: precisa de Android Studio + JDK 17: `npm install`, `npm run android:add`,
  `npm run android:sync`, `npm run android:apk`.

## Observações
- No Windows, F11 alterna tela cheia. Controle remoto da TV: setas, OK e Voltar já funcionam.
- O APK sai "debug" (serve para instalar direto). Para publicar na Play Store é preciso assinar um release.
- Ícone do app: o padrão do Capacitor. Dá para trocar depois.
