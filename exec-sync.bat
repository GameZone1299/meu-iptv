@echo off
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
echo === Sincronizando Capacitor Android ===
call npx cap sync android
echo === Capacitor Sync Concluido ===
