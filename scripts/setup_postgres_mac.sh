#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb and lpadb databases and roles on macOS.
# Usage:
#   ./setup_postgres_mac.sh                        # generates random passwords
#   ./setup_postgres_mac.sh --smdp-password <p> --lpa-password <p>   # use specific passwords
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ── Parse arguments ──────────────────────────────────────────────────────────
SMDP_DB_PASS_ARG=""
LPA_DB_PASS_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --smdp-password) SMDP_DB_PASS_ARG="$2"; shift 2 ;;
        --lpa-password)  LPA_DB_PASS_ARG="$2";  shift 2 ;;
        *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
    esac
done

echo -e "${YELLOW}[*] Starting macOS PostgreSQL Setup and Verification Script...${NC}"

# 1. Verify Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}[-] Homebrew (brew) is not installed. Please install Homebrew first: https://brew.sh/${NC}"
    exit 1
fi

# 2. Verify and Install/Update PostgreSQL
if ! command -v psql &> /dev/null && ! [ -f "$(brew --prefix postgresql 2>/dev/null)/bin/psql" ]; then
    echo -e "${YELLOW}[*] PostgreSQL not found. Installing PostgreSQL via Homebrew...${NC}"
    brew install postgresql
    echo -e "${GREEN}[+] PostgreSQL installed successfully!${NC}"
else
    echo -e "${GREEN}[+] PostgreSQL is already installed.${NC}"
fi

# Retrieve the brew prefix for postgresql and add its bin directory to PATH
PG_PREFIX=$(brew --prefix postgresql 2>/dev/null || echo "/opt/homebrew/opt/postgresql")
export PATH="${PG_PREFIX}/bin:$PATH"

# 3. Verify PostgreSQL Service is Running
# Check if a postgresql service is started under brew services
if ! brew services list | grep -qE "(postgresql|postgres)(@[0-9]+)?\s+started"; then
    echo -e "${YELLOW}[*] Starting PostgreSQL service via Homebrew services...${NC}"
    brew services start postgresql
    echo -e "${YELLOW}[*] Waiting for PostgreSQL to initialize...${NC}"
    sleep 5
    echo -e "${GREEN}[+] PostgreSQL service started!${NC}"
else
    echo -e "${GREEN}[+] PostgreSQL service is running and active.${NC}"
fi

# Helper function to run psql queries as current user (default macOS superuser)
run_pg_query() {
    psql -d postgres -t -A -c "$1"
}

# Helper function to run psql commands as current user (default macOS superuser)
run_pg_cmd() {
    psql -d postgres -c "$1"
}

echo -e "${YELLOW}[*] Verifying roles and databases...${NC}"

# 4. Setup SM-DP+ User & Database
# Resolve password
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
    psql -d postgres -c "CREATE USER smdp WITH PASSWORD '${SMDP_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'smdp' created successfully!${NC}"
else
    echo -e "${YELLOW}[*] Role 'smdp' exists - updating password...${NC}"
    psql -d postgres -c "ALTER USER smdp WITH PASSWORD '${SMDP_DB_PASS}';"
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

# 5. Setup LPA Simulator User & Database
# Resolve password
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
    psql -d postgres -c "CREATE USER lpa WITH PASSWORD '${LPA_DB_PASS}';"
    echo -e "${GREEN}[+] Role 'lpa' created successfully!${NC}"
else
    echo -e "${YELLOW}[*] Role 'lpa' exists - updating password...${NC}"
    psql -d postgres -c "ALTER USER lpa WITH PASSWORD '${LPA_DB_PASS}';"
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

echo -e "${GREEN}[+] PostgreSQL setup and verification completed successfully!${NC}"
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}Generated Credentials (record these now):${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
