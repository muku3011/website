#!/usr/bin/env bash
# This script registers the eim-service systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/eim-service..."
sudo mkdir -p /home/rbpi/eim-service
sudo chown -R rbpi:rbpi /home/rbpi/eim-service

echo "[*] Creating systemd service file /etc/systemd/system/eim-service.service..."
sudo cat << 'EOF' > /etc/systemd/system/eim-service.service
[Unit]
Description=eSIM IoT Remote Manager (eIM) Service
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/eim-service
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -jar /home/rbpi/eim-service/eim-service.jar
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

echo "[*] Enabling eim-service service on boot..."
sudo systemctl enable eim-service.service

echo "[+] Setup completed successfully!"
