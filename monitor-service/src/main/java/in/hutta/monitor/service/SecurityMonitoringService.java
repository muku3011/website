package in.hutta.monitor.service;

import in.hutta.monitor.model.SecurityIncident;
import in.hutta.monitor.repository.SecurityIncidentRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class SecurityMonitoringService {

  private final SystemMetricsService sys;
  private final SecurityIncidentRepository repository;
  private final NtfyService ntfy;

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

  private static final Pattern SSH_PATTERN =
      Pattern.compile(
          "^(\\S+) \\S+ sshd\\[\\d+\\]: Failed password for (?:invalid user )?(\\S+) from (\\S+) port (\\d+)",
          Pattern.MULTILINE);

  private static final Pattern FAIL2BAN_PATTERN =
      Pattern.compile(
          "^(\\S+) \\S+ fail2ban\\.actions\\[\\d+\\]: WARNING \\[([^\\s\\]]+)\\] (Ban|Unban) (\\S+)",
          Pattern.MULTILINE);

  @Scheduled(fixedDelay = 30_000)
  public void monitorLogFiles() {
    log.debug("Running security logs parser scheduled scan...");
    try {
      parseSshLogs();
      parseFail2banLogs();
    } catch (Exception e) {
      log.error("Error running security logs scan: {}", e.getMessage(), e);
    }
  }

  private void parseSshLogs() {
    // Check sshd logs from systemd journal in the last 15 minutes
    String output =
        sys.runCommand(
            "bash",
            "-c",
            "journalctl _SYSTEMD_UNIT=ssh.service --since '15 minutes ago' --output=short-iso --no-pager 2>/dev/null || true");

    if (output == null || output.isBlank()) {
      return;
    }

    Matcher matcher = SSH_PATTERN.matcher(output);
    while (matcher.find()) {
      String timeStr = matcher.group(1);
      String username = matcher.group(2);
      String ip = matcher.group(3);

      try {
        Instant timestamp = Instant.parse(timeStr);
        // Check if we already logged this failed attempt
        if (repository
            .findFirstByIpAddressAndUsernameAndIncidentTypeOrderByTimestampDesc(
                ip, username, "SSH_FAILED")
            .filter(
                existing ->
                    Math.abs(existing.getTimestamp().getEpochSecond() - timestamp.getEpochSecond())
                        < 5)
            .isPresent()) {
          continue; // Already processed
        }

        // Fetch Location
        GeoInfo geo = getGeoInfo(ip);

        SecurityIncident incident = new SecurityIncident();
        incident.setIpAddress(ip);
        incident.setUsername(username);
        incident.setIncidentType("SSH_FAILED");
        incident.setAttemptCount(1);
        incident.setCountry(geo.country);
        incident.setCountryCode(geo.countryCode);
        incident.setCity(geo.city);
        incident.setDetails("SSH login failed for user '" + username + "' from IP " + ip);
        incident.setTimestamp(timestamp);
        incident.setBlocked(false);

        repository.save(incident);
        log.info("Logged SSH failed login from IP {} for user {}", ip, username);
      } catch (Exception e) {
        log.warn("Error parsing SSH log line: {}", e.getMessage());
      }
    }
  }

  private void parseFail2banLogs() {
    // Check fail2ban logs from systemd journal in the last 15 minutes
    String output =
        sys.runCommand(
            "bash",
            "-c",
            "journalctl _SYSTEMD_UNIT=fail2ban.service --since '15 minutes ago' --output=short-iso --no-pager 2>/dev/null || true");

    if (output == null || output.isBlank()) {
      return;
    }

    Matcher matcher = FAIL2BAN_PATTERN.matcher(output);
    while (matcher.find()) {
      String timeStr = matcher.group(1);
      String jail = matcher.group(2);
      String action = matcher.group(3); // Ban or Unban
      String ip = matcher.group(4);
      String type = "Ban".equalsIgnoreCase(action) ? "FAIL2BAN_BAN" : "FAIL2BAN_UNBAN";

      try {
        Instant timestamp = Instant.parse(timeStr);
        // Check if we already logged this action
        if (repository
            .findFirstByIpAddressAndUsernameAndIncidentTypeOrderByTimestampDesc(ip, "", type)
            .filter(
                existing ->
                    Math.abs(existing.getTimestamp().getEpochSecond() - timestamp.getEpochSecond())
                        < 5)
            .isPresent()) {
          continue; // Already processed
        }

        GeoInfo geo = getGeoInfo(ip);

        SecurityIncident incident = new SecurityIncident();
        incident.setIpAddress(ip);
        incident.setUsername("");
        incident.setIncidentType(type);
        incident.setAttemptCount(1);
        incident.setCountry(geo.country);
        incident.setCountryCode(geo.countryCode);
        incident.setCity(geo.city);
        incident.setDetails(
            "Fail2ban " + action.toLowerCase() + "ned IP " + ip + " in jail [" + jail + "]");
        incident.setTimestamp(timestamp);
        incident.setBlocked("FAIL2BAN_BAN".equals(type));

        repository.save(incident);
        log.warn(
            "Logged Fail2ban security incident: IP {} was {} in jail {}",
            ip,
            action.toLowerCase() + "ned",
            jail);

        // Fire dynamic push alert via ntfy on active Ban
        if ("FAIL2BAN_BAN".equals(type)) {
          String alertTitle = "🚨 Security Incident: IP Banned";
          String alertMsg =
              String.format(
                  "IP address %s (%s, %s) was banned by Fail2ban in jail [%s] due to suspicious activity.",
                  ip, geo.country, geo.city, jail);
          ntfy.send(alertTitle, alertMsg, "high", "rotating_light,shield");
        }
      } catch (Exception e) {
        log.warn("Error parsing Fail2ban log line: {}", e.getMessage());
      }
    }
  }

  private GeoInfo getGeoInfo(String ip) {
    GeoInfo info = new GeoInfo();
    // Return default offline fallback for local network IPs
    if (ip.startsWith("192.168.")
        || ip.startsWith("10.")
        || ip.startsWith("172.16.")
        || ip.startsWith("172.31.")
        || "127.0.0.1".equals(ip)
        || "localhost".equals(ip)) {
      info.country = "Local Network";
      info.countryCode = "LOCAL";
      info.city = "LAN";
      return info;
    }

    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create("https://freeipapi.com/api/json/" + ip))
              .timeout(Duration.ofSeconds(3))
              .GET()
              .build();
      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        String json = response.body();
        info.country = extractJsonField(json, "countryName");
        info.countryCode = extractJsonField(json, "countryCode");
        info.city = extractJsonField(json, "cityName");
      }
    } catch (Exception e) {
      log.debug("GeoIP lookup failed for IP {}: {}", ip, e.getMessage());
    }

    if (info.country == null || info.country.isBlank()) {
      info.country = "Unknown Country";
    }
    if (info.countryCode == null || info.countryCode.isBlank()) {
      info.countryCode = "UN";
    }
    if (info.city == null || info.city.isBlank()) {
      info.city = "Unknown City";
    }

    return info;
  }

  private String extractJsonField(String json, String field) {
    Pattern pattern = Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]*)\"");
    Matcher matcher = pattern.matcher(json);
    if (matcher.find()) {
      return matcher.group(1);
    }
    return null;
  }

  private static class GeoInfo {
    String country = "Unknown Country";
    String countryCode = "UN";
    String city = "Unknown City";
  }
}
