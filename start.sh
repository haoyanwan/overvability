#!/bin/bash

# Navimow Observability - Start Script
# Runs frontend and backend concurrently

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}Starting Navimow Observability...${NC}"

# Cleanup function to kill background processes on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Trap Ctrl+C and other signals
trap cleanup SIGINT SIGTERM

# Check for python3.9
if ! command -v python3.9 &> /dev/null; then
    echo -e "${RED}Error: python3.9 is not installed${NC}"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Install npm dependencies if node_modules doesn't exist
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    cd "$SCRIPT_DIR" && npm install
fi

# Install python dependencies if needed
if [ -f "$SCRIPT_DIR/backend/requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    python3.9 -m pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q
fi

# Start backend
echo -e "${GREEN}Starting backend (python3.9)...${NC}"
cd "$SCRIPT_DIR/backend" && python3.9 app.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend (vite)...${NC}"
cd "$SCRIPT_DIR" && npm run dev:frontend &
FRONTEND_PID=$!

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Navimow Observability is running!${NC}"
echo -e "${GREEN}Frontend: http://localhost:5173${NC}"
echo -e "${GREEN}Backend:  http://localhost:5000${NC}"
echo -e "${GREEN}Press Ctrl+C to stop${NC}"
echo -e "${GREEN}========================================${NC}"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
