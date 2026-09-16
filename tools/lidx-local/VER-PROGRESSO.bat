@echo off
setlocal
cd /d "%~dp0"
echo === PROGRESSO ===
if exist "progresso.log" powershell.exe -NoProfile -Command "Get-Content -LiteralPath 'progresso.log' -Tail 15"
echo === ERROS / AVISOS DO NODE ===
if exist "erros.log" type "erros.log"
echo.
echo CONCLUIDO no log confirma que o .lidx esta pronto.
echo O aviso ExperimentalWarning do SQLite nao e falha.
pause
