# eSIM Local Profile Assistant (LPA) Simulator (GSMA SGP.22 v3.1)

This directory contains a lightweight, modular reference implementation of a GSMA SGP.22 v3.1 compliant **Local Profile Assistant (LPA)** simulator in Java 21 using Spring Boot 3.3.0, optimized to run bare-metal on a Raspberry Pi. It simulates the client-side Remote SIM Provisioning (RSP) flow, acting as the device that downloads, validates, and installs eSIM profiles from the SM-DP+ server.

## Contents

- **[pom.xml](file:///Users/muku/Projects/website/lpa-simulator/pom.xml)**: The Maven dependency configuration (Spring Web, Lombok, and Spring Boot Starter Client).
- **[setup_pi_service.sh](file:///Users/muku/Projects/website/lpa-simulator/setup_pi_service.sh)**: A one-time setup script to create the deployment directory `/home/rbpi/lpa-simulator` and register the `lpa-simulator.service` systemd service.
- **[Source Code](file:///Users/muku/Projects/website/lpa-simulator/src/main/java/in/hutta/lpa/)**: The core Java implementation, including REST controllers, download services, and DTO definitions.

---

## 1. Setup & Installation

### Prerequisites
- Java 21 JDK (OpenJDK 21) installed on the Raspberry Pi.
- Maven 3.x installed on the Raspberry Pi.
- A self-hosted GitHub Actions runner active on the Pi (for automated deployments).

### Step 1: Install Dependencies (Manual)
Log into your Raspberry Pi and install the JDK 21 compiler and Maven:
```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk maven
```

### Step 2: Register Systemd Service
Run these commands to copy the setup script to the Pi and register the background systemd service:
```bash
# Create directory if not exists
ssh rbpi@hutta.in "mkdir -p /home/rbpi/lpa-simulator"

# Copy the setup script
scp lpa-simulator/setup_pi_service.sh rbpi@hutta.in:/home/rbpi/lpa-simulator/setup_pi_service.sh

# Run the script to register and enable the service
ssh rbpi@hutta.in "chmod +x /home/rbpi/lpa-simulator/setup_pi_service.sh && sudo /home/rbpi/lpa-simulator/setup_pi_service.sh"
```

---

## 2. Configuration & Paths

- **JAR Binary Location**: `/home/rbpi/lpa-simulator/lpa-simulator.jar`
- **Port Configuration**: `8093` (configured in [application.yml](file:///Users/muku/Projects/website/lpa-simulator/src/main/resources/application.yml))
- **Systemd Service**: `lpa-simulator.service`
  - Start/Stop: `sudo systemctl [start|stop|restart] lpa-simulator`
  - Status: `sudo systemctl status lpa-simulator`
  - Logs: `sudo journalctl -u lpa-simulator -f -n 100`

---

## 3. LPA Simulation REST API

The simulator exposes a REST API that triggers the client-side eSIM profile download sequence:

### Trigger eSIM Download
Initiates the standard SGP.22 ES9+ remote SIM provisioning handshake with the target SM-DP+ server (by calling `initiateAuthentication`, `authenticateClient`, and `getBoundProfilePackage` in sequence), and mocks installing the downloaded Bound Profile Package.

- **URL**: `POST /lpa/download`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "activationCode": "LPA:1$<smdpAddress>$<matchingId>"
  }
  ```
  - *Example*:
    ```json
    {
      "activationCode": "LPA:1$hutta.in$89000123456789012341"
    }
    ```
- **Response Body**:
  ```json
  {
    "success": true,
    "message": "Profile downloaded successfully",
    "transactionId": "7844c9c547fb43158c6a9498d42a9a60",
    "iccid": "89000123456789012341",
    "boundProfilePackageSize": 22140,
    "boundProfilePackage": "MOCK_BPP_BASE64_PAYLOAD..."
  }
  ```

### Manual Trigger via curl
```bash
curl -X POST http://<your-pi-ip>:8093/lpa/download \
  -H "Content-Type: application/json" \
  -d '{"activationCode": "LPA:1$hutta.in$89000123456789012341"}'
```
