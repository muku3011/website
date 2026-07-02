#!/usr/bin/env bash
set -e

# ==============================================================================
# Apache Configuration for hutta.in with Keycloak OIDC
# - Adds auth.hutta.in VirtualHost (reverse proxy to Keycloak on :8080)
# - Protects /profiles.html with mod_auth_openidc
# - Restricts Keycloak Admin Console to home network only
# Run with: sudo ./scripts/configure_apache.sh
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root (use sudo)."
    exit 1
fi

# ── Install OIDC module if missing ────────────────────────────────────────────
if ! dpkg -s libapache2-mod-auth-openidc &>/dev/null; then
    echo "[*] Installing libapache2-mod-auth-openidc..."
    apt-get update -y
    apt-get install -y libapache2-mod-auth-openidc
fi

# ── Enable required modules ───────────────────────────────────────────────────
echo "[*] Enabling Apache modules..."
a2enmod proxy proxy_http auth_openidc ssl headers substitute || true

# ── Read Keycloak client secret ───────────────────────────────────────────────
# Accept via --oidc-client-secret <secret> flag or KC_CLIENT_SECRET env var,
# with an interactive prompt as a fallback.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --oidc-client-secret)
            KC_CLIENT_SECRET="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

if [ -z "$KC_CLIENT_SECRET" ]; then
    echo ""
    echo "Paste the OIDC client secret for 'apache-portal' from Keycloak Admin Console"
    echo "(Clients \u2192 apache-portal \u2192 Credentials \u2192 Client secret):"
    read -rsp "Client Secret: " KC_CLIENT_SECRET
    echo ""
fi

if [ -z "$KC_CLIENT_SECRET" ]; then
    echo "Error: Client secret cannot be empty."
    exit 1
fi

# Generate a random OIDC crypto passphrase
OIDC_PASSPHRASE=$(openssl rand -hex 32)

# ── Backup existing SSL config ────────────────────────────────────────────────
SSL_CONF="/etc/apache2/sites-available/000-default-le-ssl.conf"
if [ -f "$SSL_CONF" ]; then
    BACKUP="${SSL_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    echo "[*] Backing up ${SSL_CONF} to ${BACKUP}..."
    cp "$SSL_CONF" "$BACKUP"
fi

# ── Write hutta.in VirtualHost ────────────────────────────────────────────────
echo "[*] Writing ${SSL_CONF}..."
cat > "$SSL_CONF" <<'APACHEEOF'
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

    # -- Reverse Proxy: SM-DP+ backend --
    ProxyPreserveHost On
    ProxyPass /gsma/rsp/v2/ http://127.0.0.1:8092/gsma/rsp/v2/
    ProxyPassReverse /gsma/rsp/v2/ http://127.0.0.1:8092/gsma/rsp/v2/

    # -- Reverse Proxy: LPA Simulator --
    ProxyPass /lpa http://127.0.0.1:8093/lpa
    ProxyPassReverse /lpa http://127.0.0.1:8093/lpa

    # -- OIDC: exclude redirect_uri callback from proxying --
    ProxyPass /redirect_uri !

    # -- OpenID Connect provider (Keycloak hutta realm) --
APACHEEOF

# Append the secrets (cannot use single-quote heredoc for variable expansion)
cat >> "$SSL_CONF" <<APACHEVARS
    OIDCProviderMetadataURL https://auth.hutta.in/realms/hutta/.well-known/openid-configuration
    OIDCClientID apache-portal
    OIDCClientSecret "${KC_CLIENT_SECRET}"
    OIDCRedirectURI https://hutta.in/redirect_uri
    OIDCCryptoPassphrase "${OIDC_PASSPHRASE}"
    OIDCScope "openid profile email"
    OIDCRemoteUserClaim preferred_username
    # Store the id_token so mod_auth_openidc can pass id_token_hint to Keycloak on logout
    # This ensures Keycloak actually kills the SSO session (not just the Apache session)
    OIDCSessionType server-cache:persistent
    OIDCTokenEndpointParams "client_id=apache-portal"

APACHEVARS

cat >> "$SSL_CONF" <<'APACHEEOF'
    # -- Required: OIDC callback endpoint --
    <Location /redirect_uri>
        AuthType openid-connect
        Require valid-user

        # Server-side logout cookie clear: Apache expires all hutta_* cookies
        # atomically on the logout redirect response, so the browser never sees
        # stale auth state. This eliminates the need for any client-side flag.
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

    # ==========================================================================
    # Let's Encrypt SSL (covers hutta.in + auth.hutta.in via --expand)
    # ==========================================================================
    SSLCertificateFile /etc/letsencrypt/live/hutta.in/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/hutta.in/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
APACHEEOF

echo "[+] ${SSL_CONF} written"

# ── Write auth.hutta.in VirtualHost (separate file) ──────────────────────────
AUTH_CONF="/etc/apache2/sites-available/auth.hutta.in.conf"
echo "[*] Writing ${AUTH_CONF}..."
cat > "$AUTH_CONF" <<'AUTHEOF'
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerAdmin webmaster@localhost
    ServerName auth.hutta.in

    ErrorLog ${APACHE_LOG_DIR}/auth-error.log
    CustomLog ${APACHE_LOG_DIR}/auth-access.log combined

    # Tell Keycloak it is behind an HTTPS reverse proxy
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "auth.hutta.in"

    # Proxy everything to Keycloak running on localhost:8080
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    # ==========================================================================
    # Access Control
    # ==========================================================================

    # Admin Console (/admin) — restricted to home/LAN network only
    # Adjust the IP ranges to match your home network
    <Location /admin>
        Require ip 192.168.0.0/16
        Require ip 10.0.0.0/8
        Require ip 127.0.0.1
    </Location>

    # master realm endpoints — also LAN only
    <Location /realms/master>
        Require ip 192.168.0.0/16
        Require ip 10.0.0.0/8
        Require ip 127.0.0.1
    </Location>

    # hutta realm account console — publicly accessible (user self-service)
    <Location /realms/hutta/account>
        Require all granted
    </Location>

    # hutta realm OIDC endpoints — public (needed for mod_auth_openidc on hutta.in)
    <Location /realms/hutta>
        Require all granted
    </Location>

    # ==========================================================================
    # SSL — same expanded cert covers auth.hutta.in
    # ==========================================================================
    SSLCertificateFile /etc/letsencrypt/live/hutta.in/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/hutta.in/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
AUTHEOF

# ── Enable auth.hutta.in site ─────────────────────────────────────────────────
a2ensite auth.hutta.in.conf || true
echo "[+] auth.hutta.in VirtualHost enabled"

# ── Test and reload Apache ─────────────────────────────────────────────────────
echo "[*] Testing Apache configuration..."
apache2ctl configtest

echo "[*] Reloading Apache..."
systemctl reload apache2
echo "[+] Apache reloaded successfully!"

echo ""
echo "============================================================"
echo " Apache configured for Keycloak!"
echo "============================================================"
echo " hutta.in         → serves site, protects /profiles.html"
echo " auth.hutta.in    → proxies Keycloak :8080"
echo " Admin Console    → LAN only (192.168.x.x / 10.x.x.x)"
echo " Account Console  → https://auth.hutta.in/realms/hutta/account"
echo "============================================================"
echo " OIDC Crypto Passphrase (save this):"
echo " OIDC_PASSPHRASE=${OIDC_PASSPHRASE}"
echo "============================================================"
