package in.hutta.monitor.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ServiceStatusService {

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

  record ServiceDef(String name, String unit, int port, String healthPath) {}

  private static final List<ServiceDef> SERVICES =
      List.of(
          new ServiceDef("smdp-plus", "smdp-plus", 8092, "/actuator/health"),
          new ServiceDef("lpa-simulator", "lpa-simulator", 8093, "/actuator/health"),
          new ServiceDef("blog-service", "blog-service", 8094, "/actuator/health"),
          new ServiceDef("monitor-service", "monitor-service", 8095, "/actuator/health"),
          new ServiceDef(
              "keycloak", "keycloak", 8080, "/realms/hutta/.well-known/openid-configuration"),
          new ServiceDef("apache2", "apache2", 443, null),
          new ServiceDef("postgresql", "postgresql", 5432, null));

  public List<Map<String, Object>> collect() {
    return SERVICES.stream().map(this::checkService).toList();
  }

  private Map<String, Object> checkService(ServiceDef svc) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", svc.name());
    result.put("port", svc.port());

    // systemd check
    String systemdStatus = runSystemctl(svc.unit());
    result.put("systemdStatus", systemdStatus);
    result.put("active", "active".equals(systemdStatus));

    // HTTP health check (if applicable)
    if (svc.healthPath() != null) {
      int httpStatus = httpCheck("http://127.0.0.1:" + svc.port() + svc.healthPath());
      result.put("httpStatus", httpStatus);
      result.put("httpOk", httpStatus >= 200 && httpStatus < 400);
    }
    return result;
  }

  private String runSystemctl(String unit) {
    try {
      ProcessBuilder pb = new ProcessBuilder("systemctl", "is-active", unit);
      Process p = pb.start();
      p.waitFor();
      return new String(p.getInputStream().readAllBytes()).trim();
    } catch (Exception e) {
      return "unknown";
    }
  }

  private int httpCheck(String url) {
    try {
      HttpRequest req =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(Duration.ofSeconds(3))
              .GET()
              .build();
      HttpResponse<Void> resp = HTTP.send(req, HttpResponse.BodyHandlers.discarding());
      return resp.statusCode();
    } catch (Exception e) {
      return 0;
    }
  }
}
