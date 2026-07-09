#!/usr/bin/env bash
# This script registers the monitor-service (Sentinel) systemd service on the Pi.
set -e

echo "[*] Creating application directory /home/rbpi/monitor-service..."
sudo mkdir -p /home/rbpi/monitor-service
sudo chown -R rbpi:rbpi /home/rbpi/monitor-service

echo "[*] Creating systemd service file /etc/systemd/system/monitor-service.service..."
sudo tee /etc/systemd/system/monitor-service.service > /dev/null << 'EOF'
[Unit]
Description=Sentinel — System Monitoring & Alerting Service
After=network.target postgresql.service

[Service]
User=rbpi
WorkingDirectory=/home/rbpi/monitor-service
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java \
  -Dspring.datasource.password=${MONITOR_DB_PASSWORD} \
  -Dmonitor.db.smdp-password=${SMDP_DB_PASSWORD} \
  -Dmonitor.db.lpa-password=${LPA_DB_PASSWORD} \
  -Dmonitor.db.blog-password=${BLOG_DB_PASSWORD} \
  -Dmonitor.db.monitor-password=${MONITOR_DB_PASSWORD} \
  -Dmonitor.db.keycloak-password=${KEYCLOAK_DB_PASSWORD} \
  -jar /home/rbpi/monitor-service/monitor-service.jar
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

echo "[*] Enabling monitor-service on boot..."
sudo systemctl enable monitor-service.service

echo "[+] Setup completed successfully!"
