@echo off
chcp 65001 >nul
echo ========================================================
echo   GAME ZONE IPTV - BUILD COMPLETO
echo ========================================================

echo.
echo [1/3] Sincronizando Capacitor Android...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo ERRO no Capacitor Sync!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Compilando APK Android com JDK 17...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app\android"
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
    echo ERRO no build do APK Android!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Compilando Executáveis Windows (Portable + NSIS)...
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
call .\node_modules\.bin\electron-builder --win portable --win nsis
if %ERRORLEVEL% neq 0 (
    echo ERRO no build do Windows!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   TODOS OS BUILDS FORAM CONCLUÍDOS COM SUCESSO!
echo ========================================================
echo.
pause
