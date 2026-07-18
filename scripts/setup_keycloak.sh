#!/usr/bin/env bash
# ==============================================================================
# Keycloak Bare-Metal Installer for Raspberry Pi 5
# Domain: auth.hutta.in (reverse-proxied via Apache — Keycloak runs HTTP only)
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Keycloak Bare-Metal Installer for Raspberry Pi 5         ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── 1. Root check ─────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

# ── Parse arguments ────────────────────────────────────────────────────────────
KC_ADMIN_USERNAME_ARG=""
KC_ADMIN_PASSWORD_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --kc-admin-username)
            KC_ADMIN_USERNAME_ARG="$2"
            shift 2
            ;;
        --kc-admin-password)
            KC_ADMIN_PASSWORD_ARG="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

# ── 2. Detect architecture ────────────────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}Warning: Unexpected architecture: $ARCH. Script is optimized for aarch64 (Pi 5).${NC}"
fi
echo -e "${GREEN}[+] Architecture: $ARCH — confirmed${NC}"

# ── 3. Dependencies ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Checking dependencies...${NC}"

if ! command -v java &>/dev/null; then
    echo -e "${YELLOW}[*] Installing OpenJDK 21...${NC}"
    apt-get update -y
    apt-get install -y openjdk-21-jre-headless
fi

for dep in wget tar curl openssl python3; do
    if ! command -v "$dep" &>/dev/null; then
        apt-get install -y "$dep"
    fi
done
echo -e "${GREEN}[+] All dependencies present${NC}"

# ── 4. Configuration ──────────────────────────────────────────────────────────
KC_VERSION="26.7.0"
KC_DIR="/opt/keycloak"
KC_USER="keycloak"
KC_DB_NAME="keycloakdb"
KC_DB_USER="keycloak"

# Resolve SCRIPT_DIR
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

# Load centralized secrets manager
. "$SCRIPT_DIR/secrets_manager.sh"

# Resolve DB password and bootstrap admin credentials
KC_ADMIN_USERNAME=$(get_or_create_secret "KC_ADMIN_USERNAME" "password" "${KC_ADMIN_USERNAME_ARG:-admin}")
KC_ADMIN_PASSWORD=$(get_or_create_secret "KC_ADMIN_PASSWORD" "hex_32" "${KC_ADMIN_PASSWORD_ARG:-}")

if [ -f "$KC_DIR/conf/keycloak.conf" ] && grep -q "db-password=" "$KC_DIR/conf/keycloak.conf"; then
    KC_DB_PASS=$(grep "^db-password=" "$KC_DIR/conf/keycloak.conf" | cut -d'=' -f2-)
    echo -e "${YELLOW}[*] Reusing existing DB password from keycloak.conf${NC}"
elif [ -n "$KC_DB_PASSWORD" ]; then
    KC_DB_PASS="$KC_DB_PASSWORD"
else
    echo -e "${RED}Error: No Keycloak DB password resolved.${NC}"
    echo -e "${RED}Run setup_postgres.sh first so /etc/hutta/secrets.env contains KC_DB_PASSWORD.${NC}"
    exit 1
fi

# ── 5. System user ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Creating system user '${KC_USER}'...${NC}"
if ! getent passwd "$KC_USER" &>/dev/null; then
    useradd --system -r -d "$KC_DIR" -s /sbin/nologin "$KC_USER"
    echo -e "${GREEN}[+] User '${KC_USER}' created${NC}"
else
    echo -e "${GREEN}[+] User '${KC_USER}' already exists${NC}"
fi

# ── 6. Download & extract ─────────────────────────────────────────────────────
SKIP_DOWNLOAD=false
if [ -x "$KC_DIR/bin/kc.sh" ]; then
    INSTALLED_VER=$("$KC_DIR/bin/kc.sh" --version 2>/dev/null | grep -i "Keycloak" | head -n 1 | awk '{print $2}')
    if [ "$INSTALLED_VER" = "$KC_VERSION" ]; then
        echo -e "${GREEN}[+] Keycloak $KC_VERSION is already installed. Skipping download/extraction.${NC}"
        SKIP_DOWNLOAD=true
    fi
fi

if [ "$SKIP_DOWNLOAD" = "false" ]; then
    echo -e "${YELLOW}[*] Downloading Keycloak ${KC_VERSION}...${NC}"
    TEMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TEMP_DIR"' EXIT
    cd "$TEMP_DIR"

    wget -q --show-progress \
        "https://github.com/keycloak/keycloak/releases/download/${KC_VERSION}/keycloak-${KC_VERSION}.tar.gz"

    echo -e "${YELLOW}[*] Extracting to ${KC_DIR}...${NC}"
    tar -xzf "keycloak-${KC_VERSION}.tar.gz"

    if [ -d "$KC_DIR" ]; then
        BACKUP="/opt/keycloak.bak.$(date +%Y%m%d%H%M%S)"
        echo -e "${YELLOW}[*] Backing up existing install to ${BACKUP}...${NC}"
        mv "$KC_DIR" "$BACKUP"
    fi

    mv "keycloak-${KC_VERSION}" "$KC_DIR"
    cd - >/dev/null
    echo -e "${GREEN}[+] Keycloak extracted to ${KC_DIR}${NC}"
fi

# ── 7. Write keycloak.conf ────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Ensuring /opt/keycloak/conf/keycloak.conf is up to date...${NC}"
mkdir -p "$KC_DIR/conf"

KC_CONF_CONTENT=$(cat <<KCCONF
# ==============================================================================
# Keycloak Configuration — hutta.in
# Runs HTTP on loopback only; Apache terminates TLS at auth.hutta.in
# ============================================================================== 

# Network — listen on loopback; Apache reverse-proxies externally
http-enabled=true
http-host=127.0.0.1
http-port=8080
https-enabled=false

# Public hostname — what Keycloak tells clients to use in OIDC redirects
hostname=auth.hutta.in
hostname-strict-https=true

# Trust X-Forwarded-Proto / X-Forwarded-Host from Apache (KC 26 syntax)
proxy-headers=xforwarded

# Database — PostgreSQL
db=postgres
db-url=jdbc:postgresql://localhost:5432/${KC_DB_NAME}
db-username=${KC_DB_USER}
db-password=\${KC_DB_PASSWORD}

# Logging
log-level=INFO
KCCONF
)

TMP_CONF=$(mktemp)
printf '%s\n' "$KC_CONF_CONTENT" > "$TMP_CONF"
if [ ! -f "$KC_DIR/conf/keycloak.conf" ] || ! cmp -s "$TMP_CONF" "$KC_DIR/conf/keycloak.conf"; then
    install -m 600 "$TMP_CONF" "$KC_DIR/conf/keycloak.conf"
    echo -e "${GREEN}[+] keycloak.conf written/updated${NC}"
else
    echo -e "${GREEN}[+] keycloak.conf already up to date${NC}"
fi
rm -f "$TMP_CONF"

# ── 8. Pre-build optimised distribution ─────────────────────────────────────
BUILD_STAMP="$KC_DIR/.build-complete"
if [ -f "$BUILD_STAMP" ]; then
    echo -e "${GREEN}[+] Keycloak build already completed; skipping rebuild${NC}"
else
    echo -e "${YELLOW}[*] Pre-building Keycloak (bakes in DB + proxy config; ~2-3 min on Pi 5)...${NC}"
    chown -R "$KC_USER:$KC_USER" "$KC_DIR"
    chmod 600 "$KC_DIR/conf/keycloak.conf"

    sudo -u "$KC_USER" "$KC_DIR/bin/kc.sh" build --db=postgres
    touch "$BUILD_STAMP"
    echo -e "${GREEN}[+] Build complete — startup will be faster and use less RAM${NC}"
fi

# Reset ownership after build
chown -R "$KC_USER:$KC_USER" "$KC_DIR"

# ── 10. Install systemd service ───────────────────────────────────────────────
echo -e "${YELLOW}[*] Ensuring keycloak.service is configured...${NC}"
SERVICE_FILE="/etc/systemd/system/keycloak.service"
SERVICE_CONTENT=$(cat <<SVCEOF
[Unit]
Description=Keycloak Identity Provider
Documentation=https://www.keycloak.org/guides
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=idle
User=${KC_USER}
Group=${KC_USER}
WorkingDirectory=${KC_DIR}
EnvironmentFile=/etc/hutta/secrets.env

# JVM tuning to minimize memory footprint on Raspberry Pi (Serial GC, Level 1 compilation, 512MB heap limit)
Environment="JAVA_OPTS=-Xms64m -Xmx512m -XX:MetaspaceSize=96m -XX:MaxMetaspaceSize=160m -XX:+UseSerialGC -XX:+TieredCompilation -XX:TieredStopAtLevel=1"

ExecStart=${KC_DIR}/bin/kc.sh start --optimized --bootstrap-admin-username=${KC_ADMIN_USERNAME} --bootstrap-admin-password=${KC_ADMIN_PASSWORD}
Restart=on-failure
RestartSec=10

# Security hardening
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF
)

TMP_SERVICE=$(mktemp)
printf '%s\n' "$SERVICE_CONTENT" > "$TMP_SERVICE"
if [ ! -f "$SERVICE_FILE" ] || ! cmp -s "$TMP_SERVICE" "$SERVICE_FILE"; then
    install -m 644 "$TMP_SERVICE" "$SERVICE_FILE"
    echo -e "${GREEN}[+] keycloak.service written/updated${NC}"
else
    echo -e "${GREEN}[+] keycloak.service already up to date${NC}"
fi
rm -f "$TMP_SERVICE"

systemctl daemon-reload
if ! systemctl is-enabled --quiet keycloak.service; then
    systemctl enable keycloak.service
fi
if ! systemctl is-active --quiet keycloak.service; then
    echo -e "${YELLOW}[*] Starting Keycloak...${NC}"
    systemctl start keycloak.service
else
    echo -e "${GREEN}[+] Keycloak service is already running${NC}"
fi
echo -e "${GREEN}[+] keycloak.service installed and enabled${NC}"

# ── 11. Wait for Keycloak & Configure Realm ──────────────────────────────────
KC_URL="http://127.0.0.1:8080"
REALM_NAME="hutta"
CLIENT_ID="apache-portal"
CLIENT_REDIRECT_URI="https://hutta.in/redirect_uri"

wait_for_keycloak() {
    local attempt=0
    while [ "$attempt" -lt 120 ]; do
        if curl -fsS -o /dev/null "$KC_URL/admin/" >/dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${RED}Error: Keycloak did not become ready in time.${NC}"
    exit 1
}

get_admin_token() {
    local token
    token=$(curl -fsS -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode "username=${KC_ADMIN_USERNAME}" \
        --data-urlencode "password=${KC_ADMIN_PASSWORD}" \
        --data-urlencode 'client_id=admin-cli' \
        --data-urlencode 'grant_type=password' | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("access_token", ""))')
    if [ -z "$token" ]; then
        echo -e "${RED}Error: Unable to authenticate to Keycloak admin API.${NC}"
        exit 1
    fi
    echo "$token"
}

api_get() {
    local token="$1"
    local path="$2"
    local response_file=$(mktemp)
    local http_code
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -H "Authorization: Bearer ${token}" "$KC_URL${path}")
    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 400 ]; then
        echo -e "${RED}Error: GET to ${path} failed (HTTP ${http_code})${NC}" >&2
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
    fi
    cat "$response_file"
    rm -f "$response_file"
}

api_post() {
    local token="$1"
    local path="$2"
    local body="$3"
    local response_file=$(mktemp)
    local http_code
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -X POST -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' --data "$body" "$KC_URL${path}")
    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 400 ]; then
        echo -e "${RED}Error: POST to ${path} failed (HTTP ${http_code})${NC}" >&2
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
    fi
    cat "$response_file"
    rm -f "$response_file"
}

api_put() {
    local token="$1"
    local path="$2"
    local body="$3"
    local response_file=$(mktemp)
    local http_code
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -X PUT -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' --data "$body" "$KC_URL${path}")
    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 400 ]; then
        echo -e "${RED}Error: PUT to ${path} failed (HTTP ${http_code})${NC}" >&2
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
    fi
    cat "$response_file"
    rm -f "$response_file"
}

api_delete() {
    local token="$1"
    local path="$2"
    local response_file=$(mktemp)
    local http_code
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -X DELETE -H "Authorization: Bearer ${token}" "$KC_URL${path}")
    if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 400 ]; then
        echo -e "${RED}Error: DELETE to ${path} failed (HTTP ${http_code})${NC}" >&2
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
    fi
    cat "$response_file"
    rm -f "$response_file"
}


ensure_secure_password() {
    local username="$1"
    local current_password="$2"
    if [ -z "$current_password" ] || [ "$current_password" = "$username" ]; then
        local pass
        pass=$(openssl rand -base64 12 | tr -d '+/' | cut -c1-12)
        echo "Hutta@${pass}1!"
    else
        echo "$current_password"
    fi
}

echo -e "${YELLOW}[*] Waiting for Keycloak to start up...${NC}"
wait_for_keycloak
TOKEN=$(get_admin_token)

# Create or reuse the hutta realm
REALM_EXISTS=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "$KC_URL/admin/realms/${REALM_NAME}")
if [ "$REALM_EXISTS" != "200" ]; then
    echo -e "${YELLOW}[*] Creating realm '${REALM_NAME}'...${NC}"
    api_post "$TOKEN" '/admin/realms' '{"realm":"hutta","enabled":true,"displayName":"hutta"}' >/dev/null
else
    echo -e "${GREEN}[+] Realm '${REALM_NAME}' already exists${NC}"
fi

# Configure secure Password Policy and settings for the realm
echo -e "${YELLOW}[*] Configuring realm settings (password policy) for '${REALM_NAME}'...${NC}"
api_put "$TOKEN" "/admin/realms/${REALM_NAME}" '{"realm":"hutta","displayName":"hutta.in","displayNameHtml":"<a href=\"https://hutta.in\" >hutta.in</a>","passwordPolicy":"length(12) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1) and notUsername(true) and notEmail(true)"}' >/dev/null

# Clean up stale/old groups from previous setup versions
for old_group_name in hutta-admins hutta-operators hutta-users; do
    OLD_GROUP_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/groups?search=${old_group_name}" 2>/dev/null || true)
    OLD_GROUP_ID=$(echo "$OLD_GROUP_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((item.get("id", "") for item in data if item.get("name") == sys.argv[1]), "") if isinstance(data, list) else "")' "$old_group_name")
    if [ -n "$OLD_GROUP_ID" ]; then
        echo -e "${YELLOW}[*] Cleaning up stale group '${old_group_name}'...${NC}"
        api_delete "$TOKEN" "/admin/realms/${REALM_NAME}/groups/${OLD_GROUP_ID}" >/dev/null
    fi
done

# Clean up stale/old roles from previous setup versions
for old_role_name in crud-admin crud-operator crud-user; do
    OLD_ROLE_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/roles/${old_role_name}" 2>/dev/null || true)
    if [ -n "$OLD_ROLE_JSON" ] && ! echo "$OLD_ROLE_JSON" | grep -q '"error"'; then
        echo -e "${YELLOW}[*] Cleaning up stale role '${old_role_name}'...${NC}"
        api_delete "$TOKEN" "/admin/realms/${REALM_NAME}/roles/${old_role_name}" >/dev/null
    fi
done

# Create required realm roles
for role_name in admin operator viewer; do
    role_json=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/roles/${role_name}" 2>/dev/null || true)
    if [ -z "$role_json" ] || echo "$role_json" | grep -q '"error"'; then
        echo -e "${YELLOW}[*] Creating realm role '${role_name}'...${NC}"
        api_post "$TOKEN" "/admin/realms/${REALM_NAME}/roles" "{\"name\":\"${role_name}\",\"description\":\"${role_name}\"}" >/dev/null
    fi
done

# Create or reuse groups
for group_name in admins operators viewers; do
    group_json=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/groups?search=${group_name}" 2>/dev/null || true)
    group_id=$(echo "$group_json" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((item.get("id", "") for item in data if item.get("name") == sys.argv[1]), "") if isinstance(data, list) else "")' "$group_name")
    if [ -z "$group_id" ]; then
        echo -e "${YELLOW}[*] Creating group '${group_name}'...${NC}"
        api_post "$TOKEN" "/admin/realms/${REALM_NAME}/groups" "{\"name\":\"${group_name}\"}" >/dev/null
    else
        echo -e "${GREEN}[+] Group '${group_name}' already exists${NC}"
    fi
done

# Create or reuse the Apache OIDC client
CLIENT_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}" 2>/dev/null || true)
CLIENT_ID_VALUE=$(echo "$CLIENT_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data[0].get("id", "") if isinstance(data, list) and data else "")')

if [ -z "$CLIENT_ID_VALUE" ]; then
    echo -e "${YELLOW}[*] Creating client '${CLIENT_ID}'...${NC}"
    api_post "$TOKEN" "/admin/realms/${REALM_NAME}/clients" "{\"clientId\":\"${CLIENT_ID}\",\"name\":\"Apache Portal OIDC Client\",\"enabled\":true,\"protocol\":\"openid-connect\",\"publicClient\":false,\"standardFlowEnabled\":true,\"implicitFlowEnabled\":false,\"directAccessGrantsEnabled\":false,\"serviceAccountsEnabled\":false,\"fullScopeAllowed\":true,\"redirectUris\":[\"${CLIENT_REDIRECT_URI}\"],\"attributes\":{\"post.logout.redirect.uris\":\"https://hutta.in/\"},\"webOrigins\":[\"https://hutta.in\",\"https://auth.hutta.in\"]}" >/dev/null 2>&1
    sleep 2
    CLIENT_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}" 2>/dev/null || true)
    CLIENT_ID_VALUE=$(echo "$CLIENT_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data[0].get("id", "") if isinstance(data, list) and data else "")')
else
    echo -e "${GREEN}[+] Client '${CLIENT_ID}' already exists${NC}"
fi

if [ -z "$CLIENT_ID_VALUE" ]; then
    echo -e "${RED}Error: Unable to resolve client '${CLIENT_ID}'.${NC}"
    exit 1
fi

api_put "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}" "{\"clientId\":\"${CLIENT_ID}\",\"name\":\"Apache Portal OIDC Client\",\"enabled\":true,\"protocol\":\"openid-connect\",\"publicClient\":false,\"standardFlowEnabled\":true,\"implicitFlowEnabled\":false,\"directAccessGrantsEnabled\":false,\"serviceAccountsEnabled\":false,\"fullScopeAllowed\":true,\"redirectUris\":[\"${CLIENT_REDIRECT_URI}\"],\"attributes\":{\"post.logout.redirect.uris\":\"https://hutta.in/\"},\"webOrigins\":[\"https://hutta.in\",\"https://auth.hutta.in\"]}" >/dev/null 2>&1 || true

echo -e "${YELLOW}[*] Resolving client secret from Keycloak for '${CLIENT_ID}'...${NC}"
if [ -z "${KC_CLIENT_SECRET:-}" ]; then
    CLIENT_SECRET=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/client-secret" 2>/dev/null | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("value", ""))')

    if [ -z "$CLIENT_SECRET" ]; then
        echo -e "${YELLOW}[*] Creating client secret for '${CLIENT_ID}'...${NC}"
        CLIENT_SECRET=$(api_post "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/client-secret" '' 2>/dev/null | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("value", ""))')
    fi

    if [ -z "$CLIENT_SECRET" ]; then
        CLIENT_SECRET=$(generate_hex_32)
    fi
    set_secret "KC_CLIENT_SECRET" "$CLIENT_SECRET"
else
    CLIENT_SECRET="$KC_CLIENT_SECRET"
fi

# Ensure groups claim mapper exists for the Apache client
MAPPER_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/protocol-mappers/models" 2>/dev/null || true)
if ! echo "$MAPPER_JSON" | grep -q 'oidc-group-membership-mapper'; then
    echo -e "${YELLOW}[*] Adding groups claim mapper to client '${CLIENT_ID}'...${NC}"
    api_post "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/protocol-mappers/models" '{"name":"groups","protocol":"openid-connect","protocolMapper":"oidc-group-membership-mapper","consentRequired":false,"config":{"full.path":"false","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true","claim.name":"groups","jsonType.label":"String"}}' >/dev/null
fi

# Clean up stale/old users from previous setup versions
for old_username in hutta-admin hutta-operator; do
    OLD_USER_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/users?username=${old_username}" 2>/dev/null || true)
    OLD_USER_ID=$(echo "$OLD_USER_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((u.get("id") for u in data if u.get("username") == sys.argv[1]), "") if isinstance(data, list) else "")' "$old_username")
    if [ -n "$OLD_USER_ID" ]; then
        echo -e "${YELLOW}[*] Cleaning up stale user '${old_username}'...${NC}"
        api_delete "$TOKEN" "/admin/realms/${REALM_NAME}/users/${OLD_USER_ID}" >/dev/null
    fi
done

ADMIN_PASSWORD=$(get_or_create_secret "ADMIN_PASSWORD" "user_password")
OPERATOR_PASSWORD=$(get_or_create_secret "OPERATOR_PASSWORD" "user_password")
VIEWER_PASSWORD=$(get_or_create_secret "VIEWER_PASSWORD" "user_password")

# Create or reuse default users
for user_data in \
  "admin|Portal|Admin|admin@example.com|admins|admin|${ADMIN_PASSWORD}" \
  "operator|Portal|Operator|operator@example.com|operators|operator|${OPERATOR_PASSWORD}" \
  "viewer|Portal|Viewer|viewer@example.com|viewers|viewer|${VIEWER_PASSWORD}"; do
    IFS='|' read -r username first last email group_name role_name password <<< "$user_data"
    USER_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/users?username=${username}" 2>/dev/null || true)
    USER_ID=$(echo "$USER_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((u.get("id") for u in data if u.get("username") == sys.argv[1]), "") if isinstance(data, list) else "")' "$username")
    if [ -z "$USER_ID" ]; then
        echo -e "${YELLOW}[*] Creating user '${username}'...${NC}"
        api_post "$TOKEN" "/admin/realms/${REALM_NAME}/users" "{\"username\":\"${username}\",\"email\":\"${email}\",\"firstName\":\"${first}\",\"lastName\":\"${last}\",\"enabled\":true,\"emailVerified\":true,\"credentials\":[{\"type\":\"password\",\"value\":\"${password}\",\"temporary\":false}]}" >/dev/null
        USER_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/users?username=${username}" 2>/dev/null || true)
        USER_ID=$(echo "$USER_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((u.get("id") for u in data if u.get("username") == sys.argv[1]), "") if isinstance(data, list) else "")' "$username")
    else
        echo -e "${GREEN}[+] User '${username}' already exists${NC}"
        echo -e "${YELLOW}[*] Enforcing secure password for user '${username}'...${NC}"
        api_put "$TOKEN" "/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" "{\"type\":\"password\",\"value\":\"${password}\",\"temporary\":false}" >/dev/null
    fi

    if [ -n "$USER_ID" ]; then
        GROUP_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/groups?search=${group_name}" 2>/dev/null || true)
        GROUP_ID=$(echo "$GROUP_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(next((item.get("id", "") for item in data if item.get("name") == sys.argv[1]), "") if isinstance(data, list) else "")' "$group_name")
        if [ -n "$GROUP_ID" ]; then
            api_put "$TOKEN" "/admin/realms/${REALM_NAME}/users/${USER_ID}/groups/${GROUP_ID}" '' >/dev/null 2>&1 || true
        fi

        ROLE_JSON=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/roles/${role_name}" 2>/dev/null || true)
        if echo "$ROLE_JSON" | grep -q '"name"'; then
            api_post "$TOKEN" "/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" "[{\"id\":\"$(echo "$ROLE_JSON" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("id", ""))')\",\"name\":\"${role_name}\",\"composite\":false,\"clientRole\":false,\"containerId\":\"${REALM_NAME}\"}]" >/dev/null 2>&1 || true
        fi
    fi
done

get_or_create_secret "ADMIN_USERNAME" "password" "admin" >/dev/null
get_or_create_secret "OPERATOR_USERNAME" "password" "operator" >/dev/null
get_or_create_secret "VIEWER_USERNAME" "password" "viewer" >/dev/null

echo -e "${GREEN}[+] Keycloak provisioning completed successfully${NC}"

# Print final status
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Keycloak installed and configured successfully!           ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Service:         systemctl status keycloak"
echo -e "Logs:            journalctl -u keycloak -f"
echo -e "Admin Console:   http://127.0.0.1:8080/admin"
echo -e "Realm Console:   https://auth.hutta.in/realms/hutta/account"
echo -e ""
echo -e "${YELLOW}Credentials (stored inside ${SECRETS_FILE}):${NC}"
echo -e "KC_ADMIN_USERNAME=${KC_ADMIN_USERNAME}"
echo -e "KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD}"
echo -e "KC_DB_PASSWORD=${KC_DB_PASS}"
echo -e ""
echo -e "Realm User Credentials:"
echo -e "  Admin User:     admin / ${ADMIN_PASSWORD}"
echo -e "  Operator User:  operator / ${OPERATOR_PASSWORD}"
echo -e "  Viewer User:    viewer / ${VIEWER_PASSWORD}"
echo -e "${BLUE}============================================================${NC}"