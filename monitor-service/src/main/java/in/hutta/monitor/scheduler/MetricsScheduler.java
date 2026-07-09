package in.hutta.monitor.scheduler;

import in.hutta.monitor.service.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class MetricsScheduler {

  private final SystemMetricsService systemMetrics;
  private final ServiceStatusService serviceStatus;
  private final DatabaseStatusService databaseStatus;
  private final CertificateService certificateService;
  private final DnsService dnsService;
  private final AlertRuleService alertRuleService;

  @Scheduled(fixedDelay = 60_000)
  public void collect() {
    log.debug("Running scheduled metrics collection...");
    try {
      Map<String, Object> snapshot = buildSnapshot();
      alertRuleService.evaluate(snapshot);
    } catch (Exception e) {
      log.error("Error during metrics collection: {}", e.getMessage(), e);
    }
  }

  /** Build a flat snapshot map keyed as "component.metric" for rule evaluation. */
  @SuppressWarnings("unchecked")
  private Map<String, Object> buildSnapshot() {
    Map<String, Object> snapshot = new HashMap<>();

    // System metrics
    Map<String, Object> sys = systemMetrics.collect();
    // cpu is now a Map with "overall", "cores", etc. — extract overall for alert evaluation
    Object cpuRaw = sys.get("cpu");
    if (cpuRaw instanceof Map<?, ?> cpuMap) {
      snapshot.put("system.cpu", cpuMap.get("overall"));
    } else {
      snapshot.put("system.cpu", cpuRaw);
    }
    snapshot.put("system.cpuTempCelsius", sys.get("cpuTempCelsius"));
    Map<String, Object> mem = (Map<String, Object>) sys.get("memory");
    if (mem != null) snapshot.put("system.mem_percent", mem.get("percent"));
    Map<String, Object> disk = (Map<String, Object>) sys.get("disk");
    if (disk != null) snapshot.put("system.disk_percent", disk.get("percent"));

    // Service statuses
    List<Map<String, Object>> services = serviceStatus.collect();
    for (Map<String, Object> svc : services) {
      String name = (String) svc.get("name");
      boolean active = Boolean.TRUE.equals(svc.get("active"));
      snapshot.put(name + ".service_status", active ? "active" : "inactive");
    }

    // Database statuses
    List<Map<String, Object>> dbs = databaseStatus.collect();
    for (Map<String, Object> db : dbs) {
      String name = (String) db.get("name");
      snapshot.put(name + ".connected", db.get("connected"));
    }

    // Certificates
    List<Map<String, Object>> certs = certificateService.collect();
    for (Map<String, Object> cert : certs) {
      String domain = (String) cert.get("domain");
      snapshot.put(domain + ".cert_days_left", cert.get("daysLeft"));
    }

    // DNS
    Map<String, Object> dns = dnsService.collect();
    List<Map<String, Object>> domains = (List<Map<String, Object>>) dns.get("domains");
    if (domains != null) {
      boolean anyMismatch = domains.stream().anyMatch(d -> !Boolean.TRUE.equals(d.get("matches")));
      snapshot.put("dns.dns_mismatch", String.valueOf(anyMismatch));
    }

    return snapshot;
  }
}
