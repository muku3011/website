#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb, lpadb,
# and keycloakdb databases and roles on Debian-based Linux.
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
echo -e "${YELLOW}[*] Starting PostgreSQL Setup and Verification Script...${NC}"

# Ensure root check
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# 1. Load centralized secrets manager
. "$SCRIPT_DIR/secrets_manager.sh"

# 2. Configure official PostgreSQL APT Repository and Install/Upgrade to the latest version
echo -e "${YELLOW}[*] Configuring PostgreSQL official APT repository...${NC}"
apt-get update
apt-get install -y gnupg2 wget lsb-release

# Add PostgreSQL official signing key
KEYRING_PATH="/usr/share/keyrings/pgdg-archive-keyring.gpg"
if [ ! -f "$KEYRING_PATH" ]; then
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o "$KEYRING_PATH"
fi

# Detect OS codename (with specific Raspbian-to-Debian mapping support)
OS_CODENAME=$(lsb_release -cs 2>/dev/null || echo "")
if [ -f /etc/os-release ]; then
    if grep -q -i "raspbian" /etc/os-release; then
        DEBIAN_VERSION=$(cat /etc/debian_version 2>/dev/null | cut -d'.' -f1 || echo "")
        case "$DEBIAN_VERSION" in
            12) OS_CODENAME="bookworm" ;;
            11) OS_CODENAME="bullseye" ;;
            10) OS_CODENAME="buster" ;;
            *) OS_CODENAME="bookworm" ;;
        esac
    fi
fi

if [ -z "$OS_CODENAME" ] || [ "$OS_CODENAME" = "n/a" ]; then
    OS_CODENAME="bookworm"
fi

# Write official sources list entry
echo "deb [signed-by=${KEYRING_PATH}] http://apt.postgresql.org/pub/repos/apt ${OS_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list

echo -e "${YELLOW}[*] Updating package index and installing/upgrading PostgreSQL to the latest version...${NC}"
apt-get update
apt-get install -y postgresql postgresql-contrib
echo -e "${GREEN}[+] PostgreSQL configured and updated to the latest version successfully!${NC}"

# 3. Verify PostgreSQL Service is Running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}[*] Starting and enabling PostgreSQL service...${NC}"
    systemctl start postgresql
    systemctl enable postgresql
    echo -e "${GREEN}[+] PostgreSQL service started!${NC}"
else
    echo -e "${GREEN}[+] PostgreSQL service is running and active.${NC}"
fi

# Helper function to run psql queries as postgres superuser
run_pg_query() {
    sudo -u postgres psql -t -A -c "$1"
}

# Helper function to run psql commands as postgres superuser
run_pg_cmd() {
    sudo -u postgres psql -c "$1"
}

# Helper function to provision a database role and database consistently for all services
provision_service_database() {
    local service_name="$1"
    local role_name="$2"
    local db_name="$3"
    local db_password="$4"

    local role_exists
    role_exists=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = '${role_name}';")

    if [ "$role_exists" != "1" ]; then
        if [ -n "$db_password" ]; then
            echo -e "${YELLOW}[*] Creating role '${role_name}' for ${service_name}...${NC}"
            sudo -u postgres psql -c "CREATE USER ${role_name} WITH PASSWORD '${db_password}';"
            echo -e "${GREEN}[+] Role '${role_name}' created successfully for ${service_name}.${NC}"
        else
            echo -e "${YELLOW}[*] Creating role '${role_name}' for ${service_name} without a password (will be configured later if needed)...${NC}"
            sudo -u postgres psql -c "CREATE USER ${role_name};"
            echo -e "${GREEN}[+] Role '${role_name}' created successfully for ${service_name}.${NC}"
        fi
    else
        if [ -n "$db_password" ]; then
            echo -e "${YELLOW}[*] Role '${role_name}' exists for ${service_name} — ensuring the configured password is applied...${NC}"
            sudo -u postgres psql -c "ALTER USER ${role_name} WITH PASSWORD '${db_password}';"
            echo -e "${GREEN}[+] Role '${role_name}' password checked/updated for ${service_name}.${NC}"
        else
            echo -e "${GREEN}[+] Role '${role_name}' already exists for ${service_name}; leaving the existing password unchanged.${NC}"
        fi
    fi

    local db_exists
    db_exists=$(run_pg_query "SELECT 1 FROM pg_database WHERE datname = '${db_name}';")

    if [ "$db_exists" != "1" ]; then
        echo -e "${YELLOW}[*] Creating database '${db_name}' for ${service_name}...${NC}"
        run_pg_cmd "CREATE DATABASE ${db_name} OWNER ${role_name};"
        run_pg_cmd "GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${role_name};"
        echo -e "${GREEN}[+] Database '${db_name}' created successfully for ${service_name}.${NC}"
    else
        echo -e "${GREEN}[+] Database '${db_name}' already exists for ${service_name}.${NC}"
    fi
}

echo -e "${YELLOW}[*] Verifying roles and databases...${NC}"

# 4. Setup SM-DP+ User & Database
SMDP_DB_PASS=$(get_or_create_secret "SMDP_DB_PASSWORD")

provision_service_database "SM-DP+" "smdp" "smdpdb" "$SMDP_DB_PASS"

# 5. Setup LPA Simulator User & Database
LPA_DB_PASS=$(get_or_create_secret "LPA_DB_PASSWORD")

provision_service_database "LPA simulator" "lpa" "lpadb" "$LPA_DB_PASS"

# 6. Setup Keycloak User & Database
KC_DB_NAME="${KC_DB_NAME:-keycloakdb}"
KC_DB_USER="${KC_DB_USER:-keycloak}"

# Resolve DB password from existing keycloak.conf if keycloak is already installed but password is not in env yet
if [ -z "${KC_DB_PASSWORD:-}" ] && [ -f "/opt/keycloak/conf/keycloak.conf" ] && grep -q "db-password=" "/opt/keycloak/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "/opt/keycloak/conf/keycloak.conf" | cut -d'=' -f2-)
    set_secret "KC_DB_PASSWORD" "$KC_DB_PASS"
else
    KC_DB_PASS=$(get_or_create_secret "KC_DB_PASSWORD")
fi

provision_service_database "Keycloak" "$KC_DB_USER" "$KC_DB_NAME" "$KC_DB_PASS"

# 6.5. Setup Blog User & Database
BLOG_DB_PASS=$(get_or_create_secret "BLOG_DB_PASSWORD")

provision_service_database "Blog" "blog" "blogdb" "$BLOG_DB_PASS"

# 7. Setup Monitor Service (Sentinel) User & Database
MONITOR_DB_PASS=$(get_or_create_secret "MONITOR_DB_PASSWORD")

provision_service_database "Monitor (Sentinel)" "monitor" "monitordb" "$MONITOR_DB_PASS"



# 8. Persist consolidated secrets without overwriting unrelated values
# Explicitly disable HSM integration for microservices if not set
get_or_create_secret "SMDP_HSM_ENABLED" "password" "false" >/dev/null

# Generate secure random AES-256 key for eSIM database encryption if not exists
get_or_create_secret "SMDP_DB_ENCRYPTION_KEY" "base64_key" >/dev/null

# Generate secure random password for SM-DP+ local keystore if not exists
get_or_create_secret "SMDP_KEYSTORE_PASSWORD" "password" >/dev/null

# 9. Configure daily database backup cron job
echo -e "${YELLOW}[*] Configuring daily PostgreSQL database backups...${NC}"
BACKUP_SCRIPT_DEST="/usr/local/bin/cron_db_backup.sh"
cp "$SCRIPT_DIR/cron_db_backup.sh" "$BACKUP_SCRIPT_DEST"
chmod 755 "$BACKUP_SCRIPT_DEST"

# Ensure the backup directory exists and is owned by postgres
mkdir -p /var/backups/postgresql
chown postgres:postgres /var/backups/postgresql
chmod 750 /var/backups/postgresql

# Ensure the monitor service running user (rbpi) has access to read status files
if getent passwd rbpi &>/dev/null; then
    usermod -aG postgres rbpi
    echo -e "${GREEN}[+] Added user 'rbpi' to 'postgres' group for database backup monitoring access.${NC}"
fi

# Create cron job file to run daily at 2:00 AM as postgres user
CRON_FILE="/etc/cron.d/database-backup"
cat << 'EOF' > "$CRON_FILE"
# Run daily database backup at 2:00 AM as postgres user
0 2 * * * postgres /usr/local/bin/cron_db_backup.sh 2>&1 | logger -t postgres-backup
EOF
chmod 644 "$CRON_FILE"

# Run it once right now as postgres to seed the backup_status.json
echo -e "${YELLOW}[*] Executing database backup script once to seed initial status...${NC}"
sudo -u postgres "$BACKUP_SCRIPT_DEST" || echo -e "${RED}[!] Initial database backup run returned warnings/errors (see logs).${NC}"
echo -e "${GREEN}[+] Daily backup cron job successfully configured at ${CRON_FILE}.${NC}"



echo -e "${GREEN}[+] PostgreSQL setup and verification completed successfully!${NC}"
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}Credentials (stored in ${SECRETS_FILE}):${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
echo -e "BLOG_DB_PASSWORD=${BLOG_DB_PASS}"