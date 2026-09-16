@echo off
setlocal
cd /d "%~dp0"
echo cancelar>"cancelar.flag"
echo Cancelamento solicitado. Aguarde o log confirmar antes de reiniciar.
echo Durante a ordenacao em disco, a resposta pode demorar.
pause
