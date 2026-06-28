package in.hutta.smdp;

import in.hutta.smdp.dto.Es2Dtos;
import in.hutta.smdp.dto.Es9Dtos;
import in.hutta.smdp.model.Profile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class SmdpIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    public void testRspLifecycle() {
        // 1. Admin Profile Import (Multipart File Upload)
        MultiValueMap<String, Object> importBody = new LinkedMultiValueMap<>();
        importBody.add("file", new ClassPathResource("profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI.rename2der"));
        importBody.add("iccid", "89000123456789012399");

        HttpHeaders importHeaders = new HttpHeaders();
        importHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

        HttpEntity<MultiValueMap<String, Object>> importRequest = new HttpEntity<>(importBody, importHeaders);

        ResponseEntity<String> importResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/admin/importProfile",
                importRequest,
                String.class
        );
        assertThat(importResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(importResponse.getBody())).contains("Profile imported successfully");

        // 2. ES2+ Download Order
        Es2Dtos.DownloadOrderRequest orderReq = new Es2Dtos.DownloadOrderRequest();
        orderReq.setEid("89049032000008888888888888888801");
        orderReq.setIccid("89000123456789012399");
        orderReq.setProfileType("Standard");
        
        Es2Dtos.RequestHeader orderHeader = new Es2Dtos.RequestHeader();
        orderHeader.setFunctionRequesterIdentifier("OperatorX");
        orderHeader.setFunctionCallIdentifier("TX-100");
        orderReq.setHeader(orderHeader);

        ResponseEntity<Es2Dtos.DownloadOrderResponse> orderResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es2plus/downloadOrder",
                orderReq,
                Es2Dtos.DownloadOrderResponse.class
        );
        assertThat(orderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Es2Dtos.DownloadOrderResponse orderResponseBody = Objects.requireNonNull(orderResponse.getBody());
        assertThat(orderResponseBody.getIccid()).isEqualTo("89000123456789012399");

        // 3. ES2+ Release Profile
        Es2Dtos.ReleaseProfileRequest releaseReq = new Es2Dtos.ReleaseProfileRequest();
        releaseReq.setIccid("89000123456789012399");

        Es2Dtos.RequestHeader releaseHeader = new Es2Dtos.RequestHeader();
        releaseHeader.setFunctionRequesterIdentifier("OperatorX");
        releaseHeader.setFunctionCallIdentifier("TX-101");
        releaseReq.setHeader(releaseHeader);

        ResponseEntity<Es2Dtos.ReleaseProfileResponse> releaseResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es2plus/releaseProfile",
                releaseReq,
                Es2Dtos.ReleaseProfileResponse.class
        );
        assertThat(releaseResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Es2Dtos.ReleaseProfileResponse releaseResponseBody = Objects.requireNonNull(releaseResponse.getBody());
        assertThat(releaseResponseBody.getHeader().getFunctionExecutionStatus().getStatus()).isEqualTo("Executed-Success");

        // 4. ES9+ Initiate Authentication
        Es9Dtos.InitiateAuthenticationRequest initReq = new Es9Dtos.InitiateAuthenticationRequest();
        initReq.setEuiccChallenge("11223344556677889900AABBCCDDEEFF");
        initReq.setSmdpAddress("localhost:8092");
        initReq.setEuiccInfo1("MOCK_EUICC_INFO_1");

        ResponseEntity<Es9Dtos.InitiateAuthenticationResponse> initResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es9plus/initiateAuthentication",
                initReq,
                Es9Dtos.InitiateAuthenticationResponse.class
        );
        assertThat(initResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Es9Dtos.InitiateAuthenticationResponse initResponseBody = Objects.requireNonNull(initResponse.getBody());
        String transactionId = initResponseBody.getTransactionId();
        assertThat(transactionId).isNotBlank();

        // 5. ES9+ Authenticate Client
        Es9Dtos.AuthenticateClientRequest authReq = new Es9Dtos.AuthenticateClientRequest();
        authReq.setTransactionId(transactionId);
        authReq.setAuthenticateServerResponse("MOCK_EUICC_AUTHENTICATE_RESPONSE_SIGNATURE");

        ResponseEntity<Es9Dtos.AuthenticateClientResponse> authResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es9plus/authenticateClient",
                authReq,
                Es9Dtos.AuthenticateClientResponse.class
        );
        assertThat(authResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Es9Dtos.AuthenticateClientResponse authResponseBody = Objects.requireNonNull(authResponse.getBody());
        assertThat(authResponseBody.getTransactionId()).isEqualTo(transactionId);

        // 6. ES9+ Get Bound Profile Package (BPP)
        Es9Dtos.GetBoundProfilePackageRequest bppReq = new Es9Dtos.GetBoundProfilePackageRequest();
        bppReq.setTransactionId(transactionId);
        bppReq.setPrepareDownloadResponse("MOCK_EUICC_PREPARE_DOWNLOAD_RESPONSE");

        ResponseEntity<Es9Dtos.GetBoundProfilePackageResponse> bppResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es9plus/getBoundProfilePackage",
                bppReq,
                Es9Dtos.GetBoundProfilePackageResponse.class
        );
        assertThat(bppResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Es9Dtos.GetBoundProfilePackageResponse bppResponseBody = Objects.requireNonNull(bppResponse.getBody());
        assertThat(bppResponseBody.getTransactionId()).isEqualTo(transactionId);
        assertThat(bppResponseBody.getBoundProfilePackage()).isNotBlank();

        // 6b. Send Deletion Notification
        Es9Dtos.HandleNotificationRequest notifReq = new Es9Dtos.HandleNotificationRequest();
        Es9Dtos.PendingNotification pendingNotif = new Es9Dtos.PendingNotification();
        pendingNotif.setProfileManagementOperation("delete");
        pendingNotif.setIccid("89000123456789012399");
        pendingNotif.setNotificationAddress("localhost:8092");
        notifReq.setPendingNotification(pendingNotif);

        @SuppressWarnings("rawtypes")
        ResponseEntity<java.util.Map> notifResponse = restTemplate.postForEntity(
                "/gsma/rsp/v2/es9plus/handleNotification",
                notifReq,
                java.util.Map.class
        );
        assertThat(notifResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(notifResponse.getBody()).get("status")).isEqualTo("Executed-Success");

        // 7. Verify GET all profiles and GET profiles by state
        ResponseEntity<Profile[]> allProfilesResp = restTemplate.getForEntity(
                "/gsma/rsp/v2/admin/profiles",
                Profile[].class
        );
        assertThat(allProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Profile[] allProfiles = Objects.requireNonNull(allProfilesResp.getBody());
        assertThat(allProfiles).isNotEmpty();
        assertThat(allProfiles[0].getIccid()).isEqualTo("89000123456789012399");

        // Verify GET profiles by state (DOWNLOADED) is now empty
        ResponseEntity<Profile[]> downloadedProfilesResp = restTemplate.getForEntity(
                "/gsma/rsp/v2/admin/profiles?state=DOWNLOADED",
                Profile[].class
        );
        assertThat(downloadedProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Profile[] downloadedProfiles = Objects.requireNonNull(downloadedProfilesResp.getBody());
        assertThat(downloadedProfiles).isEmpty();

        // Verify GET profiles by state (AVAILABLE) is now populated
        ResponseEntity<Profile[]> availableProfilesResp = restTemplate.getForEntity(
                "/gsma/rsp/v2/admin/profiles?state=AVAILABLE",
                Profile[].class
        );
        assertThat(availableProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Profile[] availableProfiles = Objects.requireNonNull(availableProfilesResp.getBody());
        assertThat(availableProfiles).isNotEmpty();

        // 8. Verify DELETE profile
        restTemplate.delete("/gsma/rsp/v2/admin/profiles/89000123456789012399");

        // Verify GET all profiles is now empty
        ResponseEntity<Profile[]> postDeleteProfilesResp = restTemplate.getForEntity(
                "/gsma/rsp/v2/admin/profiles",
                Profile[].class
        );
        assertThat(postDeleteProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(postDeleteProfilesResp.getBody())).isEmpty();
    }

    @Test
    public void testAllAvailableProfilesLifecycle() {
        String[] profileFiles = {
                "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI.rename2der",
                "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_NoBERTLV.rename2der",
                "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_NoBERTLV_NoRAMRFM.rename2der",
                "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI_NoRAMRFM.rename2der"
        };

        for (String fileResourcePath : profileFiles) {
            // 1. Import Profile (Automatic ICCID extraction)
            MultiValueMap<String, Object> importBody = new LinkedMultiValueMap<>();
            importBody.add("file", new ClassPathResource(fileResourcePath));

            HttpHeaders importHeaders = new HttpHeaders();
            importHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> importRequest = new HttpEntity<>(importBody, importHeaders);

            ResponseEntity<String> importResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/admin/importProfile",
                    importRequest,
                    String.class
            );
            assertThat(importResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(Objects.requireNonNull(importResponse.getBody())).contains("Profile imported successfully");

            // Fetch the imported profile to find the extracted ICCID
            ResponseEntity<Profile[]> allProfilesResp = restTemplate.getForEntity(
                    "/gsma/rsp/v2/admin/profiles?state=AVAILABLE",
                    Profile[].class
            );
            assertThat(allProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
            Profile[] available = Objects.requireNonNull(allProfilesResp.getBody());
            assertThat(available).isNotEmpty();
            String extractedIccid = available[0].getIccid();
            assertThat(extractedIccid).isNotBlank();

            // 2. ES2+ Download Order
            Es2Dtos.DownloadOrderRequest orderReq = new Es2Dtos.DownloadOrderRequest();
            orderReq.setEid("89049032000008888888888888888801");
            orderReq.setIccid(extractedIccid);
            orderReq.setProfileType("Standard");
            
            Es2Dtos.RequestHeader orderHeader = new Es2Dtos.RequestHeader();
            orderHeader.setFunctionRequesterIdentifier("OperatorX");
            orderHeader.setFunctionCallIdentifier("TX-101");
            orderReq.setHeader(orderHeader);

            ResponseEntity<Es2Dtos.DownloadOrderResponse> orderResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es2plus/downloadOrder",
                    orderReq,
                    Es2Dtos.DownloadOrderResponse.class
            );
            assertThat(orderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

            // 3. Confirm Order
            Es2Dtos.ConfirmOrderRequest confirmReq = new Es2Dtos.ConfirmOrderRequest();
            confirmReq.setEid("89049032000008888888888888888801");
            confirmReq.setIccid(extractedIccid);
            confirmReq.setHeader(orderHeader);

            ResponseEntity<Es2Dtos.ConfirmOrderResponse> confirmResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es2plus/confirmOrder",
                    confirmReq,
                    Es2Dtos.ConfirmOrderResponse.class
            );
            assertThat(confirmResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

            // 4. ES9+ Initiate Authentication
            Es9Dtos.InitiateAuthenticationRequest initAuthReq = new Es9Dtos.InitiateAuthenticationRequest();
            initAuthReq.setEuiccChallenge("AABBCCDDEEFF00112233445566778899");
            initAuthReq.setSmdpAddress("localhost:8092");
            initAuthReq.setEuiccInfo1("MOCK_EUICC_INFO_INFO");

            ResponseEntity<Es9Dtos.InitiateAuthenticationResponse> initAuthResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es9plus/initiateAuthentication",
                    initAuthReq,
                    Es9Dtos.InitiateAuthenticationResponse.class
            );
            assertThat(initAuthResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
            String transactionId = Objects.requireNonNull(initAuthResponse.getBody()).getTransactionId();

            // 5. ES9+ Authenticate Client
            Es9Dtos.AuthenticateClientRequest authClientReq = new Es9Dtos.AuthenticateClientRequest();
            authClientReq.setTransactionId(transactionId);
            authClientReq.setAuthenticateServerResponse("MOCK_AUTHENTICATE_SERVER_RESPONSE");

            ResponseEntity<Es9Dtos.AuthenticateClientResponse> authClientResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es9plus/authenticateClient",
                    authClientReq,
                    Es9Dtos.AuthenticateClientResponse.class
            );
            assertThat(authClientResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

            // 6. ES9+ Get Bound Profile Package (BPP)
            Es9Dtos.GetBoundProfilePackageRequest bppReq = new Es9Dtos.GetBoundProfilePackageRequest();
            bppReq.setTransactionId(transactionId);
            bppReq.setPrepareDownloadResponse("MOCK_PREPARE_DOWNLOAD_RESPONSE");

            ResponseEntity<Es9Dtos.GetBoundProfilePackageResponse> bppResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es9plus/getBoundProfilePackage",
                    bppReq,
                    Es9Dtos.GetBoundProfilePackageResponse.class
            );
            assertThat(bppResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

            // 7. Verify deletion notification reverts state to AVAILABLE
            Es9Dtos.HandleNotificationRequest notifReq = new Es9Dtos.HandleNotificationRequest();
            Es9Dtos.PendingNotification pendingNotif = new Es9Dtos.PendingNotification();
            pendingNotif.setProfileManagementOperation("delete");
            pendingNotif.setIccid(extractedIccid);
            pendingNotif.setNotificationAddress("localhost:8092");
            notifReq.setPendingNotification(pendingNotif);

            @SuppressWarnings("rawtypes")
            ResponseEntity<java.util.Map> notifResponse = restTemplate.postForEntity(
                    "/gsma/rsp/v2/es9plus/handleNotification",
                    notifReq,
                    java.util.Map.class
                );
            assertThat(notifResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

            // 8. Clean up profile by deleting it from admin controller
            restTemplate.delete("/gsma/rsp/v2/admin/profiles/" + extractedIccid);
        }
    }
}
