package in.hutta.smdp.controller;

import in.hutta.smdp.dto.Es2Dtos.CancelOrderRequest;
import in.hutta.smdp.dto.Es2Dtos.CancelOrderResponse;
import in.hutta.smdp.dto.Es2Dtos.ConfirmOrderRequest;
import in.hutta.smdp.dto.Es2Dtos.ConfirmOrderResponse;
import in.hutta.smdp.dto.Es2Dtos.DownloadOrderRequest;
import in.hutta.smdp.dto.Es2Dtos.DownloadOrderResponse;
import in.hutta.smdp.dto.Es2Dtos.ReleaseProfileRequest;
import in.hutta.smdp.dto.Es2Dtos.ReleaseProfileResponse;
import in.hutta.smdp.dto.Es2Dtos.ResponseHeader;
import in.hutta.smdp.model.Profile;
import in.hutta.smdp.service.ProfileService;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin
@RestController
@RequestMapping("/gsma/rsp/v2/es2plus")
public class Es2PlusController {
  private static final Logger log = LoggerFactory.getLogger(Es2PlusController.class);

  @Autowired private ProfileService profileService;

  @PostMapping("/downloadOrder")
  public ResponseEntity<DownloadOrderResponse> downloadOrder(
      @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
      @RequestBody DownloadOrderRequest request) {
    log.info("ES2+ downloadOrder call, protocol={}", adminProtocol);

    Optional<Profile> profileOpt =
        profileService.downloadOrder(
            request.getEid(), request.getIccid(), request.getProfileType());

    DownloadOrderResponse response = new DownloadOrderResponse();
    if (profileOpt.isPresent()) {
      response.setHeader(successHeader());
      response.setIccid(profileOpt.get().getIccid());
      return ResponseEntity.ok(response);
    } else {
      response.setHeader(failureHeader("8.1.1", "Profile Not Available or Already Reserved"));
      return ResponseEntity.status(400).body(response);
    }
  }

  @PostMapping("/confirmOrder")
  public ResponseEntity<ConfirmOrderResponse> confirmOrder(
      @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
      @RequestBody ConfirmOrderRequest request) {
    log.info("ES2+ confirmOrder call, protocol={}", adminProtocol);

    boolean isConfirmed = profileService.confirmOrder(request.getIccid(), request.getEid());

    ConfirmOrderResponse response = new ConfirmOrderResponse();
    if (isConfirmed) {
      response.setHeader(successHeader());
      response.setMatchingId(
          request.getMatchingId() != null ? request.getMatchingId() : "MATCHING_ID_DEFAULT");
      return ResponseEntity.ok(response);
    } else {
      response.setHeader(failureHeader("8.1.2", "Order Confirmation Failed"));
      return ResponseEntity.status(400).body(response);
    }
  }

  @PostMapping("/cancelOrder")
  public ResponseEntity<CancelOrderResponse> cancelOrder(
      @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
      @RequestBody CancelOrderRequest request) {
    log.info("ES2+ cancelOrder call, protocol={}", adminProtocol);

    boolean isCancelled = profileService.cancelOrder(request.getIccid(), request.getEid());

    CancelOrderResponse response = new CancelOrderResponse();
    if (isCancelled) {
      response.setHeader(successHeader());
      return ResponseEntity.ok(response);
    } else {
      response.setHeader(failureHeader("8.1.3", "Order Cancellation Failed"));
      return ResponseEntity.status(400).body(response);
    }
  }

  @PostMapping("/releaseProfile")
  public ResponseEntity<ReleaseProfileResponse> releaseProfile(
      @RequestHeader(value = "X-Admin-Protocol", required = false) String adminProtocol,
      @RequestBody ReleaseProfileRequest request) {
    log.info("ES2+ releaseProfile call, protocol={}", adminProtocol);

    boolean isReleased = profileService.releaseProfile(request.getIccid());

    ReleaseProfileResponse response = new ReleaseProfileResponse();
    if (isReleased) {
      response.setHeader(successHeader());
      return ResponseEntity.ok(response);
    } else {
      response.setHeader(failureHeader("8.1.4", "Profile Release Failed"));
      return ResponseEntity.status(400).body(response);
    }
  }

  private ResponseHeader successHeader() {
    return in.hutta.smdp.dto.Es2Dtos.successHeader();
  }

  private ResponseHeader failureHeader(String code, String message) {
    return in.hutta.smdp.dto.Es2Dtos.failureHeader(code, message);
  }
}
