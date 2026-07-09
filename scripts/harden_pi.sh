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
systemctl enable fail2ban
systemctl restart fail2ban

printf "${YELLOW}[*] Activating automated security updates (unattended-upgrades)...${NC}\n"
# Ensure unattended-upgrades config is enabled
# (Debian default enables it automatically upon install, but we force enable it to be sure)
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

# 6. Print status summary
printf "\n${GREEN}============================================================${NC}\n"
printf "${GREEN}   Hardening Completed Successfully!                         ${NC}\n"
printf "${GREEN}============================================================${NC}\n"
printf "Firewall status:\n"
ufw status verbose
printf "\nService Statuses:\n"
printf " - fail2ban:          $(systemctl is-active fail2ban)\n"
printf " - unattended-upgrades: $(systemctl is-active unattended-upgrades)\n"
printf "============================================================\n"
