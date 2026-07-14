#!/bin/bash
set -e

SECRETS_FILE="/etc/hutta/secrets.env"
if [ -f "$SECRETS_FILE" ]; then
    set -a
    source "$SECRETS_FILE"
    set +a
fi

HSM_URL="${SMDP_HSM_URL:-http://localhost:8096}"
HSM_PIN="${SMDP_HSM_PIN:-1234}"

echo "[*] Keycloak HSM Wrapper: Fetching db password from HSM..."
KC_DB_PASSWORD=$(java -cp /opt/keycloak/providers/hsm-client.jar in.hutta.hsm.client.SecretExtractor keycloak-db-pass "$HSM_URL" "$HSM_PIN")

if [ -z "$KC_DB_PASSWORD" ]; then
    echo "[-] Keycloak HSM Wrapper Error: Failed to retrieve keycloak-db-pass from HSM!" >&2
    exit 1
fi

export KC_DB_PASSWORD
echo "[+] Keycloak HSM Wrapper: Database password successfully retrieved. Starting Keycloak..."

exec /opt/keycloak/bin/kc.sh "$@"
