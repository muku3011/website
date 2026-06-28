package in.hutta.lpa;

import in.hutta.lpa.dto.LpaDtos.DownloadResponse;
import in.hutta.lpa.service.LpaDownloadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@SpringBootTest
public class LpaDownloadTest {

    @Autowired
    private LpaDownloadService lpaDownloadService;

    private MockRestServiceServer mockServer;

    @BeforeEach
    public void setUp() throws Exception {
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

        mockServer.expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/initiateAuthentication"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"transactionId\":\"tx123\",\"smdpSigned2\":\"smdpSigned2Data\"}",
                        MediaType.APPLICATION_JSON
                ));

        mockServer.expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/authenticateClient"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.transactionId").value("tx123"))
                .andRespond(withSuccess(
                        "{\"transactionId\":\"tx123\",\"smdpSigned3\":\"smdpSigned3Data\"}",
                        MediaType.APPLICATION_JSON
                ));

        mockServer.expect(requestTo("http://" + testAddress + "/gsma/rsp/v2/es9plus/getBoundProfilePackage"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.transactionId").value("tx123"))
                .andRespond(withSuccess(
                        "{\"transactionId\":\"tx123\",\"boundProfilePackage\":\"mockBppContentBinaryPayloadBase64\"}",
                        MediaType.APPLICATION_JSON
                ));

        DownloadResponse result = lpaDownloadService.downloadProfile(activationCode);

        mockServer.verify();

        assertTrue(result.isSuccess());
        assertEquals("tx123", result.getTransactionId());
        assertEquals(testIccid, result.getIccid());
        assertEquals("mockBppContentBinaryPayloadBase64", result.getBoundProfilePackage());
        assertEquals("Profile downloaded successfully", result.getMessage());
    }

    @Test
    public void testInvalidActivationCode() {
        DownloadResponse result = lpaDownloadService.downloadProfile("INVALID_CODE");
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("Invalid activation code format"));
    }
}
