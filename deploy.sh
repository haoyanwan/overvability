#!/bin/bash
set -e
cd /data/navimow-observability

# Install Node deps & build frontend
npm ci
npm run build

# Install Python deps
pip3.9 install -r backend/requirements.txt

# First-run: install systemd service
if [ ! -f /etc/systemd/system/navimow-observability.service ]; then
    sudo cp navimow-observability.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable navimow-observability
fi

# Restart service
sudo systemctl restart navimow-observability
echo "[Deploy] Done."
