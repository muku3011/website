#!/usr/bin/env bash
# ==============================================================================
# Unified Systemd Service Registration Helper for Hutta Services
# Arguments:
#   1: service_name (e.g. blog-service)
#   2: app_dir (e.g. /home/rbpi/blog-service)
#   3: jar_name (e.g. blog-service.jar)
#   4: [optional] description (e.g. "Technology Blog Backend Service")
#   5: [optional] max heap (e.g. 256m — defaults to 256m)
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 3 ]; then
    echo "Error: Missing arguments."
    echo "Usage: $0 <service_name> <app_dir> <jar_name> [description] [max_heap]"
    exit 1
fi

SERVICE_NAME="$1"
APP_DIR="$2"
JAR_NAME="$3"
DESCRIPTION="${4:-Hutta $SERVICE_NAME Service}"
MAX_HEAP="${5:-256m}"

# JVM flags optimised for a low-memory embedded system (Raspberry Pi)
JVM_OPTS="-Xms32m -Xmx${MAX_HEAP} -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m \
-XX:+TieredCompilation -XX:TieredStopAtLevel=1 \
-Djava.security.egd=file:/dev/./urandom"

# Ensure root check
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Please run this script as root (use sudo)."
    exit 1
fi

echo "[*] Creating application directory ${APP_DIR}..."
mkdir -p "${APP_DIR}"
chown -R rbpi:rbpi "${APP_DIR}"

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
echo "[*] Creating systemd service file ${SERVICE_FILE}..."

cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=${DESCRIPTION}
After=network.target postgresql.service

[Service]
User=rbpi
WorkingDirectory=${APP_DIR}
EnvironmentFile=/etc/hutta/secrets.env
ExecStart=/usr/bin/java ${JVM_OPTS} -jar ${APP_DIR}/${JAR_NAME}
SuccessExitStatus=143
StandardOutput=journal
StandardError=journal
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "[*] Reloading systemd daemon..."
systemctl daemon-reload

echo "[*] Enabling ${SERVICE_NAME} on boot..."
systemctl enable "${SERVICE_NAME}.service"

echo "[*] Starting/restarting ${SERVICE_NAME} service..."
systemctl restart "${SERVICE_NAME}.service"

echo "[+] Service ${SERVICE_NAME} registered successfully!"
