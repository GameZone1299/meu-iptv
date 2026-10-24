@echo off
cd /d "%~dp0"
git remote add origin https://github.com/GameZone1299/meu-iptv.git
git branch -M main
git push -u origin main
pause