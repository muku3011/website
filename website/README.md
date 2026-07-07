# Website Frontend & Raspberry Pi Deployment

This directory contains the frontend website assets (HTML/CSS/JS) for the `hutta.in` server, featuring the portfolio homepage, developer toolbox, eSIM Profiles dashboard, and the technology blog.

## Deployment & Architecture

```mermaid
flowchart TD
    subgraph Web Clients
        Browser["User Browser"]
    end

    subgraph Raspberry Pi (Home Server)
        subgraph Apache HTTP Server
            Static["Static Files (index.html, tools.html, blog.html)"]
            OIDC["mod_auth_openidc (profiles.html & /api/blog/ write APIs)"]
            Proxy["Reverse Proxy (API routes)"]
        end

        subgraph Authentication Service
            Keycloak["Keycloak SSO (loopback :8080)"]
        end

        subgraph Backend Services
            LPA["LPA Simulator (:8093)"]
            SMDP["SM-DP+ Server (:8092)"]
            Blog["Blog Service (:8094)"]
        end
    end

    Browser -->|HTTPS: /| Static
    Browser -->|HTTPS: /tools.html| Static
    Browser -->|HTTPS: /blog.html| Static
    Browser -->|HTTPS: /profiles.html| OIDC
    OIDC -->|"Not authenticated → redirect"| Keycloak
    Keycloak -->|"SSO session + hutta_* cookies set"| OIDC
    OIDC -->|Authenticated: serve page + set cookies| Browser
    Browser -->|HTTPS: /gsma/rsp/v2/*| Proxy
    Browser -->|HTTPS: /lpa/*| Proxy
    Browser -->|HTTPS: /api/blog/*| Proxy
    Proxy --> SMDP
    Proxy --> LPA
    Proxy --> Blog
```

## Repository Contents
- **`index.html`**: The main landing page.
- **`tools.html`**: The developer toolbox (calculators, encoders, API explorer).
- **`profiles.html`**: The eSIM profiles management registry and LPA download simulator.
- **`blog.html`**: The technology blog feed page.
- **`css/index.css`**: Global design system + home page layouts (consolidates portfolio styles).
- **`js/auth-nav.js`**: Shared core — reads the `hutta_*` cookies set by Apache `mod_auth_openidc` on authenticated routes, drives dynamic nav menus (Profiles and Blog write permissions), manages the idle session timer, and handles the theme toggle. Authentication state is fully server-driven via cookies; no client-side session storage is used.
- **`js/index.js`**: Home page scroll transitions and timeline animations.
- **`js/tools.js`**: Developer toolbox calculators, encoders, and API explorer logic.
- **`js/profiles.js`**: eSIM Profiles page — API integrations and LPA simulator.
- **`js/blog.js`**: Technology blog feed controller (Markdown compiler, search engine, CRUD overlays).
- **`js/libs/`**: Vendor libraries (js-yaml, ReDoc).
- **`keycloak/`**: Legacy Keycloak theme assets retained for reference only.

---

## Setup & Deployment Instructions

> [!NOTE]
> **First-time vs. repeat deployments**: Steps 1–4 below are **first-time setup only**.
> After that, all deployments are fully automated via GitHub Actions (Step 5).
> Only re-run individual scripts if you are rebuilding or re-provisioning the server.

### Step 1: Router Configuration (Port Forwarding & Static IP)

For the public to access your website hosted on the Raspberry Pi from outside your home network, you must configure two settings on your home router:

#### 1. Configure DHCP Reservation (Static Local IP)
By default, your home router dynamically assigns IP addresses to devices. If your Raspberry Pi restarts, its local IP might change, breaking port forwarding.
1. Log in to your home router's admin panel (typically at `192.168.1.1` or `192.168.0.1`).
2. Navigate to the **DHCP Server settings** or **LAN settings**.
3. Bind your Raspberry Pi's MAC address to a fixed local IP address (e.g., `192.168.1.100`).

#### 2. Configure Port Forwarding
This tells your router to send incoming web traffic from the internet to your Raspberry Pi.
1. Find the **Port Forwarding**, **Virtual Server**, or **NAT** settings in your router's panel.
2. Create forwarding rules for HTTP (port 80) and HTTPS (port 443):
   * **Rule 1 (HTTP)**: External Port `80` -> Internal Port `80` (TCP) -> Raspberry Pi IP.
   * **Rule 2 (HTTPS)**: External Port `443` -> Internal Port `443` (TCP) -> Raspberry Pi IP.

> [!NOTE]
> **NAT Loopback (Hairpin NAT)**:
> Some home routers do not support accessing your public domain name (`hutta.in`) while you are connected to your *home Wi-Fi*. Test by disabling Wi-Fi on a mobile phone to see if it loads successfully over mobile data.

---

### Step 2: Deploy Frontend Website (Apache HTTP Server)

> [!NOTE]
> This step is for **first-time setup only**. Subsequent deploys are automated by the GitHub Actions workflow (Step 5).

To serve the dashboard website assets from your Raspberry Pi, install and configure the Apache HTTP server.

#### 1. Copy Assets to the Pi
From your local machine's project directory, copy all dashboard frontend assets to your Pi:
```bash
scp -r website/* rbpi@your-raspberry-pi-ip:/home/rbpi/website/
```

#### 2. Install Apache
Log in to the Raspberry Pi and install the `apache2` package:
```bash
sudo apt update && sudo apt install -y apache2
```

#### 3. Move Assets to Web Root & Configure Permissions
```bash
# Remove default index.html
sudo rm -f /var/www/html/index.html

# Copy your website assets to the web root
sudo cp /home/rbpi/website/index.html /home/rbpi/website/profiles.html \
        /home/rbpi/website/tools.html /home/rbpi/website/favicon.png /var/www/html/
sudo cp -r /home/rbpi/website/css /var/www/html/
sudo cp -r /home/rbpi/website/js /var/www/html/

# Assign proper ownership and permissions
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/

# Restart Apache
sudo systemctl restart apache2
```

---

### Step 3: Configure HTTPS (SSL/TLS) via Let's Encrypt

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d hutta.in
```

Certbot automatically configures a systemd timer to renew certificates twice daily:
```bash
sudo systemctl status certbot.timer
```

---

### Step 4: Set Up Keycloak Authentication (OIDC)

Keycloak provides SSO for `profiles.html`. Apache acts as the OIDC Relying Party via `mod_auth_openidc`. On successful authentication, Apache sets the `hutta_*` cookies that `auth-nav.js` reads.

#### Prerequisites
- PostgreSQL must be installed and running (needed by Keycloak).

#### One-command setup (recommended)
Run the `setup_all.sh` orchestrator — it chains all four scripts in order, passing the OIDC client secret via a shell variable (never via `/tmp`):
```bash
sudo ./scripts/setup_all.sh
```

#### What it runs
| Script | Purpose |
|--------|---------|
| `setup_postgres.sh` | Creates the `keycloakdb`, `smdpdb`, `lpadb` databases and roles with generated passwords |
| `install_keycloak.sh` | Downloads Keycloak, configures systemd service, deploys the hutta theme |
| `configure_apache.sh` | Writes the `mod_auth_openidc` Apache config; adds `Header` directives to atomically expire `hutta_*` cookies on logout |

> [!IMPORTANT]
> After running `setup_all.sh`, note the printed credentials (DB passwords + OIDC client secret).
> Store them in a secrets manager — they are **not** saved to any file.

#### Logout cookie behaviour
Apache's `<Location /redirect_uri>` block expires all `hutta_*` cookies server-side on the logout response. No `sessionStorage` flag or client-side workaround is needed.

---

### Step 5: Automate Deployments via GitHub Actions (CI/CD)

The workflow is defined at [website-deploy.yml](../.github/workflows/website-deploy.yml). When you push changes to the `main` branch under the `website/` folder, the pipeline automatically copies files to Apache's web root and redeploys the Keycloak theme.
