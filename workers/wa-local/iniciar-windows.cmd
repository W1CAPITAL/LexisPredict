@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js 20 ou superior nao encontrado. Instale gratuitamente em nodejs.org.
 pause
 exit /b 1
)
if not exist ".env" (
 copy /Y ".env.example" ".env" >nul
 echo Cole a credencial gerada em WhatsApp ^> Conectar dispositivo local.
 notepad ".env"
)
if not exist "node_modules" (
 echo Instalando a ponte local de WhatsApp...
 call npm install --no-audit --no-fund
 if errorlevel 1 (
  echo Nao foi possivel instalar as dependencias.
  pause
  exit /b 1
 )
)
echo Iniciando WA Local... deixe esta janela aberta.
node index.mjs
pause
