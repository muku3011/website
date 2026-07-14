#!/usr/bin/env bash
# ==============================================================================
# Raspberry Pi Security Hardening Script
# Installs and configures firewall (UFW) and security utilities (fail2ban, unattended-upgrades).
# Must be executed as root on the target Pi.
# ==============================================================================
set -euo pipefail

# Formatting Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "${YELLOW}[*] Starting Raspberry Pi Security Hardening...${NC}\n"

# 1. Ensure script is run as root (using id -u for portability across shell envs)
if [ "$(id -u)" -ne 0 ]; then
    printf "${RED}Error: This script must be run as root (sudo).${NC}\n"
    exit 1
fi

# 2. Update package list and install required security tools
printf "${YELLOW}[*] Updating package repositories and installing security packages...${NC}\n"
apt-get update
apt-get install -y ufw fail2ban unattended-upgrades

# 3. Configure UFW (Uncomplicated Firewall)
printf "${YELLOW}[*] Resetting UFW to clean state (clearing old rules)...${NC}\n"
ufw --force reset

printf "${YELLOW}[*] Configuring Firewall (UFW)...${NC}\n"
# Set defaults: Deny incoming, Allow outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH only from private subnets (RFC 1918) for local network access
ufw allow from 192.168.0.0/16 to any port 22 proto tcp comment 'SSH local only'
ufw allow from 10.0.0.0/8 to any port 22 proto tcp comment 'SSH local only'
ufw allow from 172.16.0.0/12 to any port 22 proto tcp comment 'SSH local only'

# Explicitly allow HTTPS (Port 80 is kept closed and opened dynamically by Certbot hooks)
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW (non-interactively)
printf "${YELLOW}[*] Enabling UFW firewall rules...${NC}\n"
ufw --force enable

# 4. Enable and start services
printf "${YELLOW}[*] Activating and configuring Fail2ban brute-force monitor...${NC}\n"
# Setup tuned sshd jail and new apache jails
cat > /etc/fail2ban/jail.d/hardened.conf << 'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 3
findtime = 10m
bantime  = 24h

[apache-auth]
enabled  = true
port     = http,https
filter   = apache-auth
logpath  = /var/log/apache2/error.log
maxretry = 5
bantime  = 1h

[apache-badbots]
enabled  = true
port     = http,https
filter   = apache-badbots
logpath  = /var/log/apache2/access.log
maxretry = 2
bantime  = 24h
EOF

systemctl enable fail2ban
systemctl restart fail2ban

printf "${YELLOW}[*] Activating automated security updates (unattended-upgrades)...${NC}\n"
# Ensure unattended-upgrades config is enabled
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

systemctl enable unattended-upgrades
systemctl restart unattended-upgrades

# 5. Configure Certbot renewal hooks to open/close port 80 on demand
printf "${YELLOW}[*] Configuring Certbot dynamic UFW renewal hooks...${NC}\n"
mkdir -p /etc/letsencrypt
CLI_INI="/etc/letsencrypt/cli.ini"

# Ensure clean configuration without duplicate hook entries
if [ -f "$CLI_INI" ]; then
    sed -i '/pre-hook/d' "$CLI_INI" 2>/dev/null || true
    sed -i '/post-hook/d' "$CLI_INI" 2>/dev/null || true
fi

echo "pre-hook = ufw allow 80/tcp comment 'Temp open for Certbot'" >> "$CLI_INI"
echo "post-hook = ufw delete allow 80/tcp" >> "$CLI_INI"

# 6. Hardening SSH Configuration
printf "${YELLOW}[*] Applying SSH Server hardening configs...${NC}\n"
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-hardened.conf << 'EOF'
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3
X11Forwarding no
LoginGraceTime 30
EOF
printf "${YELLOW}[*] Validating SSH configurations...${NC}\n"
if sshd -t; then
    systemctl restart ssh
    printf "${GREEN}[+] SSH Server restarted with hardened configuration.${NC}\n"
else
    printf "${RED}Error: Invalid SSH configuration! Skipping SSH restart to prevent lockout.${NC}\n"
    exit 1
fi

# 7. Apply Sysctl Kernel Parameters Hardening
printf "${YELLOW}[*] Applying network sysctl kernel security hardening...${NC}\n"
cat > /etc/sysctl.d/99-hardened.conf << 'EOF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv6.conf.all.accept_ra = 0
net.ipv4.conf.all.accept_source_route = 0
EOF
sysctl --system

# 8. Configure Apache Security Headers
printf "${YELLOW}[*] Configuring Apache security headers and server tokens...${NC}\n"
cat > /etc/apache2/conf-available/security-headers.conf << 'EOF'
Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://auth.hutta.in"
ServerTokens Prod
ServerSignature Off
EOF
if a2enconf security-headers &>/dev/null; then
    systemctl reload apache2
fi

# 9. Cleanup unnecessary SUID on ntfs-3g
if [ -f /usr/bin/ntfs-3g ]; then
    printf "${YELLOW}[*] Removing SUID bit from /usr/bin/ntfs-3g...${NC}\n"
    chmod 0755 /usr/bin/ntfs-3g
fi

# 10. Print status summary
printf "\n${GREEN}============================================================${NC}\n"
printf "${GREEN}   Hardening Completed Successfully!                         ${NC}\n"
printf "${GREEN}============================================================${NC}\n"
printf "Firewall status:\n"
ufw status verbose
printf "\nService Statuses:\n"
printf " - fail2ban:          $(systemctl is-active fail2ban)\n"
printf " - unattended-upgrades: $(systemctl is-active unattended-upgrades)\n"
printf "============================================================\n"

