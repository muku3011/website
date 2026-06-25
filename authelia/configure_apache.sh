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
		Substitute "s~</head>~<link rel=\"stylesheet\" href=\"/custom-authelia.css\"></head>~n"
		
		# Inject \"Back to hutta.in\" button, Theme Toggle button, and theme observer script right after the React root container
		Substitute "s~<div id=\"root\"></div>~<div id=\"root\"></div><div class=\"back-to-hutta-container\"><a href=\"https://hutta.in/\" class=\"back-to-hutta-btn\"><svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2.5\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18\" /></svg>Back to hutta.in</a></div><div class=\"theme-toggle-container\"><button id=\"theme-toggle-btn\" class=\"theme-toggle-btn\" aria-label=\"Toggle theme\"><svg class=\"sun-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41\"/></svg><svg class=\"moon-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/></svg></button></div><script>(function(){const b=document.body;function a(t){if(b.getAttribute(\"data-theme\")!==t){b.setAttribute(\"data-theme\",t)}}let s=localStorage.getItem(\"authelia_theme\");if(!s){s=window.matchMedia(\"(prefers-color-scheme:dark)\").matches?\"dark\":\"light\"}a(s);const o=new MutationObserver((m)=>{m.forEach((n)=>{if(n.attributeName===\"data-theme\"){const c=b.getAttribute(\"data-theme\");const d=localStorage.getItem(\"authelia_theme\")||s;if(c!==d){a(d)}}})});o.observe(b,{attributes:true});document.addEventListener(\"DOMContentLoaded\",()=>{const btn=document.getElementById(\"theme-toggle-btn\");if(btn){btn.addEventListener(\"click\",()=>{const c=b.getAttribute(\"data-theme\")||\"light\";const n=c===\"dark\"?\"light\":\"dark\";localStorage.setItem(\"authelia_theme\",n);a(n)})}})})();</script>~n"
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
