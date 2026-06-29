#!/usr/bin/env bash
# This script inserts or updates an admin user with all groups (admins, users) in the Authelia PostgreSQL database.
# Run this script on the Raspberry Pi.

set -e

# Formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[*] Authelia Admin User Insertion Script${NC}"

# 1. Prompt for inputs
read -p "Enter username [admin]: " USERNAME
USERNAME=${USERNAME:-admin}
USERNAME=$(echo "$USERNAME" | tr -d ' ' | tr '[:upper:]' '[:lower:]')

read -p "Enter display name [Administrator]: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Administrator}

read -p "Enter email address [admin@hutta.in]: " EMAIL
EMAIL=${EMAIL:-admin@hutta.in}

while true; do
    read -s -p "Enter password: " PASSWORD
    echo
    read -s -p "Confirm password: " PASSWORD_CONFIRM
    echo
    if [ "$PASSWORD" = "$PASSWORD_CONFIRM" ]; then
        if [ -z "$PASSWORD" ]; then
            echo -e "${RED}[!] Password cannot be empty.${NC}"
            continue
        fi
        break
    else
        echo -e "${RED}[!] Passwords do not match. Try again.${NC}"
    fi
done

# 2. Generate Argon2id password hash using Authelia binary
echo -e "${YELLOW}[*] Generating Argon2id password hash...${NC}"
AUTHELIA_BIN="/usr/local/bin/authelia"

if [ -f "$AUTHELIA_BIN" ]; then
    if "$AUTHELIA_BIN" crypto hash generate --help &>/dev/null; then
        HASH=$("$AUTHELIA_BIN" crypto hash generate argon2 --password "$PASSWORD" | cut -d' ' -f2)
    else
        HASH=$("$AUTHELIA_BIN" crypto hash-password "$PASSWORD")
    fi
else
    echo -e "${RED}[!] Authelia binary not found at $AUTHELIA_BIN.${NC}"
    echo -e "${YELLOW}[*] Attempting to generate hash using python fallback...${NC}"
    if command -v python3 &>/dev/null && python3 -c "import passlib" &>/dev/null; then
        HASH=$(python3 -c "from passlib.hash import argon2; print(argon2.using(type='ID').hash('$PASSWORD'))")
    else
        echo -e "${RED}[!] Fallback failed. Please run this script on the Raspberry Pi where Authelia is installed.${NC}"
        exit 1
    fi
fi

if [ -z "$HASH" ]; then
    echo -e "${RED}[!] Failed to generate password hash.${NC}"
    exit 1
fi

echo -e "${GREEN}[+] Generated hash successfully.${NC}"

# 3. Insert user and groups into PostgreSQL database
echo -e "${YELLOW}[*] Inserting user '$USERNAME' into PostgreSQL 'autheliadb' database...${NC}"

# We run as postgres superuser to avoid password prompting
sudo -u postgres psql -d autheliadb -c "
INSERT INTO authelia_user (username, display_name, email, password_hash)
VALUES ('$USERNAME', '$DISPLAY_NAME', '$EMAIL', '$HASH')
ON CONFLICT (username) DO UPDATE 
SET display_name = EXCLUDED.display_name, 
    email = EXCLUDED.email, 
    password_hash = EXCLUDED.password_hash;

-- Delete old group assignments to avoid duplicates
DELETE FROM authelia_user_group WHERE username = '$USERNAME';

-- Insert into groups (admins and users)
INSERT INTO authelia_user_group (username, group_name) VALUES ('$USERNAME', 'admins');
INSERT INTO authelia_user_group (username, group_name) VALUES ('$USERNAME', 'users');
"

echo -e "${GREEN}[+] User '$USERNAME' inserted/updated successfully in the database with 'admins' and 'users' groups!${NC}"

# 4. Restart authelia-ldap service to sync in-memory LDAP directory
if systemctl is-active --quiet authelia-ldap; then
    echo -e "${YELLOW}[*] Restarting authelia-ldap service to sync LDAP server...${NC}"
    sudo systemctl restart authelia-ldap
    echo -e "${GREEN}[+] authelia-ldap service restarted.${NC}"
fi

# 5. Restart authelia service if active
if systemctl is-active --quiet authelia; then
    echo -e "${YELLOW}[*] Restarting authelia SSO service...${NC}"
    sudo systemctl restart authelia
    echo -e "${GREEN}[+] authelia service restarted.${NC}"
fi

echo -e "${GREEN}[+] All tasks completed successfully!${NC}"
