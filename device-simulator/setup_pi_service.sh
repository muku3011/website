#!/usr/bin/env bash
# This script registers the device-simulator systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/device-simulator..."
sudo mkdir -p /home/rbpi/device-simulator
sudo chown -R rbpi:rbpi /home/rbpi/device-simulator

echo "[*] Creating systemd service file /etc/systemd/system/device-simulator.service..."
sudo cat << 'EOF' > /etc/systemd/system/device-simulator.service
[Unit]
Description=eSIM Device Simulator Service (LPA & IPA)
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/device-simulator
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -jar /home/rbpi/device-simulator/device-simulator.jar
SuccessExitStatus=143
StandardOutput=journal
StandardError=journal
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "[*] Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "[*] Enabling device-simulator service on boot..."
sudo systemctl enable device-simulator.service

echo "[+] Setup completed successfully!"
