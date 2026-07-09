package in.hutta.monitor.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class DnsService {

  private final SystemMetricsService sys;

  private static final List<String> DOMAINS = List.of("hutta.in", "auth.hutta.in");
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  public Map<String, Object> collect() {
    Map<String, Object> result = new LinkedHashMap<>();
    String publicIp = fetchPublicIp();
    result.put("publicIp", publicIp);
    result.put("checkedAt", Instant.now().toString());
    result.put("ddnsCronExists", ddnsCronExists());
    result.put("domains", DOMAINS.stream().map(d -> checkDomain(d, publicIp)).toList());
    return result;
  }

  private String fetchPublicIp() {
    try {
      HttpRequest req =
          HttpRequest.newBuilder()
              .uri(URI.create("https://api.ipify.org"))
              .timeout(Duration.ofSeconds(5))
              .GET()
              .build();
      return HTTP.send(req, HttpResponse.BodyHandlers.ofString()).body().trim();
    } catch (Exception e) {
      log.warn("Could not fetch public IP: {}", e.getMessage());
      return "unavailable";
    }
  }

  private Map<String, Object> checkDomain(String domain, String publicIp) {
    Map<String, Object> d = new LinkedHashMap<>();
    d.put("domain", domain);
    try {
      String resolved = InetAddress.getByName(domain).getHostAddress();
      d.put("resolvedIp", resolved);
      d.put("matches", resolved.equals(publicIp));
    } catch (Exception e) {
      d.put("resolvedIp", "error");
      d.put("matches", false);
      d.put("error", e.getMessage());
    }
    return d;
  }

  private boolean ddnsCronExists() {
    try {
      String cron =
          sys.runCommand(
              "bash",
              "-c",
              "crontab -l 2>/dev/null | grep -iE 'ddns|dyndns|duckdns|noip|ip.*update' || echo ''");
      return !cron.isBlank();
    } catch (Exception e) {
      return false;
    }
  }
}
