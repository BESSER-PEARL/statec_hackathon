@echo off
REM Ageing Luxembourg Dashboard - Automated Setup Script (Windows)
REM STATEC Hackathon 2025

echo ========================================
echo Ageing Luxembourg Dashboard Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    exit /b 1
)
echo [OK] Python found

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 16+ from https://nodejs.org/
    exit /b 1
)
echo [OK] Node.js found

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH
    exit /b 1
)
echo [OK] npm found
echo.

REM Step 1: Initialize the Database
echo ========================================
echo Step 1/4: Initializing Database
echo ========================================
echo Running data fetch script...
python database\data_fetch.py
if errorlevel 1 (
    echo [ERROR] Database initialization failed
    exit /b 1
)
echo [SUCCESS] Database initialized
echo.

REM Step 2: Install Backend Dependencies
echo ========================================
echo Step 2/4: Installing Backend Dependencies
echo ========================================
cd dashboard\backend
if not exist requirements.txt (
    echo [ERROR] requirements.txt not found in dashboard/backend
    exit /b 1
)
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Backend dependencies installation failed
    cd ..\..
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed
cd ..\..
echo.

REM Step 3: Install Frontend Dependencies
echo ========================================
echo Step 3/4: Installing Frontend Dependencies
echo ========================================
cd dashboard\frontend
if not exist package.json (
    echo [ERROR] package.json not found in dashboard/frontend
    cd ..\..
    exit /b 1
)
npm install
if errorlevel 1 (
    echo [ERROR] Frontend dependencies installation failed
    cd ..\..
    exit /b 1
)
echo [SUCCESS] Frontend dependencies installed
cd ..\..
echo.

REM Step 4: Setup Complete
echo ========================================
echo Step 4/4: Setup Complete!
echo ========================================
echo.
echo All dependencies are installed and the database is initialized.
echo.
echo To start the application:
echo   1. Start the backend API:
echo      cd dashboard\backend
echo      python main_api.py
echo.
echo   2. In a separate terminal, start the frontend:
echo      cd dashboard\frontend
echo      npm start
echo.
echo The dashboard will be available at http://localhost:3000
echo ========================================
