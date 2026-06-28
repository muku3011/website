package in.hutta.lpa.service;

import in.hutta.lpa.dto.Es9Dtos.*;
import in.hutta.lpa.dto.LpaDtos.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
public class LpaDownloadService {

    private final RestTemplate restTemplate;

    public LpaDownloadService() {
        this.restTemplate = new RestTemplate();
    }

    public DownloadResponse downloadProfile(String activationCode) {
        log.info("LPA Simulator initiating profile download: {}", activationCode);
        DownloadResponse response = new DownloadResponse();

        try {
            // 1. Parse Activation Code
            if (activationCode == null || !activationCode.startsWith("LPA:1$")) {
                throw new IllegalArgumentException("Invalid activation code format. Must start with LPA:1$");
            }
            String[] parts = activationCode.split("\\$", -1);
            if (parts.length < 3) {
                throw new IllegalArgumentException("Invalid activation code. Must contain at least SM-DP+ Address slot");
            }
            String smdpAddress = parts[1];
            String matchingId = parts[2]; // May be empty in Push scenario

            log.info("Parsed Activation Code: smdpAddress={}, matchingId={}", smdpAddress, matchingId);

            // Determine schema (https for public domain hutta.in, http for local)
            String protocol = "http";
            if (smdpAddress.contains("hutta.in") || (!smdpAddress.contains("localhost") && !smdpAddress.contains("127.0.0.1"))) {
                protocol = "https";
            }
            String es9BaseUrl = protocol + "://" + smdpAddress + "/gsma/rsp/v2/es9plus";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Step 1: initiateAuthentication
            InitiateAuthenticationRequest req1 = new InitiateAuthenticationRequest();
            req1.setEuiccChallenge("MOCK_EUICC_CHALLENGE_" + System.currentTimeMillis());
            req1.setSmdpAddress(smdpAddress);
            req1.setEuiccInfo1("MOCK_EUICC_INFO_1");

            log.info("ES9+ Handshake Step 1: initiateAuthentication targeting {}", es9BaseUrl);
            HttpEntity<InitiateAuthenticationRequest> entity1 = new HttpEntity<>(req1, headers);
            InitiateAuthenticationResponse resp1 = restTemplate.postForObject(
                    es9BaseUrl + "/initiateAuthentication",
                    entity1,
                    InitiateAuthenticationResponse.class
            );

            if (resp1 == null || resp1.getTransactionId() == null) {
                throw new IllegalStateException("Failed step 1: initiateAuthentication returned empty response");
            }
            String transactionId = resp1.getTransactionId();
            log.info("ES9+ Handshake Step 1 success: transactionId={}", transactionId);

            // Step 2: authenticateClient
            AuthenticateClientRequest req2 = new AuthenticateClientRequest();
            req2.setTransactionId(transactionId);
            req2.setAuthenticateServerResponse("MOCK_AUTHENTICATE_SERVER_RESPONSE_ASN1");

            log.info("ES9+ Handshake Step 2: authenticateClient");
            HttpEntity<AuthenticateClientRequest> entity2 = new HttpEntity<>(req2, headers);
            AuthenticateClientResponse resp2 = restTemplate.postForObject(
                    es9BaseUrl + "/authenticateClient",
                    entity2,
                    AuthenticateClientResponse.class
            );

            if (resp2 == null) {
                throw new IllegalStateException("Failed step 2: authenticateClient returned empty response");
            }
            log.info("ES9+ Handshake Step 2 success: server authenticated for transactionId={}", transactionId);

            // Step 3: getBoundProfilePackage
            GetBoundProfilePackageRequest req3 = new GetBoundProfilePackageRequest();
            req3.setTransactionId(transactionId);
            req3.setPrepareDownloadResponse("MOCK_PREPARE_DOWNLOAD_RESPONSE_ASN1");

            log.info("ES9+ Handshake Step 3: getBoundProfilePackage");
            HttpEntity<GetBoundProfilePackageRequest> entity3 = new HttpEntity<>(req3, headers);
            GetBoundProfilePackageResponse resp3 = restTemplate.postForObject(
                    es9BaseUrl + "/getBoundProfilePackage",
                    entity3,
                    GetBoundProfilePackageResponse.class
            );

            if (resp3 == null || resp3.getBoundProfilePackage() == null) {
                throw new IllegalStateException("Failed step 3: getBoundProfilePackage returned empty response");
            }
            String bpp = resp3.getBoundProfilePackage();
            int bppSize = bpp.length();
            log.info("ES9+ Handshake Step 3 success: Bound Profile Package downloaded (size: {} chars)", bppSize);

            // Extract ICCID or details if available, otherwise mock it for response
            response.setSuccess(true);
            response.setMessage("Profile downloaded successfully");
            response.setTransactionId(transactionId);
            response.setBoundProfilePackageSize(bppSize);
            response.setBoundProfilePackage(bpp);
            response.setIccid(matchingId.isEmpty() ? "EID_PUSH_FLOW" : matchingId);

        } catch (Exception e) {
            log.error("eSIM profile download failed via LPA: {}", e.getMessage(), e);
            response.setSuccess(false);
            response.setMessage("Download failed: " + e.getMessage());
        }

        return response;
    }
}
