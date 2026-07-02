# hutta.in Portfolio & Platform: Consumer eSIM SM-DP+ & Secure Server Gateway

This repository contains the Infrastructure as Code (IaC), secure web portal assets, Keycloak SSO authentication configurations, Certbot SSL/TLS certificate automation, and eSIM Remote SIM Provisioning (RSP) services needed to run a secure server gateway, status dashboard, and a local SM-DP+ eSIM provisioning environment on a home-hosted Raspberry Pi.

---

## 1. Dynamic DNS (DDNS) Architecture Overview

This diagram represents the flow for user access and the automated A-record updates when the home public IP changes.

```mermaid
flowchart LR
    subgraph Public Internet
        Browser["Web Browser"]
        DNS["GCP Cloud DNS"]
        Ipify["ipify.org"]
    end

    subgraph Home Network
        RPi["Raspberry Pi"]
    end

    Browser -->|1. DNS Lookup| DNS
    Browser -->|2. Access Website| RPi
    RPi -->|3. Check Public IP| Ipify
    RPi -->|4. Update A Record if changed| DNS
```

1. **GCP Cloud DNS**: Manages the `hutta.in` DNS zone.
2. **Terraform**: Provisions the DNS Zone, record placeholders, and a secure GCP Service Account for updates.
3. **DDNS Script**: Runs on the Raspberry Pi. It checks its current public IP and, if it changes, logs into GCP via the service account to update the A record automatically.

---

## 2. Secure HTTPS & SSL/TLS via Certbot

To ensure all public-facing HTTP traffic is encrypted and secure, **Certbot (Let's Encrypt)** is integrated into the hosting environment.

```mermaid
flowchart TD
    Timer["systemd certbot.timer"]
    Certbot["Certbot Agent"]
    LE["Let's Encrypt CA"]
    FS["Local Filesystem\n(/etc/letsencrypt)"]
    Apache["Apache Web Server"]

    Timer -->|1. Periodic Trigger| Certbot
    Certbot -->|2. Request Cert & Challenge| LE
    LE -.->|3. Validate Domain| Apache
    LE -->|4. Issue Signed Certs| Certbot
    Certbot -->|5. Save Private Key & Chain| FS
    Certbot -->|6. Reload Server Service| Apache
    Apache -->|7. Load Active Certs| FS

    style Timer fill:#fca5a5,stroke:#ef4444,stroke-width:2px,color:#000
    style Certbot fill:#93c5fd,stroke:#3b82f6,stroke-width:2px,color:#000
    style LE fill:#c084fc,stroke:#a855f7,stroke-width:2px,color:#000
    style FS fill:#cbd5e1,stroke:#64748b,stroke-width:2px,color:#000
    style Apache fill:#86efac,stroke:#22c55e,stroke-width:2px,color:#000
```

* **Certificate Acquisition**: Certbot automatically provisions trusted, free SSL/TLS certificates from Let's Encrypt for `hutta.in` (and wildcard/subdomains).
* **Apache HTTPS Integration**: The certificates (private key and full chain cert) are loaded into the Apache HTTP Server (`/etc/apache2/sites-available/000-default-le-ssl.conf`), forcing all connections to upgrade to **HTTPS (port 443)** using modern TLS protocols.
* **Automated Renewals**: A systemd timer (`certbot.timer`) runs automatically twice a day to renew certificates nearing expiration and reloads Apache to apply the renewed certificates seamlessly without downtime.

---

## 3. Web Portal & eSIM Services System Architecture

This diagram shows how user devices, reverse proxy, Keycloak authentication, and persistent database tiers interface on the Raspberry Pi.

```mermaid
flowchart TD
    subgraph Client ["Client Devices"]
        Browser["Web Browser"]
        LPA_Client["Device LPA Client"]
    end

    subgraph RPi ["Raspberry Pi Gateway"]
        direction TB
        subgraph Proxy ["Apache Reverse Proxy (Port 443)"]
            Static["Static Web Assets (index, tools, profiles)"]
            OIDC["mod_auth_openidc (/profiles.html only)"]
        end

        subgraph Auth ["Auth System"]
            Keycloak["Keycloak SSO — auth.hutta.in (loopback :8080)"]
        end

        subgraph Backend ["eSIM Backend Services"]
            SMDP["SM-DP+ eSIM Server (Port 8092)"]
            LPA_Sim["LPA Simulator (Port 8093)"]
        end

        subgraph DB ["Database Tier"]
            PostgreSQL[(PostgreSQL Server: Port 5432)]
            smdpdb[(Database: smdpdb)]
            lpadb[(Database: lpadb)]
            keycloakdb[(Database: keycloakdb)]
        end
    end

    %% Client Access
    Browser -->|HTTPS hutta.in| Static
    Browser -->|HTTPS auth.hutta.in| Keycloak
    Browser -->|Authenticate| OIDC
    LPA_Client -->|Download Handshake /es9plus| SMDP

    %% Proxy Routing
    OIDC -->|OIDC flow| Keycloak
    Proxy -->|Proxy /gsma/rsp/v2/| SMDP
    Proxy -->|Proxy /lpa/| LPA_Sim

    %% Authentication
    Keycloak <-->|JPA / Flyway| keycloakdb

    %% eSIM provisioning & database
    LPA_Sim -->|Trigger ES9+ Provisioning| SMDP
    SMDP <-->|JPA / Flyway| smdpdb
    LPA_Sim <-->|JPA / Flyway| lpadb
    smdpdb -.->|Part of| PostgreSQL
    lpadb -.->|Part of| PostgreSQL
    keycloakdb -.->|Part of| PostgreSQL
```

* **Apache HTTP Server**: Serves the website frontend assets and acts as a secure reverse proxy with OIDC integration (`mod_auth_openidc`) for private routes.
* **Keycloak**: Identity provider running on `auth.hutta.in` (bare metal, HTTP on loopback, Apache terminates TLS). Manages users natively and provides OIDC/OAuth2 for the site. Admin console is restricted to home network; Account console is public.
* **SM-DP+ eSIM Server**: Implements the standard GSMA SGP.22 endpoints (ES2+ and ES9+), backed by a persistent PostgreSQL database (`smdpdb`) and Flyway database migration controller.
* **LPA Simulator**: Simulates eUICC operations and triggers remote SIM provisioning downloads, storing downloaded profiles in a persistent PostgreSQL database (`lpadb`).

---

## 4. Projects & Repository Layout

This repository is split into five main areas:

### 1. [Infrastructure as Code & DDNS Automation (website-iac/)](website-iac/README.md)
Contains all GCP infrastructure provisioning and backend Dynamic DNS setup:
- Terraform configurations (`dns.tf`, `iam.tf`, `variables.tf`, etc.) for managing DNS zones and records.
- Zero-dependency Dynamic DNS Python script (`ddns.py`).
- Setup instructions for automating DDNS updates on the Raspberry Pi using systemd or cron.
- **Go to [website-iac/README.md](website-iac/README.md) for setup and deployment instructions.**

### 2. [Website Frontend (website/)](website/README.md)
Contains the server dashboard and portfolio site assets deployed on the Raspberry Pi:
- Frontend code (`index.html`, `index.css`, `profiles.html`) for serving the portfolio site, eSIM profiles registry, and LPA download simulator.
- Deployment configuration for Apache HTTP Server and HTTPS (SSL/TLS) via Let's Encrypt.
- GitHub Actions CI/CD setup via self-hosted runners.
- **Go to [website/README.md](website/README.md) for frontend deployment and automation setup instructions.**

### 3. [Keycloak Identity Provider (scripts/)](scripts/)
Contains the Keycloak bare-metal installer, realm setup, Apache integration, and the custom hutta theme:
- `setup_all.sh` — **recommended entry point**: orchestrates all four scripts below in order, passing secrets via shell variables (no temp files).
- `install_keycloak.sh` — installs Keycloak on Pi 5, configures PostgreSQL, deploys the hutta theme, and creates the systemd service.
- `setup_keycloak_realm.sh` — creates the `hutta` realm, `apache-portal` OIDC client, `users` group, and group-membership mapper via the Keycloak Admin REST API.
- `configure_apache.sh` — configures Apache with `mod_auth_openidc` pointing at Keycloak, adds the `auth.hutta.in` reverse-proxy VirtualHost, and restricts the admin console to the home network.
- `keycloak/hutta/` — custom Keycloak theme (login, account, email) matching the hutta.in dark design system.
- **Go to [scripts/setup_all.sh](scripts/setup_all.sh) for the full one-command deployment.**

### 4. [SM-DP+ eSIM Server (smdp-plus/)](smdp-plus/README.md)
Contains a reference implementation of a GSMA SGP.22 v3.1 compliant Subscription Manager Data Preparation+ (SM-DP+) server:
- REST API controllers for ES2+ (Operator) and ES9+ (LPA client) interfaces.
- Persistent PostgreSQL database backend and Flyway schema versioning.
- Auto-deployment via self-hosted GitHub Actions workflows and systemd service.
- **Go to [smdp-plus/README.md](smdp-plus/README.md) for build, testing, and deployment instructions.**

### 5. [eSIM LPA Download Simulator (lpa-simulator/)](lpa-simulator/README.md)
Contains a client-side simulation helper that triggers standard remote SIM provisioning (RSP) download handshakes:
- REST API controller for starting profile download via activation code.
- Persistent PostgreSQL database backend and Flyway schema versioning.
- Automatic deployment configuration via systemd service on the Raspberry Pi.
- **Go to [lpa-simulator/README.md](lpa-simulator/README.md) for build, testing, and deployment instructions.**
