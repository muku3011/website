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

RESET_SMDP=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --reset-smdp)
            RESET_SMDP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--reset-smdp] [--help]"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# Ensure root check
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# 1. Load or initialize secure local state file
SECRETS_DIR="/etc/hutta"
SECRETS_FILE="${SECRETS_DIR}/secrets.env"
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

if [ -f "$SECRETS_FILE" ]; then
    echo -e "${YELLOW}[*] Loading existing credentials from ${SECRETS_FILE}...${NC}"
    # Suppress check warnings for sourcing
    # shellcheck disable=SC1090
    . "$SECRETS_FILE"
fi

# 2. Configure official PostgreSQL APT Repository and Install/Upgrade to the latest version
echo -e "${YELLOW}[*] Configuring PostgreSQL official APT repository...${NC}"
apt-get update
apt-get install -y gnupg2 wget lsb-release

# Add PostgreSQL official signing key
if [ ! -f /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg ]; then
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg
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
echo "deb http://apt.postgresql.org/pub/repos/apt ${OS_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list

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

generate_password() {
    openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24
}

update_secret_value() {
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
if [ -n "${SMDP_DB_PASSWORD:-}" ]; then
    SMDP_DB_PASS="$SMDP_DB_PASSWORD"
else
    SMDP_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new SM-DP+ database password and stored it in ${SECRETS_FILE}.${NC}"
fi

if [ "$RESET_SMDP" = "true" ]; then
    echo -e "${RED}[!] WARNING: Dropping and recreating smdpdb database as requested...${NC}"
    # Stop smdp-plus service if it exists to release active connections
    systemctl stop smdp-plus 2>/dev/null || true
    # Terminate any remaining active connections
    run_pg_cmd "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'smdpdb' AND pid <> pg_backend_pid();" >/dev/null || true
    # Drop database
    run_pg_cmd "DROP DATABASE IF EXISTS smdpdb;"
    echo -e "${GREEN}[+] Database smdpdb dropped successfully.${NC}"
fi

provision_service_database "SM-DP+" "smdp" "smdpdb" "$SMDP_DB_PASS"

# 5. Setup LPA Simulator User & Database
if [ -n "${LPA_DB_PASSWORD:-}" ]; then
    LPA_DB_PASS="$LPA_DB_PASSWORD"
else
    LPA_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new LPA database password and stored it in ${SECRETS_FILE}.${NC}"
fi

provision_service_database "LPA simulator" "lpa" "lpadb" "$LPA_DB_PASS"

# 6. Setup Keycloak User & Database
KC_DB_NAME="${KC_DB_NAME:-keycloakdb}"
KC_DB_USER="${KC_DB_USER:-keycloak}"

if [ -n "${KC_DB_PASSWORD:-}" ]; then
    KC_DB_PASS="$KC_DB_PASSWORD"
elif [ -f "/opt/keycloak/conf/keycloak.conf" ] && grep -q "db-password=" "/opt/keycloak/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "/opt/keycloak/conf/keycloak.conf" | cut -d'=' -f2-)
else
    KC_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new Keycloak database password and stored it in ${SECRETS_FILE}.${NC}"
fi

provision_service_database "Keycloak" "$KC_DB_USER" "$KC_DB_NAME" "$KC_DB_PASS"

# 6.5. Setup Blog User & Database
if [ -n "${BLOG_DB_PASSWORD:-}" ]; then
    BLOG_DB_PASS="$BLOG_DB_PASSWORD"
else
    BLOG_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new Blog database password and stored it in ${SECRETS_FILE}.${NC}"
fi

provision_service_database "Blog" "blog" "blogdb" "$BLOG_DB_PASS"

# 7. Setup Monitor Service (Sentinel) User & Database
if [ -n "${MONITOR_DB_PASSWORD:-}" ]; then
    MONITOR_DB_PASS="$MONITOR_DB_PASSWORD"
else
    MONITOR_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new Monitor (Sentinel) database password and stored it in ${SECRETS_FILE}.${NC}"
fi

provision_service_database "Monitor (Sentinel)" "monitor" "monitordb" "$MONITOR_DB_PASS"



# 8. Persist consolidated secrets without overwriting unrelated values
chmod 600 "$SECRETS_FILE"
update_secret_value "SMDP_DB_PASSWORD" "$SMDP_DB_PASS"
update_secret_value "LPA_DB_PASSWORD" "$LPA_DB_PASS"
update_secret_value "KC_DB_PASSWORD" "$KC_DB_PASS"
update_secret_value "BLOG_DB_PASSWORD" "$BLOG_DB_PASS"
update_secret_value "MONITOR_DB_PASSWORD" "$MONITOR_DB_PASS"

# Explicitly disable HSM integration for microservices
update_secret_value "SMDP_HSM_ENABLED" "false"

# Generate secure random AES-256 key for eSIM database encryption if not exists (or reset is requested)
if [ -z "${SMDP_DB_ENCRYPTION_KEY:-}" ] || [ "$RESET_SMDP" = "true" ]; then
    SMDP_ENC_KEY=$(openssl rand -base64 32)
    update_secret_value "SMDP_DB_ENCRYPTION_KEY" "$SMDP_ENC_KEY"
    echo -e "${YELLOW}[*] Generated a new SM-DP+ database encryption key and stored it in ${SECRETS_FILE}.${NC}"
fi

# Generate secure random password for SM-DP+ local keystore if not exists (or reset is requested)
if [ -z "${SMDP_KEYSTORE_PASSWORD:-}" ] || [ "$RESET_SMDP" = "true" ]; then
    SMDP_KS_PASS=$(generate_password)
    update_secret_value "SMDP_KEYSTORE_PASSWORD" "$SMDP_KS_PASS"
    echo -e "${YELLOW}[*] Generated a new SM-DP+ keystore password and stored it in ${SECRETS_FILE}.${NC}"
fi

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

if [ "$RESET_SMDP" = "true" ]; then
    echo -e "${YELLOW}[*] Restarting smdp-plus service to trigger Flyway schema setup and seeding...${NC}"
    systemctl start smdp-plus 2>/dev/null || echo -e "${RED}Warning: Failed to start smdp-plus service. Re-seed manually by starting smdp-plus.${NC}"
fi

echo -e "${GREEN}[+] PostgreSQL setup and verification completed successfully!${NC}"
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}Credentials (stored in ${SECRETS_FILE}):${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
echo -e "BLOG_DB_PASSWORD=${BLOG_DB_PASS}"