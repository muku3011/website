package in.hutta.lpa.service;

import in.hutta.lpa.dto.Es9Dtos.*;
import in.hutta.lpa.dto.LpaDtos.*;
import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class LpaDownloadService {

    private final LocalProfileRepository localProfileRepository;
    private final RestTemplate restTemplate = new RestTemplate();

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
            headers.set("User-Agent", "gsma-rsp-lpa/3.0.0");

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
            String iccid = matchingId;
            String payloadBase64 = null;
            
            try {
                String decodedBpp = new String(java.util.Base64.getDecoder().decode(bpp), java.nio.charset.StandardCharsets.UTF_8);
                
                // Parse ICCID from BPP if present
                if (decodedBpp.contains("iccid=")) {
                    int start = decodedBpp.indexOf("iccid=") + 6;
                    int end = decodedBpp.indexOf(",", start);
                    if (end == -1) {
                        end = decodedBpp.indexOf("]", start);
                    }
                    if (end != -1) {
                        iccid = decodedBpp.substring(start, end);
                    }
                }
                
                // Parse Payload from BPP if present
                if (decodedBpp.contains("payload=")) {
                    int start = decodedBpp.indexOf("payload=") + 8;
                    int end = decodedBpp.indexOf("]", start);
                    if (end != -1) {
                        payloadBase64 = decodedBpp.substring(start, end);
                    }
                }
            } catch (Exception e) {
                log.warn("LPA Simulator: BPP is not standard mock string, skipping payload parse: {}", e.getMessage());
            }

            if (iccid == null || iccid.isEmpty()) {
                iccid = "EID_PUSH_FLOW";
            }
            
            // Decoded profile details
            String spName = null;
            String profileNickname = null;
            
            if (payloadBase64 != null) {
                try {
                    byte[] profileBytes = java.util.Base64.getDecoder().decode(payloadBase64);
                    // Extract fields from PE-Header using GSMA SGP.22 ASN.1 context tags
                    spName = extractStringField(profileBytes, 0x84); // Tag 84 is serviceProviderName
                    profileNickname = extractStringField(profileBytes, 0x85); // Tag 85 is profileName
                    
                    // Fallback to parse ICCID from profile bytes if matchingId was empty and BPP parsing failed
                    if ("EID_PUSH_FLOW".equals(iccid)) {
                        String parsedIccid = extractIccid(profileBytes);
                        if (parsedIccid != null && !parsedIccid.isEmpty()) {
                            iccid = parsedIccid;
                        }
                    }
                } catch (Exception e) {
                    log.warn("LPA Simulator: Could not parse custom fields from profile payload: {}", e.getMessage());
                }
            }
            
            if (spName == null || spName.trim().isEmpty()) {
                spName = "SM-DP+ (" + smdpAddress + ")";
            }
            if (profileNickname == null || profileNickname.trim().isEmpty()) {
                profileNickname = "eSIM " + (iccid.length() > 4 ? iccid.substring(iccid.length() - 4) : iccid);
            }
            
            response.setSuccess(true);
            response.setMessage("Profile downloaded successfully");
            response.setTransactionId(transactionId);
            response.setBoundProfilePackageSize(bppSize);
            response.setBoundProfilePackage(bpp);
            response.setIccid(iccid);

            // Save to local profile registry database
            LocalProfile localProfile = new LocalProfile();
            localProfile.setIccid(iccid);
            localProfile.setSmdpAddress(smdpAddress);
            localProfile.setProfileNickname(profileNickname);
            localProfile.setServiceProviderName(spName);
            localProfile.setProfileState("DISABLED"); // Initially disabled on device
            localProfile.setBoundProfilePackage(bpp);
            localProfileRepository.save(localProfile);
            log.info("eSIM profile successfully saved to device database: ICCID={}", iccid);

        } catch (Exception e) {
            log.error("eSIM profile download failed via LPA: {}", e.getMessage(), e);
            response.setSuccess(false);
            response.setMessage("Download failed: " + e.getMessage());
        }

        return response;
    }

    private String extractStringField(byte[] bytes, int tagValue) {
        int limit = Math.min(bytes.length - 4, 1000);
        for (int i = 0; i < limit; i++) {
            if ((bytes[i] & 0xFF) == tagValue) {
                int lenByte = bytes[i + 1] & 0xFF;
                int length = 0;
                int valueOffset = 2;
                
                if (lenByte < 128) {
                    length = lenByte;
                } else {
                    int numLenBytes = lenByte & 0x7F;
                    if (numLenBytes > 0 && numLenBytes <= 4 && i + 1 + numLenBytes < bytes.length) {
                        for (int j = 0; j < numLenBytes; j++) {
                            length = (length << 8) | (bytes[i + 2 + j] & 0xFF);
                        }
                        valueOffset = 2 + numLenBytes;
                    }
                }
                
                if (length > 0 && i + valueOffset + length <= bytes.length) {
                    byte[] strBytes = new byte[length];
                    System.arraycopy(bytes, i + valueOffset, strBytes, 0, length);
                    return new String(strBytes, java.nio.charset.StandardCharsets.UTF_8);
                }
            }
        }
        return null;
    }

    private String extractIccid(byte[] bytes) {
        int limit = Math.min(bytes.length - 11, 1000);
        for (int i = 0; i < limit; i++) {
            if ((bytes[i] & 0xFF) == 0x83 && (bytes[i + 1] & 0xFF) == 0x0A) {
                byte[] iccidBytes = new byte[10];
                System.arraycopy(bytes, i + 2, iccidBytes, 0, 10);
                return bytesToHex(iccidBytes);
            }
        }
        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
