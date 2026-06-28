# GCP Cloud DNS with Dynamic DNS (DDNS) & Server Dashboard for hutta.in

This repository contains the Infrastructure as Code (IaC) and web assets needed to delegate DNS management for `hutta.in` to Google Cloud Platform (GCP), set up Dynamic DNS (DDNS), and run a premium status dashboard on a home-hosted Raspberry Pi.

## Architecture Overview

```mermaid
graph TD
    Client[Web Browser] -->|dns lookup| GCP_DNS[GCP Cloud DNS]
    GCP_DNS -->|returns IP| Client
    Client -->|http/https request| RPi[Raspberry Pi (Home Network)]
    RPi -->|periodic IP check| Ipify[ipify.org / public IP check]
    RPi -->|updates DNS if IP changed| GCP_DNS
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

