#!/usr/bin/env bash
# This script registers the authelia-ldap systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/authelia-ldap..."
sudo mkdir -p /home/rbpi/authelia-ldap
sudo chown -R rbpi:rbpi /home/rbpi/authelia-ldap

echo "[*] Creating systemd service file /etc/systemd/system/authelia-ldap.service..."
sudo cat << 'EOF' > /etc/systemd/system/authelia-ldap.service
[Unit]
Description=Authelia custom database-backed LDAP server
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/authelia-ldap
ExecStart=/usr/bin/java -jar /home/rbpi/authelia-ldap/authelia-ldap.jar
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

echo "[*] Enabling authelia-ldap service on boot..."
sudo systemctl enable authelia-ldap.service

echo "[+] Setup completed successfully!"
