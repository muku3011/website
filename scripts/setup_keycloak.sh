#!/usr/bin/env bash
# ==============================================================================
# Keycloak Realm and OIDC Bootstrap for hutta.in
# Creates/updates the hutta realm, Apache OIDC client, and CRUD-oriented users/groups.
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (use sudo).${NC}"
    exit 1
fi

SECRETS_FILE="/etc/hutta/secrets.env"
KC_DIR="/opt/keycloak"
KC_URL="http://127.0.0.1:8080"
REALM_NAME="hutta"
CLIENT_ID="apache-portal"
CLIENT_REDIRECT_URI="https://hutta.in/redirect_uri"

mkdir -p /etc/hutta
chmod 700 /etc/hutta

if [ -f "$SECRETS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
fi

KC_ADMIN_USERNAME="${KC_ADMIN_USERNAME:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-}"
if [ -z "$KC_ADMIN_PASSWORD" ]; then
    echo -e "${RED}Error: No Keycloak admin password available. Run install_keycloak.sh first.${NC}"
    exit 1
fi

update_secret_file() {
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

wait_for_keycloak() {
    local attempt=0
    while [ "$attempt" -lt 60 ]; do
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
    curl -fsS -H "Authorization: Bearer ${token}" "$KC_URL${path}"
}

api_post() {
    local token="$1"
    local path="$2"
    local body="$3"
    curl -fsS -X POST -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
        --data "$body" "$KC_URL${path}"
}

api_put() {
    local token="$1"
    local path="$2"
    local body="$3"
    curl -fsS -X PUT -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
        --data "$body" "$KC_URL${path}"
}

api_delete() {
    local token="$1"
    local path="$2"
    curl -fsS -X DELETE -H "Authorization: Bearer ${token}" "$KC_URL${path}"
}

json_value() {
    local json="$1"
    local field="$2"
    python3 - "$json" "$field" <<'PY'
import json, sys
raw, field = sys.argv[1], sys.argv[2]
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)
if isinstance(data, list):
    for item in data:
        if isinstance(item, dict) and item.get('name') == field:
            print(item.get('id',''))
            break
    sys.exit(0)
print(data.get(field, ''))
PY
}

json_lookup() {
    local json="$1"
    local field="$2"
    local value="$3"
    python3 - "$json" "$field" "$value" <<'PY'
import json, sys
raw, field, value = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)
if isinstance(data, list):
    for item in data:
        if isinstance(item, dict) and str(item.get(field, '')) == value:
            print(item.get('id', ''))
            break
else:
    print(data.get('id', ''))
PY
}

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

# Configure secure Password Policy and custom HTML banner branding for the realm
echo -e "${YELLOW}[*] Configuring realm settings (branding & password policy) for '${REALM_NAME}'...${NC}"
api_put "$TOKEN" "/admin/realms/${REALM_NAME}" '{"realm":"hutta","displayName":"hutta.in","displayNameHtml":"<div style=\"font-family: '\''Outfit'\'', '\''Inter'\'', sans-serif; font-weight: 700; font-size: 26px; text-align: center; letter-spacing: -0.5px;\"><span style=\"background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;\">hutta.in</span></div>","passwordPolicy":"length(12) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1) and notUsername(true) and notEmail(true)"}' >/dev/null

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

# Ensure the client exists with the expected settings and reuse its existing secret when available
api_put "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}" "{\"clientId\":\"${CLIENT_ID}\",\"name\":\"Apache Portal OIDC Client\",\"enabled\":true,\"protocol\":\"openid-connect\",\"publicClient\":false,\"standardFlowEnabled\":true,\"implicitFlowEnabled\":false,\"directAccessGrantsEnabled\":false,\"serviceAccountsEnabled\":false,\"fullScopeAllowed\":true,\"redirectUris\":[\"${CLIENT_REDIRECT_URI}\"],\"attributes\":{\"post.logout.redirect.uris\":\"https://hutta.in/\"},\"webOrigins\":[\"https://hutta.in\",\"https://auth.hutta.in\"]}" >/dev/null 2>&1 || true

echo -e "${YELLOW}[*] Resolving client secret from Keycloak for '${CLIENT_ID}'...${NC}"
CLIENT_SECRET=$(api_get "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/client-secret" 2>/dev/null | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("value", ""))')

if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${YELLOW}[*] Creating client secret for '${CLIENT_ID}'...${NC}"
    CLIENT_SECRET=$(api_post "$TOKEN" "/admin/realms/${REALM_NAME}/clients/${CLIENT_ID_VALUE}/client-secret" '' 2>/dev/null | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("value", ""))')
fi

if [ -z "$CLIENT_SECRET" ]; then
    CLIENT_SECRET="${KC_CLIENT_SECRET:-$(openssl rand -hex 24)}"
fi
update_secret_file "KC_CLIENT_SECRET" "$CLIENT_SECRET"

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

# Ensure secure passwords exist or generate new ones that satisfy the Password Policy
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

ADMIN_PASSWORD=$(ensure_secure_password "admin" "${ADMIN_PASSWORD:-}")
OPERATOR_PASSWORD=$(ensure_secure_password "operator" "${OPERATOR_PASSWORD:-}")
VIEWER_PASSWORD=$(ensure_secure_password "viewer" "${VIEWER_PASSWORD:-}")

update_secret_file "ADMIN_PASSWORD" "$ADMIN_PASSWORD"
update_secret_file "OPERATOR_PASSWORD" "$OPERATOR_PASSWORD"
update_secret_file "VIEWER_PASSWORD" "$VIEWER_PASSWORD"

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
        # Force update password to match the one stored in secrets.env
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

# Persist username variables
update_secret_file "ADMIN_USERNAME" "admin"
update_secret_file "OPERATOR_USERNAME" "operator"
update_secret_file "VIEWER_USERNAME" "viewer"

echo -e "${GREEN}[+] Keycloak provisioning completed successfully${NC}"
echo -e "${YELLOW}OIDC client credentials and user passwords stored in ${SECRETS_FILE}${NC}"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Realm User Credentials (Generated Secure Passwords)     ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Admin User:"
echo -e "  Username: admin"
echo -e "  Password: ${ADMIN_PASSWORD}"
echo -e "  Role:     admin"
echo -e ""
echo -e "Operator User:"
echo -e "  Username: operator"
echo -e "  Password: ${OPERATOR_PASSWORD}"
echo -e "  Role:     operator"
echo -e ""
echo -e "Viewer User:"
echo -e "  Username: viewer"
echo -e "  Password: ${VIEWER_PASSWORD}"
echo -e "  Role:     viewer"
echo -e "${BLUE}============================================================${NC}"