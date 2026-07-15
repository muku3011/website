#!/usr/bin/env bash
# ==============================================================================
# Centralized Secrets Manager for hutta.in
# Handles atomic storage, retrieval, and generation of system credentials.
# ==============================================================================

# Formatting colors (if not defined by parent script)
GREEN="${GREEN:-\033[0;32m}"
YELLOW="${YELLOW:-\033[1;33m}"
RED="${RED:-\033[0;31m}"
NC="${NC:-\033[0m}"

SECRETS_DIR="/etc/hutta"
SECRETS_FILE="${SECRETS_DIR}/secrets.env"

# Ensure the secrets directory exists and is secured
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [ ! -f "$SECRETS_FILE" ]; then
    touch "$SECRETS_FILE"
fi
chmod 600 "$SECRETS_FILE"

# Load the file into the environment
# shellcheck disable=SC1090
. "$SECRETS_FILE"

# Function to write a value to the secrets file atomically
set_secret() {
    local key="$1"
    local value="$2"
    python3 - "$SECRETS_FILE" "$key" "$value" <<'PY'
import os, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
updated = False
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as fh:
        lines = fh.readlines()
for idx, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[idx] = f'{key}="{value.replace("\\", "\\\\").replace("\"", "\\\"")}"\n'
        updated = True
        break
if not updated:
    lines.append(f'{key}="{value.replace("\\", "\\\\").replace("\"", "\\\"")}"\n')

tmp_path = path + '.tmp'
with open(tmp_path, 'w', encoding='utf-8') as fh:
    fh.writelines(lines)
os.replace(tmp_path, path)
PY
    # Export to current shell so subsequent reads in the same process get the new value
    export "$key"="$value"
}

# Function to generate a password (24 characters, alphanumeric)
generate_password() {
    openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24
}

# Function to generate a secure user password (matching original custom pattern)
generate_user_password() {
    local pass
    pass=$(openssl rand -base64 12 | tr -d '+/' | cut -c1-12)
    echo "Hutta@${pass}1!"
}

# Function to generate base64-encoded key
generate_base64_key() {
    openssl rand -base64 32
}

# Function to generate hex-encoded key (32 bytes / 64 chars)
generate_hex_32() {
    openssl rand -hex 32
}

# Core function: retrieves a secret, or generates and stores it if missing
get_or_create_secret() {
    local key="$1"
    local generator_type="${2:-password}"
    local default_val="${3:-}"

    # Evaluate dynamic variable reference
    local current_val="${!key}"

    if [ -n "$current_val" ]; then
        echo "$current_val"
        return 0
    fi

    # Generate a new value
    local new_val
    if [ -n "$default_val" ]; then
        new_val="$default_val"
    else
        case "$generator_type" in
            password)
                new_val=$(generate_password)
                ;;
            user_password)
                new_val=$(generate_user_password)
                ;;
            base64_key)
                new_val=$(generate_base64_key)
                ;;
            hex_32)
                new_val=$(generate_hex_32)
                ;;
            *)
                echo "Error: Unknown generator type $generator_type" >&2
                return 1
                ;;
        esac
    fi

    echo -e "${YELLOW}[*] Secret $key was not found. Generated a new value.${NC}" >&2
    set_secret "$key" "$new_val"
    echo "$new_val"
}
