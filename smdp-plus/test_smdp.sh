#!/usr/bin/env bash
set -e

echo "[*] Building the Spring Boot application..."
mvn clean package -DskipTests

echo "[*] Starting SM-DP+ server on port 8092..."
java -jar target/smdp-plus-1.0.0.jar > smdp_server.log 2>&1 &
PID=$!

# Ensure we kill the server on exit
cleanup() {
    echo "[*] Stopping SM-DP+ server (PID: $PID)..."
    kill $PID || true
}
trap cleanup EXIT

echo "[*] Waiting for server to start..."
until curl -s http://localhost:8092/h2-console > /dev/null; do
    sleep 1
done
echo "[+] SM-DP+ Server started successfully!"

echo -e "\n=================================================="
echo "TEST 1: ES2+ downloadOrder (Order a profile for EID)"
echo "=================================================="
ORDER_RESP=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es2plus/downloadOrder \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d '{
    "header": {
      "functionRequesterIdentifier": "OperatorX",
      "functionCallIdentifier": "TX-100"
    },
    "eid": "89049032000008888888888888888801",
    "iccid": "89049032000008888881",
    "profileType": "Standard"
  }')
echo "Response: $ORDER_RESP"

echo -e "\n=================================================="
echo "TEST 2: ES2+ releaseProfile (Release profile for download)"
echo "=================================================="
RELEASE_RESP=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es2plus/releaseProfile \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d '{
    "header": {
      "functionRequesterIdentifier": "OperatorX",
      "functionCallIdentifier": "TX-101"
    },
    "iccid": "89049032000008888881"
  }')
echo "Response: $RELEASE_RESP"

echo -e "\n=================================================="
echo "TEST 3: ES9+ initiateAuthentication (Start LPA authentication)"
echo "=================================================="
INIT_RESP=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es9plus/initiateAuthentication \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d '{
    "euiccChallenge": "11223344556677889900AABBCCDDEEFF",
    "smdpAddress": "localhost:8092",
    "euiccInfo1": "MOCK_EUICC_INFO_1"
  }')
echo "Response: $INIT_RESP"

# Extract transactionId from JSON response
TX_ID=$(echo $INIT_RESP | grep -o '"transactionId":"[^"]*' | grep -o '[^"]*$' || true)
echo "Extracted Transaction ID: $TX_ID"

if [ -z "$TX_ID" ]; then
    echo "[!] Failed to extract transaction ID. Exiting."
    exit 1
fi

echo -e "\n=================================================="
echo "TEST 4: ES9+ authenticateClient (Authenticate client eUICC)"
echo "=================================================="
AUTH_RESP=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es9plus/authenticateClient \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d "{
    \"transactionId\": \"$TX_ID\",
    \"authenticateServerResponse\": \"MOCK_EUICC_AUTHENTICATE_RESPONSE_SIGNATURE\"
  }")
echo "Response: $AUTH_RESP"

echo -e "\n=================================================="
echo "TEST 5: ES9+ getBoundProfilePackage (Retrieve BPP)"
echo "=================================================="
BPP_RESP=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es9plus/getBoundProfilePackage \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d "{
    \"transactionId\": \"$TX_ID\",
    \"prepareDownloadResponse\": \"MOCK_EUICC_PREPARE_DOWNLOAD_RESPONSE\"
  }")
echo "Response: $BPP_RESP"

echo -e "\n=================================================="
echo "TEST 6: Verify Profile State (Attempting re-order should fail)"
echo "=================================================="
FAIL_ORDER=$(curl -s -X POST http://localhost:8092/gsma/rsp/v2/es2plus/downloadOrder \
  -H "Content-Type: application/json" \
  -H "X-Admin-Protocol: gsma/rsp/v3.1.0" \
  -d '{
    "header": {
      "functionRequesterIdentifier": "OperatorX",
      "functionCallIdentifier": "TX-102"
    },
    "eid": "89049032000008888888888888888801",
    "iccid": "89049032000008888881",
    "profileType": "Standard"
  }')
echo "Re-order response (Should Fail): $FAIL_ORDER"

echo -e "\n[+] All tests completed successfully!"
