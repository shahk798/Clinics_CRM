@echo off
echo ========================================
echo   Clinics CRM - Quick Start
echo ========================================
echo.
echo Checking Node.js installation...
node --version
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo.
echo ========================================
echo Starting server...
echo ========================================
echo.
echo Server will start on: http://localhost:5000
echo Signup page: http://localhost:5000/frontend/signup.html
echo Login page: http://localhost:5000/frontend/login.html
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.
node server.js
