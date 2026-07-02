#!/usr/bin/env bash

# ==============================================================================
# Keycloak Bare-Metal Installer for Raspberry Pi 5
# Domain: auth.hutta.in (reverse-proxied via Apache — Keycloak runs HTTP only)
#
# Usage:
#   sudo ./scripts/install_keycloak.sh                            # auto DB password
#   sudo ./scripts/install_keycloak.sh --kc-db-password <pass>   # use specific password
#
# Run setup_postgres.sh first (or pass the same password here).
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Keycloak Bare-Metal Installer for Raspberry Pi 5         ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── 1. Root check ─────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# ── Parse arguments ────────────────────────────────────────────────────────────
KC_DB_PASS_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --kc-db-password)
            KC_DB_PASS_ARG="$2"
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
if [ "$ARCH" != "aarch64" ]; then
    echo -e "${RED}Error: Unsupported architecture: $ARCH. Expected aarch64 (Pi 5).${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Architecture: aarch64 (ARM64) — confirmed${NC}"

# ── 3. Dependencies ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Checking dependencies...${NC}"

if ! command -v java &>/dev/null; then
    echo -e "${YELLOW}[*] Installing OpenJDK 21...${NC}"
    apt-get update -y
    apt-get install -y openjdk-21-jre-headless
fi

for dep in wget tar curl openssl; do
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

# Resolve DB password: CLI arg > existing keycloak.conf > fail (setup_postgres.sh must run first)
if [ -n "$KC_DB_PASS_ARG" ]; then
    KC_DB_PASS="$KC_DB_PASS_ARG"
    echo -e "${YELLOW}[*] Using provided DB password${NC}"
elif [ -f "$KC_DIR/conf/keycloak.conf" ] && grep -q "db-password=" "$KC_DIR/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "$KC_DIR/conf/keycloak.conf" | cut -d'=' -f2-)
    echo -e "${YELLOW}[*] Reusing existing DB password from keycloak.conf${NC}"
else
    echo -e "${RED}Error: No DB password provided and no existing keycloak.conf found.${NC}"
    echo -e "${RED}Run setup_postgres.sh first and pass the printed password via --kc-db-password.${NC}"
    exit 1
fi

# ── 5. System user ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Creating system user '${KC_USER}'...${NC}"
if ! getent passwd "$KC_USER" &>/dev/null; then
    useradd --system -r -d "$KC_DIR" -s /sbin/nologin "$KC_USER"
    echo -e "${GREEN}[+] User '${KC_USER}' created${NC}"
else
    echo -e "${GREEN}[+] User '${KC_USER}' already exists${NC}"
fi

# ── 6. Download & extract ─────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Downloading Keycloak ${KC_VERSION}...${NC}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT
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

# ── 7. Write keycloak.conf ────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Writing /opt/keycloak/conf/keycloak.conf...${NC}"
cat > "$KC_DIR/conf/keycloak.conf" <<KCCONF
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
db-password=${KC_DB_PASS}

# Custom hutta theme applied at realm level (also set in Realm → Themes UI)
spi-theme-welcome-theme=hutta
spi-theme-login-theme=hutta
spi-theme-account-theme=hutta

# Logging
log-level=INFO
KCCONF
echo -e "${GREEN}[+] keycloak.conf written${NC}"

# ── 8. PostgreSQL database setup ──────────────────────────────────────────────
# Delegated to setup_postgres.sh — run it before this script, or it will be
# called here automatically with the resolved password.
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
POSTGRES_SCRIPT="$SCRIPT_DIR/setup_postgres.sh"

if [ ! -f "$POSTGRES_SCRIPT" ]; then
    echo -e "${RED}Error: setup_postgres.sh not found at ${POSTGRES_SCRIPT}${NC}"
    exit 1
fi

echo -e "${YELLOW}[*] Running setup_postgres.sh to provision keycloakdb...${NC}"
bash "$POSTGRES_SCRIPT" --kc-password "${KC_DB_PASS}"
echo -e "${GREEN}[+] PostgreSQL database '${KC_DB_NAME}' ready${NC}"

# ── 9. Deploy hutta theme ─────────────────────────────────────────────────────
THEME_SRC="$SCRIPT_DIR/../keycloak/hutta"
if [ -d "$THEME_SRC" ]; then
    echo -e "${YELLOW}[*] Deploying hutta theme from repo...${NC}"
    cp -r "$THEME_SRC" "$KC_DIR/themes/hutta"
    echo -e "${GREEN}[+] Theme deployed to ${KC_DIR}/themes/hutta${NC}"
else
    echo -e "${YELLOW}[!] Theme not found at ${THEME_SRC} — deploy manually after install${NC}"
fi

# ── 10. Pre-build optimised distribution ─────────────────────────────────────
echo -e "${YELLOW}[*] Pre-building Keycloak (bakes in DB + proxy config; ~2-3 min on Pi 5)...${NC}"
# Set ownership before build so kc.sh can write cache files
chown -R "$KC_USER:$KC_USER" "$KC_DIR"
chmod 600 "$KC_DIR/conf/keycloak.conf"

sudo -u "$KC_USER" "$KC_DIR/bin/kc.sh" build --db=postgres
echo -e "${GREEN}[+] Build complete — startup will be faster and use less RAM${NC}"

# Reset ownership after build (kc.sh may have written as root)
chown -R "$KC_USER:$KC_USER" "$KC_DIR"

# ── 11. Install systemd service ───────────────────────────────────────────────
echo -e "${YELLOW}[*] Installing systemd service...${NC}"
cat > /etc/systemd/system/keycloak.service <<SVCEOF
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

# JVM tuning for Pi 5 — heap 768 MB + ~300 MB non-heap ≈ 1.1 GB total
Environment="JAVA_OPTS=-Xms256m -Xmx768m -XX:MetaspaceSize=96m -XX:MaxMetaspaceSize=256m -XX:+UseG1GC -XX:+UseStringDeduplication"

ExecStart=${KC_DIR}/bin/kc.sh start --optimized
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

systemctl daemon-reload
systemctl enable keycloak.service
echo -e "${GREEN}[+] keycloak.service installed and enabled${NC}"

# ── 12. Start service ─────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Starting Keycloak (first startup: 3-5 min on Pi 5)...${NC}"
systemctl start keycloak.service

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Keycloak installed successfully!                         ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Service:         systemctl status keycloak"
echo -e "Logs:            journalctl -u keycloak -f"
echo -e "Admin Console:   http://127.0.0.1:8080/admin  (LAN only once Apache is set)"
echo -e "Health check:    curl http://127.0.0.1:8080/health/ready"
echo -e ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo -e "1. Wait ~5 min, then open: http://127.0.0.1:8080/admin"
echo -e "2. Create realm: hutta"
echo -e "3. Create group: users"
echo -e "4. Create OIDC client: apache-portal (confidential)"
echo -e "   - Redirect URI: https://hutta.in/redirect_uri"
echo -e "   - Add Group Membership mapper, claim name: groups, full path: OFF"
echo -e "5. Realm → Realm settings → Themes → set Login + Account to: hutta"
echo -e "6. Run: sudo ./scripts/configure_apache.sh"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${YELLOW}DB password (also stored in /opt/keycloak/conf/keycloak.conf):${NC}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
