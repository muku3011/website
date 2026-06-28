# GCP Cloud DNS with Dynamic DNS (DDNS) & Server Dashboard for hutta.in

This repository contains the Infrastructure as Code (IaC) and web assets needed to delegate DNS management for `hutta.in` to Google Cloud Platform (GCP), set up Dynamic DNS (DDNS), and run a premium status dashboard on a home-hosted Raspberry Pi.

## Architecture Overview

```mermaid
flowchart TD
    subgraph Public Internet
        Client["Web Browser"]
        GCP_DNS["GCP Cloud DNS"]
        Ipify["ipify.org (IP Service)"]
    end

    subgraph Home Network
        RPi["Raspberry Pi"]
    end

    Client -->|1. DNS Lookup| GCP_DNS
    GCP_DNS -->|2. Returns Public IP| Client
    Client -->|3. HTTP/HTTPS Request| RPi
    RPi -->|4. Periodic IP Check| Ipify
    RPi -->|5. Update Record (if IP changed)| GCP_DNS

    style Client fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff
    style GCP_DNS fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    style Ipify fill:#6b7280,stroke:#374151,stroke-width:2px,color:#fff
    style RPi fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff
```

1. **GCP Cloud DNS**: Manages the `hutta.in` DNS zone.
2. **Terraform**: Provisions the DNS Zone, record placeholders, and a secure GCP Service Account for updates.
3. **DDNS Script**: Runs on the Raspberry Pi. It checks its current public IP and, if it changes, logs into GCP via the service account to update the A record automatically.

---

## Projects & Repository Layout

This repository is split into three main areas:

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
- Lightweight embedded database and in-memory session manager for Raspberry Pi resource efficiency.
- Auto-deployment via self-hosted GitHub Actions workflows and systemd service.
- **Go to [smdp-plus/README.md](smdp-plus/README.md) for build, testing, and deployment instructions.**

### 5. [eSIM LPA Download Simulator (lpa-simulator/)](lpa-simulator/README.md)
Contains a client-side simulation helper that triggers standard remote SIM provisioning (RSP) download handshakes:
- REST API controller for starting profile download via activation code.
- Automatic deployment configuration via systemd service on the Raspberry Pi.
- **Go to [lpa-simulator/README.md](lpa-simulator/README.md) for build, testing, and deployment instructions.**

