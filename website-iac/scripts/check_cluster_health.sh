#!/usr/bin/env bash
# ==============================================================================
# hutta.in Platform Health Verification Script
# Runs automated diagnostic checks across Nodes, Pods, Databases, Keycloak & DDNS
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}=== 1. Checking Kubernetes Cluster Node Status ===${NC}"
kubectl get nodes -o wide

echo -e "\n${BLUE}=== 2. Checking Hardware CPU & Memory Usage ===${NC}"
kubectl top nodes || echo -e "${YELLOW}Metrics server initializing...${NC}"

echo -e "\n${BLUE}=== 3. Checking Pod Health in Default Namespace ===${NC}"
kubectl get pods -n default -o wide

echo -e "\n${BLUE}=== 4. Checking Microservice & Web Portal Gateway Health ===${NC}"
if kubectl get deployment/website-portal -n default >/dev/null 2>&1; then
    for svc in \
        "website-portal:80:Web Portal Gateway" \
        "smdp-plus:8092:SM-DP+ eSIM Server" \
        "device-simulator:8093:LPA Device Simulator" \
        "blog-service:8094:Technology Blog Backend" \
        "eim-service:8096:SGP.32 IoT eIM Manager"; do
        
        NAME="${svc%%:*}"
        REST="${svc#*:}"
        PORT="${REST%%:*}"
        DESC="${REST#*:}"

        if [ "$NAME" == "website-portal" ]; then
            URL="http://${NAME}-service:${PORT}/health"
        else
            URL="http://${NAME}-service:${PORT}/actuator/health"
        fi
        
        RESPONSE=$(kubectl exec -n default deployment/website-portal -- wget -q -O - "$URL" 2>/dev/null || kubectl exec -n default deployment/website-portal -- curl -s "$URL" 2>/dev/null || echo "FAILED")
        
        if echo "$RESPONSE" | grep -qE '"status":"UP"|OK'; then
            echo -e "[${GREEN}OK${NC}] ${DESC} (${NAME}) is healthy (HTTP 200 UP)"
        else
            echo -e "[${RED}WARN${NC}] ${DESC} (${NAME}) is initializing/starting..."
        fi
    done
else
    echo -e "${RED}[INFO] website-portal deployment is still initializing/syncing via ArgoCD...${NC}"
fi

echo -e "\n${BLUE}=== 5. Checking Keycloak SSO Authentication Engine ===${NC}"
if kubectl get deployment/keycloak-sso -n default >/dev/null 2>&1; then
    KC_READY=$(kubectl get pod -l app=keycloak-sso -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
    if [ "$KC_READY" == "true" ]; then
        echo -e "[${GREEN}OK${NC}] Keycloak SSO Container is ready"
        
        # Test Keycloak OIDC Realm endpoint
        REALM_RESP=$(kubectl exec -n default deployment/website-portal -- wget -q -O - "http://keycloak-service:8080/realms/hutta" 2>/dev/null || echo "FAILED")
        if echo "$REALM_RESP" | grep -q '"realm":"hutta"'; then
            echo -e "[${GREEN}OK${NC}] Keycloak OIDC Realm (hutta) is healthy (HTTP 200)"
        else
            echo -e "[${YELLOW}WARN${NC}] Keycloak OIDC Realm (hutta) is initializing..."
        fi

        # Test Keycloak Admin Console endpoint
        ADMIN_RESP=$(kubectl exec -n default deployment/website-portal -- wget -q -O - "http://keycloak-service:8080/admin/master/console/" 2>/dev/null || echo "FAILED")
        if echo "$ADMIN_RESP" | grep -qE "Keycloak|html"; then
            echo -e "[${GREEN}OK${NC}] Keycloak Admin Console (/admin) is healthy (HTTP 200)"
        else
            echo -e "[${YELLOW}WARN${NC}] Keycloak Admin Console (/admin) is initializing..."
        fi
    else
        echo -e "[${RED}WARN${NC}] Keycloak SSO container is initializing/starting..."
    fi
fi

echo -e "\n${BLUE}=== 6. Checking Dynamic DNS (DDNS) Engine ===${NC}"
if kubectl get cronjob gcp-ddns-updater -n kube-system >/dev/null 2>&1; then
    DDNS_SCHEDULE=$(kubectl get cronjob gcp-ddns-updater -n kube-system -o jsonpath='{.spec.schedule}')
    LAST_SCHEDULE=$(kubectl get cronjob gcp-ddns-updater -n kube-system -o jsonpath='{.status.lastScheduleTime}')
    echo -e "[${GREEN}OK${NC}] GCP Dynamic DNS CronJob is active (Schedule: ${DDNS_SCHEDULE}, Last Run: ${LAST_SCHEDULE})"
else
    echo -e "[${YELLOW}WARN${NC}] GCP Dynamic DNS CronJob not found in kube-system namespace"
fi

echo -e "\n${GREEN}=== Diagnostic Verification Complete ===${NC}"
