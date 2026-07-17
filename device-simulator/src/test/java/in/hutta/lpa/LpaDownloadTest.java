package in.hutta.lpa;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import in.hutta.lpa.dto.LpaDtos.DownloadResponse;
import in.hutta.lpa.service.LpaDownloadService;
import java.lang.reflect.Field;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

@SpringBootTest
public class LpaDownloadTest {

  @Autowired private LpaDownloadService lpaDownloadService;

  @Autowired private in.hutta.lpa.repository.LocalProfileRepository localProfileRepository;

  private MockRestServiceServer mockServer;

  @BeforeEach
  public void setUp() throws Exception {
    localProfileRepository.deleteAll();
    Field restTemplateField = LpaDownloadService.class.getDeclaredField("restTemplate");
    restTemplateField.setAccessible(true);
    RestTemplate restTemplate = (RestTemplate) restTemplateField.get(lpaDownloadService);
    mockServer = MockRestServiceServer.createServer(restTemplate);
  }

  @Test
  public void testSuccessfulDownloadHandshake() {
    String testAddress = "localhost:8092";
    String testIccid = "89000123456789012399";
    String activationCode = "LPA:1$" + testAddress + "$" + testIccid;

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/initiateAuthentication"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"smdpSigned2\":\"smdpSigned2Data\"}",
                MediaType.APPLICATION_JSON));

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/authenticateClient"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(jsonPath("$.transactionId").value("tx123"))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"smdpSigned3\":\"smdpSigned3Data\"}",
                MediaType.APPLICATION_JSON));

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/getBoundProfilePackage"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(jsonPath("$.transactionId").value("tx123"))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"boundProfilePackage\":\"mockBppContentBinaryPayloadBase64\"}",
                MediaType.APPLICATION_JSON));

    DownloadResponse result = lpaDownloadService.downloadProfile(activationCode);

    mockServer.verify();

    assertTrue(result.isSuccess());
    assertEquals("tx123", result.getTransactionId());
    assertEquals(testIccid, result.getIccid());
    assertEquals("mockBppContentBinaryPayloadBase64", result.getBoundProfilePackage());
    assertEquals("Profile downloaded successfully", result.getMessage());
  }

  @Test
  public void testMetadataExtractionFromBpp() {
    String testAddress = "localhost:8092";
    String testIccid = "89000123456789012399";
    String activationCode = "LPA:1$" + testAddress + "$" + testIccid;

    // Build mock payload bytes: tag 0x84 (sysmocom), tag 0x85 (Test Profile)
    byte[] payloadBytes = {
      (byte) 0x84,
      0x08,
      's',
      'y',
      's',
      'm',
      'o',
      'c',
      'o',
      'm',
      (byte) 0x85,
      0x0c,
      'T',
      'e',
      's',
      't',
      ' ',
      'P',
      'r',
      'o',
      'f',
      'i',
      'l',
      'e'
    };
    String payloadBase64 = java.util.Base64.getEncoder().encodeToString(payloadBytes);
    String bppRawString =
        String.format("BPP[transactionId=tx123,iccid=%s,payload=%s]", testIccid, payloadBase64);
    String bppBase64 =
        java.util.Base64.getEncoder()
            .encodeToString(bppRawString.getBytes(java.nio.charset.StandardCharsets.UTF_8));

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/initiateAuthentication"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"smdpSigned2\":\"smdpSigned2Data\"}",
                MediaType.APPLICATION_JSON));

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/authenticateClient"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"smdpSigned3\":\"smdpSigned3Data\"}",
                MediaType.APPLICATION_JSON));

    mockServer
        .expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/getBoundProfilePackage"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"transactionId\":\"tx123\",\"boundProfilePackage\":\"" + bppBase64 + "\"}",
                MediaType.APPLICATION_JSON));

    DownloadResponse result = lpaDownloadService.downloadProfile(activationCode);
    mockServer.verify();

    assertTrue(result.isSuccess());
    assertEquals("tx123", result.getTransactionId());
    assertEquals(testIccid, result.getIccid());

    // Verify it was saved in DB with correct metadata
    java.util.Optional<in.hutta.lpa.model.LocalProfile> savedOpt =
        localProfileRepository.findById(testIccid);
    assertTrue(savedOpt.isPresent());
    in.hutta.lpa.model.LocalProfile profile = savedOpt.get();
    assertEquals("sysmocom", profile.getServiceProviderName());
    assertEquals("Test Profile", profile.getProfileNickname());
  }

  @Test
  public void testInvalidActivationCode() {
    DownloadResponse result = lpaDownloadService.downloadProfile("INVALID_CODE");
    assertFalse(result.isSuccess());
    assertTrue(result.getMessage().contains("Invalid activation code format"));
  }
}
