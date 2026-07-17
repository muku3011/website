package in.hutta.lpa.dto;

import in.hutta.lpa.model.LocalProfile;
import java.util.List;
import lombok.Data;

public class IpaDtos {

  @Data
  public static class IpaTriggerRequest {
    private String action; // DOWNLOAD, ENABLE, DISABLE, DELETE
    private String activationCode; // For DOWNLOAD
    private String iccid; // For ENABLE, DISABLE, DELETE
    private String signature; // Hex-encoded eIM signature
    private String transactionId; // Unique session ID
  }

  @Data
  public static class IpaTriggerResponse {
    private boolean success;
    private String message;
    private String iccid;
  }

  @Data
  public static class IpaStatusResponse {
    private List<LocalProfile> profiles;
    private List<String> logs;
  }
}
