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
node -e "const s=require('node:net').connect(4186,'127.0.0.1');s.setTimeout(800);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>process.exit(1));"
if not errorlevel 1 (
  echo Port 4186 is already in use. Open http://127.0.0.1:4186/ if Explorer is running.
  echo To load updated source, close its existing server window and run this launcher again.
  pause
  exit /b 0
)
echo Building the current local application...
call npm run build
if errorlevel 1 (
  echo The build did not finish. Review the message above before starting.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4186/ in your browser.
echo Keep this window open while using FM API Explorer.
call npm start
if errorlevel 1 pause
