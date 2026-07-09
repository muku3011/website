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

echo -e "${YELLOW}[*] Starting Raspberry Pi Security Hardening...${NC}"

# 1. Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (sudo).${NC}"
    exit 1
fi

# 2. Update package list and install required security tools
echo -e "${YELLOW}[*] Updating package repositories and installing security packages...${NC}"
apt-get update
apt-get install -y ufw fail2ban unattended-upgrades

# 3. Configure UFW (Uncomplicated Firewall)
echo -e "${YELLOW}[*] Configuring Firewall (UFW)...${NC}"
# Set defaults: Deny incoming, Allow outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH only from private subnets (RFC 1918) for local network access
ufw allow from 192.168.0.0/16 to any port 22 proto tcp comment 'SSH local only'
ufw allow from 10.0.0.0/8 to any port 22 proto tcp comment 'SSH local only'
ufw allow from 172.16.0.0/12 to any port 22 proto tcp comment 'SSH local only'

# Explicitly allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW (non-interactively)
echo -e "${YELLOW}[*] Enabling UFW firewall rules...${NC}"
ufw --force enable

# 4. Enable and start services
echo -e "${YELLOW}[*] Activating and configuring Fail2ban brute-force monitor...${NC}"
systemctl enable fail2ban
systemctl restart fail2ban

echo -e "${YELLOW}[*] Activating automated security updates (unattended-upgrades)...${NC}"
# Ensure unattended-upgrades config is enabled
# (Debian default enables it automatically upon install, but we force enable it to be sure)
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

systemctl enable unattended-upgrades
systemctl restart unattended-upgrades

# 5. Print status summary
echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}   Hardening Completed Successfully!                         ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "Firewall status:"
ufw status verbose
echo -e "\nService Statuses:"
echo -e " - fail2ban:          $(systemctl is-active fail2ban)"
echo -e " - unattended-upgrades: $(systemctl is-active unattended-upgrades)"
echo -e "============================================================"
