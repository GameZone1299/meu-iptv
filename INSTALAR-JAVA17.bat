@echo off
echo ========================================
echo  Instalar Java 17 para Android
echo ========================================
echo.
echo Este script vai instalar o Java 17 necessario para compilar o APK
echo.
pause

cd /d "%~dp0"

if not exist "java17-installer.msi" (
    echo ERRO: Arquivo java17-installer.msi nao encontrado!
    pause
    exit /b 1
)

echo.
echo Instalando Java 17...
echo (Uma janela de instalacao vai abrir)
echo.

start /wait msiexec /i java17-installer.msi ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome INSTALLDIR="C:\Program Files\Java\jdk-17" /passive

if errorlevel 1 (
    echo.
    echo ERRO na instalacao!
    echo Tente instalar manualmente clicando duplo em: java17-installer.msi
    pause
    exit /b 1
)

echo.
echo ========================================
echo Java 17 instalado com sucesso!
echo Localizacao: C:\Program Files\Java\jdk-17
echo ========================================
echo.
echo Agora execute: COMPILAR-ANDROID.bat
echo.
pause

REM Criar script de compilacao com Java 17
echo @echo off> COMPILAR-ANDROID-JAVA17.bat
echo SET JAVA_HOME=C:\Program Files\Java\jdk-17>> COMPILAR-ANDROID-JAVA17.bat
echo SET PATH=C:\Program Files\Java\jdk-17\bin;%%PATH%%>> COMPILAR-ANDROID-JAVA17.bat
echo cd /d "%%~dp0">> COMPILAR-ANDROID-JAVA17.bat
echo call COMPILAR-ANDROID.bat>> COMPILAR-ANDROID-JAVA17.bat
