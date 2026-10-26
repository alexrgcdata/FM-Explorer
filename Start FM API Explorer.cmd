@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 or newer, then try again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:4186/ in your browser.
echo Keep this window open while using FM API Explorer.
call npm start
if errorlevel 1 pause
