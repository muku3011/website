package in.hutta.monitor.service;

import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
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

  public List<Map<String, Object>> collect() {
    return DOMAINS.stream().map(this::checkDomain).toList();
  }

  /**
   * Reads the TLS certificate for the given domain via a live SSL handshake using Java's built-in
   * SSL API. This approach requires no file-system access and is unaffected by Let's Encrypt
   * directory permissions.
   */
  private Map<String, Object> checkDomain(String domain) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("domain", domain);
    try {
      SSLSocketFactory factory = SSLContext.getDefault().getSocketFactory();
      // Connect directly to localhost on port 443 via SNI — avoids DNS and external network calls
      try (SSLSocket socket = (SSLSocket) factory.createSocket("127.0.0.1", 443)) {
        socket.setSoTimeout(5000);
        // Enable SNI so the server serves the right certificate for this domain
        socket.setSSLParameters(((SSLSocket) factory.createSocket()).getSSLParameters());
        var params = socket.getSSLParameters();
        params.setServerNames(List.of(new javax.net.ssl.SNIHostName(domain)));
        socket.setSSLParameters(params);
        socket.startHandshake();

        Certificate[] certs = socket.getSession().getPeerCertificates();
        if (certs == null || certs.length == 0) {
          throw new RuntimeException("No certificates returned from TLS handshake");
        }

        X509Certificate leaf = (X509Certificate) certs[0];
        Instant expiry = leaf.getNotAfter().toInstant();
        long daysLeft = ChronoUnit.DAYS.between(Instant.now(), expiry);

        result.put("expiresAt", expiry.toString());
        result.put("daysLeft", daysLeft);
        result.put("certPath", CERT_PATH);
        result.put("ok", daysLeft > 0);
      }
    } catch (Exception e) {
      log.warn("Could not read certificate for {}: {}", domain, e.getMessage());
      result.put("daysLeft", -1);
      result.put("ok", false);
      result.put("error", e.getMessage());
    }
    // Certbot renewal cron / systemd timer check
    result.put("certbotCronExists", certbotCronExists());
    return result;
  }

  private boolean certbotCronExists() {
    try {
      String check =
          sys.runCommand(
              "bash",
              "-c",
              "cat /etc/cron.d/certbot 2>/dev/null || "
                  + "crontab -l 2>/dev/null | grep -i certbot || "
                  + "systemctl is-active certbot.timer 2>/dev/null | grep -x active || echo ''");
      return !check.isBlank();
    } catch (Exception e) {
      return false;
    }
  }
}
