package in.hutta.eim.controller;

import in.hutta.eim.model.EimAuditLog;
import in.hutta.eim.repository.EimAuditLogRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/eim/audit-logs")
@CrossOrigin
@RequiredArgsConstructor
public class AuditLogController {

  private final EimAuditLogRepository auditLogRepository;

  @GetMapping
  public ResponseEntity<List<EimAuditLog>> getAuditLogs() {
    log.info("eIM Service: Fetching security audit logs");
    return ResponseEntity.ok(auditLogRepository.findAllByOrderByTimestampDesc());
  }
}
