package in.hutta.smdp.dto;

import lombok.Data;

public class Es2Dtos {

    @Data
    public static class RequestHeader {
        private String functionRequesterIdentifier;
        private String functionCallIdentifier;
    }

    @Data
    public static class ResponseHeader {
        private FunctionExecutionStatus functionExecutionStatus;
    }

    @Data
    public static class FunctionExecutionStatus {
        private String status; // Executed-Success, Executed-WithWarning, Failed
        private String code;
        private String message;
    }

    @Data
    public static class DownloadOrderRequest {
        private RequestHeader header;
        private String eid;
        private String iccid;
        private String profileType;
    }

    @Data
    public static class DownloadOrderResponse {
        private ResponseHeader header;
        private String iccid;
    }

    @Data
    public static class ConfirmOrderRequest {
        private RequestHeader header;
        private String iccid;
        private String eid;
        private String matchingId;
        private Boolean confirmationCodeRequired;
    }

    @Data
    public static class ConfirmOrderResponse {
        private ResponseHeader header;
        private String matchingId;
    }

    @Data
    public static class CancelOrderRequest {
        private RequestHeader header;
        private String iccid;
        private String eid;
        private String matchingId;
    }

    @Data
    public static class CancelOrderResponse {
        private ResponseHeader header;
    }

    @Data
    public static class ReleaseProfileRequest {
        private RequestHeader header;
        private String iccid;
    }

    @Data
    public static class ReleaseProfileResponse {
        private ResponseHeader header;
    }

    public static ResponseHeader successHeader() {
        ResponseHeader header = new ResponseHeader();
        FunctionExecutionStatus status = new FunctionExecutionStatus();
        status.setStatus("Executed-Success");
        status.setCode("1");
        status.setMessage("Success");
        header.setFunctionExecutionStatus(status);
        return header;
    }

    public static ResponseHeader failureHeader(String code, String message) {
        ResponseHeader header = new ResponseHeader();
        FunctionExecutionStatus status = new FunctionExecutionStatus();
        status.setStatus("Failed");
        status.setCode(code);
        status.setMessage(message);
        header.setFunctionExecutionStatus(status);
        return header;
    }
}
