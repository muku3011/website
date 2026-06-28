package in.hutta.lpa.dto;

import lombok.Data;

public class LpaDtos {

    @Data
    public static class DownloadRequest {
        private String activationCode;
    }

    @Data
    public static class DownloadResponse {
        private boolean success;
        private String message;
        private String transactionId;
        private String iccid;
        private int boundProfilePackageSize;
        private String boundProfilePackage;
    }
}
