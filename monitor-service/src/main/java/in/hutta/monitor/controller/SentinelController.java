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

  @GetMapping("/security/fail2ban/banned")
  public ResponseEntity<List<Map<String, String>>> getBannedIps() {
    List<Map<String, String>> bannedList = new java.util.ArrayList<>();
    try {
      String statusOutput = systemMetrics.runCommand("sudo", "fail2ban-client", "status");
      log.debug("Fail2ban global status: {}", statusOutput);

      String jailListLine = "";
      for (String line : statusOutput.split("\n")) {
        if (line.contains("Jail list:")) {
          jailListLine = line;
          break;
        }
      }

      if (!jailListLine.isEmpty()) {
        String jailsRaw = jailListLine.substring(jailListLine.indexOf("Jail list:") + 10).trim();
        String[] jails = jailsRaw.split(",\\s*");

        for (String jail : jails) {
          jail = jail.trim();
          if (jail.isEmpty()) continue;

          String jailStatus = systemMetrics.runCommand("sudo", "fail2ban-client", "status", jail);
          log.debug("Fail2ban jail {} status: {}", jail, jailStatus);

          String bannedIpsLine = "";
          for (String line : jailStatus.split("\n")) {
            if (line.contains("Banned IP list:")) {
              bannedIpsLine = line;
              break;
            }
          }

          if (!bannedIpsLine.isEmpty()) {
            String ipsRaw =
                bannedIpsLine.substring(bannedIpsLine.indexOf("Banned IP list:") + 15).trim();
            if (!ipsRaw.isEmpty()) {
              String[] ips = ipsRaw.split("\\s+");
              for (String ip : ips) {
                ip = ip.trim();
                if (ip.isEmpty()) continue;
                Map<String, String> entry = new HashMap<>();
                entry.put("ip", ip);
                entry.put("jail", jail);
                bannedList.add(entry);
              }
            }
          }
        }
      }
    } catch (Exception e) {
      log.error("Failed to fetch banned IPs: {}", e.getMessage(), e);
      return ResponseEntity.internalServerError().build();
    }
    return ResponseEntity.ok(bannedList);
  }

  @PostMapping("/security/fail2ban/unban")
  public ResponseEntity<Map<String, String>> unbanIp(@RequestBody Map<String, String> request) {
    String ip = request.get("ip");
    String jail = request.get("jail");
    Map<String, String> response = new HashMap<>();

    if (ip == null || ip.isBlank() || jail == null || jail.isBlank()) {
      response.put("error", "Missing IP or Jail");
      return ResponseEntity.badRequest().body(response);
    }

    if (!ip.matches("^[a-fA-F0-9.:%]+$")) {
      response.put("error", "Invalid IP Address format");
      return ResponseEntity.badRequest().body(response);
    }

    if (!jail.matches("^[a-zA-Z0-9_-]+$")) {
      response.put("error", "Invalid Jail name format");
      return ResponseEntity.badRequest().body(response);
    }

    try {
      log.info("Sentinel: unbanning IP {} from jail {}", ip, jail);
      String output =
          systemMetrics.runCommand("sudo", "fail2ban-client", "set", jail, "unbanip", ip);
      log.info("Fail2ban unban output: {}", output);

      if (output.toLowerCase().contains("error") || output.toLowerCase().contains("fail")) {
        response.put("error", output);
        return ResponseEntity.internalServerError().body(response);
      }

      response.put("status", "SUCCESS");
      response.put("message", "IP " + ip + " unbanned from jail " + jail);
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      log.error("Failed to unban IP {}: {}", ip, e.getMessage(), e);
      response.put("error", e.getMessage());
      return ResponseEntity.internalServerError().body(response);
    }
  }
}
