#!/usr/bin/env bash
# ==============================================================================
# Native Raspberry Pi 5 Deployment Pipeline Script for hutta.in Platform
# Performs native Java 25 compilation and zero-QEMU Docker image building
# ==============================================================================
set -euo pipefail

REPO_PREFIX="ghcr.io/muku3011/website"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== 1. Native Java 25 Maven Build ===${NC}"
mvn clean package -DskipTests

echo -e "\n${BLUE}=== 2. Building Native ARM64 Docker Images ===${NC}"
docker build -t "${REPO_PREFIX}/portal:latest" -f website/Dockerfile website/
docker build -t "${REPO_PREFIX}/smdp-plus:latest" -f smdp-plus/Dockerfile .
docker build -t "${REPO_PREFIX}/device-simulator:latest" -f device-simulator/Dockerfile .
docker build -t "${REPO_PREFIX}/blog-service:latest" -f blog-service/Dockerfile .
docker build -t "${REPO_PREFIX}/eim-service:latest" -f eim-service/Dockerfile .

echo -e "\n${BLUE}=== 3. Importing Images into K3s Container Runtime ===${NC}"
for img in "portal" "smdp-plus" "device-simulator" "blog-service" "eim-service"; do
    FULL_IMG="${REPO_PREFIX}/${img}:latest"
    echo -e "${YELLOW}Importing ${FULL_IMG} into K3s containerd...${NC}"
    if command -v k3s >/dev/null 2>&1; then
        sudo k3s ctr images import <(docker save "${FULL_IMG}")
    else
        echo -e "${YELLOW}k3s CLI not found locally. Streaming image to rbpi-master (192.168.1.100)...${NC}"
        docker save "${FULL_IMG}" | ssh muku@192.168.1.100 "sudo k3s ctr images import -"
    fi
done

echo -e "\n${BLUE}=== 4. Rolling Out Kubernetes Microservice Deployments ===${NC}"
kubectl rollout restart deployment/website-portal -n default || true
kubectl rollout restart deployment/smdp-plus -n default || true
kubectl rollout restart deployment/device-simulator -n default || true
kubectl rollout restart deployment/blog-service -n default || true
kubectl rollout restart deployment/eim-service -n default || true

echo -e "\n${GREEN}=== Production Build & K3s Native Rollout Complete ===${NC}"
