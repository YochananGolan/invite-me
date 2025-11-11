@echo off

echo Cleaning port 3000...

REM Kill any process using port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Killing process %%a on port 3000
    taskkill /PID %%a /F >nul 2>&1
)

REM Wait a moment for the port to be released
timeout /t 2 /nobreak >nul

echo Starting development server...
echo Press Ctrl+C to stop the server and cleanup port 3000

npm run dev

REM Cleanup on exit
echo.
echo Cleaning port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Killing process %%a on port 3000
    taskkill /PID %%a /F >nul 2>&1
)
echo Cleanup completed. Goodbye!
