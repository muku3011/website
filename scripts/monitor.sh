#!/bin/bash
# Raspberry Pi Lightweight System & Service Monitor with ntfy.sh Alerts
# Generates a beautiful glassmorphic status dashboard at /var/www/html/status.html

set -e

# Output path
OUTPUT_FILE="/var/www/html/status.html"

# Alert configuration
NTFY_TOPIC="hutta_rsp_alerts_muku3011"

# Helper for service status check
check_service() {
    if systemctl is-active --quiet "$1" 2>/dev/null; then
        echo "active"
    else
        echo "inactive"
    fi
}

# Helper for port binding check
check_port() {
    if ss -tuln 2>/dev/null | grep -q ":$1 "; then
        echo "open"
    else
        echo "closed"
    fi
}

# Send alert notification via ntfy.sh
send_ntfy_alert() {
    local title="$1"
    local message="$2"
    local priority="$3" # min, low, default, high, urgent
    local tags="$4"     # emojis/tags (e.g. warning, white_check_mark)
    
    echo "Sending Alert: $title - $message"
    curl -s \
         -H "Title: $title" \
         -H "Priority: $priority" \
         -H "Tags: $tags" \
         -d "$message" \
         "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1 || true
}

# De-duplicated state evaluator
evaluate_alert_state() {
    local component_name="$1"
    local current_failed="$2" # "true" or "false"
    local alert_message="$3"
    local recovery_message="$4"
    local priority="$5"
    local tag_fail="$6"
    local tag_ok="$7"
    
    local state_file="/tmp/rsp_alert_state_${component_name}"
    
    if [ "$current_failed" = "true" ]; then
        if [ ! -f "$state_file" ]; then
            # Issue first detected: send warning and create lock file
            send_ntfy_alert "⚠️ RSP Alert: $component_name" "$alert_message" "$priority" "$tag_fail"
            touch "$state_file"
        fi
    else
        if [ -f "$state_file" ]; then
            # Recovered: send resolution notice and delete lock file
            send_ntfy_alert "✅ RSP Resolved: $component_name" "$recovery_message" "default" "$tag_ok"
            rm -f "$state_file"
        fi
    fi
}

# 1. Gather System Statistics
uptime_str=$(uptime -p)
load_avg=$(cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}' || echo "N/A")
cpu_usage=$(top -bn1 2>/dev/null | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
if [ -z "$cpu_usage" ]; then
    cpu_usage="0.0"
fi

mem_total=$(free -m 2>/dev/null | awk '/Mem:/ {print $2}' || echo "1024")
mem_used=$(free -m 2>/dev/null | awk '/Mem:/ {print $3}' || echo "512")
mem_percent=$((mem_used * 100 / mem_total))

disk_percent=$(df -h / 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' || echo "50")
disk_free=$(df -h / 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")

# 2. Gather Service States
smdp_status=$(check_service smdp-plus)
lpa_status=$(check_service lpa-simulator)
blog_status=$(check_service blog-service)
postgres_status=$(check_service postgresql)
fail2ban_status=$(check_service fail2ban)

if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw_status="active"
else
    ufw_status="inactive"
fi

# 3. Gather Port Binding States
smdp_port=$(check_port 8092)
lpa_port=$(check_port 8093)
blog_port=$(check_port 8094)
postgres_port=$(check_port 5432)

# 4. Trigger Alerts based on service and resource states
smdp_failed="false"
if [ "$smdp_status" != "active" ]; then smdp_failed="true"; fi
evaluate_alert_state "smdp-plus" "$smdp_failed" "SM-DP+ Engine has stopped running (state: $smdp_status)" "SM-DP+ Engine has recovered and is now active." "high" "rotating_light" "white_check_mark"

lpa_failed="false"
if [ "$lpa_status" != "active" ]; then lpa_failed="true"; fi
evaluate_alert_state "lpa-simulator" "$lpa_failed" "LPA Simulator has stopped running (state: $lpa_status)" "LPA Simulator has recovered and is now active." "high" "rotating_light" "white_check_mark"

blog_failed="false"
if [ "$blog_status" != "active" ]; then blog_failed="true"; fi
evaluate_alert_state "blog-service" "$blog_failed" "Blog Service has stopped running (state: $blog_status)" "Blog Service has recovered and is now active." "high" "rotating_light" "white_check_mark"

postgres_failed="false"
if [ "$postgres_status" != "active" ]; then postgres_failed="true"; fi
evaluate_alert_state "postgresql" "$postgres_failed" "PostgreSQL DB has stopped running (state: $postgres_status)" "PostgreSQL DB has recovered and is now active." "high" "rotating_light" "white_check_mark"

mem_failed="false"
if [ "$mem_percent" -gt 90 ]; then mem_failed="true"; fi
evaluate_alert_state "high-memory" "$mem_failed" "High memory usage detected: $mem_percent% used ($mem_used MB / $mem_total MB)" "Memory usage has normalized below 90%." "default" "warning" "white_check_mark"

disk_failed="false"
if [ "$disk_percent" -gt 90 ]; then disk_failed="true"; fi
evaluate_alert_state "high-disk" "$disk_failed" "High disk usage on root: $disk_percent% used (Free: $disk_free)" "Disk usage has normalized below 90%." "high" "warning" "white_check_mark"

# 5. Gather Security Log Stats
ssh_failures=$(sudo journalctl _SYSTEMD_UNIT=ssh.service --since "24 hours ago" 2>/dev/null | grep -c "Failed password" || echo "0")
last_upgrade=$(tail -n 10 /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null | grep -i "allowed origins" | tail -n 1 || echo "Unattended Upgrades Active")

# 6. Timestamp
timestamp=$(date +"%Y-%m-%d %H:%M:%S %Z")

# 7. Generate HTML Status Dashboard (Hutta.in Theme)
cat <<EOF > "$OUTPUT_FILE"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
    <title>Hutta RSP Node Status</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Hutta Portal Design System Token Mapping */
            --bg-gradient-start: hsl(222, 24%, 7%);
            --bg-gradient-end: hsl(222, 24%, 12%);
            --card-bg: hsla(222, 24%, 15%, 0.6);
            --card-border: hsla(222, 20%, 25%, 0.4);
            
            --text-primary: hsl(210, 40%, 98%);
            --text-secondary: hsl(210, 20%, 75%);
            
            --primary-glow: hsl(212, 100%, 60%);
            --secondary-glow: hsl(275, 90%, 65%);
            --status-green: hsl(145, 80%, 50%);
            --status-red: hsl(14, 90%, 60%);
            --border-radius: 16px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
            background-attachment: fixed;
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem 1rem;
            overflow-x: hidden;
        }

        .background-glow {
            position: absolute;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            filter: blur(150px);
            z-index: -1;
            opacity: 0.25;
        }

        .glow-1 {
            background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
            top: -100px;
            left: -100px;
        }

        .glow-2 {
            background: radial-gradient(circle, var(--secondary-glow) 0%, transparent 70%);
            bottom: -100px;
            right: -100px;
        }

        .container {
            width: 100%;
            max-width: 1100px;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--card-border);
            padding-bottom: 1.5rem;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .title-group h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary-glow), var(--secondary-glow));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .title-group p {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-top: 0.25rem;
        }

        .timestamp-badge {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--card-border);
            padding: 0.5rem 1rem;
            border-radius: 50px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-family: monospace;
        }

        .grid-3 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 1.5rem;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--border-radius);
            padding: 1.5rem;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
            transition: border-color 0.3s ease;
        }

        .card:hover {
            border-color: rgba(255, 255, 255, 0.15);
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, var(--primary-glow), var(--secondary-glow));
        }

        .card-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .stat-item {
            margin-bottom: 1.25rem;
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .progress-bar-bg {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--primary-glow), var(--secondary-glow));
            border-radius: 4px;
            transition: width 0.5s ease-in-out;
        }

        .service-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .service-row:last-child {
            border-bottom: none;
        }

        .service-name {
            font-weight: 500;
            color: var(--text-primary);
        }

        .service-details {
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }

        .port-badge {
            font-family: monospace;
            font-size: 0.8rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            color: var(--text-secondary);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }

        .status-active { color: var(--status-green); }
        .status-active .status-dot { background-color: var(--status-green); box-shadow: 0 0 10px var(--status-green); }
        
        .status-inactive { color: var(--status-red); }
        .status-inactive .status-dot { background-color: var(--status-red); box-shadow: 0 0 10px var(--status-red); }

        .security-badge-grid {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .security-metric {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            padding: 0.75rem 1rem;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .security-label {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .security-value {
            font-weight: 600;
        }

        .security-ok { color: var(--status-green); }
        .security-warn { color: #f59e0b; }

        footer {
            margin-top: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.85rem;
            border-top: 1px solid var(--card-border);
            padding-top: 1.5rem;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="background-glow glow-1"></div>
    <div class="background-glow glow-2"></div>

    <div class="container">
        <header>
            <div class="title-group">
                <h1>Hutta RSP Node Status</h1>
                <p>Uptime: $uptime_str | Load Average: $load_avg</p>
            </div>
            <div class="timestamp-badge">
                Last updated: $timestamp
            </div>
        </header>

        <div class="grid-3">
            <!-- Card 1: Resources -->
            <div class="card">
                <div class="card-title">System Resources</div>
                
                <div class="stat-item">
                    <div class="stat-header">
                        <span>CPU Usage</span>
                        <span>$cpu_usage%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: $cpu_usage%;"></div>
                    </div>
                </div>

                <div class="stat-item">
                    <div class="stat-header">
                        <span>Memory Usage</span>
                        <span>$mem_used MB / $mem_total MB ($mem_percent%)</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: $mem_percent%;"></div>
                    </div>
                </div>

                <div class="stat-item" style="margin-bottom: 0;">
                    <div class="stat-header">
                        <span>Disk Space (Root /)</span>
                        <span>Free: $disk_free ($disk_percent% used)</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: $disk_percent%;"></div>
                    </div>
                </div>
            </div>

            <!-- Card 2: Services -->
            <div class="card">
                <div class="card-title">eSIM Platform Services</div>
                
                <div class="service-row">
                    <span class="service-name">SM-DP+ Engine</span>
                    <div class="service-details">
                        <span class="port-badge">8092</span>
                        <div class="status-indicator status-$smdp_status">
                            <div class="status-dot"></div>
                            <span>$smdp_status</span>
                        </div>
                    </div>
                </div>

                <div class="service-row">
                    <span class="service-name">LPA Simulator</span>
                    <div class="service-details">
                        <span class="port-badge">8093</span>
                        <div class="status-indicator status-$lpa_status">
                            <div class="status-dot"></div>
                            <span>$lpa_status</span>
                        </div>
                    </div>
                </div>

                <div class="service-row">
                    <span class="service-name">Blog Backend</span>
                    <div class="service-details">
                        <span class="port-badge">8094</span>
                        <div class="status-indicator status-$blog_status">
                            <div class="status-dot"></div>
                            <span>$blog_status</span>
                        </div>
                    </div>
                </div>

                <div class="service-row">
                    <span class="service-name">PostgreSQL DB</span>
                    <div class="service-details">
                        <span class="port-badge">5432</span>
                        <div class="status-indicator status-$postgres_status">
                            <div class="status-dot"></div>
                            <span>$postgres_status</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Card 3: Security & Firewall -->
            <div class="card">
                <div class="card-title">Security & Active Hardening</div>
                
                <div class="security-badge-grid">
                    <div class="security-metric">
                        <span class="security-label">UFW Firewall</span>
                        <div class="status-indicator status-$ufw_status">
                            <div class="status-dot"></div>
                            <span>$ufw_status</span>
                        </div>
                    </div>

                    <div class="security-metric">
                        <span class="security-label">Fail2ban Service</span>
                        <div class="status-indicator status-$fail2ban_status">
                            <div class="status-dot"></div>
                            <span>$fail2ban_status</span>
                        </div>
                    </div>

                    <div class="security-metric">
                        <span class="security-label">Failed SSH Logins (24h)</span>
                        <span class="security-value \$( [ \"\$ssh_failures\" -eq \"0\" ] && echo \"security-ok\" || echo \"security-warn\" )">\$ssh_failures attempts</span>
                    </div>

                    <div class="security-metric" style="flex-direction: column; align-items: flex-start; gap: 0.25rem;">
                        <span class="security-label">Last Auto-Update Event</span>
                        <span class="security-value" style="font-size: 0.8rem; color: var(--text-secondary); word-break: break-all;">$last_upgrade</span>
                    </div>
                </div>
            </div>
        </div>

        <footer>
            Hutta RSP (eSIM Remote Provisioning) Secure Node | Built according to GSMA SGP.22 & SAS FS.18 standards.
        </footer>
    </div>
</body>
</html>
EOF

echo "Status dashboard generated successfully at $OUTPUT_FILE"
