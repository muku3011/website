package in.hutta.lpa.service;

import in.hutta.lpa.model.LocalProfile;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Shared service for sending lifecycle notifications to the SM-DP+ server.
 *
 * <p>Per GSMA SGP.22 §5.6.3, the LPA/IPA must inform the SM-DP+ of profile management operations
 * (delete, enable, disable, install) so the server can synchronise its profile state.
 */
@Slf4j
@Service
public class SmdpNotificationService {

  private final RestTemplate restTemplate = new RestTemplate();

  /**
   * Resolves the base URL scheme for the given SM-DP+ address. Uses HTTPS for public domains and
   * HTTP for loopback addresses.
   */
  private String resolveProtocol(String smdpAddress) {
    if (smdpAddress.contains("hutta.in")
        || (!smdpAddress.contains("localhost") && !smdpAddress.contains("127.0.0.1"))) {
      return "https";
    }
    return "http";
  }

  /**
   * Sends a profile management operation notification to the SM-DP+ ES9+ handleNotification
   * endpoint.
   *
   * @param profile the local profile whose lifecycle event is being reported
   * @param operation the GSMA operation string (delete, enable, disable, install)
   */
  public void notifyProfileOperation(LocalProfile profile, String operation) {
    String smdpAddress = profile.getSmdpAddress();
    if (smdpAddress == null || smdpAddress.trim().isEmpty()) {
      log.warn(
          "SmdpNotificationService: smdpAddress is not set for ICCID={}, skipping {} notification",
          profile.getIccid(),
          operation);
      return;
    }

    String protocol = resolveProtocol(smdpAddress);
    String url = protocol + "://" + smdpAddress + "/gsma/rsp/v2/es9plus/handleNotification";
    log.info("SmdpNotificationService: Sending '{}' notification to SM-DP+ at {}", operation, url);

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("User-Agent", "gsma-rsp-lpa/3.0.0");

    Map<String, Object> pendingNotification =
        Map.of(
            "profileManagementOperation", operation,
            "iccid", profile.getIccid(),
            "notificationAddress", smdpAddress);
    Map<String, Object> requestBody = Map.of("pendingNotification", pendingNotification);

    HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
    restTemplate.postForEntity(url, entity, Void.class);
    log.info(
        "SmdpNotificationService: Successfully sent '{}' notification for ICCID={}",
        operation,
        profile.getIccid());
  }
}
