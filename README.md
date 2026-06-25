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

This repository is split into two main projects:

### 1. [Infrastructure as Code & DDNS Automation (website-iac/)](website-iac/README.md)
Contains all GCP infrastructure provisioning and backend Dynamic DNS setup:
- Terraform configurations (`dns.tf`, `iam.tf`, `variables.tf`, etc.) for managing DNS zones and records.
- Zero-dependency Dynamic DNS Python script (`ddns.py`).
- Setup instructions for automating DDNS updates on the Raspberry Pi using systemd or cron.
- **Go to [website-iac/README.md](website-iac/README.md) for setup and deployment instructions.**

### 2. [Website Frontend (website/)](website/README.md)
Contains the server dashboard and portfolio site assets deployed on the Raspberry Pi:
- Frontend code (`index.html`, `index.css`, `app.js`, `dashboard.html`) for serving system statistics, container statuses, and smart controls.
- Deployment configuration for Apache HTTP Server and HTTPS (SSL/TLS) via Let's Encrypt.
- GitHub Actions CI/CD setup via self-hosted runners.
- **Go to [website/README.md](website/README.md) for frontend deployment and automation setup instructions.**
