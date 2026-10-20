@echo off
setlocal EnableDelayedExpansion
set "PORT=5173"
set "FOUND=0"

cd /d "%~dp0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set "FOUND=1"
  taskkill /F /PID %%P >nul 2>&1
  if not errorlevel 1 echo Stopped process PID %%P on port %PORT%.
)

if "!FOUND!"=="0" (
  echo No dev server found listening on port %PORT%.
) else (
  echo Done.
)

endlocal
