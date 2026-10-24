@echo off
echo ========================================
echo  Meu IPTV - Compilar APK Android
echo  (Com Java 17 - Atualizado)
echo ========================================
echo.
SET JAVA_HOME=C:\Program Files\Java\jdk-17
SET PATH=C:\Program Files\Java\jdk-17\bin;%PATH%
cd /d "%~dp0"

echo [1/2] Sincronizando arquivos atualizados...
call npm run android:sync
if errorlevel 1 (
    echo ERRO ao sincronizar!
    pause
    exit /b 1
)

echo.
echo [2/2] Compilando APK com as ultimas mudancas...
call npm run android:apk
if errorlevel 1 (
    echo ERRO ao compilar APK!
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCESSO! APK criado em:
echo %CD%\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Compilado em: %date% %time%
echo ========================================
echo.
pause
