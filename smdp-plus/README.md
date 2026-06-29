# SM-DP+ Server Installation & Configuration (GSMA SGP.22 v3.1)

This directory contains a lightweight, modular reference implementation of a GSMA SGP.22 v3.1 compliant **Subscription Manager Data Preparation+ (SM-DP+)** server in Java 21 using Spring Boot 3.3.0, optimized to run bare-metal on a Raspberry Pi.

## System Architecture

```mermaid
flowchart LR
    subgraph Operator Systems
        MNO["Mobile Network Operator (MNO)"]
    end

    subgraph SM-DP+ Server (Port 8092)
        ES2["ES2+ Interface (Admin/Orders)"]
        ES9["ES9+ Interface (LPA Client)"]
        DB[("Database (PostgreSQL / smdpdb)")]
    end

    subgraph Device
        LPA["Local Profile Assistant (LPA)"]
    end

    MNO -->|1. Create/Order Profile| ES2
    LPA -->|2. Authenticate & Download| ES9
    ES2 --> DB
    ES9 --> DB
```

## Contents

- **[pom.xml](file:///Users/muku/Projects/website/smdp-plus/pom.xml)**: The Maven dependency configuration (Spring Web, JPA, H2 Database, Lombok, BouncyCastle, and Jackson YAML).
- **[setup_pi_service.sh](file:///Users/muku/Projects/website/smdp-plus/setup_pi_service.sh)**: A one-time setup script to create the deployment directory `/home/rbpi/smdp-plus` and register the `smdp-plus.service` systemd service.
- **[Source Code](file:///Users/muku/Projects/website/smdp-plus/src/main/java/in/hutta/smdp/)**: The core Java implementation, including REST controllers, business services, DTO mappings, and the pluggable cryptographic session manager.
- **[Tests](file:///Users/muku/Projects/website/smdp-plus/src/test/java/in/hutta/smdp/)**: Integration test suite verifying the eSIM profile provisioning lifecycle (`SmdpIntegrationTest.java`).

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
ssh rbpi@hutta.in "mkdir -p /home/rbpi/smdp-plus"

# Copy the setup script
scp smdp-plus/setup_pi_service.sh rbpi@hutta.in:/home/rbpi/smdp-plus/setup_pi_service.sh

# Run the script to register and enable the service
ssh rbpi@hutta.in "chmod +x /home/rbpi/smdp-plus/setup_pi_service.sh && sudo /home/rbpi/smdp-plus/setup_pi_service.sh"
```

---

## 2. Configuration & Paths

- **JAR Binary Location**: `/home/rbpi/smdp-plus/smdp-plus.jar`
- **Port Configuration**: `8092` (configured in [application.yml](file:///Users/muku/Projects/website/smdp-plus/src/main/resources/application.yml))
- **Systemd Service**: `smdp-plus.service`
  - Start/Stop: `sudo systemctl [start|stop|restart] smdp-plus`
  - Status: `sudo systemctl status smdp-plus`
  - Logs: `sudo journalctl -u smdp-plus -f -n 100`
- **H2 In-Memory Console**: `http://<your-pi-ip>:8092/h2-console`
  - JDBC URL: `jdbc:h2:mem:smdpdb`
  - Username: `sa` / Password: `password`

---

## 3. Profile Management & TS.48 Test Profiles Import

The database is initially seeded with sample profiles using [data.sql](file:///Users/muku/Projects/website/smdp-plus/src/main/resources/data.sql) on boot. You can also import official generic GSMA test profiles (such as those from the TS.48 specification) dynamically at runtime.

### Importing GSMA TS.48 Test Profiles
1. **Download the profiles**:
   Clone the public repository containing the generic profile packages:
   ```bash
   git clone https://github.com/GSMATerminals/Generic-eUICC-Test-Profile-for-Device-Testing-Public.git
   ```
2. **Convert the `.der` file to Base64**:
   Convert the binary ASN.1 DER-encoded profile to a single-line Base64 payload:
   - *macOS/Linux*:
     ```bash
     base64 -i path/to/profile.der -o profile.b64
     ```
   - *Windows (PowerShell)*:
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/profile.der")) | Out-File -Encoding utf8 profile.b64
     ```
3. **POST the Profile to the Admin API**:
   Import the profile payload using the Admin API endpoint `/gsma/rsp/v2/admin/importProfile`:
   ```bash
   curl -X POST http://<your-pi-ip>:8092/gsma/rsp/v2/admin/importProfile \
     -H "Content-Type: application/json" \
     -d "{
       \"iccid\": \"8900000000000000001f\",
       \"profilePayload\": \"$(cat profile.b64 | tr -d '\n\r')\"
     }"
   ```

---

## 4. Remote SIM Provisioning (RSP) REST APIs

The server implements the standard SGP.22 endpoints under `HTTP POST` mapping:

### 1. ES2+ Interface (Operator Integration)
Used by operators to order and release eSIM profiles for a given EID.
- **Download Order**:
  ```text
  POST /gsma/rsp/v2/es2plus/downloadOrder
  ```
- **Confirm Order**:
  ```text
  POST /gsma/rsp/v2/es2plus/confirmOrder
  ```
- **Release Profile**:
  ```text
  POST /gsma/rsp/v2/es2plus/releaseProfile
  ```
- **Cancel Order**:
  ```text
  POST /gsma/rsp/v2/es2plus/cancelOrder
  ```

### 2. ES9+ Interface (LPA Device Integration)
Used by the Local Profile Assistant (LPA) on the user's device to authenticate and download the Bound Profile Package.
- **Initiate Authentication**:
  ```text
  POST /gsma/rsp/v2/es9plus/initiateAuthentication
  ```
- **Authenticate Client**:
  ```text
  POST /gsma/rsp/v2/es9plus/authenticateClient
  ```
- **Get Bound Profile Package (BPP)**:
  ```text
  POST /gsma/rsp/v2/es9plus/getBoundProfilePackage
  ```
- **Cancel Session**:
  ```text
  POST /gsma/rsp/v2/es9plus/cancelSession
  ```



## 5. Running Tests

To run the complete automated integration test suite (incorporating RSP profile provisioning flows and Authelia user CRUD/password hashing operations):
```bash
mvn clean test
```

---

## 6. Automated CI/CD (GitHub Actions)

We use the self-hosted GitHub Actions runner on the Raspberry Pi to automate deployment.

### Deployment Workflow
The workflow **[deploy-smdp.yml](file:///Users/muku/Projects/website/.github/workflows/deploy-smdp.yml)** triggers on every push to `main` targeting files in `smdp-plus/**`:
1. Checks out the code inside the runner's workspace on the Pi.
2. Compiles and packages the Spring Boot application using Maven:
   ```bash
   mvn clean package -DskipTests
   ```
3. Copies the output JAR file to the application home directory: `/home/rbpi/smdp-plus/smdp-plus.jar`.
4. Gracefully restarts the application service:
   ```bash
   sudo systemctl restart smdp-plus.service
   ```
