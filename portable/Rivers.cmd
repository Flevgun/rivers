@echo off
chcp 65001 >nul
cd /d "%~dp0"
set HOST=127.0.0.1
set PORT=8787
set NITRO_HOST=127.0.0.1
set NITRO_PORT=8787
echo Rivers
echo http://127.0.0.1:8787
echo Закрой это окно, чтобы выключить клиент.
start "Rivers-open" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8787/"
node.exe server\index.mjs
