package in.hutta.monitor.service;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class TrafficService {

  private final SystemMetricsService sys;

  private static final String LOG_PATH = "/var/log/apache2/access.log";
  private static final int SAMPLE_LINES = 5000;

  // Apache combined log format:
  // %h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-Agent}i"
  private static final Pattern LOG_PATTERN =
      Pattern.compile(
          "^(\\S+)\\s+\\S+\\s+\\S+\\s+\\[([^\\]]+)\\]\\s+"
              + "\"(\\S+)\\s+([^\"]*?)\\s+\\S+\"\\s+"
              + "(\\d{3})\\s+(\\S+)\\s+\"([^\"]*)\"\\s+\"([^\"]*)\"$");

  private static final DateTimeFormatter APACHE_FMT =
      DateTimeFormatter.ofPattern("dd/MMM/yyyy:HH:mm:ss Z", Locale.ENGLISH);

  @SuppressWarnings("null") // stream entries are filtered via Objects::nonNull before use
  public Map<String, Object> collect() {

    Map<String, Object> result = new LinkedHashMap<>();
    try {
      String raw = sys.runCommand("tail", "-n", String.valueOf(SAMPLE_LINES), LOG_PATH);
      if (raw == null || raw.isBlank()) {
        result.put("error", "Log file not readable — ensure rbpi user is in the adm group");
        result.put("readable", false);
        return result;
      }
      result.put("readable", true);

      List<LogEntry> entries =
          Arrays.stream(raw.split("\n"))
              .map(this::parseLine)
              .filter(Objects::nonNull)
              // Filter loopback self-monitoring traffic
              .filter(
                  e ->
                      !e.ip().equals("127.0.0.1")
                          && !e.ip().equals("::1")
                          && !e.path().startsWith("/api/sentinel"))
              .collect(Collectors.toList());

      ZonedDateTime now = ZonedDateTime.now();
      ZonedDateTime oneMinuteAgo = now.minusMinutes(1);

      // Requests/min (rolling last 60 seconds)
      long reqPerMin = entries.stream().filter(e -> e.timestamp().isAfter(oneMinuteAgo)).count();

      // Status code breakdown
      Map<String, Long> statusCounts = new LinkedHashMap<>();
      statusCounts.put(
          "2xx", entries.stream().filter(e -> e.status() >= 200 && e.status() < 300).count());
      statusCounts.put(
          "3xx", entries.stream().filter(e -> e.status() >= 300 && e.status() < 400).count());
      statusCounts.put(
          "4xx", entries.stream().filter(e -> e.status() >= 400 && e.status() < 500).count());
      statusCounts.put(
          "5xx", entries.stream().filter(e -> e.status() >= 500 && e.status() < 600).count());

      long total = entries.size();
      long errors = statusCounts.get("4xx") + statusCounts.get("5xx");
      double errorRate = total > 0 ? (errors * 100.0 / total) : 0;

      // Top 10 paths (strip query strings for grouping)
      List<Map<String, Object>> topPaths =
          entries.stream()
              .collect(Collectors.groupingBy(e -> stripQuery(e.path()), Collectors.counting()))
              .entrySet()
              .stream()
              .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
              .limit(10)
              .map(
                  e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("path", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                  })
              .collect(Collectors.toList());

      // Top 5 IPs
      List<Map<String, Object>> topIps =
          entries.stream()
              .collect(Collectors.groupingBy(LogEntry::ip, Collectors.counting()))
              .entrySet()
              .stream()
              .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
              .limit(5)
              .map(
                  e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("ip", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                  })
              .collect(Collectors.toList());

      // Hourly request count for last 24 hours
      List<Map<String, Object>> hourlyData = new ArrayList<>();
      for (int i = 23; i >= 0; i--) {
        ZonedDateTime hourStart = now.minusHours(i + 1).truncatedTo(ChronoUnit.HOURS);
        ZonedDateTime hourEnd = now.minusHours(i).truncatedTo(ChronoUnit.HOURS);
        long count =
            entries.stream()
                .filter(e -> !e.timestamp().isBefore(hourStart) && e.timestamp().isBefore(hourEnd))
                .count();
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("hour", String.format("%02d:00", hourStart.getHour()));
        h.put("count", count);
        hourlyData.add(h);
      }

      // Recent 50 requests (newest first)
      List<Map<String, Object>> recent =
          entries.stream()
              .sorted(Comparator.comparing(LogEntry::timestamp).reversed())
              .limit(50)
              .map(
                  e -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("ip", e.ip());
                    r.put("method", e.method());
                    r.put("path", e.path());
                    r.put("status", e.status());
                    r.put("bytes", e.bytes());
                    r.put("timestamp", e.timestamp().toInstant().toString());
                    r.put("client", summarizeAgent(e.userAgent()));
                    return r;
                  })
              .collect(Collectors.toList());

      result.put("requestsPerMinute", reqPerMin);
      result.put("totalSampled", total);
      result.put("errorRate", Math.round(errorRate * 10.0) / 10.0);
      result.put("statusCounts", statusCounts);
      result.put("topPaths", topPaths);
      result.put("topIps", topIps);
      result.put("hourlyRequests", hourlyData);
      result.put("recentRequests", recent);

    } catch (Exception e) {
      log.warn("Failed to collect traffic data: {}", e.getMessage());
      result.put("error", e.getMessage());
      result.put("readable", false);
    }
    return result;
  }

  private LogEntry parseLine(String line) {
    if (line == null || line.isBlank()) return null;
    Matcher m = LOG_PATTERN.matcher(line.trim());
    if (!m.matches()) return null;
    try {
      String ip = m.group(1);
      ZonedDateTime ts = ZonedDateTime.parse(m.group(2), APACHE_FMT);
      String method = m.group(3);
      String path = m.group(4);
      int status = Integer.parseInt(m.group(5));
      long bytes = "-".equals(m.group(6)) ? 0L : Long.parseLong(m.group(6));
      String ua = m.group(8);
      return new LogEntry(ip, ts, method, path, status, bytes, ua);
    } catch (Exception e) {
      return null;
    }
  }

  private String stripQuery(String path) {
    int q = path.indexOf('?');
    return q >= 0 ? path.substring(0, q) : path;
  }

  private String summarizeAgent(String ua) {
    if (ua == null || ua.isBlank() || "-".equals(ua)) return "Unknown";
    String u = ua.toLowerCase(Locale.ENGLISH);
    if (u.contains("curl")) return "curl";
    if (u.contains("python")) return "Python";
    if (u.contains("go-http")) return "Go";
    if (u.contains("bot") || u.contains("crawler") || u.contains("spider")) return "Bot";
    if (u.contains("mobile") || u.contains("android") || u.contains("iphone")) return "Mobile";
    if (u.contains("chrome")) return "Chrome";
    if (u.contains("firefox")) return "Firefox";
    if (u.contains("safari")) return "Safari";
    return "Other";
  }

  record LogEntry(
      String ip,
      ZonedDateTime timestamp,
      String method,
      String path,
      int status,
      long bytes,
      String userAgent) {}
}
