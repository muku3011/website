# Authelia Installation & Configuration

This directory contains scripts and configurations to install, update, and configure **Authelia** (an open-source authentication and authorization server) on a bare-metal Raspberry Pi 5 running Apache as a reverse proxy.

## Contents

- **[install_authelia.sh](file:///Users/muku/Projects/website/authelia/install_authelia.sh)**: A comprehensive script to download the latest Authelia release, create a system user/group, set up configuration files (`/etc/authelia`), generate cryptographic secrets, hash administrator passwords, and register/start Authelia as a systemd service.
- **[configure_apache.sh](file:///Users/muku/Projects/website/authelia/configure_apache.sh)**: A script that installs the OpenID Connect module for Apache (`libapache2-mod-auth-openidc`), enables proxy modules, and configures Apache to reverse-proxy the `/authelia` subpath and secure specific paths (like `dashboard.html`) using OIDC authentication.

---

## 1. Setup & Installation

### Prerequisites
- Running on a Raspberry Pi (or Debian-based system) with ARMhf or ARM64 architecture.
- Root or `sudo` access.
- Apache web server installed with Let's Encrypt SSL configured.

### Step 1: Install Authelia
Run the installation script with root privileges:
```bash
sudo ./install_authelia.sh
```

During installation, the script will:
1. Verify system dependencies (`curl`, `wget`, `tar`, `openssl`, etc.).
2. Detect system architecture.
3. Setup the system user and directories (`/etc/authelia`, `/var/lib/authelia`).
4. Download the latest binary from Github.
5. Generate or reload secure random secrets.
6. Prompt you for a secure administrator username, email, and password.
7. Generate Argon2 password hashes and write them to `/etc/authelia/users_database.yml`.
8. Write `/etc/authelia/configuration.yml`.
9. Setup, enable, and start the systemd service (`authelia.service`).

### Step 2: Configure Apache Reverse Proxy & OIDC Integration
Once Authelia is running, run the Apache configuration script:
```bash
sudo ./configure_apache.sh
```

This script will:
1. Install `libapache2-mod-auth-openidc` if not already installed.
2. Enable Apache modules: `proxy`, `proxy_http`, `auth_openidc`, `ssl`, and `headers`.
3. Backup your existing Apache configuration file (`/etc/apache2/sites-available/000-default-le-ssl.conf`).
4. Overwrite it to route `/authelia` to the local Authelia server and protect `/dashboard.html` with OIDC.
5. Restart Apache.

---

## Configuration & Paths

- **Binary Location**: `/usr/local/bin/authelia`
- **Configuration Directory**: `/etc/authelia/`
  - `configuration.yml`: Global Authelia settings, OIDC providers, and access control policies.
  - `users_database.yml`: Local file user database with Argon2-hashed passwords.
- **Data Directory**: `/var/lib/authelia/`
  - `db.sqlite3`: Local SQLite database.
  - `notification.txt`: File-based notification notifier (e.g., outputs TOTP registration links).
- **Systemd Service**: `authelia.service`
  - Control with: `sudo systemctl [start|stop|restart|status] authelia`
  - Logs: `journalctl -u authelia.service`
