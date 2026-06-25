#!/usr/bin/env bash
set -e

# Install OIDC module if not installed
if ! dpkg -s libapache2-mod-auth-openidc &>/dev/null; then
    echo "[*] Installing libapache2-mod-auth-openidc..."
    apt-get update -y
    apt-get install -y libapache2-mod-auth-openidc
fi

# Enable required Apache modules
echo "[*] Enabling Apache modules..."
a2enmod proxy proxy_http auth_openidc ssl headers || true

# Backup existing config
echo "[*] Backing up /etc/apache2/sites-available/000-default-le-ssl.conf..."
cp /etc/apache2/sites-available/000-default-le-ssl.conf "/etc/apache2/sites-available/000-default-le-ssl.conf.bak.$(date +%Y%m%d%H%M%S)"

# Overwrite config file with Authelia integration included
echo "[*] Overwriting SSL site config with Authelia integration..."
cat << 'EOF' > /etc/apache2/sites-available/000-default-le-ssl.conf
<IfModule mod_ssl.c>
<VirtualHost *:443>
	ServerAdmin webmaster@localhost
	DocumentRoot /var/www/html

	ErrorLog ${APACHE_LOG_DIR}/error.log
	CustomLog ${APACHE_LOG_DIR}/access.log combined

	ServerName hutta.in

	# ==============================================================================
	# Authelia & OIDC Configuration
	# ==============================================================================

	# Exclude the redirect callback from proxying so mod_auth_openidc intercepts it
	ProxyPass /redirect_uri !

	# Set X-Forwarded-Proto header so Authelia knows it is secure HTTPS
	RequestHeader set X-Forwarded-Proto "https"

	# Reverse Proxy for Authelia subpath
	ProxyPreserveHost On
	ProxyPass /authelia http://127.0.0.1:9091/authelia
	ProxyPassReverse /authelia http://127.0.0.1:9091/authelia

	# Allow public access to Authelia subpath
	<Location /authelia>
		Require all granted

		# Enable mod_substitute to inject custom UI elements
		AddOutputFilterByType SUBSTITUTE text/html
		
		# Inject custom stylesheet link in the head to comply with Authelia CSP (which allows same-origin 'self' stylesheets)
		Substitute "s|</head>|<link rel=\"stylesheet\" href=\"/custom-authelia.css\"></head>|n"
		
		# Inject \"Back to hutta.in\" button right after the React root container
		Substitute "s|<div id=\"root\"></div>|<div id=\"root\"></div><div class=\"back-to-hutta-container\"><a href=\"https://hutta.in/\" class=\"back-to-hutta-btn\"><svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2.5\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18\" /></svg>Back to hutta.in</a></div>|n"
	</Location>

	# OpenID Connect settings
	OIDCProviderMetadataURL https://hutta.in/authelia/.well-known/openid-configuration
	OIDCClientID apache-portal
	OIDCClientSecret "308e656e77d9a2b393f350268e9b865840b643e95421dcc41ed4f15e9111843c"
	OIDCRedirectURI https://hutta.in/redirect_uri
	OIDCCryptoPassphrase "308e656e77d9a2b393f350268e9b865840b643e95421dcc41ed4f15e9111843c"
	OIDCScope "openid profile email"

	# Protect the Redirect URI itself so mod_auth_openidc can intercept it
	<Location /redirect_uri>
		AuthType openid-connect
		Require valid-user
	</Location>

	# Protect the dashboard page (dashboard.html)
	<Location /dashboard.html>
		AuthType openid-connect
		Require valid-user

		# Pass claims to client cookies so frontend JavaScript can read them
		Header set Set-Cookie "hutta_auth=true; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_preferred_username
		Header set Set-Cookie "hutta_user=%{OIDC_CLAIM_preferred_username}e; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_preferred_username
		Header set Set-Cookie "hutta_groups=%{OIDC_CLAIM_groups}e; Path=/; Secure; SameSite=Lax" env=OIDC_CLAIM_groups
	</Location>

	# ==============================================================================
	# Let's Encrypt SSL Certificates
	# ==============================================================================
	SSLCertificateFile /etc/letsencrypt/live/hutta.in/fullchain.pem
	SSLCertificateKeyFile /etc/letsencrypt/live/hutta.in/privkey.pem
	Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
EOF

# Restart Apache to apply configuration
echo "[*] Restarting Apache..."
systemctl restart apache2
echo "[+] Apache successfully restarted!"
