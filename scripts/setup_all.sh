#!/usr/bin/env bash
# ==============================================================================
# Full Stack Setup Orchestrator — hutta.in
#
# Runs all four setup scripts in the correct order and chains secrets via
# shell variables — no temp files are used at any stage.
#
# Usage:
#   sudo KC_ADMIN_PASS='<keycloak-admin-password>' ./scripts/setup_all.sh
#   sudo ./scripts/setup_all.sh   # prompts for KC_ADMIN_PASS if not set
#
# Optional overrides (all have auto-generated defaults):
#   --kc-db-password <pass>   Keycloak PostgreSQL user password
#   --smdp-password  <pass>   SM-DP+ PostgreSQL user password
#   --lpa-password   <pass>   LPA Simulator PostgreSQL user password
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

# ── Parse arguments ───────────────────────────────────────────────────────────
KC_DB_PASS_ARG=""
SMDP_PASS_ARG=""
LPA_PASS_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --kc-db-password)  KC_DB_PASS_ARG="$2";  shift 2 ;;
        --smdp-password)   SMDP_PASS_ARG="$2";   shift 2 ;;
        --lpa-password)    LPA_PASS_ARG="$2";     shift 2 ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

# ── Prompt for KC_ADMIN_PASS if not provided ──────────────────────────────────
if [ -z "$KC_ADMIN_PASS" ]; then
    echo -e "${YELLOW}Enter the Keycloak admin password (will be set during first boot):${NC}"
    read -rsp "Admin Password: " KC_ADMIN_PASS
    echo ""
fi

if [ -z "$KC_ADMIN_PASS" ]; then
    echo -e "${RED}Error: KC_ADMIN_PASS cannot be empty.${NC}"
    exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   hutta.in Full Stack Setup                                ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── Step 1: PostgreSQL setup ──────────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 1/4: Setting up PostgreSQL...${NC}"
POSTGRES_ARGS=""
[ -n "$KC_DB_PASS_ARG" ]  && POSTGRES_ARGS="$POSTGRES_ARGS --kc-password $KC_DB_PASS_ARG"
[ -n "$SMDP_PASS_ARG" ]   && POSTGRES_ARGS="$POSTGRES_ARGS --smdp-password $SMDP_PASS_ARG"
[ -n "$LPA_PASS_ARG" ]    && POSTGRES_ARGS="$POSTGRES_ARGS --lpa-password $LPA_PASS_ARG"

# Capture output to extract generated passwords from the summary block
PG_OUTPUT=$(bash "$SCRIPT_DIR/setup_postgres.sh" $POSTGRES_ARGS 2>&1)
echo "$PG_OUTPUT"

KC_DB_PASS=$(echo "$PG_OUTPUT"   | grep "^KC_DB_PASSWORD="   | cut -d'=' -f2-)
SMDP_DB_PASS=$(echo "$PG_OUTPUT" | grep "^SMDP_DB_PASSWORD=" | cut -d'=' -f2-)
LPA_DB_PASS=$(echo "$PG_OUTPUT"  | grep "^LPA_DB_PASSWORD="  | cut -d'=' -f2-)

echo -e "${GREEN}[+] Step 1 complete${NC}"

# ── Step 2: Keycloak installation ─────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 2/4: Installing Keycloak...${NC}"
bash "$SCRIPT_DIR/install_keycloak.sh" --kc-db-password "$KC_DB_PASS"
echo -e "${GREEN}[+] Step 2 complete${NC}"

# ── Step 3: Realm setup ───────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 3/4: Setting up Keycloak realm...${NC}"
REALM_OUTPUT=$(KC_ADMIN_PASS="$KC_ADMIN_PASS" bash "$SCRIPT_DIR/setup_keycloak_realm.sh" --admin-password "$KC_ADMIN_PASS" 2>&1)
echo "$REALM_OUTPUT"

# Extract client secret printed by setup_keycloak_realm.sh
KC_CLIENT_SECRET=$(echo "$REALM_OUTPUT" | grep "^Client Secret:" | awk '{print $NF}')

if [ -z "$KC_CLIENT_SECRET" ]; then
    echo -e "${RED}Error: Could not extract OIDC client secret from realm setup output.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Step 3 complete${NC}"

# ── Step 4: Apache configuration ──────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 4/4: Configuring Apache...${NC}"
bash "$SCRIPT_DIR/configure_apache.sh" --oidc-client-secret "$KC_CLIENT_SECRET"
echo -e "${GREEN}[+] Step 4 complete${NC}"

# ── Final Summary ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Full stack setup complete!                               ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Keycloak Admin:     http://127.0.0.1:8080/admin"
echo -e "Account Console:    https://auth.hutta.in/realms/hutta/account"
echo -e ""
echo -e "${YELLOW}Credentials (store securely — not saved to any file):${NC}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
echo -e "SMDP_DB_PASSWORD=${SMDP_DB_PASS}"
echo -e "LPA_DB_PASSWORD=${LPA_DB_PASS}"
echo -e "KC_CLIENT_SECRET=${KC_CLIENT_SECRET}"
echo -e "${BLUE}============================================================${NC}"
