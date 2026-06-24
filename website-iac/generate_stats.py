#!/usr/bin/env python3
import json
import os
import sys
import shutil
import multiprocessing

def get_cpu_pct():
    try:
        # Load average in the last 1 minute
        with open('/proc/loadavg', 'r') as f:
            load_1m = float(f.read().split()[0])
        cores = multiprocessing.cpu_count()
        return min(100, int((load_1m / cores) * 100))
    except Exception:
        # Fallback for macOS or dev testing
        try:
            return int(os.getloadavg()[0] * 10)
        except Exception:
            return 10

def get_mem_pct():
    try:
        with open('/proc/meminfo', 'r') as f:
            lines = f.readlines()
        mem_total = 0
        mem_avail = 0
        for line in lines:
            parts = line.split()
            if parts[0] == 'MemTotal:':
                mem_total = int(parts[1])
            elif parts[0] == 'MemAvailable:':
                mem_avail = int(parts[1])
        if mem_total > 0:
            mem_used = mem_total - mem_avail
            return int((mem_used / mem_total) * 100)
    except Exception:
        pass
    return 45 # Default fallback

def get_cpu_temp():
    # Raspberry Pi standard thermal path
    temp_paths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/hwmon/hwmon0/temp1_input'
    ]
    for path in temp_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    temp_raw = int(f.read().strip())
                    # Some platforms report in millidegrees, some in degrees
                    if temp_raw > 1000:
                        return round(temp_raw / 1000.0, 1)
                    return round(float(temp_raw), 1)
            except Exception:
                pass
    return 42.0 # Default fallback

def get_disk_stats():
    try:
        total, used, free = shutil.disk_usage("/")
        disk_pct = int((used / total) * 100)
        disk_used_gb = round(used / (1024**3), 1)
        disk_total_gb = round(total / (1024**3), 1)
        return disk_pct, disk_used_gb, disk_total_gb
    except Exception:
        return 25, 16.0, 64.0

def main():
    # Ensure correct target directory
    output_path = "/var/www/html/stats.json"
    
    # Calculate stats
    disk_pct, disk_used, disk_total = get_disk_stats()
    
    stats = {
        "cpu": get_cpu_pct(),
        "memory": get_mem_pct(),
        "temp": get_cpu_temp(),
        "disk_pct": disk_pct,
        "disk_used_gb": disk_used,
        "disk_total_gb": disk_total
    }
    
    try:
        # Create directory if it doesn't exist (e.g. during local testing)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(stats, f, indent=2)
            
        print(f"Stats successfully written to {output_path}: {stats}")
    except Exception as e:
        print(f"Error writing stats: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
