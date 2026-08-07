#!/usr/bin/env python3
import os
import sys
import json
import time
import base64
import subprocess
import tempfile
import urllib.request
import urllib.parse
import urllib.error

# Configuration (can be overridden via environment variables)
DOMAIN_NAME = os.getenv("DDNS_DOMAIN", "hutta.in.")  # Domain must end with a dot in Cloud DNS
ZONE_NAME = os.getenv("DDNS_ZONE", "hutta-in-zone")
CREDENTIALS_FILE = os.getenv("DDNS_CREDENTIALS", "service-account-key.json")

def get_current_ip():
    """Fetches the current public IP address of the machine using fallback providers."""
    urls = [
        "https://api.ipify.org",
        "https://ifconfig.me/ip",
        "https://icanhazip.com"
    ]
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (ddns-updater)'})
            with urllib.request.urlopen(req, timeout=10) as response:
                ip = response.read().decode('utf-8').strip()
                if ip:
                    return ip
        except Exception as e:
            print(f"Warning: Failed to get IP from {url}: {e}", file=sys.stderr)
            continue
    raise Exception("Error: Failed to retrieve public IP address from all providers.")

def b64url_encode(data: bytes) -> str:
    """Encodes bytes to base64url string without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def get_access_token(credentials_path):
    """Generates an OAuth2 access token using standard libraries + openssl CLI."""
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(f"Credentials file '{credentials_path}' not found at {credentials_path}.")
        
    with open(credentials_path, 'r') as f:
        creds = json.load(f)
        
    client_email = creds["client_email"]
    private_key = creds["private_key"]
    project_id = creds["project_id"]
    
    # Construct JWT Header & Claim Set
    header = {"alg": "RS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": client_email,
        "scope": "https://www.googleapis.com/auth/ndev.clouddns.readwrite",
        "aud": "https://oauth2.googleapis.com/token",
        "exp": now + 3600,
        "iat": now
    }
    
    header_b64 = b64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = b64url_encode(json.dumps(payload).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    
    # Use openssl CLI to sign the input (since standard Python has no built-in RS256 signing)
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as key_file:
        key_file.write(private_key)
        key_path = key_file.name
        
    try:
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input,
            capture_output=True,
            check=True
        )
        signature = proc.stdout
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to generate signature via openssl: {e.stderr.decode('utf-8')}")
    finally:
        try:
            os.unlink(key_path)
        except OSError:
            pass
            
    signature_b64 = b64url_encode(signature)
    jwt_token = f"{header_b64}.{payload_b64}.{signature_b64}"
    
    # Request access token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token
    }).encode('utf-8')
    
    req = urllib.request.Request(
        token_url,
        data=token_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data["access_token"], project_id
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        raise Exception(f"Failed to get OAuth token: HTTP {e.code} - {err_msg}")

def update_dns():
    """Checks the current A record in GCP Cloud DNS and updates it if it differs from current IP."""
    # Ensure domain ends with a dot
    domain_fqdn = DOMAIN_NAME if DOMAIN_NAME.endswith('.') else f"{DOMAIN_NAME}."
    
    try:
        # Get public IP
        current_ip = get_current_ip()
        print(f"Detected current public IP: {current_ip}")
        
        # Get access token and project_id
        access_token, project_id = get_access_token(CREDENTIALS_FILE)
        
        # Fetch all A records for this specific domain FQDN using query params (safer/more efficient)
        rrsets_url = f"https://dns.googleapis.com/dns/v1/projects/{project_id}/managedZones/{ZONE_NAME}/rrsets?name={urllib.parse.quote(domain_fqdn)}&type=A"
        
        req = urllib.request.Request(
            rrsets_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            }
        )
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            rrsets = data.get("rrsets", [])
            
        a_record = None
        for r in rrsets:
            if r.get("name") == domain_fqdn and r.get("type") == "A":
                a_record = r
                break
                
        # Setup change payload
        changes_url = f"https://dns.googleapis.com/dns/v1/projects/{project_id}/managedZones/{ZONE_NAME}/changes"
        
        if a_record:
            existing_ips = a_record.get("rrdatas", [])
            if len(existing_ips) == 1 and existing_ips[0] == current_ip:
                print(f"GCP Cloud DNS A record is already up to date: {current_ip}")
                return
            else:
                print(f"GCP Cloud DNS A record needs update. Existing: {existing_ips}, New: {current_ip}")
                # We extract only the standard fields from the API record to avoid sending read-only properties
                clean_deletion = {
                    "name": a_record.get("name"),
                    "type": a_record.get("type"),
                    "ttl": a_record.get("ttl"),
                    "rrdatas": a_record.get("rrdatas")
                }
                change_payload = {
                    "deletions": [clean_deletion],
                    "additions": [{
                        "name": domain_fqdn,
                        "type": "A",
                        "ttl": 300,
                        "rrdatas": [current_ip]
                    }]
                }
        else:
            print(f"No existing A record found for {domain_fqdn}. Creating a new one...")
            change_payload = {
                "additions": [{
                    "name": domain_fqdn,
                    "type": "A",
                    "ttl": 300,
                    "rrdatas": [current_ip]
                }]
            }
            
        # Post change
        req = urllib.request.Request(
            changes_url,
            data=json.dumps(change_payload).encode('utf-8'),
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req) as response:
            print("DNS A record updated successfully.")
            
    except Exception as e:
        print(f"Error updating DNS: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    update_dns()
