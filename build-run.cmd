echo ========================================================
echo   GAME ZONE IPTV - BUILD COMPLETO
echo ========================================================

echo.
echo [1/3] Sincronizando Capacitor Android...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
call npx cap sync android

echo.
echo [2/3] Compilando APK Android com JDK 17...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app\android"
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call gradlew.bat assembleDebug

echo.
echo [3/3] Compilando Executáveis Windows (Portable + NSIS)...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
call .\node_modules\.bin\electron-builder --win portable --win nsis

echo.
echo ========================================================
echo   CONCLUIDO!
echo ========================================================
