# Website Infrastructure & Dynamic DNS (DDNS)

This directory contains the Infrastructure as Code (IaC) and the Dynamic DNS (DDNS) script for the `hutta.in` server.

## Repository Contents
- **`dns.tf`**: Terraform file defining the GCP DNS Zone and record sets.
- **`iam.tf`**: Terraform file creating the Service Account with DNS update permissions.
- **`ddns.py`**: A zero-dependency Python script that runs on the Raspberry Pi to detect public IP changes and update the GCP DNS A record.
- **`generate_stats.py`**: Python script to collect Raspberry Pi hardware statistics and save them to `stats.json` for the frontend.

---

## Setup Instructions

### Step 1: Deploy Terraform IaC

#### 1. Prerequisites
- **Terraform** (v1.3.0 or higher) installed locally.
- **Google Cloud SDK** (`gcloud`) installed and authenticated (`gcloud auth application-default login`).
- A GCP Project with billing enabled and the **Cloud DNS API** enabled.

#### 2. Configure Variables
Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` and set your GCP Project ID:
```hcl
project_id = "your-gcp-project-id"
```

#### 3. Apply Infrastructure
Initialize Terraform and apply the plan:
```bash
terraform init
terraform plan
terraform apply
```

Upon successful completion, Terraform will print the assigned **GCP Name Servers** and the **Service Account JSON Credentials**.

#### 4. Drift Prevention (Dynamic IP)
The A record resource in `dns.tf` includes a `lifecycle` configuration:
```hcl
lifecycle {
  ignore_changes = [rrdatas]
}
```
This ensures subsequent runs of `terraform apply` will ignore dynamic DNS updates done by the python script and won't overwrite your public IP back to the default `127.0.0.1`.

---

### Step 2: Delegate DNS at your Registrar (domainz.in)

1. Log in to your control panel at [www.domainz.in](http://www.domainz.in).
2. Go to the domain management page for `hutta.in`.
3. Locate the **Name Servers** (NS) configuration.
4. Replace the existing name servers with the ones outputted by Terraform, **making sure to remove the trailing dot `.` at the end** of each address (e.g., enter `ns-cloud-a1.googledomains.com` instead of `ns-cloud-a1.googledomains.com.`).
5. Save changes. Note that DNS delegation can take up to 24–48 hours to propagate worldwide.

---

### Step 3: Setup DDNS on Raspberry Pi

#### 1. Extract the Service Account Key
Generate and save the service account credentials from Terraform:
```bash
terraform output -raw ddns_private_key > service-account-key.json
```
> [!WARNING]
> Keep `service-account-key.json` secure. Do not commit it to source control.

Copy `service-account-key.json` and `ddns.py` to your Raspberry Pi:
```bash
scp ddns.py service-account-key.json rbpi@your-raspberry-pi-ip:/home/rbpi/website/
```

#### 2. Prerequisites
The script uses only standard Python 3 libraries and the pre-installed `openssl` command. **No external python packages (such as `google-cloud-dns` or `requests`) are required!**

Ensure your Raspberry Pi has `openssl` installed:
```bash
ssh rbpi@your-raspberry-pi-ip
openssl version
```

#### 3. Run the Script
Test the script manually to ensure it successfully reads the credentials, authenticates via `openssl`, and updates GCP DNS:
```bash
cd /home/rbpi/website
python3 ddns.py
```
*(You should see a message indicating the A record was created/updated or is already up-to-date).*

---

### Step 4: Automate the DDNS Updates

To make sure your website stays online if your ISP rotates your home IP, run the script periodically. You can use either a **Systemd Timer** (recommended) or a **Cron Job**.

#### Option A: Systemd Service & Timer (Recommended)
This method is modern, robust, and logs directly to the system journal.

1. Create a service file `/etc/systemd/system/gcp-ddns.service`:
```ini
[Unit]
Description=GCP Cloud DNS Dynamic DNS Updater
After=network-online.target

[Service]
Type=oneshot
User=rbpi
WorkingDirectory=/home/rbpi/website
ExecStart=/usr/bin/python3 /home/rbpi/website/ddns.py
Environment="DDNS_DOMAIN=hutta.in."
Environment="DDNS_ZONE=hutta-in-zone"
Environment="DDNS_CREDENTIALS=/home/rbpi/website/service-account-key.json"
```

2. Create a timer file `/etc/systemd/system/gcp-ddns.timer`:
```ini
[Unit]
Description=Run GCP Cloud DNS DDNS Updater every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min

[Install]
WantedBy=timers.target
```

3. Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gcp-ddns.timer
```

4. Check the logs:
```bash
journalctl -u gcp-ddns.service
```

---

#### Option B: Cron Job (Simpler)
Open the crontab editor:
```bash
crontab -e
```
Add the following line to run the script every 10 minutes:
```cron
*/10 * * * * cd /home/rbpi/website && DDNS_DOMAIN="hutta.in." DDNS_ZONE="hutta-in-zone" DDNS_CREDENTIALS="/home/rbpi/website/service-account-key.json" /usr/bin/python3 /home/rbpi/website/ddns.py >> /home/rbpi/website/ddns.log 2>&1
```
