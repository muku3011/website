package in.hutta.monitor.service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class BackupMonitorService {

  private static final String STATUS_PATH = "/var/backups/postgresql/backup_status.json";

  public Map<String, Object> collect() {
    Map<String, Object> result = new LinkedHashMap<>();
    File file = new File(STATUS_PATH);

    if (!file.exists()) {
      result.put("configured", false);
      result.put("status", "UNKNOWN");
      result.put(
          "error", "backup_status.json not found — daily backup script has not executed yet");
      return result;
    }

    try {
      String json = new String(Files.readAllBytes(Paths.get(STATUS_PATH))).trim();

      result.put("configured", true);
      result.put("status", extractJsonField(json, "status", "UNKNOWN"));
      result.put("error", extractJsonField(json, "error", ""));
      result.put("startedAt", extractJsonField(json, "startedAt", ""));
      result.put("completedAt", extractJsonField(json, "completedAt", ""));

      String sizeStr = extractJsonFieldNumeric(json, "totalSize", "0");
      result.put("totalSize", Long.parseLong(sizeStr));

      // Parse files list
      List<String> files = new ArrayList<>();
      Pattern filesPattern = Pattern.compile("\"([^\"]+\\.dump)\"");
      Matcher m = filesPattern.matcher(json);
      while (m.find()) {
        files.add(m.group(1));
      }
      result.put("files", files);

    } catch (Exception e) {
      log.warn("Failed to read backup status file: {}", e.getMessage());
      result.put("configured", true);
      result.put("status", "ERROR");
      result.put("error", "Failed to parse backup metadata: " + e.getMessage());
    }

    return result;
  }

  private String extractJsonField(String json, String field, String defaultValue) {
    Pattern p = Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]*)\"");
    Matcher m = p.matcher(json);
    if (m.find()) {
      return m.group(1);
    }
    return defaultValue;
  }

  private String extractJsonFieldNumeric(String json, String field, String defaultValue) {
    Pattern p = Pattern.compile("\"" + field + "\"\\s*:\\s*(\\d+)");
    Matcher m = p.matcher(json);
    if (m.find()) {
      return m.group(1);
    }
    return defaultValue;
  }
}
