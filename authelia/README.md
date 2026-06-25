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

---

## User Management

Authelia is configured to use a local file-based database for user records, located at `/etc/authelia/users_database.yml`.

### 1. Structure of `users_database.yml`
Each user entry has the following structure:
```yaml
users:
  username:
    displayname: "User Display Name"
    password: "argon2-hashed-password"
    email: "user@domain.com"
    groups:
      - admins
      - users
```

### 2. Adding or Modifying a User
To add a new user or change a password:
1. **Generate the Argon2 hash**:
   Use the Authelia binary to securely generate a password hash matching the Argon2 settings in `configuration.yml`:
   ```bash
   /usr/local/bin/authelia crypto hash generate argon2 --password "your-secure-password"
   ```
   *Example Output:*
   ```text
   $argon2id$v=19$m=65536,t=3,p=4$q9Y7U1L...
   ```
2. **Edit the database file**:
   Open `/etc/authelia/users_database.yml` as root:
   ```bash
   sudo nano /etc/authelia/users_database.yml
   ```
3. **Insert the user block**:
   Paste the username, display name, email, groups, and the hash you generated under the `users:` key.
4. **Secure the file permissions**:
   Ensure only the `authelia` system user can read the database:
   ```bash
   sudo chown authelia:authelia /etc/authelia/users_database.yml
   sudo chmod 600 /etc/authelia/users_database.yml
   ```
5. **Reload the database**:
   Restart Authelia to apply the changes:
   ```bash
   sudo systemctl restart authelia
   ```

---

## Authentication Integration (UI & API)

Authelia protects web assets and APIs using OpenID Connect (OIDC) or forward headers.

### 1. UI Authentication (OIDC in Apache)
To protect a UI portal or web page (e.g., `/dashboard.html`):
1. **Configure mod_auth_openidc in Apache**:
   The `configure_apache.sh` script registers the `apache-portal` client with Apache's OIDC handler.
2. **Protect Specific Location Blocks**:
   Add the following inside your Apache VirtualHost configuration (`/etc/apache2/sites-available/000-default-le-ssl.conf`):
   ```apache
   <Location /dashboard.html>
       AuthType openid-connect
       Require valid-user
   </Location>
   ```
3. **How the Flow Works**:
   - The browser requests `/dashboard.html`.
   - Apache intercepts the request and redirects the user to the Authelia portal (`https://hutta.in/authelia/`) if no active OIDC session exists.
   - The user authenticates (and enters 2FA if configured).
   - Authelia redirects back to `/redirect_uri` with a code. Apache exchanges this for user identity claims, establishes a session cookie, and serves the dashboard.

### 2. API Authentication
APIs can be secured using two methods depending on the type of client:

#### Method A: Session Cookie Forwarding (For SPA Frontends)
When your frontend JS (Single Page Application) communicates with an API hosted on the same domain (`hutta.in`):
1. **Configure Apache to protect the API path**:
   ```apache
   <Location /api>
       AuthType openid-connect
       Require valid-user
   </Location>
   ```
2. **Forwarding User context**:
   Apache automatically verifies the active OIDC session cookie and forwards user context to the backend API server in headers:
   - `OIDC_CLAIM_preferred_username` (or `Remote-User`)
   - `OIDC_CLAIM_email`
   - `OIDC_CLAIM_groups`

#### Method B: Bearer Tokens / OAuth2 (For CLI, Scripts & Third-party Clients)
For non-browser clients (such as Python scripts, curl, or mobile apps) that cannot perform interactive OIDC login:
1. **Verify Tokens in Backend**:
   The backend API can accept an OIDC `AccessToken` as a Bearer token in the `Authorization` header:
   ```text
   Authorization: Bearer <access-token-jwt>
   ```
2. **JWT Signature Verification**:
   The backend API verifies the JWT against Authelia's JSON Web Key Set (JWKS) endpoint:
   - **JWKS URI**: `https://hutta.in/authelia/jwks.json`
   - **OIDC Discovery Endpoint**: `https://hutta.in/authelia/.well-known/openid-configuration`
3. **Apache Token Introspection (Alternative)**:
   Alternatively, you can instruct Apache to validate Bearer tokens directly using `mod_auth_openidc`:
   ```apache
   <Location /api>
        AuthType oauth2
        Require valid-user
    </Location>
    ```

### 3. Logout & Session Invalidation
Since Authelia does not natively advertise or support the OpenID Connect RP-Initiated Logout specification (meaning `mod_auth_openidc` cannot automatically discover a logout endpoint), you must invalidate both the local Apache proxy session and the global Authelia SSO session programmatically:

1. **Local Apache Session**: Invalidate by calling the `mod_auth_openidc` redirect URI with the `logout` parameter:
   `https://hutta.in/redirect_uri?logout=TARGET_URL`
2. **Authelia SSO Session**: Invalidate by sending a `POST` request to Authelia's logout API endpoint:
   `https://hutta.in/authelia/api/logout`

#### Implementation Example (JavaScript):
```javascript
// 1. Invalidate Apache session cookie in the background
await fetch('/redirect_uri?logout=https%3A%2F%2Fhutta.in%2F');

// 2. Invalidate Authelia session cookie in the background (POST method is required)
await fetch('/authelia/api/logout', { method: 'POST' });

// 3. Redirect back to landing page
window.location.replace('https://hutta.in/');
```
