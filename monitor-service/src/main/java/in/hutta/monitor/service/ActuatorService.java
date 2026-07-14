package in.hutta.monitor.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ActuatorService {

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

  private static final ObjectMapper MAPPER = new ObjectMapper();

  record ServiceDef(String name, int port) {}

  private static final List<ServiceDef> SERVICES =
      List.of(
          new ServiceDef("smdp-plus", 8092),
          new ServiceDef("lpa-simulator", 8093),
          new ServiceDef("blog-service", 8094),
          new ServiceDef("monitor-service", 8095));

  private static final List<String> METRICS =
      List.of(
          "jvm.memory.used",
          "jvm.memory.max",
          "jvm.threads.live",
          "jvm.threads.daemon",
          "jvm.gc.pause",
          "process.uptime",
          "hikaricp.connections.active",
          "hikaricp.connections.idle",
          "hikaricp.connections.max",
          "http.server.requests.active");

  public List<Map<String, Object>> collect() {
    List<Map<String, Object>> result = new ArrayList<>();
    for (ServiceDef svc : SERVICES) {
      result.add(collectService(svc));
    }
    return result;
  }

  private Map<String, Object> collectService(ServiceDef svc) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("name", svc.name());
    out.put("port", svc.port());

    String base = "http://127.0.0.1:" + svc.port() + "/actuator";

    // ── Health ──────────────────────────────────────────────────────────────
    try {
      JsonNode health = fetchJson(base + "/health");
      out.put("healthStatus", health.path("status").asText("UNKNOWN"));

      Map<String, String> components = new LinkedHashMap<>();
      JsonNode comps = health.path("components");
      if (comps.isObject()) {
        comps
            .fields()
            .forEachRemaining(
                e -> components.put(e.getKey(), e.getValue().path("status").asText()));
      }
      out.put("healthComponents", components);
    } catch (Exception e) {
      out.put("healthStatus", "UNREACHABLE");
      out.put("healthComponents", Map.of());
    }

    // ── Info ────────────────────────────────────────────────────────────────
    try {
      JsonNode info = fetchJson(base + "/info");
      Map<String, Object> infoMap = new LinkedHashMap<>();
      JsonNode java = info.path("java");
      if (!java.isMissingNode()) {
        infoMap.put("javaVersion", java.path("version").asText());
        infoMap.put("javaVendor", java.path("vendor").path("name").asText());
      }
      JsonNode os = info.path("os");
      if (!os.isMissingNode()) {
        infoMap.put("osName", os.path("name").asText());
        infoMap.put("osArch", os.path("arch").asText());
      }
      JsonNode build = info.path("build");
      if (!build.isMissingNode()) {
        infoMap.put("buildVersion", build.path("version").asText());
        infoMap.put("buildTime", build.path("time").asText());
      }
      out.put("info", infoMap);
    } catch (Exception e) {
      out.put("info", Map.of());
    }

    // ── Metrics ─────────────────────────────────────────────────────────────
    Map<String, Object> metrics = new LinkedHashMap<>();
    for (String metric : METRICS) {
      try {
        JsonNode m = fetchJson(base + "/metrics/" + metric);
        JsonNode measurements = m.path("measurements");
        if (measurements.isArray() && !measurements.isEmpty()) {
          metrics.put(metric, measurements.get(0).path("value").asDouble());
        }
      } catch (Exception e) {
        // metric not available on this service — skip silently
      }
    }

    double heapUsed = (double) metrics.getOrDefault("jvm.memory.used", 0.0);
    double heapMax = (double) metrics.getOrDefault("jvm.memory.max", 0.0);
    if (heapMax > 0) {
      metrics.put("heapUsedMb", Math.round(heapUsed / 1024 / 1024));
      metrics.put("heapMaxMb", Math.round(heapMax / 1024 / 1024));
      metrics.put("heapPercent", Math.round((heapUsed / heapMax) * 100.0));
    }

    double uptimeSec = (double) metrics.getOrDefault("process.uptime", 0.0);
    metrics.put("uptimeHuman", formatUptime((long) uptimeSec));

    out.put("metrics", metrics);
    return out;
  }

  private JsonNode fetchJson(String url) throws Exception {
    HttpRequest req =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(4))
            .header("Accept", "application/json")
            .GET()
            .build();
    HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
    return MAPPER.readTree(resp.body());
  }

  private String formatUptime(long seconds) {
    if (seconds < 60) return seconds + "s";
    long minutes = seconds / 60;
    if (minutes < 60) return minutes + "m " + (seconds % 60) + "s";
    long hours = minutes / 60;
    if (hours < 24) return hours + "h " + (minutes % 60) + "m";
    long days = hours / 24;
    return days + "d " + (hours % 24) + "h";
  }
}
