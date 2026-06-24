# GCP Cloud DNS with Dynamic DNS (DDNS) & Server Dashboard for hutta.in

This repository contains the Infrastructure as Code (IaC) and web assets needed to delegate DNS management for `hutta.in` to Google Cloud Platform (GCP), set up Dynamic DNS (DDNS), and run a premium status dashboard on a home-hosted Raspberry Pi.

## Repository Layout
- **`website-iac/`**: Terraform configurations, the zero-dependency Dynamic DNS python script (`ddns.py`), and system automation files.
- **`website/`**: HTML/CSS/JS dashboard frontend serving system statistics, hosted container statuses, and smart controls.

---

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

## Step 1: Deploy Terraform IaC

### 1. Prerequisites
- **Terraform** (v1.3.0 or higher) installed locally.
- **Google Cloud SDK** (`gcloud`) installed and authenticated (gcloud auth application-default login).
- A GCP Project with billing enabled and the **Cloud DNS API** enabled.

### 2. Configure Variables
Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` and set your GCP Project ID:
```hcl
project_id = "your-gcp-project-id"
```

### 3. Apply Infrastructure
Initialize Terraform and apply the plan:
```bash
terraform init
terraform plan
terraform apply
```

Upon successful completion, Terraform will print the assigned **GCP Name Servers** and the **Service Account JSON Credentials**.

### 4. Drift Prevention (Dynamic IP)
The A record resource in `dns.tf` includes a `lifecycle` configuration:
```hcl
lifecycle {
  ignore_changes = [rrdatas]
}
```
This ensures that when your Raspberry Pi dynamically updates the DNS A record with its current public IP, subsequent runs of `terraform apply` will **ignore** the difference and will not overwrite your public IP back to the default `127.0.0.1` placeholder. You can safely run Terraform to manage other records without affecting your website's availability.

---

## Step 2: Delegate DNS at your Registrar (domainz.in)

1. Log in to your control panel at [www.domainz.in](http://www.domainz.in).
2. Go to the domain management page for `hutta.in`.
3. Locate the **Name Servers** (NS) configuration.
4. Replace the existing name servers with the ones outputted by Terraform, **making sure to remove the trailing dot `.` at the end** of each address (e.g., enter `ns-cloud-a1.googledomains.com` instead of `ns-cloud-a1.googledomains.com.`).
5. Save changes. Note that DNS delegation can take up to 24–48 hours to propagate worldwide, but often works within an hour.

---

## Step 3: Setup DDNS on Raspberry Pi

### 1. Extract the Service Account Key
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

### 2. Prerequisites
The script uses only standard Python 3 libraries and the pre-installed `openssl` command. **No external python packages (such as `google-cloud-dns` or `requests`) are required!**

Ensure your Raspberry Pi has `openssl` installed (this is pre-installed on Debian and Raspberry Pi OS):
```bash
ssh rbpi@your-raspberry-pi-ip
openssl version
```

### 3. Run the Script
Test the script manually to ensure it successfully reads the credentials, authenticates via `openssl`, and updates GCP DNS:
```bash
cd /home/rbpi/website
python3 ddns.py
```
*(You should see a message indicating the A record was created/updated or is already up-to-date).*

---

## Step 4: Automate the DDNS Updates

To make sure your website stays online if your ISP rotates your home IP, run the script periodically. You can use either a **Systemd Timer** (recommended) or a **Cron Job**.

### Option A: Systemd Service & Timer (Recommended)
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

### Option B: Cron Job (Simpler)
Open the crontab editor:
```bash
crontab -e
```
Add the following line to run the script every 10 minutes (make sure path variables match):
```cron
*/10 * * * * cd /home/rbpi/website && DDNS_DOMAIN="hutta.in." DDNS_ZONE="hutta-in-zone" DDNS_CREDENTIALS="/home/rbpi/website/service-account-key.json" /usr/bin/python3 /home/rbpi/website/ddns.py >> /home/rbpi/website/ddns.log 2>&1
```
----

## Step 5: Router Configuration (Port Forwarding & Static IP)

For the public to access your website hosted on the Raspberry Pi from outside your home network, you must configure two settings on your home router:

### 1. Configure DHCP Reservation (Static Local IP)
By default, your home router dynamically assigns IP addresses to devices. If your Raspberry Pi restarts, its local IP (e.g., `192.168.1.x`) might change, which will break port forwarding.
1. Log in to your home router's admin panel (typically at `192.168.1.1` or `192.168.0.1`).
2. Navigate to the **DHCP Server settings** or **LAN settings**.
3. Look for **DHCP Reservation**, **Address Reservation**, or **Static IP Lease**.
4. Bind your Raspberry Pi’s MAC address to a fixed local IP address (e.g., `192.168.1.100`).

### 2. Configure Port Forwarding
This tells your router to send incoming web traffic from the internet to your Raspberry Pi.
1. Find the **Port Forwarding**, **Virtual Server**, or **NAT** settings in your router's panel.
2. Create forwarding rules for HTTP (port 80) and HTTPS (port 443):
   * **Rule 1 (HTTP)**:
     * External/WAN Port: `80`
     * Internal/LAN Port: `80`
     * Protocol: `TCP`
     * Internal IP: The fixed local IP of your Raspberry Pi (e.g., `192.168.1.100`)
   * **Rule 2 (HTTPS)**:
     * External/WAN Port: `443`
     * Internal/LAN Port: `443`
     * Protocol: `TCP`
     * Internal IP: The fixed local IP of your Raspberry Pi (e.g., `192.168.1.100`)

> [!NOTE]
> **NAT Loopback (Hairpin NAT)**: 
> Some home routers do not support accessing your public domain name (`hutta.in`) while you are connected to your *home Wi-Fi/network*. If the site doesn't load from home, test it by disabling Wi-Fi on a mobile phone to see if it loads successfully over mobile data (which comes from outside your home network).

---

## Step 6: Deploy Frontend Website (Apache HTTP Server)

To serve the dashboard website assets (`index.html`, `index.css`, `app.js`) from your Raspberry Pi, install and configure the Apache HTTP server.

### 1. Copy Assets to the Pi
From your local machine's project directory, copy all dashboard frontend assets to your Pi:
```bash
scp -r website/* rbpi@your-raspberry-pi-ip:/home/rbpi/website/
```

### 2. Install Apache
Log in to the Raspberry Pi and install the `apache2` package:
```bash
sudo apt update && sudo apt install -y apache2
```

### 3. Move Assets to Web Root & Configure Permissions
Move the files to Apache's default serving directory, clear any placeholders, and assign read/execute permissions to the web server user:
```bash
# Remove default index.html
sudo rm -f /var/www/html/index.html

# Copy your dashboard assets to the web root
sudo cp /home/rbpi/website/index.html /home/rbpi/website/index.css /home/rbpi/website/app.js /var/www/html/

# Assign proper ownership and permissions
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/

# Restart Apache
sudo systemctl restart apache2
```

### 4. Configure Live Server Metrics
To populate the dashboard with actual, real-time Raspberry Pi hardware statistics (CPU Load, Memory, Temperature, and Disk Usage):
1. Make sure `generate_stats.py` is executable:
   ```bash
   chmod +x /home/rbpi/website/generate_stats.py
   ```
2. Run the script once manually to verify it successfully writes metrics to `/var/www/html/stats.json`:
   ```bash
   sudo python3 /home/rbpi/website/generate_stats.py
   ```
3. Add a cron job to run the script automatically every minute. Open the crontab editor:
   ```bash
   crontab -e
   ```
   Add the following line:
   ```cron
   * * * * * /usr/bin/python3 /home/rbpi/website/generate_stats.py > /dev/null 2>&1
   ```
   *(The script runs in the background and writes statistics to `/var/www/html/stats.json`, which `app.js` fetches dynamically every 15 seconds).*

---

## Step 7: Configure HTTPS (SSL/TLS) via Let's Encrypt

Secure your website with an SSL/TLS certificate to enable HTTPS access.

### 1. Install Certbot
On the Raspberry Pi, install the Certbot client and its Apache integration plugin:
```bash
sudo apt update && sudo apt install -y certbot python3-certbot-apache
```

### 2. Obtain Certificate & Automate Redirections
Run the interactive Certbot setup. It will automatically check ownership of your domain (`hutta.in`), download the certificates, configure Apache virtual hosts, and offer to redirect HTTP traffic to HTTPS (recommended: choose Option 2):
```bash
sudo certbot --apache -d hutta.in
```

### 3. Automatic Renewals
Certbot automatically configures a systemd timer to renew your certificates twice daily. You can verify the schedule is running with:
```bash
sudo systemctl status certbot.timer
```

---

## Step 8: Automate Deployments via GitHub Actions (CI/CD)

To automatically deploy changes to your Raspberry Pi Apache server when you push to the `main` branch:

### 1. Register the Self-Hosted Runner on the Pi
1. Go to your GitHub repository > **Settings** > **Actions** > **Runners**.
2. Click **New self-hosted runner** and select **Linux** and **ARM64**.
3. SSH into your Raspberry Pi (`192.168.1.150`) and run the setup commands:
   ```bash
   mkdir actions-runner && cd actions-runner
   # (Execute the curl and config commands shown in your GitHub instructions)
   ```

### 2. Configure the Runner as a Background Service
Running `./run.sh` runs the runner in the foreground (stopping when you close your SSH session). To run it permanently in the background and auto-start it on boot:
```bash
# Register the runner as a systemd service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start
```

Useful management commands:
* **Check status:** `sudo ./svc.sh status`
* **Stop service:** `sudo ./svc.sh stop`
* **Start service:** `sudo ./svc.sh start`

### 3. Pipeline Execution
The workflow is defined at `.github/workflows/deploy.yml`. When you push changes to the `main` branch under the `website/` folder, the pipeline automatically checks out your repository on the Pi and copies the files directly to Apache's web root (`/var/www/html/`).


