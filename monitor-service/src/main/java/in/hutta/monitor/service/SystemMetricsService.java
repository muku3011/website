package in.hutta.monitor.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class SystemMetricsService {

  public Map<String, Object> collect() {
    Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("uptime", runCommand("uptime", "-p"));
    metrics.put("loadAvg", loadAverage());
    metrics.put("cpu", cpuUsage());
    metrics.put("memory", memoryMetrics());
    metrics.put("disk", diskMetrics());
    metrics.put("cpuTempCelsius", cpuTemperature());
    return metrics;
  }

  private Map<String, Object> loadAverage() {
    Map<String, Object> load = new LinkedHashMap<>();
    try {
      String raw = Files.readString(Paths.get("/proc/loadavg")).trim();
      String[] parts = raw.split("\\s+");
      load.put("oneMin", Double.parseDouble(parts[0]));
      load.put("fiveMin", Double.parseDouble(parts[1]));
      load.put("fifteenMin", Double.parseDouble(parts[2]));
    } catch (Exception e) {
      log.warn("Could not read /proc/loadavg: {}", e.getMessage());
    }
    return load;
  }

  private double cpuUsage() {
    try {
      String result =
          runCommand(
              "bash",
              "-c",
              "top -bn1 | grep 'Cpu(s)' | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk '{print 100 - $1}'");
      return Double.parseDouble(result.trim());
    } catch (Exception e) {
      log.warn("Could not measure CPU usage: {}", e.getMessage());
      return 0.0;
    }
  }

  private Map<String, Object> memoryMetrics() {
    Map<String, Object> mem = new LinkedHashMap<>();
    try {
      String result = runCommand("bash", "-c", "free -m | awk '/Mem:/ {print $2, $3}'");
      String[] parts = result.trim().split("\\s+");
      long total = Long.parseLong(parts[0]);
      long used = Long.parseLong(parts[1]);
      mem.put("totalMb", total);
      mem.put("usedMb", used);
      mem.put("percent", total > 0 ? (int) (used * 100L / total) : 0);
    } catch (Exception e) {
      log.warn("Could not read memory metrics: {}", e.getMessage());
    }
    return mem;
  }

  private Map<String, Object> diskMetrics() {
    Map<String, Object> disk = new LinkedHashMap<>();
    try {
      String result = runCommand("bash", "-c", "df / | awk 'NR==2 {print $2, $3, $4, $5}'");
      String[] parts = result.trim().split("\\s+");
      disk.put("totalKb", Long.parseLong(parts[0]));
      disk.put("usedKb", Long.parseLong(parts[1]));
      disk.put("freeKb", Long.parseLong(parts[2]));
      disk.put("percent", Integer.parseInt(parts[3].replace("%", "")));
    } catch (Exception e) {
      log.warn("Could not read disk metrics: {}", e.getMessage());
    }
    return disk;
  }

  private double cpuTemperature() {
    try {
      String raw = Files.readString(Paths.get("/sys/class/thermal/thermal_zone0/temp")).trim();
      return Double.parseDouble(raw) / 1000.0;
    } catch (Exception e) {
      return -1.0;
    }
  }

  public String runCommand(String... cmd) {
    try {
      ProcessBuilder pb = new ProcessBuilder(cmd);
      pb.redirectErrorStream(true);
      Process p = pb.start();
      try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
        return br.lines().collect(Collectors.joining("\n")).trim();
      }
    } catch (Exception e) {
      log.warn("Command failed {}: {}", String.join(" ", cmd), e.getMessage());
      return "";
    }
  }
}
