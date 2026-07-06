#!/usr/bin/env bash
# ==============================================================================
# Full Stack Setup Orchestrator — hutta.in
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(dirname "$(realpath "$0")")"

# ── Root check ────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (use sudo).${NC}"
    exit 1
fi

# ── Load secure local state file ──────────────────────────────────────────────
SECRETS_FILE="/etc/hutta/secrets.env"
if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   hutta.in Full Stack Setup                                ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── Step 1: PostgreSQL setup ──────────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 1/2: Setting up PostgreSQL...${NC}"
bash "$SCRIPT_DIR/setup_postgres.sh"

# Load the latest secrets from disk so later steps can read the database passwords securely.
# shellcheck disable=SC1090
source "$SECRETS_FILE"

KC_DB_PASS="$KC_DB_PASSWORD"
SMDP_DB_PASS="$SMDP_DB_PASSWORD"
LPA_DB_PASS="$LPA_DB_PASSWORD"

echo -e "${GREEN}[+] Step 1 complete${NC}"

# ── Step 2: Keycloak installation ─────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 2/3: Installing Keycloak...${NC}"
bash "$SCRIPT_DIR/install_keycloak.sh"
echo -e "${GREEN}[+] Step 2 complete${NC}"

# ── Step 3: Keycloak realm and OIDC client setup ────────────────────────────
echo -e "${YELLOW}[*] Step 3/4: Configuring Keycloak realm, clients, groups and users...${NC}"
bash "$SCRIPT_DIR/setup_keycloak.sh"
echo -e "${GREEN}[+] Step 3 complete${NC}"

# ── Step 4: Apache OIDC integration setup ───────────────────────────────────
echo -e "${YELLOW}[*] Step 4/4: Configuring Apache OIDC integration...${NC}"
bash "$SCRIPT_DIR/configure_apache.sh"
echo -e "${GREEN}[+] Step 4 complete${NC}"

# ── Final Summary ──────────────────────────────────────────────────────────────
if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Full stack setup complete!                               ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Keycloak Admin:     http://127.0.0.1:8080/admin"
echo -e "Account Console:    https://auth.hutta.in/realms/hutta/account"
echo -e ""
echo -e "${YELLOW}Credentials (stored inside ${SECRETS_FILE}):${NC}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "${BLUE}============================================================${NC}"