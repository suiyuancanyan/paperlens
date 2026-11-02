@echo off
cd /d "%~dp0"
if not exist node_modules\vite (
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist public\cmaps (
  node scripts\copy-pdf-assets.mjs
  if errorlevel 1 exit /b 1
)
start "" http://127.0.0.1:4173
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 exit /b 1
)
call npm start
