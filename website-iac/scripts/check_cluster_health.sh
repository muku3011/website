#!/usr/bin/env bash
# ==============================================================================
# hutta.in Platform Health Verification Script
# Runs automated diagnostic checks across Nodes, Pods, Databases & Ingress
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 1. Checking Kubernetes Cluster Node Status ===${NC}"
kubectl get nodes -o wide

echo -e "\n${BLUE}=== 2. Checking Hardware CPU & Memory Usage ===${NC}"
kubectl top nodes || echo -e "${RED}Metrics server initializing...${NC}"

echo -e "\n${BLUE}=== 3. Checking Pod Health in Default Namespace ===${NC}"
kubectl get pods -n default -o wide

echo -e "\n${BLUE}=== 4. Checking Microservice Health Endpoints ===${NC}"
if kubectl get deployment/website-portal -n default >/dev/null 2>&1; then
    for svc in "smdp-plus:8092" "device-simulator:8093" "blog-service:8094" "eim-service:8096"; do
        NAME="${svc%%:*}"
        PORT="${svc##*:}"
        STATUS=$(kubectl exec -n default deployment/website-portal -- curl -s -o /dev/null -w "%{http_code}" "http://${NAME}-service:${PORT}/actuator/health" 2>/dev/null || echo "FAILED")
        if [ "$STATUS" == "200" ]; then
            echo -e "[${GREEN}OK${NC}] Service ${NAME} is healthy (HTTP 200)"
        else
            echo -e "[${RED}WARN${NC}] Service ${NAME} returned HTTP status: ${STATUS}"
        fi
    done
else
    echo -e "${RED}[INFO] website-portal deployment is still initializing/syncing via ArgoCD...${NC}"
fi

echo -e "\n${BLUE}=== 5. Checking Keycloak SSO Health ===${NC}"
if kubectl get deployment/keycloak-sso -n default >/dev/null 2>&1; then
    KC_STATUS=$(kubectl get pod -l app=keycloak-sso -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
    if [ "$KC_STATUS" == "true" ]; then
        echo -e "[${GREEN}OK${NC}] Keycloak SSO is ready and healthy"
    else
        echo -e "[${RED}WARN${NC}] Keycloak SSO container is initializing/starting..."
    fi
fi

echo -e "\n${GREEN}=== Diagnostic Verification Complete ===${NC}"
