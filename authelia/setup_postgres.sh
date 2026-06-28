#!/usr/bin/env bash
# This script installs/verifies PostgreSQL and sets up the smdpdb and lpadb databases and roles.
set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# 4. Setup LPA Simulator User & Database
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
