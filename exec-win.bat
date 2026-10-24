@echo off
cd /d "D:\Documentos\IPTV\meu-iptv-projeto\iptv-app"
echo === Gerando Executaveis Windows (Portable e NSIS) ===
call .\node_modules\.bin\electron-builder --win portable --win nsis
echo === Build Windows Concluido ===
