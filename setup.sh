#!/bin/bash
# Ageing Luxembourg Dashboard - Automated Setup Script (Unix/Linux/Mac)
# STATEC Hackathon 2025

echo "========================================"
echo "Ageing Luxembourg Dashboard Setup"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Python is not installed or not in PATH"
    echo "Please install Python 3.8+ from https://www.python.org/"
    exit 1
fi

# Use python3 if available, otherwise python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
else
    PYTHON_CMD="python"
    PIP_CMD="pip"
fi

echo -e "${GREEN}[OK]${NC} Python found ($(${PYTHON_CMD} --version))"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH"
    echo "Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js found ($(node --version))"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} npm is not installed or not in PATH"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} npm found ($(npm --version))"
echo ""

# Step 1: Initialize the Database
echo "========================================"
echo "Step 1/4: Initializing Database"
echo "========================================"
echo "Running data fetch script..."
${PYTHON_CMD} database/data_fetch.py
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Database initialization failed"
    exit 1
fi
echo -e "${GREEN}[SUCCESS]${NC} Database initialized"
echo ""

# Step 2: Install Backend Dependencies
echo "========================================"
echo "Step 2/4: Installing Backend Dependencies"
echo "========================================"
cd dashboard/backend
if [ ! -f requirements.txt ]; then
    echo -e "${RED}[ERROR]${NC} requirements.txt not found in dashboard/backend"
    exit 1
fi
${PIP_CMD} install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Backend dependencies installation failed"
    cd ../..
    exit 1
fi
echo -e "${GREEN}[SUCCESS]${NC} Backend dependencies installed"
cd ../..
echo ""

# Step 3: Install Frontend Dependencies
echo "========================================"
echo "Step 3/4: Installing Frontend Dependencies"
echo "========================================"
cd dashboard/frontend
if [ ! -f package.json ]; then
    echo -e "${RED}[ERROR]${NC} package.json not found in dashboard/frontend"
    cd ../..
    exit 1
fi
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Frontend dependencies installation failed"
    cd ../..
    exit 1
fi
echo -e "${GREEN}[SUCCESS]${NC} Frontend dependencies installed"
cd ../..
echo ""

# Step 4: Setup Complete
echo "========================================"
echo "Step 4/4: Setup Complete!"
echo "========================================"
echo ""
echo "All dependencies are installed and the database is initialized."
echo ""
echo "To start the application:"
echo "  1. Start the backend API:"
echo "     cd dashboard/backend"
echo "     ${PYTHON_CMD} main_api.py"
echo ""
echo "  2. In a separate terminal, start the frontend:"
echo "     cd dashboard/frontend"
echo "     npm start"
echo ""
echo "The dashboard will be available at http://localhost:3000"
echo "========================================"
