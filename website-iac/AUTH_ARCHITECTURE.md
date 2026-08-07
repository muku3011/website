# Authentication & Authorization Architecture (Single & Multi-Cluster Setup)

This document specifies the complete **Authentication (AuthN)** and **Authorization (AuthZ)** architecture for the `hutta.in` consumer/IoT eSIM platform across single and multi-cluster Kubernetes deployments.

---

## 1. High-Level Multi-Cluster Identity & Security Architecture

```mermaid
flowchart TD
    subgraph External ["1. End-Users, Devices & Operators"]
        Browser["User Web Browsers"]
        LPA_Device["eSIM Devices (LPA/IPA)"]
        Operator["Operator API Clients"]
    end

    subgraph Cluster1 ["2. Primary Edge K3s Cluster (Raspberry Pi / On-Prem)"]
        Traefik["Traefik Ingress Controller (TLS 1.3 / mTLS)"]
        IP_Middleware["Traefik IPAllowList Middleware (192.168.1.0/24 ONLY)"]
        Keycloak["Keycloak SSO Engine (auth.hutta.in)"]
        
        subgraph Core1 ["Core eSIM Microservices (OIDC JWT Protected)"]
          SMDP1["SM-DP+ eSIM Server (:8092)"]
          LPA1["LPA Simulator (:8093)"]
          Blog1["Blog Service (:8094)"]
          Mon1["Sentinel Monitor (:8095)"]
        end

        DB1["PostgreSQL Tier (:5432)"]
    end

    subgraph Cluster2 ["3. Secondary / Cloud Failover Cluster"]
        Ingress2["Secondary Ingress Controller"]
        
        subgraph Core2 ["Failover Microservices"]
          SMDP2["SM-DP+ eSIM Server (:8092)"]
          Blog2["Blog Service (:8094)"]
        end

        DB2["PostgreSQL Replicated Database"]
    end

    Browser -->|1. Public OIDC Login & Portal| Traefik
    Browser -->|2. Keycloak Admin Console /admin ONLY| IP_Middleware
    IP_Middleware -->|3. Allow 192.168.1.0/24 ONLY| Keycloak
    
    LPA_Device -->|4. GSMA Root CI mTLS| SMDP1
    Operator -->|5. Client Credentials JWT| Keycloak

    Traefik -->|6. Public APIs Protected by OIDC JWT| Core1
    Core1 -->|7. K8s ServiceAccount Auth| DB1

    Keycloak -.->|8. Central IdP Sync| Ingress2
    Ingress2 --> Core2
```

---

## 2. Ingress & Access Policy Matrix

| Route & Path | Target Service | Access Level | Protection Mechanism |
|---|---|---|---|
| **Keycloak Admin Console** (`auth.hutta.in/admin/*`, `/realms/master/*`) | `keycloak-service` | **Home IP Subnet Only** (`192.168.1.0/24`) | Traefik `IPAllowList` Middleware (`403 Forbidden` for public IPs) |
| **Keycloak Public OIDC** (`auth.hutta.in/realms/hutta/*`) | `keycloak-service` | **Public Internet** | SSL/TLS + PKCE / OAuth2 Standards |
| **Microservice APIs** (`hutta.in/api/*`) | `smdp-plus`, `device-simulator`, `blog-service`, `monitor-service` | **Public Internet** | Keycloak RS256 JWT Token Validation & Spring Security Roles |
| **GSMA ES9+ Device Handshake** (`hutta.in/api/smdp/es9plus/*`) | `smdp-plus-service` | **Public Internet** | GSMA Root CI Mutual TLS (mTLS) Device Certificate Validation |
| **Static Web Portal Gateway** (`hutta.in/`) | `website-portal-service` | **Public Internet** | TLS 1.3 Encryption |

---

## 3. Authentication (AuthN) Matrix by Entity

| Entity | AuthN Mechanism | Credential / Token Type | Issuer & Verification |
|---|---|---|---|
| **Human Users / Admins** | Keycloak SSO OIDC (Authorization Code Flow with PKCE) | Short-Lived JWT Access Token (15 min) + Refresh Token | Issued by `https://auth.hutta.in/realms/hutta` (RS256 Signature) |
| **API Operators / Systems** | OAuth2 Client Credentials Flow | Client ID + Secret -> JWT Access Token | Keycloak Token Endpoint (`/realms/hutta/protocol/openid-connect/token`) |
| **GSMA eSIM Devices (LPA/IPA)** | GSMA Root CI Mutual TLS (mTLS) | X.509 Device Certificate issued by GSMA Cert Authority | Validated against GSMA Root Certificate Chain inside `smdp-plus` |
| **Microservice Pods (Pod-to-Pod)** | K8s ServiceAccount Tokens / SPIFFE mTLS | ServiceAccount JWT (`/var/run/secrets/kubernetes.io/serviceaccount`) | Verified by Kubernetes API Server |
| **Multi-Cluster Federation** | Central OIDC Identity Provider | Keycloak OIDC Discovery (`/.well-known/openid-configuration`) | Keycloak as Centralized IdP across all clusters |

---

## 4. Authorization (AuthZ) & Access Control Layers

### Layer 1: Ingress Boundary Control
* **Keycloak Admin Console**: Enforces Traefik `keycloak-admin-ip-allowlist` restricting `/admin` and `/realms/master` strictly to `192.168.1.0/24`.
* **Platform APIs**: Open to public internet traffic, delegating AuthN/AuthZ to Spring Security JWT verification.

### Layer 2: Keycloak Role-Based Access Control (RBAC)
* **Realm Roles**:
  - `hutta:user`: Access consumer profile download tools (`/tools.html`).
  - `hutta:operator`: Access ES2+ reservation & profile release APIs (`/api/smdp/es2plus/*`).
  - `hutta:admin`: Full administrative control across Keycloak, Sentinel monitor, and database migrations.

### Layer 3: Kubernetes API Server RBAC (Multi-Cluster Least Privilege)
Each cluster defines explicit `ServiceAccount`, `Role`, and `RoleBinding` resources.

### Layer 4: Multi-Cluster Federation & GitOps Synchronization
ArgoCD synchronizes identical NetworkPolicies, RoleBindings, and Security Contexts across all clusters automatically.
