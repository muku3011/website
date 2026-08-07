# Infrastructure as Code (IaC) & Automation Directory

This directory contains all Infrastructure as Code (IaC) assets, Terraform cloud resources, Ansible bare-metal playbooks, Kubernetes manifests, and flasher scripts needed to run the `hutta.in` platform on a 3-node Raspberry Pi K8s cluster (**1x Raspberry Pi 5 8GB Master** + **2x Raspberry Pi 4 8GB Workers**).

---

## 📁 Symmetrical Directory Structure

```text
website-iac/
├── terraform/                      # Terraform Cloud Infrastructure
│   ├── dns.tf                      # GCP Cloud DNS Zone definition
│   ├── iam.tf                      # Service Account & Least Privilege IAM
│   ├── ddns.py                     # Dynamic DNS update script
│   ├── providers.tf                # GCP Terraform Provider configuration
│   ├── variables.tf / outputs.tf   # Variables & Outputs
│   └── service-account-key.json    # GCP Service Account key
├── ansible/                        # Ansible OS Hardening & K3s Bootstrap
│   ├── ansible.cfg                 # SSH Pipelining & ControlMaster configuration
│   ├── inventory.ini               # Host IPs (rbpi-master, worker-01, worker-02)
│   └── playbooks/
│       ├── 01-prep-nodes.yml       # SD Protection (tmpfs, noatime), UFW, Fail2ban, SSH key-only
│       ├── 02-autoupdates.yml      # Security unattended-upgrades & 04:00 AM reboot
│       └── 03-install-k3s.yml      # K3s install with --flannel-iface=wlan0 Wi-Fi binding
├── k8s/                            # Kubernetes Manifests (Synced by ArgoCD)
│   ├── argocd/
│   │   └── root-app.yaml           # GitOps Root Application
│   ├── infrastructure/
│   │   ├── postgres-db.yaml        # PostgreSQL StatefulSet (keycloakdb, smdpdb, lpadb, blogdb)
│   │   ├── keycloak-sso.yaml       # Keycloak SSO (auth.hutta.in)
│   │   ├── cert-issuer.yaml        # cert-manager GCP Cloud DNS ClusterIssuer
│   │   └── ddns-cronjob.yaml       # GCP Cloud DNS Dynamic DNS CronJob
│   └── apps/
│       ├── website-portal.yaml     # Static Web Portal Gateway
│       ├── smdp-plus.yaml          # SM-DP+ eSIM Provisioning Server (8092)
│       ├── device-simulator.yaml   # LPA Device Simulator (8093)
│       ├── blog-service.yaml       # Blog Service (8094)
│       └── ingress.yaml            # Global Ingress (hutta.in & auth.hutta.in)
├── scripts/
│   └── check_cluster_health.sh     # Cluster health verification script
└── README.md
```

---

## 🚀 Execution Workflow

### 1. Install Raspberry Pi OS Lite & Set Static IPs
Install Raspberry Pi OS Lite (64-bit) manually and assign static IP addresses (or router DHCP reservations):
* **`rbpi-master`**: `192.168.1.100` (Raspberry Pi 5 8GB)
* **`rbpi-worker-01`**: `192.168.1.110` (Raspberry Pi 4 8GB)
* **`rbpi-worker-02`**: `192.168.1.120` (Raspberry Pi 4 8GB)

### 2. Provision Cloud Infrastructure (Terraform)
```bash
cd website-iac/terraform
terraform init
terraform apply -auto-approve
cd ../..
```

### 3. Run Automated Ansible Node Hardening & K3s Setup
```bash
cd website-iac/ansible
ansible-playbook -i inventory.ini playbooks/01-prep-nodes.yml
ansible-playbook -i inventory.ini playbooks/02-autoupdates.yml
ansible-playbook -i inventory.ini playbooks/03-install-k3s.yml
cd ../..
```

### 4. Deploy GitOps & In-Cluster Infrastructure
```bash
# Verify K3s Nodes
kubectl get nodes -o wide

# Install ArgoCD & cert-manager
kubectl create namespace argocd
kubectl apply --server-side --force-conflicts -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# Secret for GCP Cloud DNS API
kubectl create secret generic gcp-sa-credentials \
  --from-file=service-account-key.json=website-iac/terraform/service-account-key.json \
  -n kube-system

# Apply In-Cluster Infrastructure & GitOps Root App
kubectl apply -f website-iac/k8s/infrastructure/postgres-db.yaml
kubectl apply -f website-iac/k8s/infrastructure/keycloak-sso.yaml
kubectl apply -f website-iac/k8s/infrastructure/cert-issuer.yaml
kubectl apply -f website-iac/k8s/infrastructure/ddns-cronjob.yaml
kubectl apply -f website-iac/k8s/argocd/root-app.yaml
```
