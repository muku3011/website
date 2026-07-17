package in.hutta.eim.controller;

import in.hutta.eim.model.EimAuditLog;
import in.hutta.eim.model.IotDevice;
import in.hutta.eim.repository.EimAuditLogRepository;
import in.hutta.eim.repository.IotDeviceRepository;
import in.hutta.eim.service.EimCryptoService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@Slf4j
@RestController
@RequestMapping("/api/eim/devices")
@CrossOrigin
@RequiredArgsConstructor
public class DeviceController {

  private final IotDeviceRepository deviceRepository;
  private final EimAuditLogRepository auditLogRepository;
  private final EimCryptoService cryptoService;
  private final RestTemplate restTemplate = new RestTemplate();

  private final String smdpUrl = "http://127.0.0.1:8092/gsma/rsp/v2/es2plus";
  private final String smdpAddress = "127.0.0.1:8092";
  private final String ipaUrl = "http://127.0.0.1:8097/ipa";

  @GetMapping
  public ResponseEntity<List<IotDevice>> listDevices() {
    log.info("eIM: Fetching IoT fleet devices");
    return ResponseEntity.ok(deviceRepository.findAll());
  }

  @PostMapping
  public ResponseEntity<IotDevice> registerDevice(@RequestBody Map<String, String> payload) {
    String eid = payload.get("eid");
    String name = payload.get("deviceName");

    if (eid == null || name == null) {
      return ResponseEntity.badRequest().build();
    }

    log.info("eIM: Registering new IoT device EID={}, name={}", eid, name);
    IotDevice device = new IotDevice(eid, name, "ACTIVE", LocalDateTime.now(), LocalDateTime.now());
    deviceRepository.save(device);

    EimAuditLog audit = new EimAuditLog();
    audit.setTimestamp(LocalDateTime.now());
    audit.setActorUsername("KeycloakUser");
    audit.setAction("REGISTER");
    audit.setTargetEid(eid);
    audit.setStatus("SUCCESS");
    audit.setDetails("Device registered with name: " + name);
    auditLogRepository.save(audit);

    return ResponseEntity.ok(device);
  }

  @DeleteMapping("/{eid}")
  public ResponseEntity<?> deregisterDevice(@PathVariable String eid) {
    log.info("eIM: Deregistering IoT device EID={}", eid);
    java.util.Optional<IotDevice> deviceOpt = deviceRepository.findById(eid);
    if (deviceOpt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }

    deviceRepository.deleteById(eid);

    EimAuditLog audit = new EimAuditLog();
    audit.setTimestamp(LocalDateTime.now());
    audit.setActorUsername("KeycloakUser");
    audit.setAction("DEREGISTER");
    audit.setTargetEid(eid);
    audit.setStatus("SUCCESS");
    audit.setDetails("Device deregistered/deleted");
    auditLogRepository.save(audit);

    return ResponseEntity.ok(java.util.Map.of("success", true));
  }

  @PostMapping("/{eid}/download")
  public ResponseEntity<?> triggerDownload(
      @PathVariable String eid, @RequestBody Map<String, String> body) {
    String iccid = body.get("iccid");
    String profileType = body.get("profileType");

    log.info(
        "eIM: Triggering remote download for EID={}, ICCID={}, profileType={}",
        eid,
        iccid,
        profileType);

    EimAuditLog audit = new EimAuditLog();
    audit.setTimestamp(LocalDateTime.now());
    audit.setActorUsername("KeycloakUser");
    audit.setAction("DOWNLOAD");
    audit.setTargetEid(eid);
    audit.setTargetIccid(iccid);

    try {
      // 1. Call SM-DP+ downloadOrder
      Map<String, Object> orderReq = new HashMap<>();
      orderReq.put("eid", eid);
      orderReq.put("iccid", iccid);
      orderReq.put("profileType", profileType);

      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      HttpEntity<Map<String, Object>> entity = new HttpEntity<>(orderReq, headers);

      log.info("eIM calling SM-DP+ downloadOrder at: {}", smdpUrl + "/downloadOrder");
      ResponseEntity<Map<String, Object>> orderResp =
          restTemplate.exchange(
              smdpUrl + "/downloadOrder",
              HttpMethod.POST,
              entity,
              new ParameterizedTypeReference<Map<String, Object>>() {});

      if (orderResp.getStatusCode() != HttpStatus.OK || orderResp.getBody() == null) {
        throw new IllegalStateException(
            "SM-DP+ downloadOrder failed: " + orderResp.getStatusCode());
      }

      // 2. Call SM-DP+ confirmOrder
      Map<String, Object> confirmReq = new HashMap<>();
      confirmReq.put("eid", eid);
      confirmReq.put("iccid", iccid);
      confirmReq.put(
          "matchingId", "MATCHING-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

      HttpEntity<Map<String, Object>> confirmEntity = new HttpEntity<>(confirmReq, headers);
      log.info("eIM calling SM-DP+ confirmOrder at: {}", smdpUrl + "/confirmOrder");
      ResponseEntity<Map<String, Object>> confirmResp =
          restTemplate.exchange(
              smdpUrl + "/confirmOrder",
              HttpMethod.POST,
              confirmEntity,
              new ParameterizedTypeReference<Map<String, Object>>() {});

      if (confirmResp.getStatusCode() != HttpStatus.OK || confirmResp.getBody() == null) {
        throw new IllegalStateException("SM-DP+ confirmOrder failed");
      }

      String matchingId = (String) confirmResp.getBody().get("matchingId");

      // 3. Create Download Trigger
      String activationCode = "LPA:1$" + smdpAddress + "$" + matchingId;
      String transactionId = UUID.randomUUID().toString();
      String rawDataToSign = activationCode + "|" + transactionId;
      String signature = cryptoService.signTrigger(rawDataToSign);

      Map<String, String> ipaTrigger = new HashMap<>();
      ipaTrigger.put("action", "DOWNLOAD");
      ipaTrigger.put("activationCode", activationCode);
      ipaTrigger.put("signature", signature);
      ipaTrigger.put("transactionId", transactionId);

      // 4. Send to IPA Simulator on Port 8097
      log.info("eIM sending remote trigger to IPA at: {}/trigger", ipaUrl);
      HttpEntity<Map<String, String>> ipaEntity = new HttpEntity<>(ipaTrigger, headers);
      ResponseEntity<Map<String, Object>> ipaResp =
          restTemplate.exchange(
              ipaUrl + "/trigger",
              HttpMethod.POST,
              ipaEntity,
              new ParameterizedTypeReference<Map<String, Object>>() {});

      if (ipaResp.getStatusCode() == HttpStatus.OK) {
        audit.setStatus("SUCCESS");
        audit.setDetails("Triggered download of activationCode: " + activationCode);
        auditLogRepository.save(audit);
        return ResponseEntity.ok(
            Map.of("success", true, "message", "Download triggered successfully."));
      } else {
        throw new IllegalStateException(
            "IPA Simulator rejected trigger download: " + ipaResp.getStatusCode());
      }

    } catch (Exception e) {
      log.error("Failed to execute remote download: {}", e.getMessage(), e);
      audit.setStatus("FAILED");
      audit.setDetails("Error: " + e.getMessage());
      auditLogRepository.save(audit);
      return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
    }
  }

  @PostMapping("/{eid}/psmo")
  public ResponseEntity<?> triggerPsmo(
      @PathVariable String eid, @RequestBody Map<String, String> body) {
    String iccid = body.get("iccid");
    String operation = body.get("operation");

    log.info("eIM: Triggering remote PSMO {} for EID={}, ICCID={}", operation, eid, iccid);

    EimAuditLog audit = new EimAuditLog();
    audit.setTimestamp(LocalDateTime.now());
    audit.setActorUsername("KeycloakUser");
    audit.setAction(operation);
    audit.setTargetEid(eid);
    audit.setTargetIccid(iccid);

    try {
      String transactionId = UUID.randomUUID().toString();
      String rawDataToSign = operation + "|" + iccid + "|" + transactionId;
      String signature = cryptoService.signTrigger(rawDataToSign);

      Map<String, String> ipaTrigger = new HashMap<>();
      ipaTrigger.put("action", operation);
      ipaTrigger.put("iccid", iccid);
      ipaTrigger.put("signature", signature);
      ipaTrigger.put("transactionId", transactionId);

      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      HttpEntity<Map<String, String>> ipaEntity = new HttpEntity<>(ipaTrigger, headers);

      log.info("eIM sending remote trigger {} to IPA at: {}/trigger", operation, ipaUrl);
      ResponseEntity<Map<String, Object>> ipaResp =
          restTemplate.exchange(
              ipaUrl + "/trigger",
              HttpMethod.POST,
              ipaEntity,
              new ParameterizedTypeReference<Map<String, Object>>() {});

      if (ipaResp.getStatusCode() == HttpStatus.OK) {
        audit.setStatus("SUCCESS");
        audit.setDetails("Successfully completed remote operation: " + operation);
        auditLogRepository.save(audit);
        return ResponseEntity.ok(
            Map.of("success", true, "message", operation + " operation executed successfully."));
      } else {
        throw new IllegalStateException(
            "IPA Simulator rejected command trigger: " + ipaResp.getStatusCode());
      }

    } catch (Exception e) {
      log.error("Failed to execute remote PSMO {}: {}", operation, e.getMessage(), e);
      audit.setStatus("FAILED");
      audit.setDetails("Error: " + e.getMessage());
      auditLogRepository.save(audit);
      return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
    }
  }
}
