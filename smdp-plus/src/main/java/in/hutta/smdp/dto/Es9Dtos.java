package in.hutta.smdp.dto;

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
        private String smdpSigned2; // Base64 DER ASN.1 of SM-DP+ Challenge details
        private String smdpSignature2; // Base64 ECDSA signature of smdpSigned2
        private String smdpCertificate; // Base64 SM-DP+ Cert chain
    }

    @Data
    public static class AuthenticateClientRequest {
        private String transactionId;
        private String authenticateServerResponse; // Base64 DER ASN.1 containing eUICC signed data
    }

    @Data
    public static class AuthenticateClientResponse {
        private String transactionId;
        private String smdpSigned3; // Base64 DER ASN.1 containing server auth response
        private String smdpSignature3; // Base64 ECDSA signature of smdpSigned3
    }

    @Data
    public static class GetBoundProfilePackageRequest {
        private String transactionId;
        private String prepareDownloadResponse; // Base64 DER ASN.1 containing eUICC ready download token
    }

    @Data
    public static class GetBoundProfilePackageResponse {
        private String transactionId;
        private String boundProfilePackage; // Base64 DER Bound Profile Package (BPP)
    }

    @Data
    public static class CancelSessionRequest {
        private String transactionId;
        private String cancelSessionResponse; // Base64 eUICC signed cancellation
    }

    @Data
    public static class CancelSessionResponse {
        private String status; // Executed-Success, Failed
        private String code;
    }

    @Data
    public static class HandleNotificationRequest {
        private PendingNotification pendingNotification;
    }

    @Data
    public static class PendingNotification {
        private String profileManagementOperation;
        private String iccid;
        private String notificationAddress;
    }
}
