@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/npm was not found. Install Node.js 20+ and try again.
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting Rail Shooter dev server on http://127.0.0.1:5173/
echo Close the "Rail Shooter" window or run stop.bat to shut down.
start "Rail Shooter" /D "%~dp0" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

endlocal
