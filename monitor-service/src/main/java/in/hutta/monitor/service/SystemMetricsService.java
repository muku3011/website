package in.hutta.monitor.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class SystemMetricsService {

  // Holds the previous /proc/stat snapshot for delta-based CPU calculation
  private long[] prevStatTotals = null;
  private long[] prevStatIdles = null;

  public Map<String, Object> collect() {
    Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("uptime", runCommand("uptime", "-p"));
    metrics.put("loadAvg", loadAverage());
    metrics.put("cpu", cpuMetrics());
    metrics.put("memory", memoryMetrics());
    metrics.put("disk", diskMetrics());
    metrics.put("cpuTempCelsius", cpuTemperature());
    metrics.put("processes", processMetrics());
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

  /**
   * Returns an enriched CPU metrics map containing: - overall usage % (delta between two /proc/stat
   * reads) - per-core usage % list - CPU model name - physical and logical core counts
   */
  private Map<String, Object> cpuMetrics() {
    Map<String, Object> cpu = new LinkedHashMap<>();
    try {
      List<String> statLines = Files.readAllLines(Paths.get("/proc/stat"));
      List<String> cpuLines =
          statLines.stream().filter(l -> l.startsWith("cpu")).collect(Collectors.toList());

      int coreCount = (int) cpuLines.stream().filter(l -> l.matches("cpu\\d+.*")).count();
      long[] totals = new long[cpuLines.size()];
      long[] idles = new long[cpuLines.size()];

      for (int i = 0; i < cpuLines.size(); i++) {
        long[] fields = parseStatLine(cpuLines.get(i));
        long total = Arrays.stream(fields).sum();
        long idle = fields.length > 3 ? fields[3] + (fields.length > 4 ? fields[4] : 0) : 0;
        totals[i] = total;
        idles[i] = idle;
      }

      // Calculate delta from previous snapshot
      double overallPct = 0;
      List<Double> corePcts = new ArrayList<>();

      if (prevStatTotals != null && prevStatTotals.length == totals.length) {
        for (int i = 0; i < totals.length; i++) {
          long dTotal = totals[i] - prevStatTotals[i];
          long dIdle = idles[i] - prevStatIdles[i];
          double pct =
              dTotal > 0 ? Math.max(0, Math.min(100, (1.0 - (double) dIdle / dTotal) * 100)) : 0;
          if (i == 0) {
            overallPct = pct;
          } else {
            corePcts.add(Math.round(pct * 10.0) / 10.0);
          }
        }
      }

      prevStatTotals = totals;
      prevStatIdles = idles;

      cpu.put("overall", Math.round(overallPct * 10.0) / 10.0);
      cpu.put("cores", corePcts);
      cpu.put("coreCount", coreCount);
      cpu.put("model", cpuModel());
    } catch (Exception e) {
      log.warn("Could not read CPU metrics: {}", e.getMessage());
      cpu.put("overall", 0.0);
      cpu.put("cores", List.of());
    }
    return cpu;
  }

  private long[] parseStatLine(String line) {
    String[] parts = line.trim().split("\\s+");
    long[] values = new long[parts.length - 1];
    for (int i = 1; i < parts.length; i++) {
      try {
        values[i - 1] = Long.parseLong(parts[i]);
      } catch (NumberFormatException ignored) {
      }
    }
    return values;
  }

  private String cpuModel() {
    try {
      return Files.lines(Paths.get("/proc/cpuinfo"))
          .filter(
              l -> l.startsWith("Model name") || l.startsWith("Hardware") || l.startsWith("Model"))
          .map(l -> l.replaceFirst(".*:\\s*", "").trim())
          .findFirst()
          .orElse("Unknown");
    } catch (Exception e) {
      return "Unknown";
    }
  }

  private Map<String, Object> processMetrics() {
    Map<String, Object> procs = new LinkedHashMap<>();
    try {
      // Total process count from /proc/loadavg (format: "...  running/total ...")
      String raw = Files.readString(Paths.get("/proc/loadavg")).trim();
      String[] parts = raw.split("\\s+");
      if (parts.length >= 4) {
        String[] counts = parts[3].split("/");
        procs.put("running", Integer.parseInt(counts[0]));
        procs.put("total", Integer.parseInt(counts[1]));
      }
    } catch (Exception e) {
      log.warn("Could not read process counts: {}", e.getMessage());
    }
    try {
      // Top 5 CPU-consuming processes via ps
      String psOut =
          runCommand(
              "bash",
              "-c",
              "ps -eo pid,user,pcpu,pmem,rss,args --sort=-pcpu --no-headers | head -5");
      List<Map<String, Object>> topProcs = new ArrayList<>();
      for (String line : psOut.split("\n")) {
        String trimmed = line.trim();
        if (trimmed.isEmpty()) continue;
        String[] cols = trimmed.split("\\s+", 6);
        if (cols.length >= 6) {
          Map<String, Object> p = new LinkedHashMap<>();
          p.put("pid", cols[0]);
          p.put("user", cols[1]);
          p.put("cpu", Double.parseDouble(cols[2]));
          p.put("mem", Double.parseDouble(cols[3]));
          double memoryMb = Double.parseDouble(cols[4]) / 1024.0;
          p.put("memoryMb", Math.round(memoryMb * 10.0) / 10.0);
          p.put("name", cleanCommandName(cols[5]));
          p.put("commandLine", cols[5]);
          topProcs.add(p);
        }
      }
      procs.put("top", topProcs);
    } catch (Exception e) {
      log.warn("Could not read top processes: {}", e.getMessage());
      procs.put("top", List.of());
    }
    return procs;
  }

  private String cleanCommandName(String args) {
    if (args == null || args.isEmpty()) {
      return "unknown";
    }
    // If it's a Java execution, find the jar name in arguments
    if (args.contains("java") && args.contains(".jar")) {
      String[] parts = args.split("\\s+");
      for (String part : parts) {
        if (part.endsWith(".jar")) {
          int slash = part.lastIndexOf('/');
          return slash >= 0 ? part.substring(slash + 1) : part;
        }
      }
    }
    // Otherwise, take the first token (the executable path) and get its basename
    String firstToken = args.split("\\s+")[0];
    int slash = firstToken.lastIndexOf('/');
    return slash >= 0 ? firstToken.substring(slash + 1) : firstToken;
  }

  private Map<String, Object> memoryMetrics() {
    Map<String, Object> mem = new LinkedHashMap<>();
    try {
      // Parse /proc/meminfo for detailed breakdown
      Map<String, Long> minfo = new LinkedHashMap<>();
      Files.lines(Paths.get("/proc/meminfo"))
          .forEach(
              line -> {
                String[] parts = line.split(":\\s*");
                if (parts.length == 2) {
                  try {
                    minfo.put(parts[0].trim(), Long.parseLong(parts[1].trim().split("\\s+")[0]));
                  } catch (NumberFormatException ignored) {
                  }
                }
              });
      long totalKb = minfo.getOrDefault("MemTotal", 0L);
      long freeKb = minfo.getOrDefault("MemFree", 0L);
      long buffersKb = minfo.getOrDefault("Buffers", 0L);
      long cachedKb = minfo.getOrDefault("Cached", 0L) + minfo.getOrDefault("SReclaimable", 0L);
      long usedKb = totalKb - freeKb - buffersKb - cachedKb;

      long totalMb = totalKb / 1024;
      long usedMb = usedKb / 1024;
      long buffersCacheMb = (buffersKb + cachedKb) / 1024;
      long freeMb = freeKb / 1024;

      mem.put("totalMb", totalMb);
      mem.put("usedMb", usedMb);
      mem.put("buffersCacheMb", buffersCacheMb);
      mem.put("freeMb", freeMb);
      mem.put("percent", totalMb > 0 ? (int) (usedMb * 100L / totalMb) : 0);

      // Swap
      long swapTotalKb = minfo.getOrDefault("SwapTotal", 0L);
      long swapFreeKb = minfo.getOrDefault("SwapFree", 0L);
      long swapUsedMb = (swapTotalKb - swapFreeKb) / 1024;
      long swapTotalMb = swapTotalKb / 1024;
      mem.put("swapUsedMb", swapUsedMb);
      mem.put("swapTotalMb", swapTotalMb);
      mem.put("swapPercent", swapTotalMb > 0 ? (int) (swapUsedMb * 100L / swapTotalMb) : 0);
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
