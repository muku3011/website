#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb, lpadb,
# and keycloakdb databases and roles on Debian-based Linux.
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[*] Starting PostgreSQL Setup and Verification Script...${NC}"

# Ensure root check
if [ "$EUID" -ne 0 ] && [ "$1" != "--help" ]; then
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
    source "$SECRETS_FILE"
fi

# 2. Verify and Install/Update PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}[*] PostgreSQL not found. Installing PostgreSQL and database tools...${NC}"
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    echo -e "${GREEN}[+] PostgreSQL installed successfully!${NC}"
else
    echo -e "${GREEN}[+] PostgreSQL is already installed. Checking status...${NC}"
fi

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
    head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 24
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
KC_DB_NAME="keycloakdb"
KC_DB_USER="keycloak"

if [ -n "${KC_DB_PASSWORD:-}" ]; then
    KC_DB_PASS="$KC_DB_PASSWORD"
elif [ -f "/opt/keycloak/conf/keycloak.conf" ] && grep -q "db-password=" "/opt/keycloak/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "/opt/keycloak/conf/keycloak.conf" | cut -d'=' -f2-)
else
    KC_DB_PASS=$(generate_password)
    echo -e "${YELLOW}[*] Generated a new Keycloak database password and stored it in ${SECRETS_FILE}.${NC}"
fi

provision_service_database "Keycloak" "$KC_DB_USER" "$KC_DB_NAME" "$KC_DB_PASS"

# 7. Persist consolidated secrets without overwriting unrelated values
chmod 600 "$SECRETS_FILE"
update_secret_value "SMDP_DB_PASSWORD" "$SMDP_DB_PASS"
update_secret_value "LPA_DB_PASSWORD" "$LPA_DB_PASS"
update_secret_value "KC_DB_PASSWORD" "$KC_DB_PASS"

echo -e "${GREEN}[+] PostgreSQL setup and verification completed successfully!${NC}"
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}Credentials (stored in ${SECRETS_FILE}):${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"