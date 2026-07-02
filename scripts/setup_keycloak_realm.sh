#!/usr/bin/env bash
# ==============================================================================
# Keycloak Realm Setup Script — automates Phase 3 via Admin REST API
# Run AFTER Keycloak is started and admin user is bootstrapped.
# Run with: sudo ./scripts/setup_keycloak_realm.sh
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

KC_URL="http://127.0.0.1:8080"
ADMIN_USER="admin"
REALM="hutta"
CLIENT_ID="apache-portal"
REDIRECT_URI="https://hutta.in/redirect_uri"
POST_LOGOUT_URI="https://hutta.in/"

# Resolve admin password: --admin-password flag > KC_ADMIN_PASS env var > prompt
ADMIN_PASS=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --admin-password)
            ADMIN_PASS="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

if [ -z "$ADMIN_PASS" ] && [ -n "$KC_ADMIN_PASS" ]; then
    ADMIN_PASS="$KC_ADMIN_PASS"
fi

if [ -z "$ADMIN_PASS" ]; then
    echo -e "${YELLOW}Enter the Keycloak admin password (set during first boot):${NC}"
    read -rsp "Admin Password: " ADMIN_PASS
    echo ""
fi

if [ -z "$ADMIN_PASS" ]; then
    echo -e "${RED}Error: Admin password cannot be empty.${NC}"
    exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Keycloak Realm Setup: hutta                              ${NC}"
echo -e "${BLUE}============================================================${NC}"

# ── 1. Wait for Keycloak to be ready ─────────────────────────────────────────
echo -e "${YELLOW}[*] Waiting for Keycloak to be ready...${NC}"
for i in $(seq 1 30); do
    if curl -s -o /dev/null "${KC_URL}/health/ready"; then
        echo -e "${GREEN}[+] Keycloak is up!${NC}"
        break
    fi
    echo -n "."
    sleep 5
    if [ "$i" -eq 30 ]; then
        echo -e "${RED}Timeout: Keycloak not ready after 2.5 minutes. Check: journalctl -u keycloak -n 50${NC}"
        exit 1
    fi
done

# ── 2. Get admin access token ─────────────────────────────────────────────────
echo -e "${YELLOW}[*] Obtaining admin access token...${NC}"
TOKEN=$(curl -s -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password&client_id=admin-cli&username=${ADMIN_USER}&password=${ADMIN_PASS}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}Error: Could not get admin token. Check credentials.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Admin token obtained${NC}"

AUTH="Authorization: Bearer ${TOKEN}"

# ── 3. Create hutta realm ─────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Creating realm '${REALM}'...${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${KC_URL}/admin/realms" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
        \"realm\": \"${REALM}\",
        \"displayName\": \"hutta.in\",
        \"enabled\": true,
        \"loginTheme\": \"hutta\",
        \"accountTheme\": \"hutta\",
        \"emailTheme\": \"hutta\",
        \"ssoSessionIdleTimeout\": 900,
        \"ssoSessionMaxLifespan\": 28800,
        \"registrationAllowed\": false,
        \"resetPasswordAllowed\": true,
        \"editUsernameAllowed\": false,
        \"bruteForceProtected\": true,
        \"permanentLockout\": false,
        \"maxFailureWaitSeconds\": 900,
        \"maxDeltaTimeSeconds\": 43200,
        \"failureFactor\": 5
    }")

if [ "$HTTP" = "201" ]; then
    echo -e "${GREEN}[+] Realm '${REALM}' created${NC}"
elif [ "$HTTP" = "409" ]; then
    echo -e "${YELLOW}[!] Realm '${REALM}' already exists — skipping${NC}"
else
    echo -e "${RED}Error creating realm (HTTP ${HTTP})${NC}"
    exit 1
fi

# ── 4. Create 'users' group ───────────────────────────────────────────────────
echo -e "${YELLOW}[*] Creating group 'users'...${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${KC_URL}/admin/realms/${REALM}/groups" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{"name": "users"}')

if [ "$HTTP" = "201" ]; then
    echo -e "${GREEN}[+] Group 'users' created${NC}"
elif [ "$HTTP" = "409" ]; then
    echo -e "${YELLOW}[!] Group 'users' already exists — skipping${NC}"
else
    echo -e "${RED}Error creating group (HTTP ${HTTP})${NC}"
fi

# ── 5. Create OIDC client: apache-portal ─────────────────────────────────────
echo -e "${YELLOW}[*] Creating OIDC client '${CLIENT_ID}'...${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${KC_URL}/admin/realms/${REALM}/clients" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
        \"clientId\": \"${CLIENT_ID}\",
        \"name\": \"Apache OIDC Portal\",
        \"description\": \"Apache mod_auth_openidc client for hutta.in\",
        \"enabled\": true,
        \"protocol\": \"openid-connect\",
        \"publicClient\": false,
        \"standardFlowEnabled\": true,
        \"implicitFlowEnabled\": false,
        \"directAccessGrantsEnabled\": false,
        \"serviceAccountsEnabled\": false,
        \"redirectUris\": [\"${REDIRECT_URI}\"],
        \"webOrigins\": [\"https://hutta.in\"],
        \"attributes\": {
            \"post.logout.redirect.uris\": \"${POST_LOGOUT_URI}\"
        }
    }")

if [ "$HTTP" = "201" ]; then
    echo -e "${GREEN}[+] Client '${CLIENT_ID}' created${NC}"
elif [ "$HTTP" = "409" ]; then
    echo -e "${YELLOW}[!] Client '${CLIENT_ID}' already exists — skipping creation${NC}"
else
    echo -e "${RED}Error creating client (HTTP ${HTTP})${NC}"
    exit 1
fi

# ── 6. Get client UUID ────────────────────────────────────────────────────────
CLIENT_UUID=$(curl -s "${KC_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}" \
    -H "$AUTH" \
    | python3 -c "import sys,json; clients=json.load(sys.stdin); print(clients[0]['id']) if clients else print('')")

if [ -z "$CLIENT_UUID" ]; then
    echo -e "${RED}Error: Could not find client UUID for ${CLIENT_ID}${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Client UUID: ${CLIENT_UUID}${NC}"

# ── 7. Get client secret ──────────────────────────────────────────────────────
echo -e "${YELLOW}[*] Retrieving client secret...${NC}"
CLIENT_SECRET=$(curl -s "${KC_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/client-secret" \
    -H "$AUTH" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['value'])")

if [ -z "$CLIENT_SECRET" ] || [ "$CLIENT_SECRET" = "null" ]; then
    # Regenerate if empty
    CLIENT_SECRET=$(curl -s -X POST "${KC_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/client-secret" \
        -H "$AUTH" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['value'])")
fi
echo -e "${GREEN}[+] Client secret obtained${NC}"

# ── 8. Get the dedicated client scope UUID ────────────────────────────────────
SCOPE_UUID=$(curl -s "${KC_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/default-client-scopes" \
    -H "$AUTH" \
    | python3 -c "
import sys,json
scopes=json.load(sys.stdin)
for s in scopes:
    if s.get('name','') == '${CLIENT_ID}-dedicated':
        print(s['id']); break
" 2>/dev/null || echo "")

# Fall back: find scope by listing all client scopes
if [ -z "$SCOPE_UUID" ]; then
    SCOPE_UUID=$(curl -s "${KC_URL}/admin/realms/${REALM}/client-scopes" \
        -H "$AUTH" \
        | python3 -c "
import sys,json
scopes=json.load(sys.stdin)
for s in scopes:
    if '${CLIENT_ID}' in s.get('name',''):
        print(s['id']); break
" 2>/dev/null || echo "")
fi

# ── 9. Add Group Membership protocol mapper ───────────────────────────────────
echo -e "${YELLOW}[*] Adding Group Membership mapper to client scope...${NC}"

# Add mapper directly to the client (works whether or not we found the scope)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${KC_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
        "name": "groups",
        "protocol": "openid-connect",
        "protocolMapper": "oidc-group-membership-mapper",
        "consentRequired": false,
        "config": {
            "full.path": "false",
            "id.token.claim": "true",
            "access.token.claim": "true",
            "claim.name": "groups",
            "userinfo.token.claim": "true"
        }
    }')

if [ "$HTTP" = "201" ]; then
    echo -e "${GREEN}[+] Group mapper added${NC}"
elif [ "$HTTP" = "409" ]; then
    echo -e "${YELLOW}[!] Group mapper already exists — skipping${NC}"
else
    echo -e "${YELLOW}[!] Group mapper HTTP ${HTTP} — may need manual check${NC}"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   Realm setup complete!                                    ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "Realm:           ${REALM}"
echo -e "Client ID:       ${CLIENT_ID}"
echo -e "Client Secret:   ${CLIENT_SECRET}"
echo -e ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo -e "1. Pass the client secret to configure_apache.sh:"
echo -e "   sudo KC_CLIENT_SECRET='${CLIENT_SECRET}' ./scripts/configure_apache.sh"
echo -e "   (or use: sudo ./scripts/configure_apache.sh --oidc-client-secret '${CLIENT_SECRET}')"
echo -e "2. Create a test user via: http://127.0.0.1:8080/admin"
echo -e "   hutta realm \u2192 Users \u2192 Add user \u2192 assign to 'users' group"
echo -e "${BLUE}============================================================${NC}"
