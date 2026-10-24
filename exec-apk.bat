@echo off
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app\android"
echo === Configurando JDK 17 ===
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo JAVA_HOME=%JAVA_HOME%
echo === Compilando APK Android Debug ===
call gradlew.bat assembleDebug
echo === Build Android Concluido ===
