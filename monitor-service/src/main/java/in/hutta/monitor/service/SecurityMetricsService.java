package in.hutta.monitor.service;

import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class SecurityMetricsService {

  private final SystemMetricsService sys;

  public Map<String, Object> collect() {
    Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("ufwActive", isUfwActive());
    metrics.put("fail2banActive", isServiceActive("fail2ban"));
    metrics.put("unattendedUpgradesActive", isServiceActive("unattended-upgrades"));
    metrics.put("sshFailures24h", countSshFailures());
    metrics.put("fail2banBannedIps", countBannedIps());
    metrics.put("lastAutoUpgrade", lastAutoUpgrade());

    // Hardening metrics
    metrics.put("sshPasswordAuthDisabled", checkSshSetting("passwordauthentication no"));
    metrics.put("sshRootLoginDisabled", checkSshSetting("permitrootlogin no"));
    metrics.put("apacheSecurityHeadersActive", checkApacheHeadersConf());
    metrics.put("kernelHardeningActive", checkKernelHardening());
    return metrics;
  }

  private boolean isUfwActive() {
    try {
      String result = sys.runCommand("bash", "-c", "sudo ufw status | head -1");
      return result.contains("Status: active");
    } catch (Exception e) {
      return false;
    }
  }

  private boolean isServiceActive(String unit) {
    try {
      ProcessBuilder pb = new ProcessBuilder("systemctl", "is-active", unit);
      Process p = pb.start();
      p.waitFor();
      return "active".equals(new String(p.getInputStream().readAllBytes()).trim());
    } catch (Exception e) {
      return false;
    }
  }

  private int countSshFailures() {
    try {
      String result =
          sys.runCommand(
              "bash",
              "-c",
              "journalctl _SYSTEMD_UNIT=ssh.service --since '24 hours ago' 2>/dev/null | grep -c 'Failed password' || echo 0");
      return Integer.parseInt(result.trim());
    } catch (Exception e) {
      return 0;
    }
  }

  private int countBannedIps() {
    try {
      String result =
          sys.runCommand(
              "bash",
              "-c",
              "sudo fail2ban-client status sshd 2>/dev/null | grep 'Currently banned' | awk '{print $NF}' || echo 0");
      return Integer.parseInt(result.trim());
    } catch (Exception e) {
      return 0;
    }
  }

  private String lastAutoUpgrade() {
    try {
      String result =
          sys.runCommand(
              "bash",
              "-c",
              "tail -n 20 /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null | grep 'Packages that will be upgraded' | tail -1 || echo 'No recent log entry'");
      return result.isBlank() ? "No recent log entry" : result.trim();
    } catch (Exception e) {
      return "Unavailable";
    }
  }

  private boolean checkSshSetting(String settingPattern) {
    try {
      String result =
          sys.runCommand(
              "bash", "-c", "sudo sshd -T 2>/dev/null | grep -i '" + settingPattern + "' || true");
      return !result.isBlank();
    } catch (Exception e) {
      return false;
    }
  }

  private boolean checkApacheHeadersConf() {
    try {
      // Check if Apache security-headers conf is enabled
      String result =
          sys.runCommand(
              "bash",
              "-c",
              "[ -f /etc/apache2/conf-enabled/security-headers.conf ] && echo 'enabled' || true");
      return "enabled".equals(result.trim());
    } catch (Exception e) {
      return false;
    }
  }

  private boolean checkKernelHardening() {
    try {
      // Check active rp_filter value (should be 1 for hardened status)
      String result =
          sys.runCommand(
              "bash",
              "-c",
              "sysctl net.ipv4.conf.all.rp_filter 2>/dev/null | awk '{print $NF}' || echo 0");
      return "1".equals(result.trim());
    } catch (Exception e) {
      return false;
    }
  }
}
