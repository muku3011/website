#!/usr/bin/env bash
# ==============================================================================
# Apache Configuration for hutta.in with Keycloak OIDC
# - Adds auth.hutta.in VirtualHost (reverse proxy to Keycloak on :8080)
# - Protects /profiles.html with mod_auth_openidc
# - Restricts Keycloak Admin Console to home network only
# Run with: sudo ./scripts/setup_apache.sh
# ==============================================================================
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Please run as root (use sudo)."
    exit 1
fi

# ── Install/Upgrade Apache if missing or upgrade available ────────────────────
echo "[*] Ensuring Apache2 is installed and up to date..."
apt-get update -y
apt-get install -y apache2 apache2-utils

# ── Install OIDC module if missing ────────────────────────────────────────────
if ! dpkg -s libapache2-mod-auth-openidc &>/dev/null; then
    echo "[*] Installing libapache2-mod-auth-openidc..."
    apt-get install -y libapache2-mod-auth-openidc
fi

# ── Configure Certbot if missing ──────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
    echo "[*] Installing Certbot and Apache plugin..."
    apt-get install -y certbot python3-certbot-apache
fi

# Ensure Let's Encrypt directories and options files exist
mkdir -p /etc/letsencrypt/live/hutta.in

if [ ! -f "/etc/letsencrypt/live/hutta.in/fullchain.pem" ]; then
    echo "[*] Let's Encrypt certificates not found. Setting up Certbot..."
    # Ensure port 80 is temporarily open in UFW if firewall is installed
    UFW_OPENED=false
    if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
        ufw allow 80/tcp comment 'Temp open for Certbot'
        UFW_OPENED=true
    fi

    # Run certbot to obtain certificate
    echo "[*] Requesting SSL certificate from Let's Encrypt..."
    if certbot --apache -d hutta.in -d auth.hutta.in --non-interactive --agree-tos --email contact@hutta.in; then
        echo "[+] Let's Encrypt certificates successfully obtained!"
    else
        echo "[-] Warning: Failed to obtain Let's Encrypt certificates automatically."
        echo "[-] Generating self-signed certificates as a temporary fallback to prevent Apache restart failure..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/letsencrypt/live/hutta.in/privkey.pem \
            -out /etc/letsencrypt/live/hutta.in/fullchain.pem \
            -subj "/CN=hutta.in"
        
        if [ ! -f "/etc/letsencrypt/options-ssl-apache.conf" ]; then
            cat << 'EOF' > /etc/letsencrypt/options-ssl-apache.conf
SSLEngine on
SSLProtocol             all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite          ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA256
SSLHonorCipherOrder     off
SSLSessionTickets       off
EOF
        fi
    fi

    # Clean up UFW rule if we opened it
    if [ "$UFW_OPENED" = "true" ]; then
        ufw delete allow 80/tcp || true
    fi
fi

# Ensure certbot renewal cron job is registered
CRON_RENEW_FILE="/etc/cron.d/certbot-renew"
if [ ! -f "$CRON_RENEW_FILE" ]; then
    echo "[*] Creating Certbot renewal cron job..."
    cat << 'EOF' > "$CRON_RENEW_FILE"
# Run Certbot renew twice daily at 3:15 AM and 3:15 PM and reload apache on successful renewal
15 3,15 * * * root certbot renew --post-hook "systemctl reload apache2" >/dev/null 2>&1
EOF
    chmod 644 "$CRON_RENEW_FILE"
    echo "[+] Certbot renewal cron job successfully registered."
fi


# ── Enable required modules ───────────────────────────────────────────────────
echo "[*] Enabling Apache modules..."
a2enmod proxy proxy_http auth_openidc ssl headers substitute || true

# ── Read Keycloak client secret ───────────────────────────────────────────────
SSL_CONF="/etc/apache2/sites-available/000-default-le-ssl.conf"

# Resolve SCRIPT_DIR
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

# Load centralized secrets manager
. "$SCRIPT_DIR/secrets_manager.sh"

# ── Read Keycloak client secret ───────────────────────────────────────────────
KC_CLIENT_SECRET_ARG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --oidc-client-secret)
            KC_CLIENT_SECRET_ARG="$2"
            shift 2
            ;;
        *)
            # Apache setup script specific args
            shift
            ;;
    esac
done

if [ -n "$KC_CLIENT_SECRET_ARG" ]; then
    set_secret "KC_CLIENT_SECRET" "$KC_CLIENT_SECRET_ARG"
fi

KC_CLIENT_SECRET=$(get_or_create_secret "KC_CLIENT_SECRET" "hex_32" "${KC_CLIENT_SECRET_ARG:-}")

if [ -z "$KC_CLIENT_SECRET" ] && [ -f "$SSL_CONF" ]; then
    KC_CLIENT_SECRET=$(grep -E '^[[:space:]]*OIDCClientSecret[[:space:]]+' "$SSL_CONF" | head -n 1 | sed -E 's/.*OIDCClientSecret[[:space:]]+"?([^\"]+)"?.*/\1/' | tr -d '"')
    if [ -n "$KC_CLIENT_SECRET" ]; then
        set_secret "KC_CLIENT_SECRET" "$KC_CLIENT_SECRET"
    fi
fi

if [ -z "$KC_CLIENT_SECRET" ]; then
    if [ -t 0 ]; then
        echo "Paste the OIDC client secret for 'apache-portal' from Keycloak Admin Console"
        echo "(Clients → apache-portal → Credentials → Client secret):"
        read -rsp "Client Secret: " KC_CLIENT_SECRET
        echo ""
        if [ -n "$KC_CLIENT_SECRET" ]; then
            set_secret "KC_CLIENT_SECRET" "$KC_CLIENT_SECRET"
        fi
    else
        echo "Error: Client secret cannot be empty."
        exit 1
    fi
fi

if [ -z "$KC_CLIENT_SECRET" ]; then
    echo "Error: Client secret cannot be empty."
    exit 1
fi

# Extract existing passphrase or generate and save it centrally
OIDC_PASSPHRASE=$(get_or_create_secret "OIDC_PASSPHRASE" "hex_32")

# ── Set global ServerName to suppress FQDN warning ────────────────────────────
APACHE_RELOAD_REQUIRED=false
SERVERNAME_CONF="/etc/apache2/conf-available/servername.conf"
if [ ! -f "$SERVERNAME_CONF" ] || ! grep -q "ServerName" "$SERVERNAME_CONF"; then
    echo "[*] Setting global ServerName to suppress FQDN warning..."
    echo "ServerName localhost" > "$SERVERNAME_CONF"
    a2enconf servername || true
    APACHE_RELOAD_REQUIRED=true
fi

SSL_TMP=$(mktemp)
echo "[*] Ensuring ${SSL_CONF}..."
cat > "$SSL_TMP" <<'APACHEEOF'
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerAdmin webmaster@localhost
    ServerName hutta.in
    DocumentRoot /var/www/html

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    # ==========================================================================
    # Keycloak OIDC Configuration
    # ==========================================================================

    # Forward the protocol so mod_auth_openidc uses the correct redirect URL
    RequestHeader set X-Forwarded-Proto "https"

    # Strip OIDC/Auth headers injected by clients to prevent spoofing
    RequestHeader unset OIDC_CLAIM_preferred_username
    RequestHeader unset OIDC_CLAIM_name
    RequestHeader unset OIDC_CLAIM_email
    RequestHeader unset OIDC_CLAIM_groups
    RequestHeader unset X-Forwarded-User

    # -- Reverse Proxy: SM-DP+ backend --
    ProxyPreserveHost On
    ProxyPass /gsma/rsp/v2/ http://127.0.0.1:8092/gsma/rsp/v2/
    ProxyPassReverse /gsma/rsp/v2/ http://127.0.0.1:8092/gsma/rsp/v2/

    # -- Reverse Proxy: LPA Simulator --
    ProxyPass /lpa http://127.0.0.1:8093/lpa
    ProxyPassReverse /lpa http://127.0.0.1:8093/lpa

    # -- Reverse Proxy: Blog Backend --
    ProxyPass /api/blog/ http://127.0.0.1:8094/api/blog/
    ProxyPassReverse /api/blog/ http://127.0.0.1:8094/api/blog/

    # -- Reverse Proxy: Sentinel Monitor Service --
    ProxyPass /api/sentinel/ http://127.0.0.1:8095/api/sentinel/
    ProxyPassReverse /api/sentinel/ http://127.0.0.1:8095/api/sentinel/
    ProxyPass /api/alert-rules http://127.0.0.1:8095/api/alert-rules
    ProxyPassReverse /api/alert-rules http://127.0.0.1:8095/api/alert-rules
    ProxyPass /api/alert-history http://127.0.0.1:8095/api/alert-history
    ProxyPassReverse /api/alert-history http://127.0.0.1:8095/api/alert-history



    # -- OIDC: exclude redirect_uri callback from proxying --
    ProxyPass /redirect_uri !

    # -- OpenID Connect provider (Keycloak hutta realm) --
APACHEEOF

# Append variables safely
cat >> "$SSL_TMP" <<APACHEVARS
    OIDCProviderMetadataURL https://auth.hutta.in/realms/hutta/.well-known/openid-configuration
    OIDCClientID apache-portal
    OIDCClientSecret "${KC_CLIENT_SECRET}"
    OIDCRedirectURI https://hutta.in/redirect_uri
    OIDCCryptoPassphrase "${OIDC_PASSPHRASE}"
    OIDCScope "openid profile email"
    OIDCRemoteUserClaim preferred_username
    OIDCSessionType server-cache:persistent

APACHEVARS

cat >> "$SSL_TMP" <<'APACHEEOF'
    # -- Required: OIDC callback endpoint --
    <Location /redirect_uri>
        AuthType openid-connect
        Require valid-user

        # Clear login-state cookies atomically on redirect response
        Header always unset Set-Cookie
        Header always set Set-Cookie "hutta_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax"
        Header always add Set-Cookie "hutta_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax"
        Header always add Set-Cookie "hutta_name=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax"
        Header always add Set-Cookie "hutta_email=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax"
        Header always add Set-Cookie "hutta_groups=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Lax"
    </Location>

    # -- profiles.html: requires any authenticated Keycloak user --
    <Location /profiles.html>
        AuthType openid-connect
        Require valid-user

        # Expose OIDC claims as cookies for auth-nav.js to read
        Header always set Set-Cookie "hutta_auth=true; Path=/; Secure; SameSite=Lax"
        Header add Set-Cookie "hutta_user=\"%{OIDC_CLAIM_preferred_username}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_preferred_username
        Header add Set-Cookie "hutta_name=\"%{OIDC_CLAIM_name}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_name
        Header add Set-Cookie "hutta_email=\"%{OIDC_CLAIM_email}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_email
        Header add Set-Cookie "hutta_groups=\"%{OIDC_CLAIM_groups}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_groups

        # Prevent caching of protected pages
        Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
        Header set Pragma "no-cache"
        Header set Expires "0"
    </Location>

    # -- sentinel.html: requires any authenticated Keycloak user --
    <Location /sentinel.html>
        AuthType openid-connect
        Require valid-user

        Header always set Set-Cookie "hutta_auth=true; Path=/; Secure; SameSite=Lax"
        Header add Set-Cookie "hutta_user=\"%{OIDC_CLAIM_preferred_username}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_preferred_username
        Header add Set-Cookie "hutta_name=\"%{OIDC_CLAIM_name}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_name
        Header add Set-Cookie "hutta_email=\"%{OIDC_CLAIM_email}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_email
        Header add Set-Cookie "hutta_groups=\"%{OIDC_CLAIM_groups}e\"; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_groups

        Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
        Header set Pragma "no-cache"
    </Location>



    # -- protect write operations to technology blog service --
    <LocationMatch "^/api/blog/(posts(/.*)?|images)$">
        <LimitExcept GET>
            AuthType openid-connect
            Require valid-user
        </LimitExcept>
    </LocationMatch>

    # -- protect eSIM admin endpoints (metadata reading, lists) --
    <Location /gsma/rsp/v2/admin>
        AuthType openid-connect
        Require claim "groups:admins" "groups:operators"
    </Location>
 
    # -- restrict profile import and deletion to admins only --
    <LocationMatch "^/gsma/rsp/v2/admin/(importProfile|profiles/[^/]+)$">
        AuthType openid-connect
        Require claim "groups:admins"
    </LocationMatch>

    # -- protect eSIM operator order endpoints (ES2+) --
    <Location /gsma/rsp/v2/es2plus>
        AuthType openid-connect
        Require claim "groups:admins" "groups:operators"
    </Location>

    # -- protect LPA Simulator endpoints --
    <Location /lpa>
        AuthType openid-connect
        Require valid-user
    </Location>

    # -- protect Sentinel API endpoints (general read-only) --
    <LocationMatch "^/api/(sentinel|alert-rules|alert-history)">
        AuthType openid-connect
        Require valid-user
    </LocationMatch>

    # -- restrict Sentinel service control to admins and operators --
    <Location /api/sentinel/services/control>
        AuthType openid-connect
        Require claim "groups:admins" "groups:operators"
    </Location>

    # -- restrict Sentinel log retrieval to admins only --
    <Location /api/sentinel/logs>
        AuthType openid-connect
        Require claim "groups:admins"
    </Location>

    # -- restrict Sentinel alert rules modifications to admins and operators --
    <LocationMatch "^/api/alert-rules.*">
        <LimitExcept GET>
            AuthType openid-connect
            Require claim "groups:admins" "groups:operators"
        </LimitExcept>
    </LocationMatch>

    # -- Prevent caching of static HTML files to ensure updates are immediately visible --
    <FilesMatch "\.html$">
        Header set Cache-Control "no-cache, must-revalidate"
    </FilesMatch>

    # ==========================================================================
    # Let's Encrypt SSL
    # ==========================================================================
    SSLCertificateFile /etc/letsencrypt/live/hutta.in/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/hutta.in/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
APACHEEOF

if [ -f "$SSL_CONF" ] && cmp -s "$SSL_TMP" "$SSL_CONF"; then
    rm -f "$SSL_TMP"
    echo "[+] ${SSL_CONF} already up to date"
else
    if [ -f "$SSL_CONF" ]; then
        BACKUP="${SSL_CONF}.bak.$(date +%Y%m%d%H%M%S)"
        echo "[*] Backing up ${SSL_CONF} to ${BACKUP}..."
        cp "$SSL_CONF" "$BACKUP"
    fi
    install -m 644 "$SSL_TMP" "$SSL_CONF"
    APACHE_RELOAD_REQUIRED=true
    echo "[+] ${SSL_CONF} written/updated"
fi
rm -f "$SSL_TMP"

# ── Write auth.hutta.in VirtualHost ──────────────────────────────────────────
AUTH_CONF="/etc/apache2/sites-available/auth.hutta.in.conf"
echo "[*] Ensuring ${AUTH_CONF}..."
AUTH_TMP=$(mktemp)
cat > "$AUTH_TMP" <<'AUTHEOF'
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerAdmin webmaster@localhost
    ServerName auth.hutta.in

    ErrorLog ${APACHE_LOG_DIR}/auth-error.log
    CustomLog ${APACHE_LOG_DIR}/auth-access.log combined

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "auth.hutta.in"

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    # ==========================================================================
    # Access Control
    # ==========================================================================

    # Admin Console (/admin) — restricted to home/LAN network only
    <Location /admin>
        Require ip 192.168.0.0/16
        Require ip 10.0.0.0/8
        Require ip 127.0.0.1
    </Location>

    # master realm endpoints — LAN only
    <Location /realms/master>
        Require ip 192.168.0.0/16
        Require ip 10.0.0.0/8
        Require ip 127.0.0.1
    </Location>

    # hutta realm account console — publicly accessible
    <Location /realms/hutta/account>
        Require all granted
    </Location>

    # hutta realm OIDC endpoints — public
    <Location /realms/hutta>
        Require all granted
    </Location>

    # ==========================================================================
    # SSL
    # ==========================================================================
    SSLCertificateFile /etc/letsencrypt/live/hutta.in/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/hutta.in/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
AUTHEOF

if [ -f "$AUTH_CONF" ] && cmp -s "$AUTH_TMP" "$AUTH_CONF"; then
    rm -f "$AUTH_TMP"
    echo "[+] ${AUTH_CONF} already up to date"
else
    if [ -f "$AUTH_CONF" ]; then
        BACKUP="${AUTH_CONF}.bak.$(date +%Y%m%d%H%M%S)"
        echo "[*] Backing up ${AUTH_CONF} to ${BACKUP}..."
        cp "$AUTH_CONF" "$BACKUP"
    fi
    install -m 644 "$AUTH_TMP" "$AUTH_CONF"
    APACHE_RELOAD_REQUIRED=true
    echo "[+] ${AUTH_CONF} written/updated"
fi
rm -f "$AUTH_TMP"

# ── Enable auth.hutta.in site ─────────────────────────────────────────────────
if [ ! -e /etc/apache2/sites-enabled/auth.hutta.in.conf ]; then
    a2ensite auth.hutta.in.conf >/dev/null || true
    APACHE_RELOAD_REQUIRED=true
    echo "[+] auth.hutta.in VirtualHost enabled"
else
    echo "[+] auth.hutta.in VirtualHost already enabled"
fi

# ── Test and reload Apache ─────────────────────────────────────────────────────
if [ "$APACHE_RELOAD_REQUIRED" = true ]; then
    echo "[*] Testing Apache configuration..."
    apache2ctl configtest

    echo "[*] Reloading Apache..."
    systemctl reload apache2
    echo "[+] Apache reloaded successfully!"
else
    echo "[+] Apache configuration already up to date; skipping reload"
fi

echo ""
echo "============================================================"
echo " Apache configured for Keycloak!"
echo "============================================================"
echo " hutta.in         → serves site, protects /profiles.html"
echo " auth.hutta.in    → proxies Keycloak :8080"
echo " Admin Console    → LAN only"
echo " Account Console  → https://auth.hutta.in/realms/hutta/account"
echo "============================================================"
echo " OIDC Crypto Passphrase (saved):"
echo " OIDC_PASSPHRASE=${OIDC_PASSPHRASE}"
echo "============================================================"