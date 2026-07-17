package in.hutta.lpa.controller;

import in.hutta.lpa.dto.LpaDtos.DownloadRequest;
import in.hutta.lpa.dto.LpaDtos.DownloadResponse;
import in.hutta.lpa.service.LpaDownloadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/lpa")
@CrossOrigin
@RequiredArgsConstructor
public class LpaController {

  private final LpaDownloadService lpaDownloadService;

  @PostMapping("/download")
  public ResponseEntity<DownloadResponse> downloadProfile(@RequestBody DownloadRequest request) {
    log.info("Received LPA download request for activation code: {}", request.getActivationCode());
    DownloadResponse response = lpaDownloadService.downloadProfile(request.getActivationCode());
    if (response.isSuccess()) {
      return ResponseEntity.ok(response);
    } else {
      return ResponseEntity.badRequest().body(response);
    }
  }
}
