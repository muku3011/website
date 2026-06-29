# Website Frontend & Raspberry Pi Deployment

This directory contains the frontend website assets (HTML/CSS/JS) for the `hutta.in` server, featuring the eSIM Profiles Management dashboard and the Authelia User Administration panel.

## Deployment & Architecture

```mermaid
flowchart TD
    subgraph Web Clients
        Browser["User Browser"]
    end

    subgraph Raspberry Pi (Home Server)
        subgraph Reverse Proxy & Web Server (Apache)
            Apache["Apache HTTP Server"]
            OIDC["mod_auth_openidc"]
        end

        subgraph Authentication Service
            Authelia["Authelia Service (Port 9091)"]
            AutheliaLDAP["Authelia LDAP Service (Port 8094)"]
        end

        subgraph Web Apps
            Dashboard["Static Dashboard Files (Port 80/443)"]
            LPA["LPA Simulator (Port 8093)"]
            SMDP["SM-DP+ Server (Port 8092)"]
        end
    end

    Browser -->|HTTPS request| Apache
    Apache --> OIDC
    OIDC -->|Authenticate if needed| Authelia
    OIDC -->|Authorized | Dashboard
    OIDC -->|Forward API request| LPA
    OIDC -->|Forward API request| SMDP
    OIDC -->|Forward User API request| AutheliaLDAP
```

## Repository Contents
- **`index.html`**: The main landing page.
- **`profiles.html`**: The eSIM profiles management registry and LPA download simulator.
- **`admin.html`**: The Authelia SSO user directory management interface.
- **`index.css` / `portfolio.css`**: Styling sheets.
- **`app.js` / `admin.js` / `portfolio.js`**: Frontend interactivity and API communication logic.

---

## Setup & Deployment Instructions

### Step 1: Router Configuration (Port Forwarding & Static IP)

For the public to access your website hosted on the Raspberry Pi from outside your home network, you must configure two settings on your home router:

#### 1. Configure DHCP Reservation (Static Local IP)
By default, your home router dynamically assigns IP addresses to devices. If your Raspberry Pi restarts, its local IP might change, breaking port forwarding.
1. Log in to your home router's admin panel (typically at `192.168.1.1` or `192.168.0.1`).
2. Navigate to the **DHCP Server settings** or **LAN settings**.
3. Bind your Raspberry Pi’s MAC address to a fixed local IP address (e.g., `192.168.1.100`).

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
Move the files to Apache's default serving directory, clear any placeholders, and assign read/execute permissions:
```bash
# Remove default index.html
sudo rm -f /var/www/html/index.html

# Copy your website assets to the web root
sudo cp /home/rbpi/website/index.html /home/rbpi/website/index.css /home/rbpi/website/portfolio.js /home/rbpi/website/app.js /home/rbpi/website/profiles.html /home/rbpi/website/admin.html /home/rbpi/website/admin.js /home/rbpi/website/custom-authelia.css /home/rbpi/website/custom-authelia.js /var/www/html/

# Assign proper ownership and permissions
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/

# Restart Apache
sudo systemctl restart apache2
```

#### 4. Configure Live Server Metrics
To populate the dashboard with actual, real-time Raspberry Pi hardware statistics:
1. Make sure `generate_stats.py` (located in the [website-iac/](../website-iac/generate_stats.py) folder) is executable:
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

### Step 3: Configure HTTPS (SSL/TLS) via Let's Encrypt

Secure your website with an SSL/TLS certificate to enable HTTPS access.

#### 1. Install Certbot
On the Raspberry Pi, install the Certbot client and its Apache integration plugin:
```bash
sudo apt update && sudo apt install -y certbot python3-certbot-apache
```

#### 2. Obtain Certificate & Automate Redirections
Run the interactive Certbot setup. Choose option to redirect HTTP traffic to HTTPS:
```bash
sudo certbot --apache -d hutta.in
```

#### 3. Automatic Renewals
Certbot automatically configures a systemd timer to renew your certificates twice daily:
```bash
sudo systemctl status certbot.timer
```

---

### Step 4: Automate Deployments via GitHub Actions (CI/CD)

To automatically deploy changes to your Raspberry Pi Apache server when you push to the `main` branch:

#### 1. Register the Self-Hosted Runner on the Pi
1. Go to your GitHub repository > **Settings** > **Actions** > **Runners**.
2. Click **New self-hosted runner** and select **Linux** and **ARM64**.
3. SSH into your Raspberry Pi and run the setup commands:
   ```bash
   mkdir actions-runner && cd actions-runner
   # (Execute the curl and config commands shown in your GitHub instructions)
   ```

#### 2. Configure the Runner as a Background Service
To run it permanently in the background and auto-start it on boot:
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

#### 3. Pipeline Execution
The workflow is defined at [deploy.yml](../.github/workflows/deploy.yml). When you push changes to the `main` branch under the `website/` folder, the pipeline automatically checks out your repository on the Pi and copies the files directly to Apache's web root (`/var/www/html/`).
