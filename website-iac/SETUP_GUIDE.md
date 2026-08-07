# Complete End-to-End Setup Guide for hutta.in Platform

This guide provides step-by-step instructions to set up the **hutta.in** eSIM platform on a **3-node Raspberry Pi Kubernetes Cluster** (**1x Pi 5 8GB Master** + **2x Pi 4 8GB Workers**) over Wi-Fi.

---

## 🛠️ Step 1: Prerequisites & Tooling

Install the following required tools on your local Mac/Linux machine:
* `git`
* `terraform` (v1.5+)
* `ansible` (v2.14+)
* `kubectl`
* `curl` & `xz`

Ensure you have a GCP account with a Cloud DNS managed zone for `hutta.in`.

---

## 💾 Step 2: Install Raspberry Pi OS Lite (64-bit) & Set Static IPs

Flash Raspberry Pi OS Lite (64-bit) manually onto MicroSD cards / SSDs using Raspberry Pi Imager or your preferred tool. Configure SSH, Wi-Fi credentials, and assign static IP addresses (or DHCP reservations on your router):

* **Master Node (`rbpi-master`)**: `192.168.1.100` (Raspberry Pi 5 8GB)
* **Worker Node 1 (`rbpi-worker-01`)**: `192.168.1.110` (Raspberry Pi 4 8GB)
* **Worker Node 2 (`rbpi-worker-02`)**: `192.168.1.120` (Raspberry Pi 4 8GB)

Insert the SD cards into the Raspberry Pis and power them on.

---

## ☁️ Step 3: Provision GCP Cloud Infrastructure (Terraform)

Provision Cloud DNS record placeholders and the Dynamic DNS Service Account:

```bash
cd website-iac/terraform

# Initialize Terraform
terraform init

# Apply GCP resources
terraform apply -auto-approve

# Verify service-account-key.json is created
ls -la service-account-key.json

cd ../..
```

---

## 🔒 Step 4: Node Hardening & K3s Bootstrap (Ansible)

Configure OS optimizations, MicroSD write protection, firewall rules, and install K3s:

```bash
cd website-iac/ansible

# 1. Prepare nodes (tmpfs /tmp, noatime, UFW firewall, SSH hardening)
ansible-playbook -i inventory.ini playbooks/01-prep-nodes.yml

# 2. Enable automated security updates & 04:00 AM reboots
ansible-playbook -i inventory.ini playbooks/02-autoupdates.yml

# 3. Install K3s cluster with --flannel-iface=wlan0 Wi-Fi binding
ansible-playbook -i inventory.ini playbooks/03-install-k3s.yml

cd ../..
```

Fetch the cluster `kubeconfig` to your local machine:

```bash
mkdir -p ~/.kube
scp rbpi@192.168.1.100:~/.kube/config ~/.kube/config
sed -i 's/127.0.0.1/192.168.1.100/g' ~/.kube/config
kubectl get nodes
```

---

## 🚀 Step 5: Deploy Core Infrastructure & GitOps

Deploy cluster components:

```bash
# 1. Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# 2. Create GCP Service Account secret for Certbot & Dynamic DNS
kubectl create secret generic gcp-sa-credentials \
  --from-file=service-account-key.json=website-iac/terraform/service-account-key.json \
  -n kube-system

# 3. Deploy PostgreSQL StatefulSet & Keycloak SSO
kubectl apply -f website-iac/k8s/infrastructure/postgres-db.yaml
kubectl apply -f website-iac/k8s/infrastructure/keycloak-sso.yaml

# 4. Deploy ACME DNS-01 Issuer & Dynamic DNS CronJob
kubectl apply -f website-iac/k8s/infrastructure/cert-issuer.yaml
kubectl apply -f website-iac/k8s/infrastructure/ddns-cronjob.yaml

# 5. Deploy Lightweight Monitoring Stack (VictoriaMetrics + Node Exporter)
kubectl apply -f website-iac/k8s/infrastructure/monitoring.yaml

# 6. Install ArgoCD GitOps Engine & Root Application
kubectl create namespace argocd
kubectl apply --server-side --force-conflicts -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f website-iac/k8s/argocd/root-app.yaml
```

---

## 🔍 Step 6: Verify Cluster Health

Run the diagnostic verification script:

```bash
./website-iac/scripts/check_cluster_health.sh
```

All microservices (`smdp-plus`, `device-simulator`, `blog-service`, `eim-service`, `website-portal`, `keycloak-sso`) will be up, secured with TLS 1.3, and synced automatically via GitOps!
