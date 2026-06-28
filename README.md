# hutta.in Gateway & eSIM Remote SIM Provisioning (RSP) Platform

This repository contains the Infrastructure as Code (IaC), secure web portal assets, authentication configurations, and eSIM Remote SIM Provisioning (RSP) services needed to run a secure server gateway, status dashboard, and a local SM-DP+ eSIM provisioning environment on a home-hosted Raspberry Pi.

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

## 2. Web Portal & eSIM Services System Architecture

This diagram shows how user devices, reverse proxy, authentication directories, and persistent database tiers interface on the Raspberry Pi.

```mermaid
flowchart TD
    subgraph Client ["Client Devices"]
        Browser["Web Browser"]
        LPA_Client["Device LPA Client"]
    end

    subgraph RPi ["Raspberry Pi Gateway"]
        direction TB
        subgraph Proxy ["Apache Reverse Proxy (Port 443)"]
            Static["Static Web Assets (profiles.html, admin.html)"]
            OIDC["mod_auth_openidc"]
        end

        subgraph Auth ["Auth System"]
            Authelia["Authelia SSO (Port 9091)"]
            YAML_DB["users_database.yml"]
        end

        subgraph Backend ["eSIM Backend Services"]
            SMDP["SM-DP+ eSIM Server (Port 8092)"]
            LPA_Sim["LPA Simulator (Port 8093)"]
        end

        subgraph DB ["Database Tier"]
            PostgreSQL[(PostgreSQL Server: Port 5432)]
            smdpdb[(Database: smdpdb)]
            lpadb[(Database: lpadb)]
        end
    end

    %% Client Access
    Browser -->|HTTPS /| Static
    Browser -->|Authenticate| OIDC
    LPA_Client -->|Download Handshake /es9plus| SMDP

    %% Proxy Routing
    OIDC -->|Authenticate| Authelia
    Proxy -->|Proxy /authelia| Authelia
    Proxy -->|Proxy /gsma/rsp/v2/| SMDP
    Proxy -->|Proxy /lpa/| LPA_Sim

    %% Authentication Directory
    Authelia <-->|Read/Write Users| YAML_DB
    SMDP -->|Authelia UserController| YAML_DB

    %% eSIM provisioning & database
    LPA_Sim -->|Trigger ES9+ Provisioning| SMDP
    SMDP <-->|JPA / Flyway| smdpdb
    LPA_Sim <-->|JPA / Flyway| lpadb
    smdpdb -.->|Part of| PostgreSQL
    lpadb -.->|Part of| PostgreSQL
```

* **Apache HTTP Server**: Serves the website frontend assets and acts as a secure reverse proxy with OIDC integration (`mod_auth_openidc`) for private routes.
* **Authelia**: Authenticates users against a local directory (`users_database.yml`) and handles Single Sign-On (SSO).
* **SM-DP+ eSIM Server**: Implements the standard GSMA SGP.22 endpoints (ES2+ and ES9+), backed by a persistent PostgreSQL database (`smdpdb`) and Flyway database migration controller.
* **LPA Simulator**: Simulates eUICC operations and triggers remote SIM provisioning downloads, storing downloaded profiles in a persistent PostgreSQL database (`lpadb`).

---

## 3. Projects & Repository Layout

This repository is split into five main areas:

### 1. [Infrastructure as Code & DDNS Automation (website-iac/)](website-iac/README.md)
Contains all GCP infrastructure provisioning and backend Dynamic DNS setup:
- Terraform configurations (`dns.tf`, `iam.tf`, `variables.tf`, etc.) for managing DNS zones and records.
- Zero-dependency Dynamic DNS Python script (`ddns.py`).
- Setup instructions for automating DDNS updates on the Raspberry Pi using systemd or cron.
- **Go to [website-iac/README.md](website-iac/README.md) for setup and deployment instructions.**

### 2. [Website Frontend (website/)](website/README.md)
Contains the server dashboard and portfolio site assets deployed on the Raspberry Pi:
- Frontend code (`index.html`, `index.css`, `app.js`, `profiles.html`, `admin.html`) for serving the portfolio site, eSIM profiles registry, LPA download simulator, and Authelia user management panel.
- Deployment configuration for Apache HTTP Server and HTTPS (SSL/TLS) via Let's Encrypt.
- GitHub Actions CI/CD setup via self-hosted runners.
- **Go to [website/README.md](website/README.md) for frontend deployment and automation setup instructions.**

### 3. [Authelia Authentication Setup (authelia/)](authelia/README.md)
Contains bare-metal installation scripts, password hash generators, and Apache server integration configuration for Authelia:
- Automated installation script (`install_authelia.sh`) for Raspberry Pi 5 / Debian systems.
- Apache web server OIDC configuration script (`configure_apache.sh`).
- **Go to [authelia/README.md](authelia/README.md) for detailed deployment and setup instructions.**

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
