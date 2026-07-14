package in.hutta.monitor.controller;

import in.hutta.monitor.repository.SecurityIncidentRepository;
import in.hutta.monitor.service.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sentinel")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class SentinelController {

  private final SystemMetricsService systemMetrics;
  private final ServiceStatusService serviceStatus;
  private final DatabaseStatusService databaseStatus;
  private final SecurityMetricsService securityMetrics;
  private final CertificateService certificateService;
  private final DnsService dnsService;
  private final TrafficService trafficService;
  private final SecurityIncidentRepository securityIncidentRepository;

  private final PostgresStatsService postgresStats;
  private final IoMetricsService ioMetrics;
  private final BackupMonitorService backupMonitor;
  private final ActuatorService actuatorService;

  private static final Set<String> ALLOWED_SERVICES =
      Set.of(
          "postgresql",
          "keycloak",
          "apache2",
          "smdp-plus",
          "lpa-simulator",
          "blog-service",
          "monitor-service");

  private static final Set<String> ALLOWED_ACTIONS = Set.of("start", "stop", "restart");

  @GetMapping("/system")
  public Map<String, Object> system() {
    return systemMetrics.collect();
  }

  @GetMapping("/services")
  public Object services() {
    return serviceStatus.collect();
  }

  @GetMapping("/databases")
  public Object databases() {
    return databaseStatus.collect();
  }

  @GetMapping("/security")
  public Map<String, Object> security() {
    return securityMetrics.collect();
  }

  @GetMapping("/certificates")
  public Object certificates() {
    return certificateService.collect();
  }

  @GetMapping("/dns")
  public Map<String, Object> dns() {
    return dnsService.collect();
  }

  @GetMapping("/security/incidents")
  public Object securityIncidents() {
    return securityIncidentRepository.findTop100ByOrderByTimestampDesc();
  }

  @GetMapping("/traffic")
  public Map<String, Object> traffic() {
    return trafficService.collect();
  }

  @GetMapping("/postgres/stats")
  public List<Map<String, Object>> postgresStats() {
    return postgresStats.collect();
  }

  @GetMapping("/io")
  public Map<String, Object> io() {
    return ioMetrics.collect();
  }

  @GetMapping("/backups")
  public Map<String, Object> backups() {
    return backupMonitor.collect();
  }

  @GetMapping("/actuator")
  public List<Map<String, Object>> actuator() {
    return actuatorService.collect();
  }

  @PostMapping("/services/control")
  public ResponseEntity<Map<String, String>> controlService(
      @RequestBody Map<String, String> request) {
    String service = request.get("service");
    String action = request.get("action");
    Map<String, String> response = new HashMap<>();

    if (service == null || !ALLOWED_SERVICES.contains(service)) {
      response.put("error", "Invalid or forbidden service: " + service);
      return ResponseEntity.badRequest().body(response);
    }

    if (action == null || !ALLOWED_ACTIONS.contains(action)) {
      response.put("error", "Invalid or forbidden action: " + action);
      return ResponseEntity.badRequest().body(response);
    }

    try {
      log.info("Sentinel: controlling service {} with action {}", service, action);
      systemMetrics.runCommand("sudo", "systemctl", action, service);
      response.put("status", "SUCCESS");
      response.put("message", "Executed systemctl " + action + " " + service);
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      log.error("Failed to run systemctl {} {}: {}", action, service, e.getMessage());
      response.put("error", e.getMessage());
      return ResponseEntity.internalServerError().body(response);
    }
  }

  @GetMapping("/logs")
  public ResponseEntity<Map<String, String>> getLogs(
      @RequestParam String service, @RequestParam(defaultValue = "100") int lines) {
    Map<String, String> response = new HashMap<>();

    if (!ALLOWED_SERVICES.contains(service)) {
      response.put("error", "Invalid or forbidden service: " + service);
      return ResponseEntity.badRequest().body(response);
    }

    int limit = Math.min(1000, Math.max(10, lines));

    try {
      String logsOutput =
          systemMetrics.runCommand(
              "journalctl", "-u", service, "-n", String.valueOf(limit), "--no-pager");
      response.put("service", service);
      response.put("logs", logsOutput);
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      log.error("Failed to retrieve logs for service {}: {}", service, e.getMessage());
      response.put("error", e.getMessage());
      return ResponseEntity.internalServerError().body(response);
    }
  }
}
