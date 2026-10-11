@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\Instalar-Ordem-de-Corte.ps1"
endlocal
