package in.hutta.lpa.controller;

import in.hutta.lpa.dto.IpaDtos.IpaStatusResponse;
import in.hutta.lpa.dto.IpaDtos.IpaTriggerRequest;
import in.hutta.lpa.dto.IpaDtos.IpaTriggerResponse;
import in.hutta.lpa.model.LocalProfile;
import in.hutta.lpa.repository.LocalProfileRepository;
import in.hutta.lpa.service.IpaTriggerService;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/ipa")
@CrossOrigin
@RequiredArgsConstructor
public class IpaController {

  private final IpaTriggerService ipaTriggerService;
  private final LocalProfileRepository localProfileRepository;

  @PostMapping("/trigger")
  public ResponseEntity<IpaTriggerResponse> receiveTrigger(@RequestBody IpaTriggerRequest request) {
    log.info("IPA: Received remote command trigger action={}", request.getAction());
    IpaTriggerResponse response = ipaTriggerService.processTrigger(request);
    if (response.isSuccess()) {
      return ResponseEntity.ok(response);
    } else {
      return ResponseEntity.badRequest().body(response);
    }
  }

  @GetMapping("/status")
  public ResponseEntity<IpaStatusResponse> getIpaStatus() {
    log.info("IPA: Fetching current eUICC profiles and console logs");

    // Filter profiles where sim_type is 'IPA'
    List<LocalProfile> ipaProfiles =
        localProfileRepository.findAll().stream()
            .filter(p -> "IPA".equals(p.getSimType()))
            .collect(Collectors.toList());

    IpaStatusResponse response = new IpaStatusResponse();
    response.setProfiles(ipaProfiles);
    response.setLogs(ipaTriggerService.getLogs());
    return ResponseEntity.ok(response);
  }

  @PostMapping("/logs/clear")
  public ResponseEntity<Void> clearLogs() {
    ipaTriggerService.clearLogs();
    return ResponseEntity.ok().build();
  }
}
