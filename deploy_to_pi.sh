#!/usr/bin/env bash
# ==============================================================================
# Mac-to-Pi Deployment, Verification, & Asset Copy Orchestrator
# Executes from your macOS machine to upload, provision, and deploy assets.
# ==============================================================================
set -euo pipefail

# Target Details
TARGET_IP="192.168.1.150"
TARGET_USER="rbpi"
REMOTE_PATH="/home/rbpi/website"
REMOTE_SCRIPTS_PATH="${REMOTE_PATH}/scripts"

# Local Paths (Adjust if your workspace paths differ)
LOCAL_WEBSITE_DIR="website"
LOCAL_SMDP_JAR="smdp-plus/target/smdp-plus-1.0.0.jar"
LOCAL_LPA_JAR="lpa-simulator/target/lpa-simulator-1.0.0.jar"
LOCAL_BLOG_JAR="blog-service/target/blog-service-1.0.0.jar"

# Remote Paths for Jars
REMOTE_SMDP_DIR="/home/rbpi/smdp-plus"
REMOTE_LPA_DIR="/home/rbpi/lpa-simulator"
REMOTE_BLOG_DIR="/home/rbpi/blog-service"

# Formatting Colors (Local macOS terminal)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Hutta.in Mac-to-Pi Deployment & Setup Tool               ${NC}"
echo -e "${BLUE}============================================================${NC}"

# Interactive prompt helper function
ask_yes_no() {
    local prompt="$1"
    local response
    read -p "$(echo -e "${YELLOW}${prompt} [y/N]: ${NC}")" response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# ── Step 1: Preflight Connectivity Check ──────────────────────────────────────
echo -e "${YELLOW}[*] Checking connectivity to Pi (${TARGET_IP})...${NC}"
if ! ping -c 1 -t 3 "$TARGET_IP" &>/dev/null; then
    echo -e "${RED}Error: Cannot reach $TARGET_IP. Ensure you are on the same local network.${NC}"
    exit 1
fi

echo -e "${YELLOW}[*] Testing SSH key authentication...${NC}"
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${TARGET_USER}@${TARGET_IP}" "exit" &>/dev/null; then
    echo -e "${RED}Error: SSH connection failed. Check your SSH keys or target username.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] SSH connectivity verified successfully.${NC}"

# ── Step 2: Synchronize Workspace Assets ──────────────────────────────────────
echo -e "\n${YELLOW}[*] Synchronizing deployment scripts via rsync...${NC}"
ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_PATH}' '${REMOTE_SCRIPTS_PATH}'"

rsync -avz --delete \
    --exclude='.DS_Store' \
    --exclude='*.bak*' \
    scripts/ \
    "${TARGET_USER}@${TARGET_IP}:${REMOTE_SCRIPTS_PATH}/"

ssh "${TARGET_USER}@${TARGET_IP}" "chmod +x '${REMOTE_SCRIPTS_PATH}'/*.sh"
echo -e "${GREEN}[+] Workspace sync complete.${NC}"

# ── Step 3: Execute Remote Orchestration ──────────────────────────────────────
echo -e "\n${YELLOW}[*] Triggering setup_all.sh on remote Pi...${NC}"
echo -e "${YELLOW}[!] Enter your remote sudo password if prompted by the Pi:${NC}"

ssh -t "${TARGET_USER}@${TARGET_IP}" \
    "sudo '${REMOTE_SCRIPTS_PATH}/setup_all.sh'"

# ── Step 4: Optional Deployments ──────────────────────────────────────────────
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}   Optional Asset Deployments                               ${NC}"
echo -e "${BLUE}============================================================${NC}"

# --- 1. Static Website Files Deployment ---
if ask_yes_no "Do you want to deploy the static website files to Apache (/var/www/html)?"; then
    if [ -d "$LOCAL_WEBSITE_DIR" ]; then
        echo -e "${YELLOW}[*] Syncing static files to temporary staging on Pi...${NC}"
        ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_PATH}/html_temp'"
        rsync -avz --delete \
            --exclude='.DS_Store' \
            "${LOCAL_WEBSITE_DIR}/" \
            "${TARGET_USER}@${TARGET_IP}:${REMOTE_PATH}/html_temp/"
        
        echo -e "${YELLOW}[*] Moving files to Apache root (/var/www/html) using sudo...${NC}"
        ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo rsync -av --delete '${REMOTE_PATH}/html_temp/' /var/www/html/"
        echo -e "${GREEN}[+] Static website files deployed successfully.${NC}"
    else
        echo -e "${RED}Warning: Local directory '${LOCAL_WEBSITE_DIR}' not found. Skipping static deployment.${NC}"
    fi
fi

# --- 2. SM-DP+ Jar Deployment ---
if ask_yes_no "Do you want to deploy the SM-DP+ Jar file ($(basename "$LOCAL_SMDP_JAR"))?"; then
    if [ -f "$LOCAL_SMDP_JAR" ]; then
        echo -e "${YELLOW}[*] Syncing SM-DP+ backend jar...${NC}"
        ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_SMDP_DIR}'"
        rsync -avz "$LOCAL_SMDP_JAR" "${TARGET_USER}@${TARGET_IP}:${REMOTE_SMDP_DIR}/smdp-plus.jar"
        echo -e "${GREEN}[+] SM-DP+ jar deployed to ${REMOTE_SMDP_DIR}/smdp-plus.jar.${NC}"
        
        # Optional: Restart SM-DP+ service if configured on systemd
        ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo systemctl restart smdp-plus 2>/dev/null || echo -e '${YELLOW}Note: No active smdp-plus systemd service found to restart.${NC}'"
    else
        echo -e "${RED}Warning: Local file '${LOCAL_SMDP_JAR}' not found. Skipping SM-DP+ deployment.${NC}"
    fi
fi

# --- 3. LPA Simulator Jar Deployment ---
if ask_yes_no "Do you want to deploy the LPA Simulator Jar file ($(basename "$LOCAL_LPA_JAR"))?"; then
    if [ -f "$LOCAL_LPA_JAR" ]; then
        echo -e "${YELLOW}[*] Syncing LPA backend jar...${NC}"
        ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_LPA_DIR}'"
        rsync -avz "$LOCAL_LPA_JAR" "${TARGET_USER}@${TARGET_IP}:${REMOTE_LPA_DIR}/lpa-simulator.jar"
        echo -e "${GREEN}[+] LPA jar deployed to ${REMOTE_LPA_DIR}/lpa-simulator.jar.${NC}"
        
        # Optional: Restart LPA service if configured on systemd
        ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo systemctl restart lpa-simulator 2>/dev/null || echo -e '${YELLOW}Note: No active lpa-simulator systemd service found to restart.${NC}'"
    else
        echo -e "${RED}Warning: Local file '${LOCAL_LPA_JAR}' not found. Skipping LPA deployment.${NC}"
    fi
fi

# --- 4. Blog Service Jar Deployment ---
if ask_yes_no "Do you want to deploy the Blog Service Jar file ($(basename "$LOCAL_BLOG_JAR"))?"; then
    if [ -f "$LOCAL_BLOG_JAR" ]; then
        echo -e "${YELLOW}[*] Syncing Blog Service backend jar and setup script...${NC}"
        ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_BLOG_DIR}'"
        rsync -avz "$LOCAL_BLOG_JAR" "${TARGET_USER}@${TARGET_IP}:${REMOTE_BLOG_DIR}/blog-service.jar"
        
        # Copy and run systemd setup script
        if [ -f "blog-service/setup_pi_service.sh" ]; then
            rsync -avz "blog-service/setup_pi_service.sh" "${TARGET_USER}@${TARGET_IP}:${REMOTE_BLOG_DIR}/setup_pi_service.sh"
            ssh "${TARGET_USER}@${TARGET_IP}" "chmod +x '${REMOTE_BLOG_DIR}/setup_pi_service.sh'"
            echo -e "${YELLOW}[*] Registering systemd service on remote target...${NC}"
            ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo '${REMOTE_BLOG_DIR}/setup_pi_service.sh'"
        fi

        echo -e "${GREEN}[+] Blog service jar and setup script deployed successfully.${NC}"
        
        # Restart blog-service systemd service
        ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo systemctl restart blog-service 2>/dev/null || echo -e '${YELLOW}Note: Failed to restart blog-service.${NC}'"
    else
        echo -e "${RED}Warning: Local file '${LOCAL_BLOG_JAR}' not found. Skipping Blog Service deployment.${NC}"
    fi
fi


# --- 6. Monitor Service (Sentinel) Jar Deployment ---
LOCAL_MONITOR_JAR="monitor-service/target/monitor-service-1.0.0.jar"
REMOTE_MONITOR_DIR="/home/rbpi/monitor-service"
if ask_yes_no "Do you want to deploy the Monitor Service (Sentinel) Jar file?"; then
    if [ -f "$LOCAL_MONITOR_JAR" ]; then
        echo -e "${YELLOW}[*] Syncing Sentinel Monitor Service jar and setup script...${NC}"
        ssh "${TARGET_USER}@${TARGET_IP}" "mkdir -p '${REMOTE_MONITOR_DIR}'"
        rsync -avz "$LOCAL_MONITOR_JAR" "${TARGET_USER}@${TARGET_IP}:${REMOTE_MONITOR_DIR}/monitor-service.jar"

        if [ -f "monitor-service/setup_pi_service.sh" ]; then
            rsync -avz "monitor-service/setup_pi_service.sh" "${TARGET_USER}@${TARGET_IP}:${REMOTE_MONITOR_DIR}/setup_pi_service.sh"
            ssh "${TARGET_USER}@${TARGET_IP}" "chmod +x '${REMOTE_MONITOR_DIR}/setup_pi_service.sh'"
            echo -e "${YELLOW}[*] Registering Sentinel systemd service on remote target...${NC}"
            ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo '${REMOTE_MONITOR_DIR}/setup_pi_service.sh'"
        fi

        echo -e "${GREEN}[+] Monitor Service jar deployed successfully.${NC}"
        ssh -t "${TARGET_USER}@${TARGET_IP}" "sudo systemctl restart monitor-service 2>/dev/null || echo -e '${YELLOW}Note: Failed to restart monitor-service.${NC}'"
    else
        echo -e "${RED}Warning: '${LOCAL_MONITOR_JAR}' not found. Skipping Monitor Service deployment.${NC}"
    fi
fi

# ── Step 5: Remote Verification & Diagnostics ────────────────────────────────
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}   Post-Deployment Verification & Diagnostics               ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "${YELLOW}[*] Running service and system integrity checks on target...${NC}"

ssh "${TARGET_USER}@${TARGET_IP}" bash << 'EOF'
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    NC='\033[0m'

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
EOF

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Mac-to-Pi deploy routine successfully finalized.         ${NC}"
echo -e "${BLUE}============================================================${NC}"