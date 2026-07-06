#!/usr/bin/env bash
# This script registers the lpa-simulator systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/lpa-simulator..."
sudo mkdir -p /home/rbpi/lpa-simulator
sudo chown -R rbpi:rbpi /home/rbpi/lpa-simulator

echo "[*] Creating systemd service file /etc/systemd/system/lpa-simulator.service..."
sudo cat << 'EOF' > /etc/systemd/system/lpa-simulator.service
[Unit]
Description=GSMA SGP.22 eSIM Local Profile Assistant (LPA) Simulator
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/lpa-simulator
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -Dspring.datasource.password=${LPA_DB_PASSWORD} -jar /home/rbpi/lpa-simulator/lpa-simulator.jar
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

echo "[*] Enabling lpa-simulator service on boot..."
sudo systemctl enable lpa-simulator.service

echo "[+] Setup completed successfully!"
