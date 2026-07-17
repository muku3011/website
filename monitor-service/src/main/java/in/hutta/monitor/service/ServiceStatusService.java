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
          new ServiceDef("device-simulator-lpa", "device-simulator", 8093, "/actuator/health"),
          new ServiceDef("device-simulator-ipa", "device-simulator", 8097, "/ipa/status"),
          new ServiceDef("eim-service", "eim-service", 8096, "/actuator/health"),
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

    // Version detection
    String version = "unknown";
    if ("active".equals(systemdStatus)) {
      if ("postgresql".equals(svc.name())) {
        version = getPostgresVersion();
      } else if ("apache2".equals(svc.name())) {
        version = getApacheVersion();
      } else if ("keycloak".equals(svc.name())) {
        version = getKeycloakVersion();
      } else {
        version = getCustomServiceVersion(svc.name());
      }
    } else {
      // If service is inactive, we can still try to get the version from files
      if ("postgresql".equals(svc.name())) {
        version = getPostgresVersion();
      } else if ("apache2".equals(svc.name())) {
        version = getApacheVersion();
      } else if ("keycloak".equals(svc.name())) {
        version = getKeycloakVersion();
      } else {
        version = getCustomServiceVersion(svc.name());
      }
    }
    result.put("version", version);

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

  private String runCommand(String... cmd) {
    try {
      ProcessBuilder pb = new ProcessBuilder(cmd);
      Process p = pb.start();
      p.waitFor();
      return new String(p.getInputStream().readAllBytes()).trim();
    } catch (Exception e) {
      return "";
    }
  }

  private String getPostgresVersion() {
    String output = runCommand("pg_config", "--version");
    if (output.startsWith("PostgreSQL ")) {
      String ver = output.substring("PostgreSQL ".length()).trim();
      int spaceIdx = ver.indexOf(' ');
      if (spaceIdx > 0) {
        return ver.substring(0, spaceIdx);
      }
      return ver;
    }
    return output.isEmpty() ? "unknown" : output;
  }

  private String getApacheVersion() {
    String output = runCommand("/usr/sbin/apache2", "-v");
    for (String line : output.split("\n")) {
      if (line.startsWith("Server version:")) {
        String ver = line.substring("Server version:".length()).trim();
        if (ver.startsWith("Apache/")) {
          return ver.substring("Apache/".length());
        }
        return ver;
      }
    }
    return "unknown";
  }

  private String getKeycloakVersion() {
    try {
      java.io.File dir = new java.io.File("/opt/keycloak/lib/lib/main");
      if (dir.exists() && dir.isDirectory()) {
        java.io.File[] files =
            dir.listFiles(
                (d, name) ->
                    name.startsWith("org.keycloak.keycloak-core-") && name.endsWith(".jar"));
        if (files != null && files.length > 0) {
          String name = files[0].getName();
          java.util.regex.Pattern p =
              java.util.regex.Pattern.compile("org\\.keycloak\\.keycloak-core-(.+)\\.jar");
          java.util.regex.Matcher m = p.matcher(name);
          if (m.find()) {
            return m.group(1);
          }
        }
      }
    } catch (Exception e) {
      log.warn("Failed to detect Keycloak version: {}", e.getMessage());
    }
    return "unknown";
  }

  private String getCustomServiceVersion(String name) {
    String folderName = name;
    String jarBaseName = name;
    if (name.startsWith("device-simulator-")) {
      folderName = "device-simulator";
      jarBaseName = "device-simulator";
    }
    String jarPath = "/home/rbpi/" + folderName + "/" + jarBaseName + ".jar";
    java.io.File jarFile = new java.io.File(jarPath);
    if (!jarFile.exists()) {
      // Fallback for local development environment
      java.io.File localPom = new java.io.File("../" + folderName + "/pom.xml");
      if (localPom.exists()) {
        return "1.0.0-DEV";
      }
      return "unknown";
    }
    try (java.util.jar.JarFile jar = new java.util.jar.JarFile(jarFile)) {
      java.util.zip.ZipEntry entry =
          jar.getEntry("META-INF/maven/in.hutta/" + folderName + "/pom.properties");
      if (entry != null) {
        try (java.io.InputStream is = jar.getInputStream(entry)) {
          java.util.Properties props = new java.util.Properties();
          props.load(is);
          return props.getProperty("version", "unknown");
        }
      }
    } catch (Exception e) {
      // Ignore
    }
    return "unknown";
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
