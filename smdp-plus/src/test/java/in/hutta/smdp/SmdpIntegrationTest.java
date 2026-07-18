package in.hutta.smdp;

import static org.assertj.core.api.Assertions.assertThat;

import in.hutta.smdp.dto.Es2Dtos;
import in.hutta.smdp.dto.Es9Dtos;
import in.hutta.smdp.model.Profile;
import in.hutta.smdp.repository.ProfileRepository;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Objects;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.bouncycastle.asn1.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class SmdpIntegrationTest {

  @Autowired private TestRestTemplate restTemplate;

  @Autowired private ProfileRepository profileRepository;

  @Autowired private in.hutta.smdp.service.CryptoService cryptoService;

  @BeforeEach
  public void setUp() {
    if (Security.getProvider("BC") == null) {
      Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
    }
    profileRepository.deleteAll();
  }

  @Test
  public void testRspLifecycle() {
    // 1. Admin Profile Import (Multipart File Upload)
    MultiValueMap<String, Object> importBody = new LinkedMultiValueMap<>();
    importBody.add(
        "file",
        new ClassPathResource("profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI.rename2der"));
    importBody.add("iccid", "89000123456789012399");

    HttpHeaders importHeaders = new HttpHeaders();
    importHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

    HttpEntity<MultiValueMap<String, Object>> importRequest =
        new HttpEntity<>(importBody, importHeaders);

    ResponseEntity<String> importResponse =
        restTemplate.postForEntity("/gsma/rsp/v2/admin/importProfile", importRequest, String.class);
    assertThat(importResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(Objects.requireNonNull(importResponse.getBody()))
        .contains("Profile imported successfully");

    // 2. ES2+ Download Order
    Es2Dtos.DownloadOrderRequest orderReq = new Es2Dtos.DownloadOrderRequest();
    orderReq.setEid("89049032000008888888888888888801");
    orderReq.setIccid("89000123456789012399");
    orderReq.setProfileType("Standard");

    Es2Dtos.RequestHeader orderHeader = new Es2Dtos.RequestHeader();
    orderHeader.setFunctionRequesterIdentifier("OperatorX");
    orderHeader.setFunctionCallIdentifier("TX-100");
    orderReq.setHeader(orderHeader);

    ResponseEntity<Es2Dtos.DownloadOrderResponse> orderResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es2plus/downloadOrder", orderReq, Es2Dtos.DownloadOrderResponse.class);
    assertThat(orderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es2Dtos.DownloadOrderResponse orderResponseBody =
        Objects.requireNonNull(orderResponse.getBody());
    assertThat(orderResponseBody.getIccid()).isEqualTo("89000123456789012399");

    // 3. ES2+ Release Profile
    Es2Dtos.ReleaseProfileRequest releaseReq = new Es2Dtos.ReleaseProfileRequest();
    releaseReq.setIccid("89000123456789012399");

    Es2Dtos.RequestHeader releaseHeader = new Es2Dtos.RequestHeader();
    releaseHeader.setFunctionRequesterIdentifier("OperatorX");
    releaseHeader.setFunctionCallIdentifier("TX-101");
    releaseReq.setHeader(releaseHeader);

    ResponseEntity<Es2Dtos.ReleaseProfileResponse> releaseResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es2plus/releaseProfile",
            releaseReq,
            Es2Dtos.ReleaseProfileResponse.class);
    assertThat(releaseResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es2Dtos.ReleaseProfileResponse releaseResponseBody =
        Objects.requireNonNull(releaseResponse.getBody());
    assertThat(releaseResponseBody.getHeader().getFunctionExecutionStatus().getStatus())
        .isEqualTo("Executed-Success");

    // 4. ES9+ Initiate Authentication
    Es9Dtos.InitiateAuthenticationRequest initReq = new Es9Dtos.InitiateAuthenticationRequest();
    initReq.setEuiccChallenge("11223344556677889900AABBCCDDEEFF");
    initReq.setSmdpAddress("localhost:8092");
    initReq.setEuiccInfo1("MOCK_EUICC_INFO_1");

    ResponseEntity<Es9Dtos.InitiateAuthenticationResponse> initResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/initiateAuthentication",
            initReq,
            Es9Dtos.InitiateAuthenticationResponse.class);
    assertThat(initResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.InitiateAuthenticationResponse initResponseBody =
        Objects.requireNonNull(initResponse.getBody());
    String transactionId = initResponseBody.getTransactionId();
    assertThat(transactionId).isNotBlank();

    // 5. ES9+ Authenticate Client
    Es9Dtos.AuthenticateClientRequest authReq = new Es9Dtos.AuthenticateClientRequest();
    authReq.setTransactionId(transactionId);
    authReq.setAuthenticateServerResponse("MOCK_EUICC_AUTHENTICATE_RESPONSE_SIGNATURE");

    ResponseEntity<Es9Dtos.AuthenticateClientResponse> authResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/authenticateClient",
            authReq,
            Es9Dtos.AuthenticateClientResponse.class);
    assertThat(authResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.AuthenticateClientResponse authResponseBody =
        Objects.requireNonNull(authResponse.getBody());
    assertThat(authResponseBody.getTransactionId()).isEqualTo(transactionId);

    // 6. ES9+ Get Bound Profile Package (BPP)
    Es9Dtos.GetBoundProfilePackageRequest bppReq = new Es9Dtos.GetBoundProfilePackageRequest();
    bppReq.setTransactionId(transactionId);
    bppReq.setPrepareDownloadResponse("MOCK_EUICC_PREPARE_DOWNLOAD_RESPONSE");

    ResponseEntity<Es9Dtos.GetBoundProfilePackageResponse> bppResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/getBoundProfilePackage",
            bppReq,
            Es9Dtos.GetBoundProfilePackageResponse.class);
    assertThat(bppResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.GetBoundProfilePackageResponse bppResponseBody =
        Objects.requireNonNull(bppResponse.getBody());
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
    ResponseEntity<java.util.Map> notifResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/handleNotification", notifReq, java.util.Map.class);
    assertThat(notifResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(Objects.requireNonNull(notifResponse.getBody()).get("status"))
        .isEqualTo("Executed-Success");

    // 7. Verify GET all profiles and GET profiles by state
    ResponseEntity<Profile[]> allProfilesResp =
        restTemplate.getForEntity("/gsma/rsp/v2/admin/profiles", Profile[].class);
    assertThat(allProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    Profile[] allProfiles = Objects.requireNonNull(allProfilesResp.getBody());
    assertThat(allProfiles).isNotEmpty();
    assertThat(allProfiles[0].getIccid()).isEqualTo("89000123456789012399");

    // Verify GET profiles by state (DOWNLOADED) is now empty
    ResponseEntity<Profile[]> downloadedProfilesResp =
        restTemplate.getForEntity("/gsma/rsp/v2/admin/profiles?state=DOWNLOADED", Profile[].class);
    assertThat(downloadedProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    Profile[] downloadedProfiles = Objects.requireNonNull(downloadedProfilesResp.getBody());
    assertThat(downloadedProfiles).isEmpty();

    // Verify GET profiles by state (AVAILABLE) is now populated
    ResponseEntity<Profile[]> availableProfilesResp =
        restTemplate.getForEntity("/gsma/rsp/v2/admin/profiles?state=AVAILABLE", Profile[].class);
    assertThat(availableProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    Profile[] availableProfiles = Objects.requireNonNull(availableProfilesResp.getBody());
    assertThat(availableProfiles).isNotEmpty();

    // 8. Verify DELETE profile
    restTemplate.delete("/gsma/rsp/v2/admin/profiles/89000123456789012399");

    // Verify GET all profiles is now empty
    ResponseEntity<Profile[]> postDeleteProfilesResp =
        restTemplate.getForEntity("/gsma/rsp/v2/admin/profiles", Profile[].class);
    assertThat(postDeleteProfilesResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(Objects.requireNonNull(postDeleteProfilesResp.getBody())).isEmpty();
  }

  @Test
  public void testAllAvailableProfilesLifecycle() {
    String[] profileFiles = {
      "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI.rename2der",
      "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_NoBERTLV.rename2der",
      "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_NoBERTLV_NoRAMRFM.rename2der",
      "profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI_NoRAMRFM.rename2der",
      "profiles/TS48 V2 eSIM_GTP_SAIP2.1_BERTLV_v2.rename2der",
      "profiles/TS48 V2 eSIM_GTP_SAIP2.1_NoBERTLV.rename2der",
      "profiles/TS48 V2 eSIM_GTP_SAIP2.3_BERTLV.rename2der",
      "profiles/TS48 V2 eSIM_GTP_SAIP2.3_NoBERTLV.rename2der"
    };

    for (String fileResourcePath : profileFiles) {
      // 1. Import Profile (Automatic ICCID extraction)
      MultiValueMap<String, Object> importBody = new LinkedMultiValueMap<>();
      importBody.add("file", new ClassPathResource(fileResourcePath));

      HttpHeaders importHeaders = new HttpHeaders();
      importHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);
      HttpEntity<MultiValueMap<String, Object>> importRequest =
          new HttpEntity<>(importBody, importHeaders);

      ResponseEntity<String> importResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/admin/importProfile", importRequest, String.class);
      assertThat(importResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(Objects.requireNonNull(importResponse.getBody()))
          .contains("Profile imported successfully");

      // Fetch the imported profile to find the extracted ICCID
      ResponseEntity<Profile[]> allProfilesResp =
          restTemplate.getForEntity("/gsma/rsp/v2/admin/profiles?state=AVAILABLE", Profile[].class);
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

      ResponseEntity<Es2Dtos.DownloadOrderResponse> orderResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es2plus/downloadOrder", orderReq, Es2Dtos.DownloadOrderResponse.class);
      assertThat(orderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

      // 3. Confirm Order
      Es2Dtos.ConfirmOrderRequest confirmReq = new Es2Dtos.ConfirmOrderRequest();
      confirmReq.setEid("89049032000008888888888888888801");
      confirmReq.setIccid(extractedIccid);
      confirmReq.setHeader(orderHeader);

      ResponseEntity<Es2Dtos.ConfirmOrderResponse> confirmResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es2plus/confirmOrder", confirmReq, Es2Dtos.ConfirmOrderResponse.class);
      assertThat(confirmResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

      // 4. ES9+ Initiate Authentication
      Es9Dtos.InitiateAuthenticationRequest initAuthReq =
          new Es9Dtos.InitiateAuthenticationRequest();
      initAuthReq.setEuiccChallenge("AABBCCDDEEFF00112233445566778899");
      initAuthReq.setSmdpAddress("localhost:8092");
      initAuthReq.setEuiccInfo1("MOCK_EUICC_INFO_INFO");

      ResponseEntity<Es9Dtos.InitiateAuthenticationResponse> initAuthResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es9plus/initiateAuthentication",
              initAuthReq,
              Es9Dtos.InitiateAuthenticationResponse.class);
      assertThat(initAuthResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
      String transactionId = Objects.requireNonNull(initAuthResponse.getBody()).getTransactionId();

      // 5. ES9+ Authenticate Client
      Es9Dtos.AuthenticateClientRequest authClientReq = new Es9Dtos.AuthenticateClientRequest();
      authClientReq.setTransactionId(transactionId);
      authClientReq.setAuthenticateServerResponse("MOCK_AUTHENTICATE_SERVER_RESPONSE");

      ResponseEntity<Es9Dtos.AuthenticateClientResponse> authClientResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es9plus/authenticateClient",
              authClientReq,
              Es9Dtos.AuthenticateClientResponse.class);
      assertThat(authClientResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

      // 6. ES9+ Get Bound Profile Package (BPP)
      Es9Dtos.GetBoundProfilePackageRequest bppReq = new Es9Dtos.GetBoundProfilePackageRequest();
      bppReq.setTransactionId(transactionId);
      bppReq.setPrepareDownloadResponse("MOCK_PREPARE_DOWNLOAD_RESPONSE");

      ResponseEntity<Es9Dtos.GetBoundProfilePackageResponse> bppResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es9plus/getBoundProfilePackage",
              bppReq,
              Es9Dtos.GetBoundProfilePackageResponse.class);
      assertThat(bppResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

      // 7. Verify deletion notification reverts state to AVAILABLE
      Es9Dtos.HandleNotificationRequest notifReq = new Es9Dtos.HandleNotificationRequest();
      Es9Dtos.PendingNotification pendingNotif = new Es9Dtos.PendingNotification();
      pendingNotif.setProfileManagementOperation("delete");
      pendingNotif.setIccid(extractedIccid);
      pendingNotif.setNotificationAddress("localhost:8092");
      notifReq.setPendingNotification(pendingNotif);

      @SuppressWarnings("rawtypes")
      ResponseEntity<java.util.Map> notifResponse =
          restTemplate.postForEntity(
              "/gsma/rsp/v2/es9plus/handleNotification", notifReq, java.util.Map.class);
      assertThat(notifResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

      // 8. Clean up profile by deleting it from admin controller
      restTemplate.delete("/gsma/rsp/v2/admin/profiles/" + extractedIccid);
    }
  }

  @Test
  public void testRealRspLifecycle() throws Exception {
    // 1. Admin Profile Import (Multipart File Upload)
    MultiValueMap<String, Object> importBody = new LinkedMultiValueMap<>();
    importBody.add(
        "file",
        new ClassPathResource("profiles/TS48 V7.0 eSIM_GTP_SAIP2.3_BERTLV_SUCI.rename2der"));
    importBody.add("iccid", "89000123456789012399");

    HttpHeaders importHeaders = new HttpHeaders();
    importHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

    HttpEntity<MultiValueMap<String, Object>> importRequest =
        new HttpEntity<>(importBody, importHeaders);

    ResponseEntity<String> importResponse =
        restTemplate.postForEntity("/gsma/rsp/v2/admin/importProfile", importRequest, String.class);
    assertThat(importResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

    // 2. ES2+ Download Order
    Es2Dtos.DownloadOrderRequest orderReq = new Es2Dtos.DownloadOrderRequest();
    orderReq.setEid("89049032000008888888888888888801");
    orderReq.setIccid("89000123456789012399");
    orderReq.setProfileType("Standard");

    Es2Dtos.RequestHeader orderHeader = new Es2Dtos.RequestHeader();
    orderHeader.setFunctionRequesterIdentifier("OperatorX");
    orderHeader.setFunctionCallIdentifier("TX-100");
    orderReq.setHeader(orderHeader);

    ResponseEntity<Es2Dtos.DownloadOrderResponse> orderResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es2plus/downloadOrder", orderReq, Es2Dtos.DownloadOrderResponse.class);
    assertThat(orderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

    // 3. ES2+ Release Profile
    Es2Dtos.ReleaseProfileRequest releaseReq = new Es2Dtos.ReleaseProfileRequest();
    releaseReq.setIccid("89000123456789012399");

    Es2Dtos.RequestHeader releaseHeader = new Es2Dtos.RequestHeader();
    releaseHeader.setFunctionRequesterIdentifier("OperatorX");
    releaseHeader.setFunctionCallIdentifier("TX-101");
    releaseReq.setHeader(releaseHeader);

    ResponseEntity<Es2Dtos.ReleaseProfileResponse> releaseResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es2plus/releaseProfile",
            releaseReq,
            Es2Dtos.ReleaseProfileResponse.class);
    assertThat(releaseResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

    // 4. ES9+ Initiate Authentication (Real Challenge)
    byte[] challBytes = new byte[16];
    new SecureRandom().nextBytes(challBytes);
    StringBuilder sb = new StringBuilder();
    for (byte b : challBytes) {
      sb.append(String.format("%02x", b));
    }
    String euiccChallengeStr = sb.toString();

    Es9Dtos.InitiateAuthenticationRequest initReq = new Es9Dtos.InitiateAuthenticationRequest();
    initReq.setEuiccChallenge(euiccChallengeStr);
    initReq.setSmdpAddress("localhost:8092");
    initReq.setEuiccInfo1("MOCK_EUICC_INFO_1");

    ResponseEntity<Es9Dtos.InitiateAuthenticationResponse> initResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/initiateAuthentication",
            initReq,
            Es9Dtos.InitiateAuthenticationResponse.class);
    assertThat(initResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.InitiateAuthenticationResponse initResponseBody =
        Objects.requireNonNull(initResponse.getBody());
    String transactionId = initResponseBody.getTransactionId();
    assertThat(transactionId).isNotBlank();

    // 5. Verify server signature and prepare real AuthenticateClientRequest
    String smdpSigned2Base64 = initResponseBody.getSmdpSigned2();
    String smdpSignature2Base64 = initResponseBody.getSmdpSignature2();
    String smdpCertificateBase64 = initResponseBody.getSmdpCertificate();

    byte[] signed2Bytes = Base64.getDecoder().decode(smdpSigned2Base64.trim());
    byte[] signature2Bytes = Base64.getDecoder().decode(smdpSignature2Base64.trim());
    byte[] certBytes = Base64.getDecoder().decode(smdpCertificateBase64.trim());

    // Parse Server Certificate
    java.security.cert.CertificateFactory cf =
        java.security.cert.CertificateFactory.getInstance("X.509");
    java.security.cert.X509Certificate serverCert =
        (java.security.cert.X509Certificate)
            cf.generateCertificate(new java.io.ByteArrayInputStream(certBytes));
    PublicKey serverPublicKey = serverCert.getPublicKey();

    // Verify signature
    Signature ecdsaVerify = Signature.getInstance("SHA256withECDSA", "BC");
    ecdsaVerify.initVerify(serverPublicKey);
    ecdsaVerify.update(signed2Bytes);
    assertThat(ecdsaVerify.verify(signature2Bytes)).isTrue();

    // Extract challenges
    String smdpChallenge = null;
    String euiccChallenge = null;
    try (ASN1InputStream asn1In = new ASN1InputStream(signed2Bytes)) {
      ASN1Primitive obj = asn1In.readObject();
      assertThat(obj).isInstanceOf(ASN1Sequence.class);
      ASN1Sequence seq = (ASN1Sequence) obj;
      smdpChallenge = ((DERPrintableString) seq.getObjectAt(1)).getString();
      euiccChallenge = ((DERPrintableString) seq.getObjectAt(2)).getString();
    }
    assertThat(smdpChallenge).isNotBlank();
    assertThat(euiccChallenge).isEqualTo(euiccChallengeStr);

    // Generate client EC signing key pair
    KeyPairGenerator kpgSign = KeyPairGenerator.getInstance("EC", "BC");
    kpgSign.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair clientSignKeyPair = kpgSign.generateKeyPair();

    // Build signedData sequence
    ASN1EncodableVector clientSignedVector = new ASN1EncodableVector();
    clientSignedVector.add(new DERPrintableString(transactionId));
    clientSignedVector.add(new DERPrintableString(euiccChallenge));
    clientSignedVector.add(new DERPrintableString(smdpChallenge));
    DERSequence clientSignedData = new DERSequence(clientSignedVector);
    byte[] clientSignedBytes = clientSignedData.getEncoded("DER");

    // Sign clientSignedBytes
    Signature ecdsaSign = Signature.getInstance("SHA256withECDSA", "BC");
    ecdsaSign.initSign(clientSignKeyPair.getPrivate());
    ecdsaSign.update(clientSignedBytes);
    byte[] clientSigBytes = ecdsaSign.sign();

    // Generate EUM CA cert and dynamic eUICC cert using the cryptoService helpers
    java.security.cert.X509Certificate eumCert = cryptoService.getEumCertificate();
    KeyPair eumKeyPair = cryptoService.getDeterministicKeyPair("EUM_CA_SEED");

    // Generate leaf eUICC cert signed by EUM CA
    java.security.cert.X509Certificate euiccCert =
        cryptoService.generateCertificate(
            "CN=eUICC-Simulated, O=eUICC-Manufacturer, C=US",
            clientSignKeyPair,
            "CN=EUM-CA-01, O=EUM-Manufacturer, C=US",
            eumKeyPair.getPrivate(),
            java.math.BigInteger.valueOf(3));

    // Assemble authenticateServerResponse ASN.1 sequence:
    // [0] clientSignedData, [1] clientSigBytes, [2] euiccCertificate, [3] eumCertificate
    ASN1EncodableVector authResponseVector = new ASN1EncodableVector();
    authResponseVector.add(clientSignedData);
    authResponseVector.add(new DEROctetString(clientSigBytes));
    authResponseVector.add(new DEROctetString(euiccCert.getEncoded()));
    authResponseVector.add(new DEROctetString(eumCert.getEncoded()));
    DERSequence authResponseSeq = new DERSequence(authResponseVector);
    String authenticateServerResponseBase64 =
        Base64.getEncoder().encodeToString(authResponseSeq.getEncoded("DER"));

    // Call ES9+ Authenticate Client
    Es9Dtos.AuthenticateClientRequest authReq = new Es9Dtos.AuthenticateClientRequest();
    authReq.setTransactionId(transactionId);
    authReq.setAuthenticateServerResponse(authenticateServerResponseBase64);

    ResponseEntity<Es9Dtos.AuthenticateClientResponse> authResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/authenticateClient",
            authReq,
            Es9Dtos.AuthenticateClientResponse.class);
    assertThat(authResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.AuthenticateClientResponse authResponseBody =
        Objects.requireNonNull(authResponse.getBody());
    assertThat(authResponseBody.getTransactionId()).isEqualTo(transactionId);

    // 6. Generate client EC Ephemeral key pair for real ECDH key agreement
    KeyPairGenerator kpgAg = KeyPairGenerator.getInstance("EC", "BC");
    kpgAg.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair clientEphemeralKeyPair = kpgAg.generateKeyPair();
    byte[] clientPublicKeyBytes = clientEphemeralKeyPair.getPublic().getEncoded();

    // Build DER Sequence for PrepareDownloadResponse
    ASN1EncodableVector prepareVector = new ASN1EncodableVector();
    prepareVector.add(new DERPrintableString(transactionId));
    prepareVector.add(new DEROctetString(clientPublicKeyBytes));
    DERSequence prepareSeq = new DERSequence(prepareVector);
    String prepareDownloadResponseBase64 =
        Base64.getEncoder().encodeToString(prepareSeq.getEncoded("DER"));

    // Call ES9+ Get Bound Profile Package (BPP)
    Es9Dtos.GetBoundProfilePackageRequest bppReq = new Es9Dtos.GetBoundProfilePackageRequest();
    bppReq.setTransactionId(transactionId);
    bppReq.setPrepareDownloadResponse(prepareDownloadResponseBase64);

    ResponseEntity<Es9Dtos.GetBoundProfilePackageResponse> bppResponse =
        restTemplate.postForEntity(
            "/gsma/rsp/v2/es9plus/getBoundProfilePackage",
            bppReq,
            Es9Dtos.GetBoundProfilePackageResponse.class);
    assertThat(bppResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    Es9Dtos.GetBoundProfilePackageResponse bppResponseBody =
        Objects.requireNonNull(bppResponse.getBody());
    assertThat(bppResponseBody.getTransactionId()).isEqualTo(transactionId);
    String bpp = bppResponseBody.getBoundProfilePackage();
    assertThat(bpp).isNotBlank();

    // 7. Decode BPP DER sequence and decrypt profile payload
    byte[] bppBytes = Base64.getDecoder().decode(bpp.trim());
    try (ASN1InputStream asn1In = new ASN1InputStream(bppBytes)) {
      ASN1Primitive obj = asn1In.readObject();
      assertThat(obj).isInstanceOf(ASN1Sequence.class);
      ASN1Sequence seq = (ASN1Sequence) obj;
      assertThat(seq.size()).isEqualTo(5);

      ASN1TaggedObject taggedEphPubKey = (ASN1TaggedObject) seq.getObjectAt(2);
      byte[] smdpEphemeralPubKeyBytes =
          ((ASN1OctetString) taggedEphPubKey.getBaseObject()).getOctets();

      ASN1TaggedObject taggedEncPayload = (ASN1TaggedObject) seq.getObjectAt(3);
      byte[] encPayload = ((ASN1OctetString) taggedEncPayload.getBaseObject()).getOctets();

      ASN1TaggedObject taggedCert = (ASN1TaggedObject) seq.getObjectAt(4);
      byte[] certBytesBpp = ((ASN1OctetString) taggedCert.getBaseObject()).getOctets();

      // Extract Server Public Key (long-term cert) for signature verification (if needed)
      java.security.cert.CertificateFactory cfBpp =
          java.security.cert.CertificateFactory.getInstance("X.509");
      java.security.cert.X509Certificate serverCertBpp =
          (java.security.cert.X509Certificate)
              cfBpp.generateCertificate(new java.io.ByteArrayInputStream(certBytesBpp));

      // Reconstruct SM-DP+ ephemeral public key
      KeyFactory kf = KeyFactory.getInstance("EC", "BC");
      PublicKey smdpEphemeralPublicKey =
          kf.generatePublic(new java.security.spec.X509EncodedKeySpec(smdpEphemeralPubKeyBytes));

      // Perform client-side ECDH key agreement using SM-DP+ ephemeral key
      KeyAgreement ka = KeyAgreement.getInstance("ECDH", "BC");
      ka.init(clientEphemeralKeyPair.getPrivate());
      ka.doPhase(smdpEphemeralPublicKey, true);
      byte[] sharedSecret = ka.generateSecret();

      // Derive symmetric key via SHA-256 KDF
      byte[] keyBytes = new byte[16];
      MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
      byte[] hashedSecret = sha256.digest(sharedSecret);
      System.arraycopy(hashedSecret, 0, keyBytes, 0, 16);
      SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");

      // Decrypt
      byte[] iv = new byte[12];
      byte[] ciphertext = new byte[encPayload.length - 12];
      System.arraycopy(encPayload, 0, iv, 0, 12);
      System.arraycopy(encPayload, 12, ciphertext, 0, ciphertext.length);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      GCMParameterSpec parameterSpec = new GCMParameterSpec(128, iv);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
      byte[] decryptedPayloadBytes = cipher.doFinal(ciphertext);

      // Verify that the decrypted payload length matches the exact imported profile payload Base64
      // size!
      assertThat(decryptedPayloadBytes.length).isEqualTo(16516);
    }
  }
}
