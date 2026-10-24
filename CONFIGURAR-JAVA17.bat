@echo off
echo ========================================
echo  Configurar Java 17 para Android
echo ========================================
echo.
echo Cole o caminho completo da pasta do Java 17
echo Exemplo: C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot
echo.
set /p JAVA17_PATH="Caminho do Java 17: "

if not exist "%JAVA17_PATH%\bin\java.exe" (
    echo ERRO: Java nao encontrado nesse caminho!
    pause
    exit /b 1
)

echo.
echo Salvando configuracao...
echo SET JAVA_HOME=%JAVA17_PATH%> android-java17.bat
echo SET PATH=%JAVA17_PATH%\bin;%%PATH%%>> android-java17.bat
echo cd /d "%%~dp0">> android-java17.bat
echo call COMPILAR-ANDROID.bat>> android-java17.bat

echo.
echo ========================================
echo Configuracao salva!
echo Agora execute: android-java17.bat
echo ========================================
pause
