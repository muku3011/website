#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb, lpadb,
# and keycloakdb databases and roles.
#
# Usage:
#   sudo ./setup_postgres.sh                        # generates a random Keycloak DB password
#   sudo ./setup_postgres.sh --kc-password <pass>   # use a specific Keycloak DB password
#
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ── Parse arguments ────────────────────────────────────────────────────────────
KC_DB_PASS_ARG=""
SMDP_DB_PASS_ARG=""
LPA_DB_PASS_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --kc-password)
            KC_DB_PASS_ARG="$2"
            shift 2
            ;;
        --smdp-password)
            SMDP_DB_PASS_ARG="$2"
            shift 2
            ;;
        --lpa-password)
            LPA_DB_PASS_ARG="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}[*] Starting PostgreSQL Setup and Verification Script...${NC}"

# 1. Verify and Install/Update PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}[*] PostgreSQL not found. Installing PostgreSQL and contrib packages...${NC}"
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    echo -e "${GREEN}[+] PostgreSQL installed successfully!${NC}"
else
    echo -e "${GREEN}[+] PostgreSQL is already installed. Checking status...${NC}"
fi

# 2. Verify PostgreSQL Service is Running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}[*] Starting and enabling PostgreSQL service...${NC}"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
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

echo -e "${YELLOW}[*] Verifying roles and databases...${NC}"

# 3. Setup SM-DP+ User & Database
# Resolve SMDP password: CLI arg > existing pg role > generate new
if [ -n "$SMDP_DB_PASS_ARG" ]; then
    SMDP_DB_PASS="$SMDP_DB_PASS_ARG"
else
    SMDP_DB_PASS=$(openssl rand -hex 24)
    echo -e "${GREEN}[+] Generated new SM-DP+ DB password${NC}"
fi

# Check SM-DP+ Role
SMDP_ROLE_EXISTS=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = 'smdp';")
if [ "$SMDP_ROLE_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating role 'smdp'...${NC}"
    sudo -u postgres psql -c "CREATE USER smdp WITH PASSWORD '${SMDP_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'smdp' created successfully!${NC}"
else
    echo -e "${YELLOW}[*] Role 'smdp' exists — updating password...${NC}"
    sudo -u postgres psql -c "ALTER USER smdp WITH PASSWORD '${SMDP_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'smdp' password updated.${NC}"
fi

# Check SM-DP+ Database
SMDP_DB_EXISTS=$(run_pg_query "SELECT 1 FROM pg_database WHERE datname = 'smdpdb';")
if [ "$SMDP_DB_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating database 'smdpdb'...${NC}"
    run_pg_cmd "CREATE DATABASE smdpdb OWNER smdp;"
    run_pg_cmd "GRANT ALL PRIVILEGES ON DATABASE smdpdb TO smdp;"
    echo -e "${GREEN}[+] Database 'smdpdb' created successfully!${NC}"
else
    echo -e "${GREEN}[+] Database 'smdpdb' already exists.${NC}"
fi

# 4. Setup LPA Simulator User & Database
# Resolve LPA password: CLI arg > generate new
if [ -n "$LPA_DB_PASS_ARG" ]; then
    LPA_DB_PASS="$LPA_DB_PASS_ARG"
else
    LPA_DB_PASS=$(openssl rand -hex 24)
    echo -e "${GREEN}[+] Generated new LPA DB password${NC}"
fi

# Check LPA Role
LPA_ROLE_EXISTS=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = 'lpa';")
if [ "$LPA_ROLE_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating role 'lpa'...${NC}"
    sudo -u postgres psql -c "CREATE USER lpa WITH PASSWORD '${LPA_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'lpa' created successfully!${NC}"
else
    echo -e "${YELLOW}[*] Role 'lpa' exists - updating password...${NC}"
    sudo -u postgres psql -c "ALTER USER lpa WITH PASSWORD '${LPA_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'lpa' password updated.${NC}"
fi

# Check LPA Database
LPA_DB_EXISTS=$(run_pg_query "SELECT 1 FROM pg_database WHERE datname = 'lpadb';")
if [ "$LPA_DB_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating database 'lpadb'...${NC}"
    run_pg_cmd "CREATE DATABASE lpadb OWNER lpa;"
    run_pg_cmd "GRANT ALL PRIVILEGES ON DATABASE lpadb TO lpa;"
    echo -e "${GREEN}[+] Database 'lpadb' created successfully!${NC}"
else
    echo -e "${GREEN}[+] Database 'lpadb' already exists.${NC}"
fi

# 5. Setup Keycloak User & Database
KC_DB_NAME="keycloakdb"
KC_DB_USER="keycloak"

# Resolve password: CLI arg > existing keycloak.conf > generate new
if [ -n "$KC_DB_PASS_ARG" ]; then
    KC_DB_PASS="$KC_DB_PASS_ARG"
    echo -e "${YELLOW}[*] Using provided Keycloak DB password${NC}"
elif [ -f "/opt/keycloak/conf/keycloak.conf" ] && grep -q "db-password=" "/opt/keycloak/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "/opt/keycloak/conf/keycloak.conf" | cut -d'=' -f2-)
    echo -e "${YELLOW}[*] Reusing existing Keycloak DB password from keycloak.conf${NC}"
else
    KC_DB_PASS=$(openssl rand -hex 32)
    echo -e "${GREEN}[+] Generated new Keycloak DB password${NC}"
fi

# Check Keycloak Role
KC_ROLE_EXISTS=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = '${KC_DB_USER}';")
if [ "$KC_ROLE_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating role '${KC_DB_USER}'...${NC}"
    sudo -u postgres psql -c "CREATE USER ${KC_DB_USER} WITH PASSWORD '${KC_DB_PASS}';"
    echo -e "${GREEN}[+] Role '${KC_DB_USER}' created successfully!${NC}"
else
    echo -e "${YELLOW}[*] Role '${KC_DB_USER}' exists — updating password...${NC}"
    sudo -u postgres psql -c "ALTER USER ${KC_DB_USER} WITH PASSWORD '${KC_DB_PASS}';"
    echo -e "${GREEN}[+] Role '${KC_DB_USER}' password updated.${NC}"
fi

# Check Keycloak Database
KC_DB_EXISTS=$(run_pg_query "SELECT 1 FROM pg_database WHERE datname = '${KC_DB_NAME}';")
if [ "$KC_DB_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating database '${KC_DB_NAME}'...${NC}"
    run_pg_cmd "CREATE DATABASE ${KC_DB_NAME} OWNER ${KC_DB_USER};"
    run_pg_cmd "GRANT ALL PRIVILEGES ON DATABASE ${KC_DB_NAME} TO ${KC_DB_USER};"
    echo -e "${GREEN}[+] Database '${KC_DB_NAME}' created successfully!${NC}"
else
    echo -e "${GREEN}[+] Database '${KC_DB_NAME}' already exists.${NC}"
fi

# Export so callers (e.g. install_keycloak.sh) can read the resolved password
export KC_DB_PASS

echo -e "${GREEN}[+] PostgreSQL setup and verification completed successfully!${NC}"
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}Generated Credentials (record these now):${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo -e "SM-DP+ DB password:  SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA DB password:     LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "Keycloak DB password (pass to install_keycloak.sh via --kc-db-password):"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
