#!/usr/bin/env bash

# ==============================================================================
# Authelia Baremetal Installer & Configurator for Raspberry Pi 5
# Subpath Configuration: Served on hutta.in/authelia
# Supports Raspberry Pi OS & Debian (ARM64 and ARMhf)
# Run this script with sudo: sudo ./install_authelia.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   Authelia subpath Installer for Raspberry Pi 5    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Temp directory placeholder for clean-up
TEMP_DIR=""

# Error handling and cleanup trap
error_handler() {
    local exit_code=$?
    echo -e "\n${RED}[!] Error: An error occurred on line $1. Exit code: $exit_code. Installation failed.${NC}"
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        echo -e "${YELLOW}[*] Cleaning up temporary files...${NC}"
        rm -rf "$TEMP_DIR"
    fi
}
trap 'error_handler $LINENO' ERR

# 1. Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# 2. Verify and Install Dependencies
echo -e "${YELLOW}[*] Checking required system dependencies...${NC}"
DEPS=("curl" "wget" "tar" "openssl" "grep" "sed")
MISSING_DEPS=()
for dep in "${DEPS[@]}"; do
    if ! command -v "$dep" &>/dev/null; then
        MISSING_DEPS+=("$dep")
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo -e "${YELLOW}[*] Installing missing dependencies: ${MISSING_DEPS[*]}...${NC}"
    apt-get update -y
    apt-get install -y "${MISSING_DEPS[@]}"
else
    echo -e "${GREEN}[+] All dependencies are already installed.${NC}"
fi

# 3. Detect System Architecture
ARCH=$(uname -m)
DOWNLOAD_ARCH=""

if [ "$ARCH" = "aarch64" ]; then
    echo -e "${GREEN}[+] Detected 64-bit architecture (ARM64) - Ideal for Pi 5${NC}"
    DOWNLOAD_ARCH="arm64"
elif [[ "$ARCH" =~ ^armv7 ]]; then
    echo -e "${GREEN}[+] Detected 32-bit architecture (ARM)${NC}"
    DOWNLOAD_ARCH="arm"
else
    echo -e "${RED}Error: Unsupported architecture: $ARCH. This installer is for Raspberry Pi (ARM).${NC}"
    exit 1
fi

# 4. Create System User and Directories
echo -e "${YELLOW}[*] Setting up system user and directories...${NC}"
if ! getent group authelia >/dev/null; then
    groupadd --system authelia
    echo -e "${GREEN}[+] Group 'authelia' created.${NC}"
fi

if ! getent passwd authelia >/dev/null; then
    useradd --system -g authelia -s /sbin/nologin -d /var/lib/authelia authelia
    echo -e "${GREEN}[+] System user 'authelia' created.${NC}"
fi

mkdir -p /etc/authelia
mkdir -p /var/lib/authelia

# 5. Fetch the Latest Authelia Binary Version with fallback validation
echo -e "${YELLOW}[*] Fetching latest Authelia release version...${NC}"
LATEST_VERSION=$(curl -s https://api.github.com/repos/authelia/authelia/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "")

if [[ ! "$LATEST_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    LATEST_VERSION="v4.38.9" # Safe fallback
    echo -e "${YELLOW}[!] GitHub API rate limit or network issue. Using fallback: $LATEST_VERSION${NC}"
else
    echo -e "${GREEN}[+] Found latest version: $LATEST_VERSION${NC}"
fi

# 6. Download and Extract Binary
echo -e "${YELLOW}[*] Downloading Authelia binary...${NC}"
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

TAR_FILE="authelia-${LATEST_VERSION}-linux-${DOWNLOAD_ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/authelia/authelia/releases/download/${LATEST_VERSION}/${TAR_FILE}"

wget -q --show-progress "$DOWNLOAD_URL"

echo -e "${YELLOW}[*] Extracting and installing to /usr/local/bin/authelia...${NC}"
tar -xf "$TAR_FILE"
mv authelia /usr/local/bin/authelia
chmod +x /usr/local/bin/authelia
echo -e "${GREEN}[+] Authelia binary installed successfully.${NC}"

# Clean up download directory
rm -rf "$TEMP_DIR"
TEMP_DIR=""

# 7. Generate Secure Secrets
echo -e "${YELLOW}[*] Generating cryptographic secrets...${NC}"
JWT_SECRET=$(openssl rand -hex 64)
SESSION_SECRET=$(openssl rand -hex 64)
STORAGE_KEY=$(openssl rand -hex 64)
OIDC_HMAC_SECRET=$(openssl rand -hex 64)
CLIENT_SECRET=$(openssl rand -hex 32)

echo -e "${YELLOW}[*] Generating RSA Private Key for OIDC...${NC}"
OIDC_PRIVATE_KEY=$(openssl genrsa 2048 2>/dev/null)
# Indent the private key so it aligns correctly under YAML key block
OIDC_PRIVATE_KEY_INDENTED=$(echo "$OIDC_PRIVATE_KEY" | sed 's/^/          /')

# 8. Prompt for Password
echo -e "\n${BLUE}====================================================${NC}"
echo -e "${YELLOW}User Configuration Setup${NC}"
echo -e "${BLUE}====================================================${NC}"
read -p "Enter username for admin account [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Enter display name for admin [Administrator]: " ADMIN_DISPLAY
ADMIN_DISPLAY=${ADMIN_DISPLAY:-Administrator}

read -p "Enter email for admin account [admin@hutta.in]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@hutta.in}

while true; do
    read -s -p "Enter secure password for admin account: " ADMIN_PASS
    echo
    read -s -p "Confirm secure password: " ADMIN_PASS_CONFIRM
    echo
    if [ "$ADMIN_PASS" = "$ADMIN_PASS_CONFIRM" ]; then
        break
    else
        echo -e "${RED}Passwords do not match. Try again.${NC}"
    fi
done

echo -e "${YELLOW}[*] Hashing password (this may take a few seconds)...${NC}"
if /usr/local/bin/authelia crypto hash generate --help &>/dev/null; then
    PASS_HASH=$(/usr/local/bin/authelia crypto hash generate argon2 --password "$ADMIN_PASS" | cut -d' ' -f2)
    CLIENT_SECRET_HASH=$(/usr/local/bin/authelia crypto hash generate argon2 --password "$CLIENT_SECRET" | cut -d' ' -f2)
else
    PASS_HASH=$(/usr/local/bin/authelia crypto hash-password "$ADMIN_PASS")
    CLIENT_SECRET_HASH=$(/usr/local/bin/authelia crypto hash-password "$CLIENT_SECRET")
fi

# 9. Backup Existing Configurations if they exist
if [ -f "/etc/authelia/configuration.yml" ]; then
    BACKUP_SUFFIX=$(date +%Y%m%d%H%M%S)
    echo -e "${YELLOW}[*] Backing up existing config files to *.bak.${BACKUP_SUFFIX}...${NC}"
    cp /etc/authelia/configuration.yml "/etc/authelia/configuration.yml.bak.${BACKUP_SUFFIX}"
    if [ -f "/etc/authelia/users_database.yml" ]; then
        cp /etc/authelia/users_database.yml "/etc/authelia/users_database.yml.bak.${BACKUP_SUFFIX}"
    fi
fi

# 10. Create Config files with path: /authelia
echo -e "${YELLOW}[*] Writing configuration files...${NC}"

cat <<EOF > /etc/authelia/configuration.yml
server:
  host: 127.0.0.1
  port: 9091
  path: "/authelia" # Configures base subpath

log:
  level: info

jwt_secret: "${JWT_SECRET}"

default_redirection_url: https://hutta.in/authelia/

totp:
  issuer: hutta.in
  period: 30
  skew: 1

session:
  name: authelia_session
  same_site: lax
  secret: "${SESSION_SECRET}"
  expiration: 1h
  inactivity: 5m
  remember_me_duration: 1M
  domain: hutta.in

access_control:
  default_policy: deny
  rules:
    # Bypass rule for Authelia login portal pages/APIs
    - domain: hutta.in
      resources:
        - "^/authelia($|/.*)"
      policy: bypass
    # Protected rules (One-factor auth by default for all other hutta.in pages)
    - domain: hutta.in
      policy: one_factor

authentication_backend:
  file:
    path: /etc/authelia/users_database.yml
    password:
      algorithm: argon2
      argon2:
        variant: id
        iterations: 3
        memory: 65536
        parallelism: 4
        key_length: 32

identity_providers:
  oidc:
    hmac_secret: "${OIDC_HMAC_SECRET}"
    issuer_private_key: |
${OIDC_PRIVATE_KEY_INDENTED}
    clients:
      - client_id: apache-portal
        client_name: Apache Gateway
        client_secret: "${CLIENT_SECRET_HASH}"
        public: false
        authorization_policy: one_factor
        redirect_uris:
          - https://hutta.in/redirect_uri

storage:
  local:
    path: /var/lib/authelia/db.sqlite3
  encryption_key: "${STORAGE_KEY}"

notifier:
  filesystem:
    filename: /var/lib/authelia/notification.txt
EOF

cat <<EOF > /etc/authelia/users_database.yml
users:
  ${ADMIN_USER}:
    displayname: "${ADMIN_DISPLAY}"
    password: "${PASS_HASH}"
    email: "${ADMIN_EMAIL}"
    groups:
      - admins
      - users
EOF

# 11. Set Permissions
echo -e "${YELLOW}[*] Setting file permissions...${NC}"
chown -R authelia:authelia /etc/authelia
chown -R authelia:authelia /var/lib/authelia

chmod 700 /var/lib/authelia
chmod 600 /etc/authelia/configuration.yml
chmod 600 /etc/authelia/users_database.yml

# 12. Install Systemd Service Unit
echo -e "${YELLOW}[*] Installing systemd service unit...${NC}"
cat <<EOF > /etc/systemd/system/authelia.service
[Unit]
Description=Authelia Authentication Server
After=network.target

[Service]
Type=simple
User=authelia
Group=authelia
WorkingDirectory=/var/lib/authelia
ExecStart=/usr/local/bin/authelia --config /etc/authelia/configuration.yml
Restart=always
RestartSec=5

# Security hardening configurations
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Reload daemon, enable, and start service
systemctl daemon-reload
systemctl enable authelia.service
systemctl start authelia.service

echo -e "\n${BLUE}====================================================${NC}"
echo -e "${GREEN}      Authelia has been successfully installed!     ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "Service Status: \$(systemctl is-active authelia.service)"
echo -e "Port/Path:      127.0.0.1:9091/authelia"
echo -e "Admin Config:   /etc/authelia/configuration.yml"
echo -e "User Database:  /etc/authelia/users_database.yml"
echo -e "TOTP Link Log:  /var/lib/authelia/notification.txt"
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${YELLOW}IMPORTANT COPY-PASTE DATA FOR APACHE:${NC}"
echo -e "OIDCClientID:      apache-portal"
echo -e "OIDCClientSecret:  \${CLIENT_SECRET}"
echo -e "OIDRedirectURI:    https://hutta.in/redirect_uri"
echo -e "${BLUE}====================================================${NC}"
