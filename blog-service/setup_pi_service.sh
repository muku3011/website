#!/usr/bin/env bash
# This script registers the blog-service systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/blog-service..."
sudo mkdir -p /home/rbpi/blog-service
sudo chown -R rbpi:rbpi /home/rbpi/blog-service

echo "[*] Creating systemd service file /etc/systemd/system/blog-service.service..."
sudo cat << 'EOF' > /etc/systemd/system/blog-service.service
[Unit]
Description=Technology Blog Backend Service
After=network.target

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/blog-service
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java -Dspring.datasource.password=${BLOG_DB_PASSWORD} -jar /home/rbpi/blog-service/blog-service.jar
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

echo "[*] Enabling blog-service service on boot..."
sudo systemctl enable blog-service.service

echo "[+] Setup completed successfully!"
