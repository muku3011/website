package in.hutta.lpa.dto;

import lombok.Data;

public class Es9Dtos {

  @Data
  public static class InitiateAuthenticationRequest {
    private String euiccChallenge;
    private String smdpAddress;
    private String euiccInfo1;
  }

  @Data
  public static class InitiateAuthenticationResponse {
    private String transactionId;
    private String smdpSigned2;
    private String smdpSignature2;
    private String smdpCertificate;
  }

  @Data
  public static class AuthenticateClientRequest {
    private String transactionId;
    private String authenticateServerResponse;
  }

  @Data
  public static class AuthenticateClientResponse {
    private String transactionId;
    private String smdpSigned3;
    private String smdpSignature3;
  }

  @Data
  public static class GetBoundProfilePackageRequest {
    private String transactionId;
    private String prepareDownloadResponse;
  }

  @Data
  public static class GetBoundProfilePackageResponse {
    private String transactionId;
    private String boundProfilePackage;
  }
}
