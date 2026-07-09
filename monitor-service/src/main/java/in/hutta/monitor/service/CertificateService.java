package in.hutta.monitor.service;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class CertificateService {

  private final SystemMetricsService sys;

  // Let's Encrypt covers both hutta.in and auth.hutta.in with the same cert bundle
  private static final List<String> DOMAINS = List.of("hutta.in", "auth.hutta.in");
  private static final String CERT_PATH = "/etc/letsencrypt/live/hutta.in/fullchain.pem";
  // RFC 2459 date format used by openssl
  private static final DateTimeFormatter OPENSSL_FMT =
      DateTimeFormatter.ofPattern("MMM d HH:mm:ss yyyy z", Locale.ENGLISH);

  public List<Map<String, Object>> collect() {
    return DOMAINS.stream().map(this::checkDomain).toList();
  }

  private Map<String, Object> checkDomain(String domain) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("domain", domain);
    try {
      String raw = sys.runCommand("openssl", "x509", "-enddate", "-noout", "-in", CERT_PATH);
      // raw: "notAfter=Sep 15 12:00:00 2025 GMT"
      String dateStr = raw.replace("notAfter=", "").trim();
      ZonedDateTime expiry = ZonedDateTime.parse(dateStr, OPENSSL_FMT);
      long daysLeft = ChronoUnit.DAYS.between(Instant.now(), expiry.toInstant());
      result.put("expiresAt", expiry.toInstant().toString());
      result.put("daysLeft", daysLeft);
      result.put("certPath", CERT_PATH);
      result.put("ok", daysLeft > 0);
    } catch (Exception e) {
      log.warn("Could not read certificate for {}: {}", domain, e.getMessage());
      result.put("daysLeft", -1);
      result.put("ok", false);
      result.put("error", e.getMessage());
    }
    // Certbot renewal cron check
    result.put("certbotCronExists", certbotCronExists());
    return result;
  }

  private boolean certbotCronExists() {
    try {
      String cron =
          sys.runCommand(
              "bash",
              "-c",
              "cat /etc/cron.d/certbot 2>/dev/null || crontab -l 2>/dev/null | grep -i certbot || echo ''");
      return !cron.isBlank();
    } catch (Exception e) {
      return false;
    }
  }
}
