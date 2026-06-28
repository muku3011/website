#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb and lpadb databases and roles on macOS.
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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
# Check SM-DP+ Role
SMDP_ROLE_EXISTS=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = 'smdp';")
if [ "$SMDP_ROLE_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating role 'smdp'...${NC}"
    run_pg_cmd "CREATE USER smdp WITH PASSWORD 'smdp_password';"
    echo -e "${GREEN}[+] Role 'smdp' created successfully!${NC}"
else
    echo -e "${GREEN}[+] Role 'smdp' already exists.${NC}"
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
# Check LPA Role
LPA_ROLE_EXISTS=$(run_pg_query "SELECT 1 FROM pg_roles WHERE rolname = 'lpa';")
if [ "$LPA_ROLE_EXISTS" != "1" ]; then
    echo -e "${YELLOW}[*] Creating role 'lpa'...${NC}"
    run_pg_cmd "CREATE USER lpa WITH PASSWORD 'lpa_password';"
    echo -e "${GREEN}[+] Role 'lpa' created successfully!${NC}"
else
    echo -e "${GREEN}[+] Role 'lpa' already exists.${NC}"
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
