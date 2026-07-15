# hutta.in Platform Guidelines

This file provides context, architectural details, and coding conventions for the `hutta.in` project. Antigravity loads these rules automatically.

## 1. Project Overview & Architecture
`hutta.in` is a secure eSIM SM-DP+ portal and developer platform hosted locally on a Raspberry Pi.
* **Frontend:** Static HTML, Vanilla CSS, and native JavaScript deployed under Apache HTTP Server.
* **Authentication:** Keycloak SSO (`auth.hutta.in`) integrated via Apache `mod_auth_openidc`. 
* **Backend Services:** Spring Boot microservices running on Java 25.
* **Databases:** PostgreSQL database server managing separate databases for each module.

## 2. Microservice & Port Registry
| Service Name | Port | Database Name | Description |
|---|---|---|---|
| **Keycloak SSO** | `8080` (loopback) | `keycloakdb` | Authentication provider |
| **SM-DP+ Server** | `8092` | `smdpdb` | GSMA SGP.22 eSIM Provisioning Server |
| **LPA Simulator** | `8093` | `lpadb` | eSIM Local Profile Assistant simulator |
| **Blog Service** | `8094` | `blogdb` | Backend for technology blog and uploads |
| **Monitor Service** | `8095` | `monitordb` | Sentinel status and version metrics engine |

## 3. Development & Styling Conventions
* **Frontend Design:** Use **Vanilla CSS** and CSS custom properties (variables) defined in `/website/css/index.css`. Avoid adding Tailwind CSS unless explicitly requested. Always make sure that the frontend is responsive and works on mobile devices. Make sure light and dark thems are considered whenever new UI is added. Make sure the UI is accessible and works with screen readers. Ensure that the UI is user-friendly and easy to navigate.  
* **JavaScript Auth & State:** Navbars and session logic are server-driven and read OIDC claims via `hutta_*` cookies (managed in `/website/js/auth-nav.js`). Do not use local storage/session storage for security tokens.
* **Java Version:** Always use **Java 25** features where appropriate.
* **Database Migrations:** Use **Flyway** for database schema versioning. Migration scripts reside under `[service]/src/main/resources/db/migration/`.
* **Code Formatting:** The project uses Spotless. Before staging Java changes, compile and apply formatting:
  ```bash
  mvn spotless:apply
  ```
* **Security:** Always follow security best practices. Never hardcode passwords or API keys. Use environment variables for sensitive information. Always use HTTPS for secure communication. Never expose sensitive information to the public. Use proper authentication and authorization mechanisms. Make sure OWASP Top 10 is considered whenever new code is written.

## 4. Infrastructure & Deployment
* GCP Cloud DNS handles domain routing for `hutta.in`.
* Zero-dependency Python script (`ddns.py` under `website-iac/`) manages Dynamic DNS updates.
* Deployments to the Raspberry Pi environment are automated via GitHub Actions (`website-deploy.yml`).
* Raspberry Pi (192.168.1.150) can be accessed from my PC using SSH, for local execution, troubleshooting, and manual deployment.


