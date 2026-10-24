@echo off
echo ========================================
echo  Configurar Android SDK
echo ========================================
echo.
echo Abra o Android Studio e va em:
echo File ^> Settings ^> Appearance and Behavior ^> System Settings ^> Android SDK
echo.
echo Copie o caminho que aparece em "Android SDK Location"
echo Exemplo: C:\Users\JuanRennely\AppData\Local\Android\Sdk
echo.
echo ========================================
echo.
set /p SDK_PATH="Cole o caminho do Android SDK aqui: "

if not exist "%SDK_PATH%\platform-tools" (
    echo.
    echo ERRO: Caminho invalido! Nao encontrei a pasta platform-tools
    echo Verifique se o caminho esta correto.
    pause
    exit /b 1
)

echo.
echo Criando arquivo de configuracao...
echo sdk.dir=%SDK_PATH:\=\\%> "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app\android\local.properties"

echo.
echo ========================================
echo SDK configurado com sucesso!
echo ========================================
echo.
echo Agora execute: COMPILAR-ANDROID-JAVA17.bat
echo.
pause
