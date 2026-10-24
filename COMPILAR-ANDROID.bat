@echo off
echo ========================================
echo  Meu IPTV - Compilar APK Android
echo ========================================
echo.
echo REQUISITOS:
echo - Android Studio instalado
echo - Java JDK 17 ou superior
echo - Variavel JAVA_HOME configurada
echo.
echo ========================================
echo.

cd /d "%~dp0"

if exist "android\" (
    echo [1/2] Plataforma Android ja existe, pulando...
) else (
    echo [1/2] Adicionando plataforma Android...
    call npm run android:add
    if errorlevel 1 (
        echo ERRO ao adicionar Android!
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Sincronizando arquivos...
call npm run android:sync
if errorlevel 1 (
    echo ERRO ao sincronizar!
    pause
    exit /b 1
)

echo.
echo [3/3] Compilando APK...
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
echo ========================================
echo.
pause
