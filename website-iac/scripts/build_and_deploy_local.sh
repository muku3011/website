#!/usr/bin/env bash
# ==============================================================================
# Fast Native Local Build & Deployment Script for Raspberry Pi K3s Cluster
# Bypasses GitHub Actions QEMU emulation by building natively & pushing to K3s
# ==============================================================================
set -euo pipefail

MASTER_IP="192.168.1.100"
SSH_USER="${SSH_USER:-muku}"
REPO_PREFIX="ghcr.io/muku3011/website"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== 1. Checking Docker Runtime Daemon ===${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}Docker daemon is not running locally.${NC}"
    if command -v colima >/dev/null 2>&1; then
        echo -e "${BLUE}Starting Colima runtime...${NC}"
        colima start
    else
        echo -e "${RED}ERROR: Please start Docker Desktop or Colima ('colima start') and re-run this script.${NC}"
        exit 1
    fi
fi

echo -e "\n${BLUE}=== 2. Building Java Microservices with Maven ===${NC}"
mvn clean package -DskipTests

echo -e "\n${BLUE}=== 3. Building Native ARM64 Docker Images ===${NC}"
docker build -t "${REPO_PREFIX}/portal:latest" -f website/Dockerfile website/
docker build -t "${REPO_PREFIX}/smdp-plus:latest" -f smdp-plus/Dockerfile .
docker build -t "${REPO_PREFIX}/device-simulator:latest" -f device-simulator/Dockerfile .
docker build -t "${REPO_PREFIX}/blog-service:latest" -f blog-service/Dockerfile .
docker build -t "${REPO_PREFIX}/eim-service:latest" -f eim-service/Dockerfile .

echo -e "\n${BLUE}=== 4. Stream-Importing Images directly into K3s Containerd ===${NC}"
for img in "portal" "smdp-plus" "device-simulator" "blog-service" "eim-service"; do
    FULL_IMG="${REPO_PREFIX}/${img}:latest"
    echo -e "${YELLOW}Importing ${FULL_IMG} to K3s master (${MASTER_IP})...${NC}"
    docker save "${FULL_IMG}" | ssh "${SSH_USER}@${MASTER_IP}" "sudo k3s ctr images import -"
done

echo -e "\n${BLUE}=== 5. Triggering Kubernetes Deployment Rollout ===${NC}"
kubectl rollout restart deployment/website-portal -n default || true
kubectl rollout restart deployment/smdp-plus -n default || true
kubectl rollout restart deployment/device-simulator -n default || true
kubectl rollout restart deployment/blog-service -n default || true
kubectl rollout restart deployment/eim-service -n default || true

echo -e "\n${GREEN}=== Local Build & K3s Rollout Complete ===${NC}"
