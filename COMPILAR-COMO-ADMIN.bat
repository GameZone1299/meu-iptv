@echo off
echo ========================================
echo  Compilador Meu IPTV - Modo Admin
echo  (Atualizado com correcoes de buffer)
echo ========================================
echo.
echo Este script precisa ser executado como Administrador
echo Clique com botao direito e selecione "Executar como administrador"
echo.
pause

cd /d "%~dp0"

echo Verificando arquivos atualizados...
if exist "www\index.html" (
    echo Arquivo www\index.html encontrado - OK
) else (
    echo ERRO: www\index.html nao encontrado!
    pause
    exit /b 1
)

echo.
echo Limpando cache problematico...
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul

echo.
echo Compilando executavel portable com ultimas correcoes...
call npm run build:win

echo.
echo ========================================
if exist "dist\Meu IPTV*.exe" (
    echo SUCESSO! Executavel criado em:
    echo %CD%\dist\
    echo.
    dir /b dist\*.exe
    echo.
    echo Compilado em: %date% %time%
    echo Inclui correcoes de buffer para evitar travamento
) else (
    echo ERRO: Executavel nao foi criado
    echo Verifique os erros acima
)
echo ========================================
echo.
pause
