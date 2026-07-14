#!/usr/bin/env bash
# ==============================================================================
# Keycloak Bare-Metal Installer for Raspberry Pi 5
# Domain: auth.hutta.in (reverse-proxied via Apache — Keycloak runs HTTP only)
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Keycloak Bare-Metal Installer for Raspberry Pi 5         ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── 1. Root check ─────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# ── Parse arguments ────────────────────────────────────────────────────────────
KC_ADMIN_USERNAME_ARG=""
KC_ADMIN_PASSWORD_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --kc-admin-username)
            KC_ADMIN_USERNAME_ARG="$2"
            shift 2
            ;;
        --kc-admin-password)
            KC_ADMIN_PASSWORD_ARG="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

# ── 2. Detect architecture ────────────────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}Warning: Unexpected architecture: $ARCH. Script is optimized for aarch64 (Pi 5).${NC}"
fi
echo -e "${GREEN}[+] Architecture: $ARCH — confirmed${NC}"

# ── 3. Dependencies ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Checking dependencies...${NC}"

if ! command -v java &>/dev/null; then
    echo -e "${YELLOW}[*] Installing OpenJDK 21...${NC}"
    apt-get update -y
    apt-get install -y openjdk-21-jre-headless
fi

for dep in wget tar curl openssl python3; do
    if ! command -v "$dep" &>/dev/null; then
        apt-get install -y "$dep"
    fi
done
echo -e "${GREEN}[+] All dependencies present${NC}"

# ── 4. Configuration ──────────────────────────────────────────────────────────
KC_VERSION="26.6.4"
KC_DIR="/opt/keycloak"
KC_USER="keycloak"
KC_DB_NAME="keycloakdb"
KC_DB_USER="keycloak"

# Resolve DB password and bootstrap admin credentials from secrets or existing config
SECRETS_FILE="/etc/hutta/secrets.env"
mkdir -p /etc/hutta
chmod 700 /etc/hutta

if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
fi

KC_ADMIN_USERNAME="${KC_ADMIN_USERNAME_ARG:-${KC_ADMIN_USERNAME:-admin}}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD_ARG:-${KC_ADMIN_PASSWORD:-}}"

if [ -z "$KC_ADMIN_PASSWORD" ]; then
    KC_ADMIN_PASSWORD=$(openssl rand -hex 24)
    echo -e "${YELLOW}[*] Generated bootstrap admin password${NC}"
fi

if [ -z "$KC_ADMIN_USERNAME" ]; then
    KC_ADMIN_USERNAME="admin"
fi

if [ -f "$KC_DIR/conf/keycloak.conf" ] && grep -q "db-password=" "$KC_DIR/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "$KC_DIR/conf/keycloak.conf" | cut -d'=' -f2-)
    echo -e "${YELLOW}[*] Reusing existing DB password from keycloak.conf${NC}"
elif [ -n "$KC_DB_PASSWORD" ]; then
    KC_DB_PASS="$KC_DB_PASSWORD"
else
    echo -e "${RED}Error: No Keycloak DB password resolved.${NC}"
    echo -e "${RED}Run setup_postgres.sh first so /etc/hutta/secrets.env contains KC_DB_PASSWORD.${NC}"
    exit 1
fi

write_secret_entry() {
    local key="$1"
    local value="$2"
    python3 - "$SECRETS_FILE" "$key" "$value" <<'PY'
import os, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
updated = False
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as fh:
        lines = fh.readlines()
for idx, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[idx] = f'{key}="{value.replace("\\", "\\\\").replace("\"", "\\\"")}"\n'
        updated = True
        break
if not updated:
    lines.append(f'{key}="{value.replace("\\", "\\\\").replace("\"", "\\\"")}"\n')
with open(path, 'w', encoding='utf-8') as fh:
    fh.writelines(lines)
PY
}

if [ ! -f "$SECRETS_FILE" ]; then
    touch "$SECRETS_FILE"
fi
chmod 600 "$SECRETS_FILE"
write_secret_entry "KC_ADMIN_USERNAME" "$KC_ADMIN_USERNAME"
write_secret_entry "KC_ADMIN_PASSWORD" "$KC_ADMIN_PASSWORD"

# ── 5. System user ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Creating system user '${KC_USER}'...${NC}"
if ! getent passwd "$KC_USER" &>/dev/null; then
    useradd --system -r -d "$KC_DIR" -s /sbin/nologin "$KC_USER"
    echo -e "${GREEN}[+] User '${KC_USER}' created${NC}"
else
    echo -e "${GREEN}[+] User '${KC_USER}' already exists${NC}"
fi

# ── 6. Download & extract ─────────────────────────────────────────────────────
SKIP_DOWNLOAD=false
if [ -x "$KC_DIR/bin/kc.sh" ]; then
    INSTALLED_VER=$("$KC_DIR/bin/kc.sh" --version 2>/dev/null | grep -i "Keycloak" | head -n 1 | awk '{print $2}')
    if [ "$INSTALLED_VER" = "$KC_VERSION" ]; then
        echo -e "${GREEN}[+] Keycloak $KC_VERSION is already installed. Skipping download/extraction.${NC}"
        SKIP_DOWNLOAD=true
    fi
fi

if [ "$SKIP_DOWNLOAD" = "false" ]; then
    echo -e "${YELLOW}[*] Downloading Keycloak ${KC_VERSION}...${NC}"
    TEMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TEMP_DIR"' EXIT
    cd "$TEMP_DIR"

    wget -q --show-progress \
        "https://github.com/keycloak/keycloak/releases/download/${KC_VERSION}/keycloak-${KC_VERSION}.tar.gz"

    echo -e "${YELLOW}[*] Extracting to ${KC_DIR}...${NC}"
    tar -xzf "keycloak-${KC_VERSION}.tar.gz"

    if [ -d "$KC_DIR" ]; then
        BACKUP="/opt/keycloak.bak.$(date +%Y%m%d%H%M%S)"
        echo -e "${YELLOW}[*] Backing up existing install to ${BACKUP}...${NC}"
        mv "$KC_DIR" "$BACKUP"
    fi

    mv "keycloak-${KC_VERSION}" "$KC_DIR"
    cd - >/dev/null
    echo -e "${GREEN}[+] Keycloak extracted to ${KC_DIR}${NC}"
fi

# ── 7. Write keycloak.conf ────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Ensuring /opt/keycloak/conf/keycloak.conf is up to date...${NC}"
mkdir -p "$KC_DIR/conf"

KC_CONF_CONTENT=$(cat <<KCCONF
# ==============================================================================
# Keycloak Configuration — hutta.in
# Runs HTTP on loopback only; Apache terminates TLS at auth.hutta.in
# ============================================================================== 

# Network — listen on loopback; Apache reverse-proxies externally
http-enabled=true
http-host=127.0.0.1
http-port=8080
https-enabled=false

# Public hostname — what Keycloak tells clients to use in OIDC redirects
hostname=auth.hutta.in
hostname-strict-https=true

# Trust X-Forwarded-Proto / X-Forwarded-Host from Apache (KC 26 syntax)
proxy-headers=xforwarded

# Database — PostgreSQL
db=postgres
db-url=jdbc:postgresql://localhost:5432/${KC_DB_NAME}
db-username=${KC_DB_USER}
db-password=\${KC_DB_PASSWORD}

# Logging
log-level=INFO
KCCONF
)

TMP_CONF=$(mktemp)
printf '%s\n' "$KC_CONF_CONTENT" > "$TMP_CONF"
if [ ! -f "$KC_DIR/conf/keycloak.conf" ] || ! cmp -s "$TMP_CONF" "$KC_DIR/conf/keycloak.conf"; then
    install -m 600 "$TMP_CONF" "$KC_DIR/conf/keycloak.conf"
    echo -e "${GREEN}[+] keycloak.conf written/updated${NC}"
else
    echo -e "${GREEN}[+] keycloak.conf already up to date${NC}"
fi
rm -f "$TMP_CONF"

# ── 8. Pre-build optimised distribution ─────────────────────────────────────
BUILD_STAMP="$KC_DIR/.build-complete"
if [ -f "$BUILD_STAMP" ]; then
    echo -e "${GREEN}[+] Keycloak build already completed; skipping rebuild${NC}"
else
    echo -e "${YELLOW}[*] Pre-building Keycloak (bakes in DB + proxy config; ~2-3 min on Pi 5)...${NC}"
    chown -R "$KC_USER:$KC_USER" "$KC_DIR"
    chmod 600 "$KC_DIR/conf/keycloak.conf"

    sudo -u "$KC_USER" "$KC_DIR/bin/kc.sh" build --db=postgres
    touch "$BUILD_STAMP"
    echo -e "${GREEN}[+] Build complete — startup will be faster and use less RAM${NC}"
fi

# Reset ownership after build
chown -R "$KC_USER:$KC_USER" "$KC_DIR"

# ── 10. Install systemd service ───────────────────────────────────────────────
echo -e "${YELLOW}[*] Ensuring keycloak.service is configured...${NC}"
SERVICE_FILE="/etc/systemd/system/keycloak.service"
SERVICE_CONTENT=$(cat <<SVCEOF
[Unit]
Description=Keycloak Identity Provider
Documentation=https://www.keycloak.org/guides
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=idle
User=${KC_USER}
Group=${KC_USER}
WorkingDirectory=${KC_DIR}
EnvironmentFile=/etc/hutta/secrets.env

# JVM tuning for Pi 5 — heap 768 MB + ~300 MB non-heap ≈ 1.1 GB total
Environment="JAVA_OPTS=-Xms256m -Xmx768m -XX:MetaspaceSize=96m -XX:MaxMetaspaceSize=256m -XX:+UseG1GC -XX:+UseStringDeduplication"

ExecStart=${KC_DIR}/bin/kc.sh start --optimized --bootstrap-admin-username=${KC_ADMIN_USERNAME} --bootstrap-admin-password=${KC_ADMIN_PASSWORD}
Restart=on-failure
RestartSec=10

# Security hardening
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF
)

TMP_SERVICE=$(mktemp)
printf '%s\n' "$SERVICE_CONTENT" > "$TMP_SERVICE"
if [ ! -f "$SERVICE_FILE" ] || ! cmp -s "$TMP_SERVICE" "$SERVICE_FILE"; then
    install -m 644 "$TMP_SERVICE" "$SERVICE_FILE"
    echo -e "${GREEN}[+] keycloak.service written/updated${NC}"
else
    echo -e "${GREEN}[+] keycloak.service already up to date${NC}"
fi
rm -f "$TMP_SERVICE"

systemctl daemon-reload
if ! systemctl is-enabled --quiet keycloak.service; then
    systemctl enable keycloak.service
fi
if ! systemctl is-active --quiet keycloak.service; then
    echo -e "${YELLOW}[*] Starting Keycloak...${NC}"
    systemctl start keycloak.service
else
    echo -e "${GREEN}[+] Keycloak service is already running${NC}"
fi
echo -e "${GREEN}[+] keycloak.service installed and enabled${NC}"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Keycloak installed successfully!                         ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Service:         systemctl status keycloak"
echo -e "Logs:            journalctl -u keycloak -f"
echo -e "Admin Console:   http://127.0.0.1:8080/admin"
echo -e "Health check:    curl -I http://127.0.0.1:8080/admin"
echo -e ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo -e "1. Verify the service is healthy with: curl -I http://127.0.0.1:8080/admin"
echo -e "2. Review the local Keycloak configuration if you later need additional integration work."
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${YELLOW}Credentials (stored inside ${SECRETS_FILE}):${NC}"
echo -e "KC_ADMIN_USERNAME=${KC_ADMIN_USERNAME}"
echo -e "KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"