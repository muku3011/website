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
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (use sudo).${NC}"
    exit 1
fi

# ── Load secure local state file ──────────────────────────────────────────────
SECRETS_FILE="/etc/hutta/secrets.env"
if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    . "$SECRETS_FILE"
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   hutta.in Full Stack Setup                                ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── Step 1: PostgreSQL setup ──────────────────────────────────────────────────
echo -e "${YELLOW}[*] Step 1/4: Setting up PostgreSQL...${NC}"
bash "$SCRIPT_DIR/setup_postgres.sh"

# Load the latest secrets from disk so later steps can read the database passwords securely.
# shellcheck disable=SC1090
. "$SECRETS_FILE"

KC_DB_PASS="$KC_DB_PASSWORD"
SMDP_DB_PASS="$SMDP_DB_PASSWORD"
LPA_DB_PASS="$LPA_DB_PASSWORD"
BLOG_DB_PASS="${BLOG_DB_PASSWORD:-}"

echo -e "${GREEN}[+] Step 1 complete${NC}"

# ── Step 2: Keycloak installation & setup ─────────────────────────────────────
echo -e "${YELLOW}[*] Step 2/4: Installing & Configuring Keycloak...${NC}"
bash "$SCRIPT_DIR/setup_keycloak.sh"
echo -e "${GREEN}[+] Step 2 complete${NC}"

# ── Step 3: Apache OIDC integration setup ───────────────────────────────────
echo -e "${YELLOW}[*] Step 3/4: Configuring Apache OIDC integration...${NC}"
bash "$SCRIPT_DIR/setup_apache.sh"
echo -e "${GREEN}[+] Step 3 complete${NC}"

# ── Step 4: Systemd Service Registrations ───────────────────────────────────
echo -e "${YELLOW}[*] Step 4/4: Registering backend Systemd services...${NC}"
bash "$SCRIPT_DIR/setup_systemd_service.sh" smdp-plus /home/rbpi/smdp-plus smdp-plus.jar "SM-DP+ eSIM Remote Provisioning Service"
bash "$SCRIPT_DIR/setup_systemd_service.sh" lpa-simulator /home/rbpi/lpa-simulator lpa-simulator.jar "LPA Simulator Service"
bash "$SCRIPT_DIR/setup_systemd_service.sh" blog-service /home/rbpi/blog-service blog-service.jar "Technology Blog Backend Service"
bash "$SCRIPT_DIR/setup_systemd_service.sh" monitor-service /home/rbpi/monitor-service monitor-service.jar "Sentinel — System Monitoring & Alerting Service"
echo -e "${GREEN}[+] Step 5 complete${NC}"

# ── Final Summary & Verification ──────────────────────────────────────────────
if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    . "$SECRETS_FILE"
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
echo -e "BLOG_DB_PASSWORD=${BLOG_DB_PASS}"
echo -e "${BLUE}============================================================${NC}"

echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}   Post-Deployment Verification & Diagnostics               ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "${YELLOW}[*] Running service and system integrity checks...${NC}"

# 1. Systemd Service Checks
check_service() {
    local name=$1
    if systemctl is-active --quiet "$name"; then
        echo -e "Service: ${name} [ ${GREEN}ACTIVE${NC} ]"
        return 0
    else
        echo -e "Service: ${name} [ ${RED}FAILED/INACTIVE${NC} ]"
        return 1
    fi
}

# 2. Database Existence Checks
check_db() {
    local dbname=$1
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$dbname"; then
        echo -e "Database: ${dbname} [ ${GREEN}EXISTS${NC} ]"
        return 0
    else
        echo -e "Database: ${dbname} [ ${RED}MISSING${NC} ]"
        return 1
    fi
}

echo ""
check_service "postgresql"
check_service "keycloak"
check_service "apache2"
if [ -f "/etc/systemd/system/smdp-plus.service" ]; then
    check_service "smdp-plus"
fi
if [ -f "/etc/systemd/system/lpa-simulator.service" ]; then
    check_service "lpa-simulator"
fi
if [ -f "/etc/systemd/system/blog-service.service" ]; then
    check_service "blog-service"
fi
echo ""
check_db "keycloakdb"
check_db "smdpdb"
check_db "lpadb"
check_db "blogdb"
echo ""

# 3. Keycloak HTTP Health-Check Endpoint Check
echo -e "${YELLOW}[*] Querying Keycloak health status internally...${NC}"
KC_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/admin || echo "000")
if [ "$KC_HEALTH" = "200" ] || [ "$KC_HEALTH" = "302" ]; then
    echo -e "Keycloak Engine: http://127.0.0.1:8080/admin [ ${GREEN}${KC_HEALTH} OK${NC} ]"
else
    echo -e "Keycloak Engine: http://127.0.0.1:8080/admin [ ${RED}UNAVAILABLE (HTTP ${KC_HEALTH})${NC} ]"
fi

# 4. Apache Configuration Validation Check
echo -e "${YELLOW}[*] Validating Apache active configuration structure...${NC}"
APACHE_CONFIG_TEST=$(sudo apache2ctl configtest 2>&1)
if echo "$APACHE_CONFIG_TEST" | grep -q "Syntax OK"; then
    echo -e "Apache Configuration: syntax check [ ${GREEN}OK${NC} ]"
else
    echo -e "Apache Configuration: syntax check [ ${RED}ERROR${NC} ]"
    echo -e "${RED}Apache configtest output:${NC}"
    echo "$APACHE_CONFIG_TEST"
fi
echo -e "${BLUE}============================================================${NC}"