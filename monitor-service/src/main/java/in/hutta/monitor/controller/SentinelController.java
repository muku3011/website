package in.hutta.monitor.controller;

import in.hutta.monitor.repository.SecurityIncidentRepository;
import in.hutta.monitor.service.*;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sentinel")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SentinelController {

  private final SystemMetricsService systemMetrics;
  private final ServiceStatusService serviceStatus;
  private final DatabaseStatusService databaseStatus;
  private final SecurityMetricsService securityMetrics;
  private final CertificateService certificateService;
  private final DnsService dnsService;
  private final SecurityIncidentRepository securityIncidentRepository;

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
}
