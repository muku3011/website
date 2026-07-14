#!/usr/bin/env bash
# This script egisters the smdp-plus systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/smdp-plus..."
sudo mkdir -p /home/rbpi/smdp-plus
sudo chown -R rbpi:rbpi /home/rbpi/smdp-plus

echo "[*] Creating systemd service file /etc/systemd/system/smdp-plus.service..."
sudo cat << 'EOF' > /etc/systemd/system/smdp-plus.service
[Unit]
Description=GSMA SGP.22 eSIM SM-DP+ Server
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/smdp-plus
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -jar /home/rbpi/smdp-plus/smdp-plus.jar
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

echo "[*] Enabling smdp-plus service on boot..."
sudo systemctl enable smdp-plus.service

echo "[+] Setup completed successfully!"
