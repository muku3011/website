#!/usr/bin/env bash
# This script registers the hsm-simulator systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/hsm-simulator..."
sudo mkdir -p /home/rbpi/hsm-simulator
sudo chown -R rbpi:rbpi /home/rbpi/hsm-simulator

echo "[*] Creating systemd service file /etc/systemd/system/hsm-simulator.service..."
sudo cat << 'EOF' > /etc/systemd/system/hsm-simulator.service
[Unit]
Description=Centralized Network HSM Simulator Daemon
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/hsm-simulator
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -jar /home/rbpi/hsm-simulator/hsm-simulator.jar
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

echo "[*] Enabling hsm-simulator service on boot..."
sudo systemctl enable hsm-simulator.service

echo "[+] Setup completed successfully!"
